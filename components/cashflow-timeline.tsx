import type { CashflowPoint } from "@/lib/cashflow"

const fmt = (v: number) => v.toFixed(1)

/**
 * Month-by-month refund calendar drawn with plain HTML/CSS (no chart library, so it renders on the
 * server, never comes up blank, and scrolls inside its own box on phones).
 * Solid bar = filed claims, expected that month. Striped bar = claims that could be filed today.
 * The line of numbers underneath is the cash still locked after that month.
 */
export function CashflowTimeline({ points, etaDays, blockedM }: { points: CashflowPoint[]; etaDays: number; blockedM: number }) {
  const max = Math.max(1, ...points.map((p) => p.expectedRefunds + p.potentialRefunds))
  const H = 168
  const empty = points.every((p) => p.expectedRefunds === 0 && p.potentialRefunds === 0 && p.lockedCash === 0)

  if (empty) {
    return (
      <div className="flex h-56 flex-col items-center justify-center text-center text-sm text-slate-500">
        <p>No open claims to project yet.</p>
        <p className="text-xs text-slate-400">Run “Sync with SII (Demo)” on the Shipments page.</p>
      </div>
    )
  }

  return (
    <figure className="w-full">
      <figcaption className="sr-only">Expected refunds by month in CLP millions</figcaption>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[300px] auto-cols-fr grid-flow-col gap-2 sm:gap-3" role="img" aria-label={`Refund calendar: ${points.map((p) => `${p.month} ${fmt(p.expectedRefunds + p.potentialRefunds)} million`).join(", ")}`}>
          {points.map((p) => {
            const total = p.expectedRefunds + p.potentialRefunds
            const filedH = (p.expectedRefunds / max) * H
            const potH = (p.potentialRefunds / max) * H
            return (
              <div key={p.month} className="flex min-w-[56px] flex-col items-center">
                <span className="mb-1 h-4 text-xs font-semibold tabular-nums text-slate-700">{total > 0 ? fmt(total) : ""}</span>
                <div className="flex w-full max-w-[64px] flex-col justify-end" style={{ height: H }}>
                  {potH > 0 && (
                    <div
                      className="w-full rounded-t border border-dashed border-teal-600 bg-[repeating-linear-gradient(135deg,#ccfbf1,#ccfbf1_5px,#99f6e4_5px,#99f6e4_10px)]"
                      style={{ height: Math.max(potH, 3) }}
                      title={`${fmt(p.potentialRefunds)}M if filed today`}
                    />
                  )}
                  {filedH > 0 && (
                    <div className={`w-full bg-teal-600 ${potH > 0 ? "" : "rounded-t"}`} style={{ height: Math.max(filedH, 3) }} title={`${fmt(p.expectedRefunds)}M expected (filed)`} />
                  )}
                  {total === 0 && <div className="h-px w-full bg-slate-200" />}
                </div>
                <span className="mt-2 text-xs font-medium text-slate-600">{p.month}</span>
                <span className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-slate-400">{fmt(p.lockedCash)}M left</span>
              </div>
            )
          })}
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-teal-600" />Filed: expected {etaDays} days after filing</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-dashed border-teal-600 bg-teal-100" />Ready to file: if filed today</li>
        {blockedM > 0 && <li className="flex items-center gap-1.5 text-red-700">⚠ {fmt(blockedM)}M is stuck behind a failed check, so it is not in the chart (it stays in “left”)</li>}
      </ul>
      <p className="mt-2 text-xs text-slate-400">CLP millions; “left” = cash still locked after that month. The {etaDays}-day delay is a planning assumption, not an SII commitment.</p>
    </figure>
  )
}
