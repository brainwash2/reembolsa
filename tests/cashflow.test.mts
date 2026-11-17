import assert from "node:assert/strict"
import { projectCashflow, inflowSchedule, cashWindows, buildAlerts, estimateAdvance, type ClaimView } from "../lib/cashflow.ts"

const now = new Date("2026-11-17T12:00:00Z")
const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
const row = (o: Partial<ClaimView> & { reference: string }): ClaimView => ({
  claim_id: "c-" + o.reference, shipment_id: "s-" + o.reference, buyer: "B " + o.reference,
  claim_status: "draft", amount_clp: 0, filed_at: null, missing_docs: [], open_errors: 0, source: "sii_demo", ...o,
})
// the demo's first batch: 2 filed (38d, 14d ago), 2 ready, 1 blocked by FOB mismatch
const rows: ClaimView[] = [
  row({ reference: "A", claim_status: "filed", filed_at: day(38), amount_clp: 7_942_000 }),
  row({ reference: "B", claim_status: "filed", filed_at: day(14), amount_clp: 4_807_000 }),
  row({ reference: "C", claim_status: "ready", amount_clp: 3_306_000 }),
  row({ reference: "D", claim_status: "ready", amount_clp: 5_643_000 }),
  row({ reference: "E", claim_status: "draft", amount_clp: 6_441_000, open_errors: 1 }),
]

const p = projectCashflow(rows.map((r) => ({ amount_clp: r.amount_clp, status: r.claim_status, filed_at: r.filed_at, blocked: Number(r.open_errors) > 0 })), now)
assert.equal(p.totalLockedClp, 28_139_000)
assert.equal(p.filedClp, 12_749_000)
assert.equal(p.unfiledClp, 8_949_000)
assert.equal(p.blockedClp, 6_441_000)
// blocked money never appears as incoming bars, but stays in the locked line until the end
const bars = p.points.reduce((s, x) => s + x.expectedRefunds + x.potentialRefunds, 0)
assert.ok(Math.abs(bars - 21.698) < 1e-9, String(bars))
assert.ok(Math.abs(p.points[p.points.length - 1].lockedCash - 6.441) < 1e-9)

const sched = inflowSchedule(rows, now)
assert.equal(sched[0].reference, "A")           // 38d ago + 45 = 7 days
assert.equal(sched[0].daysUntil, 7)
assert.equal(sched.at(-1)!.reference, "E")      // blocked sorts last
const w = cashWindows(sched)
assert.equal(w.filed30, 7_942_000)               // B lands in 31 days: outside the 30-day window
assert.equal(w.filed60, 12_749_000)
assert.equal(w.fileableClp, 8_949_000)
assert.equal(w.blockedClp, 6_441_000)

// alerts: blocked (critical), ready-to-file (warning); nothing overdue yet
let a = buildAlerts(rows, now)
assert.deepEqual(a.map((x) => x.code), ["CLAIM_BLOCKED", "READY_NOT_FILED"])
assert.equal(a[0].amountClp, 6_441_000)
// a filed claim 50 days ago is overdue -> critical, and sorts first
const late = [...rows, row({ reference: "F", claim_status: "filed", filed_at: day(50), amount_clp: 1_000_000 })]
a = buildAlerts(late, now)
const od = a.find((x) => x.code === "REFUND_OVERDUE")!
assert.equal(od.level, "critical")
assert.match(od.detail, /5 days late/)
assert.deepEqual(a.slice(0, 2).map((x) => x.code), ["CLAIM_BLOCKED", "REFUND_OVERDUE"]) // critical first, larger amount first
// draft claims the engine never checked are flagged as such
a = buildAlerts([row({ reference: "G", amount_clp: 2_000_000, missing_docs: ["DUS", "Commercial invoice"] })], now)
assert.deepEqual(a.map((x) => x.code), ["CHECKS_NOT_RUN"])
// nothing open -> no alerts, empty projection does not crash
assert.deepEqual(buildAlerts([], now), [])
assert.equal(projectCashflow([], now).totalLockedClp, 0)

// advance: 80% of 10M, 24% simple annual fee, 45 days
const e = estimateAdvance({ amountClp: 10_000_000, daysToRefund: 45, advanceRate: 0.8, annualFeeRate: 0.24 })
assert.equal(e.advanceClp, 8_000_000)
assert.equal(e.feeClp, Math.round(8_000_000 * 0.24 * 45 / 365))
assert.equal(e.netTodayClp, e.advanceClp - e.feeClp)
assert.equal(e.remainderAtRefundClp, 2_000_000)
// clamps: rate above 1 and negative days are bounded
assert.equal(estimateAdvance({ amountClp: 100, daysToRefund: -5, advanceRate: 3, annualFeeRate: 1 }).advanceClp, 100)
console.log("cashflow tests OK")
