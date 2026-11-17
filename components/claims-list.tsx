import { formatClp, formatDate } from "@/lib/format"
import { ClaimStatusBadge } from "@/components/status-badge"
import type { ClaimStatus } from "@/lib/mock-data"
import { expectedRefundDate } from "@/lib/cashflow"

export interface ClaimRow {
  id: string
  amount_clp: number | null
  status: ClaimStatus
  missing_docs: string[] | null
  filed_at: string | null
  shipments: { reference: string; buyer: string } | null
}

const expected = (c: ClaimRow) =>
  c.status === "paid" ? "Paid" : formatDate(expectedRefundDate({ status: c.status, filed_at: c.filed_at }).toISOString().slice(0, 10))
const expectedNote = (c: ClaimRow) => (c.status === "filed" || c.status === "approved" ? "filed + 45 d" : "if filed today")

function Docs({ docs }: { docs: string[] | null }) {
  return docs && docs.length > 0 ? (
    <span className="text-xs font-medium text-red-600">{docs.join(", ")}</span>
  ) : (
    <span className="text-xs font-medium text-emerald-600">Complete</span>
  )
}

export function ClaimsList({ claims }: { claims: ClaimRow[] }) {
  if (claims.length === 0) {
    return (
      <div className="rounded-lg border bg-white px-6 py-10 text-center text-sm text-slate-500">
        No refund claims found. A draft claim is created automatically for every shipment.
      </div>
    )
  }
  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label="IVA refund claims">
        {claims.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{c.shipments?.reference ?? "Unknown"}</p>
                <p className="truncate text-sm text-slate-500">{c.shipments?.buyer ?? "Unknown"}</p>
              </div>
              <ClaimStatusBadge status={c.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Refund (CLP)</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{formatClp(Number(c.amount_clp ?? 0))}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Expected</dt>
                <dd className="tabular-nums text-slate-900">
                  {expected(c)}
                  <span className="block text-[11px] text-slate-400">{c.status === "paid" ? "" : expectedNote(c)}</span>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-400">Documents</dt>
                <dd><Docs docs={c.missing_docs} /></dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              {["Shipment", "Buyer", "Refund (CLP)", "Expected", "Status", "Missing docs"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium text-slate-500 lg:px-6">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-4 font-medium lg:px-6">{c.shipments?.reference ?? "Unknown"}</td>
                <td className="px-4 py-4 lg:px-6">{c.shipments?.buyer ?? "Unknown"}</td>
                <td className="whitespace-nowrap px-4 py-4 tabular-nums lg:px-6">{formatClp(Number(c.amount_clp ?? 0))}</td>
                <td className="whitespace-nowrap px-4 py-4 text-xs tabular-nums lg:px-6">
                  {expected(c)}
                  <span className="block text-slate-400">{c.status === "paid" ? "" : expectedNote(c)}</span>
                </td>
                <td className="px-4 py-4 lg:px-6"><ClaimStatusBadge status={c.status} /></td>
                <td className="px-4 py-4 lg:px-6"><Docs docs={c.missing_docs} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
