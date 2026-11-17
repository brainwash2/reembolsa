import Link from "next/link"
import { formatClp, formatDate } from "@/lib/format"
import type { Inflow } from "@/lib/cashflow"

function when(i: Inflow) {
  if (i.blocked) return { text: "Blocked", cls: "bg-red-50 text-red-700 border-red-200" }
  if (i.overdue) return { text: `${-i.daysUntil} d late`, cls: "bg-red-50 text-red-700 border-red-200" }
  if (!i.filed) return { text: `~${i.daysUntil} d after filing`, cls: "bg-slate-50 text-slate-600 border-slate-200" }
  if (i.daysUntil === 0) return { text: "Today", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  return { text: `in ${i.daysUntil} d`, cls: "bg-teal-50 text-teal-700 border-teal-200" }
}

/** The dated list behind the chart: which claim brings how much, and when. */
export function InflowSchedule({ rows, limit = 8 }: { rows: Inflow[]; limit?: number }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-slate-500">No open claims.</p>
  const shown = rows.slice(0, limit)
  return (
    <>
      <ul className="divide-y rounded-lg border bg-white" aria-label="Money arriving">
        {shown.map((i) => {
          const w = when(i)
          return (
            <li key={i.claimId}>
              <Link href={`/shipments/${i.shipmentId}`} className="flex min-h-[56px] items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{i.reference}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {i.buyer}
                    {!i.blocked && ` · ${i.filed ? "expected" : "if filed today"} ${formatDate(i.expectedDate)}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{formatClp(i.amountClp)}</span>
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${w.cls}`}>{w.text}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {rows.length > limit && <p className="mt-2 text-xs text-slate-500">+ {rows.length - limit} more on the IVA Refunds page.</p>}
    </>
  )
}
