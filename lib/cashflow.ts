/**
 * Cash-flow engine: turns IVA-exportador claims into a dated cash forecast, alerts and a
 * working-capital estimate. Pure functions - no I/O, no AI. Everything here is unit-tested.
 *
 * Assumption (planning, NOT an SII deadline): a refund lands REFUND_ETA_DAYS after the claim is
 * filed. Claims not filed yet are projected as if filed today. Claims blocked by the rules engine
 * are NOT projected as incoming cash (they cannot be filed) - they are reported as "stuck" money.
 */
export const REFUND_ETA_DAYS = Number(process.env.REFUND_ETA_DAYS ?? 45)

export type ClaimStatus = "draft" | "ready" | "filed" | "approved" | "paid"

export interface ClaimForForecast {
  amount_clp: number | string | null
  status: ClaimStatus
  filed_at: string | null
  /** true when the rules engine found an unresolved error: the claim cannot be filed yet. */
  blocked?: boolean
}

/** A row of the v_shipment_claims view. */
export interface ClaimView {
  claim_id: string
  shipment_id: string
  reference: string
  buyer: string
  claim_status: ClaimStatus
  amount_clp: number | string | null
  filed_at: string | null
  missing_docs?: string[] | null
  open_errors?: number | string | null
  source?: string | null
  shipment_date?: string | null
}

export interface CashflowPoint {
  month: string
  /** CLP millions expected from claims already filed/approved. */
  expectedRefunds: number
  /** CLP millions from claims that could be filed today (not blocked), if filed today. */
  potentialRefunds: number
  /** CLP millions still locked after this month (filed + fileable + blocked). */
  lockedCash: number
}

export interface CashflowProjection {
  points: CashflowPoint[]
  totalLockedClp: number
  filedClp: number
  /** Not filed and fileable. */
  unfiledClp: number
  /** Blocked by an unresolved rules-engine error: stuck until fixed. */
  blockedClp: number
  overdueCount: number
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
const addDays = (d: Date, n: number) => new Date(utcDay(d) + n * 86_400_000)
const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth()
const label = (idx: number) => `${MONTHS[idx % 12]} ${Math.floor(idx / 12)}`
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const num = (v: unknown) => Number(v ?? 0) || 0
const isFiledStatus = (s: ClaimStatus) => s === "filed" || s === "approved"

export function expectedRefundDate(claim: Pick<ClaimForForecast, "status" | "filed_at">, now = new Date()): Date {
  const base = isFiledStatus(claim.status) && claim.filed_at ? new Date(claim.filed_at) : now
  return addDays(base, REFUND_ETA_DAYS)
}

export function projectCashflow(claims: ClaimForForecast[], now = new Date(), minMonths = 4): CashflowProjection {
  const open = claims.filter((c) => c.status !== "paid")
  const nowIdx = monthIndex(now)

  let filedClp = 0
  let unfiledClp = 0
  let blockedClp = 0
  let overdueCount = 0
  const rows = open.map((c) => {
    const amount = num(c.amount_clp)
    const isFiled = isFiledStatus(c.status) && !!c.filed_at
    const blocked = !isFiled && !!c.blocked
    const when = expectedRefundDate(c, now)
    const overdue = isFiled && utcDay(when) < utcDay(now)
    if (overdue) overdueCount += 1
    if (isFiled) filedClp += amount
    else if (blocked) blockedClp += amount
    else unfiledClp += amount
    // overdue refunds are shown in the current month (they should land any day)
    const idx = overdue ? nowIdx : monthIndex(when)
    return { amount, isFiled, blocked, idx }
  })

  const lastIdx = Math.max(nowIdx + minMonths - 1, ...rows.filter((r) => !r.blocked).map((r) => r.idx))
  const points: CashflowPoint[] = []
  let remainingFiled = filedClp
  let remainingUnfiled = unfiledClp
  for (let idx = nowIdx; idx <= lastIdx; idx++) {
    const filedThisMonth = rows.filter((r) => r.isFiled && r.idx === idx).reduce((s, r) => s + r.amount, 0)
    const unfiledThisMonth = rows.filter((r) => !r.isFiled && !r.blocked && r.idx === idx).reduce((s, r) => s + r.amount, 0)
    remainingFiled -= filedThisMonth
    remainingUnfiled -= unfiledThisMonth
    points.push({
      month: label(idx),
      expectedRefunds: filedThisMonth / 1_000_000,
      potentialRefunds: unfiledThisMonth / 1_000_000,
      lockedCash: (remainingFiled + remainingUnfiled + blockedClp) / 1_000_000,
    })
  }

  return { points, totalLockedClp: filedClp + unfiledClp + blockedClp, filedClp, unfiledClp, blockedClp, overdueCount }
}

// ----------------------------------------------------------------------------- dated schedule

export interface Inflow {
  claimId: string
  shipmentId: string
  reference: string
  buyer: string
  amountClp: number
  status: ClaimStatus
  filed: boolean
  blocked: boolean
  /** YYYY-MM-DD. For blocked claims this is only "if it were filed today". */
  expectedDate: string
  daysUntil: number
  overdue: boolean
}

export const isBlocked = (r: Pick<ClaimView, "claim_status" | "open_errors">) =>
  !isFiledStatus(r.claim_status) && num(r.open_errors) > 0

export function inflowSchedule(rows: ClaimView[], now = new Date()): Inflow[] {
  return rows
    .filter((r) => r.claim_status !== "paid")
    .map((r) => {
      const filed = isFiledStatus(r.claim_status) && !!r.filed_at
      const when = expectedRefundDate({ status: r.claim_status, filed_at: r.filed_at }, now)
      const daysUntil = Math.round((utcDay(when) - utcDay(now)) / 86_400_000)
      return {
        claimId: r.claim_id,
        shipmentId: r.shipment_id,
        reference: r.reference,
        buyer: r.buyer,
        amountClp: num(r.amount_clp),
        status: r.claim_status,
        filed,
        blocked: isBlocked(r),
        expectedDate: isoDay(when),
        daysUntil,
        overdue: filed && daysUntil < 0,
      }
    })
    .sort((a, b) => Number(a.blocked) - Number(b.blocked) || a.daysUntil - b.daysUntil)
}

export interface CashWindows {
  /** Filed claims expected within N days (overdue ones count in every window: they can land any day). */
  filed30: number
  filed60: number
  filed90: number
  /** Fileable-but-not-filed claims: cash that starts its clock only when filed. */
  fileableClp: number
  blockedClp: number
}

export function cashWindows(schedule: Inflow[]): CashWindows {
  const within = (n: number) =>
    schedule.filter((i) => i.filed && i.daysUntil <= n).reduce((s, i) => s + i.amountClp, 0)
  return {
    filed30: within(30),
    filed60: within(60),
    filed90: within(90),
    fileableClp: schedule.filter((i) => !i.filed && !i.blocked).reduce((s, i) => s + i.amountClp, 0),
    blockedClp: schedule.filter((i) => i.blocked).reduce((s, i) => s + i.amountClp, 0),
  }
}

// ----------------------------------------------------------------------------- alerts

export type AlertLevel = "critical" | "warning" | "info"
export interface CashAlert {
  code: "REFUND_OVERDUE" | "CLAIM_BLOCKED" | "READY_NOT_FILED" | "CHECKS_NOT_RUN"
  level: AlertLevel
  title: string
  detail: string
  amountClp: number
  count: number
  href: string
}

const fmtClp = (v: number) => `CLP ${Math.round(v).toLocaleString("en-US")}`

/** Every alert is derived from claim rows by fixed rules. Nothing is generated by a model. */
export function buildAlerts(rows: ClaimView[], now = new Date()): CashAlert[] {
  const schedule = inflowSchedule(rows, now)
  const alerts: CashAlert[] = []

  const overdue = schedule.filter((i) => i.overdue)
  if (overdue.length > 0) {
    const oldest = Math.max(...overdue.map((i) => -i.daysUntil))
    alerts.push({
      code: "REFUND_OVERDUE",
      level: "critical",
      title: `${overdue.length} filed claim${overdue.length > 1 ? "s" : ""} past the ${REFUND_ETA_DAYS}-day estimate`,
      detail: `${fmtClp(overdue.reduce((s, i) => s + i.amountClp, 0))} should have landed already (oldest ${oldest} days late). Check the status with SII.`,
      amountClp: overdue.reduce((s, i) => s + i.amountClp, 0),
      count: overdue.length,
      href: "/iva",
    })
  }

  const blocked = schedule.filter((i) => i.blocked)
  if (blocked.length > 0) {
    alerts.push({
      code: "CLAIM_BLOCKED",
      level: "critical",
      title: `${blocked.length} claim${blocked.length > 1 ? "s" : ""} blocked by a failed check`,
      detail: `${fmtClp(blocked.reduce((s, i) => s + i.amountClp, 0))} cannot be filed until the error is fixed: ${blocked.map((i) => i.reference).join(", ")}.`,
      amountClp: blocked.reduce((s, i) => s + i.amountClp, 0),
      count: blocked.length,
      href: `/shipments/${blocked[0].shipmentId}`,
    })
  }

  const unchecked = rows.filter(
    (r) => r.claim_status === "draft" && r.source === "sii_demo" && num(r.open_errors) === 0 && (r.missing_docs?.length ?? 0) > 0
  )
  const readyToFile = schedule.filter((i) => !i.filed && !i.blocked && i.status === "ready")
  if (readyToFile.length > 0) {
    const sum = readyToFile.reduce((s, i) => s + i.amountClp, 0)
    alerts.push({
      code: "READY_NOT_FILED",
      level: "warning",
      title: `${readyToFile.length} claim${readyToFile.length > 1 ? "s" : ""} passed every check and can be filed now`,
      detail: `${fmtClp(sum)} starts its ${REFUND_ETA_DAYS}-day clock only when filed. Every day of delay moves the cash one day later.`,
      amountClp: sum,
      count: readyToFile.length,
      href: "/iva",
    })
  }

  if (unchecked.length > 0) {
    const sum = unchecked.reduce((s, r) => s + num(r.amount_clp), 0)
    alerts.push({
      code: "CHECKS_NOT_RUN",
      level: "info",
      title: `Rules engine has not checked ${unchecked.length} claim${unchecked.length > 1 ? "s" : ""}`,
      detail: `${fmtClp(sum)} is still in draft because the document checks have not run yet.`,
      amountClp: sum,
      count: unchecked.length,
      href: "/dashboard",
    })
  }

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level] || b.amountClp - a.amountClp)
}

// ----------------------------------------------------------------------------- working capital

export interface AdvanceInput {
  amountClp: number
  daysToRefund: number
  /** Share of the claim advanced, 0-1. */
  advanceRate: number
  /** Simple annual fee on the advanced amount, 0-1 (illustrative input, not a quote). */
  annualFeeRate: number
}

export interface AdvanceEstimate {
  advanceClp: number
  feeClp: number
  netTodayClp: number
  /** What the exporter still receives from SII after repaying the advance and the fee. */
  remainderAtRefundClp: number
  daysToRefund: number
}

export function estimateAdvance(i: AdvanceInput): AdvanceEstimate {
  const days = Math.max(0, Math.round(i.daysToRefund))
  const rate = Math.min(1, Math.max(0, i.advanceRate))
  const advance = Math.round(i.amountClp * rate)
  const fee = Math.round(advance * Math.max(0, i.annualFeeRate) * (days / 365))
  return {
    advanceClp: advance,
    feeClp: fee,
    netTodayClp: advance - fee,
    remainderAtRefundClp: i.amountClp - advance,
    daysToRefund: days,
  }
}
