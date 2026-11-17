/**
 * Cash-flow projection from real iva_claims rows.
 *
 * Assumption (from the product brief, not a legal deadline): the refund lands
 * REFUND_ETA_DAYS after the claim is filed. Claims not yet filed are projected as if they were
 * filed today. Override with the REFUND_ETA_DAYS environment variable.
 */
export const REFUND_ETA_DAYS = Number(process.env.REFUND_ETA_DAYS ?? 45)

export interface ClaimForForecast {
  amount_clp: number | string | null
  status: "draft" | "ready" | "filed" | "approved" | "paid"
  filed_at: string | null
}

export interface CashflowPoint {
  month: string
  /** CLP millions expected from claims already filed/approved. */
  expectedRefunds: number
  /** CLP millions from claims not filed yet, if filed today. */
  potentialRefunds: number
  /** CLP millions still locked after this month, counting filed claims only. */
  lockedCash: number
}

export interface CashflowProjection {
  points: CashflowPoint[]
  totalLockedClp: number
  filedClp: number
  unfiledClp: number
  overdueCount: number
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
const addDays = (d: Date, n: number) => new Date(utcDay(d) + n * 86_400_000)
const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth()
const label = (idx: number) => `${MONTHS[idx % 12]} ${String(Math.floor(idx / 12)).slice(2)}`

export function expectedRefundDate(claim: Pick<ClaimForForecast, "status" | "filed_at">, now = new Date()): Date {
  const filed = claim.status === "filed" || claim.status === "approved"
  const base = filed && claim.filed_at ? new Date(claim.filed_at) : now
  return addDays(base, REFUND_ETA_DAYS)
}

export function projectCashflow(claims: ClaimForForecast[], now = new Date(), minMonths = 4): CashflowProjection {
  const open = claims.filter((c) => c.status !== "paid")
  const nowIdx = monthIndex(now)

  let filedClp = 0
  let unfiledClp = 0
  let overdueCount = 0
  const rows = open.map((c) => {
    const amount = Number(c.amount_clp ?? 0)
    const isFiled = (c.status === "filed" || c.status === "approved") && !!c.filed_at
    const when = expectedRefundDate(c, now)
    const overdue = isFiled && utcDay(when) < utcDay(now)
    if (overdue) overdueCount += 1
    if (isFiled) filedClp += amount
    else unfiledClp += amount
    // overdue refunds are shown in the current month (they should land any day)
    const idx = overdue ? nowIdx : monthIndex(when)
    return { amount, isFiled, idx }
  })

  const lastIdx = Math.max(nowIdx + minMonths - 1, ...rows.map((r) => r.idx))
  const points: CashflowPoint[] = []
  let remaining = filedClp
  for (let idx = nowIdx; idx <= lastIdx; idx++) {
    const filedThisMonth = rows.filter((r) => r.isFiled && r.idx === idx).reduce((s, r) => s + r.amount, 0)
    const unfiledThisMonth = rows.filter((r) => !r.isFiled && r.idx === idx).reduce((s, r) => s + r.amount, 0)
    remaining -= filedThisMonth
    points.push({
      month: label(idx),
      expectedRefunds: filedThisMonth / 1_000_000,
      potentialRefunds: unfiledThisMonth / 1_000_000,
      lockedCash: (remaining + unfiledClp) / 1_000_000,
    })
  }

  return { points, totalLockedClp: filedClp + unfiledClp, filedClp, unfiledClp, overdueCount }
}
