import Link from "next/link"
import { formatClp, formatDate, formatFxRate } from "@/lib/format"
import { ShipmentStatusBadge } from "@/components/status-badge"
import type { ShipmentStatus } from "@/lib/mock-data"

export interface ShipmentRow {
  id: string
  reference: string
  buyer: string
  destination: string
  currency: string
  invoice_amount: number | string
  exchange_rate: number | string | null
  exchange_rate_date: string | null
  exchange_rate_source: string | null
  export_value_clp: number | string | null
  status: string
  source: string | null
}

const invoice = (s: ShipmentRow) => `${s.currency} ${Number(s.invoice_amount).toLocaleString("en-US")}`
const fob = (s: ShipmentRow) => (s.export_value_clp != null ? formatClp(Number(s.export_value_clp)) : "—")
const demoBadge = (s: ShipmentRow) =>
  s.source === "sii_demo" ? (
    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Demo</span>
  ) : null
const fx = (s: ShipmentRow) =>
  s.exchange_rate ? `${formatFxRate(Number(s.exchange_rate))}${s.exchange_rate_date ? ` · ${formatDate(s.exchange_rate_date)}` : ""}` : "—"

/** < md: one card per shipment (no horizontal scrolling). md+: table, scrollable inside its own box. */
export function ShipmentsList({ rows }: { rows: ShipmentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white px-6 py-10 text-center text-sm text-slate-500">
        No shipments yet. Press “Sync with SII (Demo)”.
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label="Shipments">
        {rows.map((s) => (
          <li key={s.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  <Link href={`/shipments/${s.id}`} className="text-teal-700 hover:underline">{s.reference}</Link>
                  {demoBadge(s)}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {s.buyer} · {s.destination}
                </p>
              </div>
              <ShipmentStatusBadge status={s.status as ShipmentStatus} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Invoice</dt>
                <dd className="tabular-nums text-slate-900">{invoice(s)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">FOB (CLP)</dt>
                <dd className="tabular-nums text-slate-900">{fob(s)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-400">FX → CLP</dt>
                <dd className="text-xs tabular-nums text-slate-600">
                  {fx(s)}
                  {s.exchange_rate_source ? ` · ${s.exchange_rate_source}` : ""}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              {["Reference", "Buyer", "Destination", "Invoice", "FX → CLP", "FOB (CLP)", "Status"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  <Link href={`/shipments/${s.id}`} className="text-teal-700 hover:underline">{s.reference}</Link>
                  {demoBadge(s)}
                </td>
                <td className="px-4 py-3">{s.buyer}</td>
                <td className="px-4 py-3">{s.destination}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{invoice(s)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-slate-600">
                  {fx(s)}
                  <span className="block text-slate-400">{s.exchange_rate_source ?? ""}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fob(s)}</td>
                <td className="px-4 py-3">
                  <ShipmentStatusBadge status={s.status as ShipmentStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
