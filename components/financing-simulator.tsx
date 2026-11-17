"use client"

import { useMemo, useState } from "react"
import { estimateAdvance } from "@/lib/cashflow"
import { formatClp } from "@/lib/format"

export interface EligibleClaim {
  id: string
  reference: string
  buyer: string
  amountClp: number
  daysToRefund: number
}

const clampNum = (v: string, lo: number, hi: number, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

/**
 * Illustrative working-capital simulator on FILED claims. The advance rate and fee are inputs the
 * user can change, not a quote: Reembolsa does not lend and has no lender partner yet.
 */
export function FinancingSimulator({ claims }: { claims: EligibleClaim[] }) {
  const [ratePct, setRatePct] = useState("80")
  const [aprPct, setAprPct] = useState("24")
  const rate = clampNum(ratePct, 0, 95, 80) / 100
  const apr = clampNum(aprPct, 0, 120, 24) / 100

  const rows = useMemo(
    () => claims.map((c) => ({ c, e: estimateAdvance({ amountClp: c.amountClp, daysToRefund: c.daysToRefund, advanceRate: rate, annualFeeRate: apr }) })),
    [claims, rate, apr]
  )
  const tot = rows.reduce(
    (t, r) => ({ face: t.face + r.c.amountClp, adv: t.adv + r.e.advanceClp, fee: t.fee + r.e.feeClp, net: t.net + r.e.netTodayClp, rem: t.rem + r.e.remainderAtRefundClp }),
    { face: 0, adv: 0, fee: 0, net: 0, rem: 0 }
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Advance rate (% of each filed claim)</span>
          <input type="number" inputMode="decimal" min={0} max={95} step={5} value={ratePct} onChange={(e) => setRatePct(e.target.value)} className="min-h-[44px] w-full rounded-md border border-slate-300 px-3 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Assumed annual fee (% on the advanced amount)</span>
          <input type="number" inputMode="decimal" min={0} max={120} step={1} value={aprPct} onChange={(e) => setAprPct(e.target.value)} className="min-h-[44px] w-full rounded-md border border-slate-300 px-3 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-white p-6 text-center text-sm text-slate-500">No filed claims yet. Only claims already filed with SII can back an advance.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite">
            <Stat label="Filed claims" value={formatClp(tot.face)} />
            <Stat label="Cash available today" value={formatClp(tot.net)} strong />
            <Stat label="Cost of getting it early" value={formatClp(tot.fee)} />
            <Stat label="Still arrives from SII" value={formatClp(tot.rem)} />
          </div>

          <ul className="space-y-2 md:hidden" aria-label="Per claim">
            {rows.map(({ c, e }) => (
              <li key={c.id} className="rounded-lg border bg-white p-3 text-sm">
                <p className="font-medium text-slate-900">{c.reference} <span className="font-normal text-slate-500">· {c.buyer}</span></p>
                <p className="mt-1 text-xs text-slate-500">{formatClp(c.amountClp)} refund in ~{e.daysToRefund} days</p>
                <p className="mt-1 tabular-nums">Today <strong>{formatClp(e.netTodayClp)}</strong> <span className="text-xs text-slate-500">(fee {formatClp(e.feeClp)})</span></p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-500">
                <tr>{["Shipment", "Refund", "Days to refund", "Advance", "Fee", "Cash today"].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ c, e }) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3"><span className="font-medium">{c.reference}</span><span className="block text-xs text-slate-500">{c.buyer}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatClp(c.amountClp)}</td>
                    <td className="px-4 py-3 tabular-nums">{e.daysToRefund}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatClp(e.advanceClp)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatClp(e.feeClp)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{formatClp(e.netTodayClp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${strong ? "border-teal-300 bg-teal-50" : "bg-white"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 sm:text-xl">{value}</p>
    </div>
  )
}
