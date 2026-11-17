export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { formatClp, formatDate, formatFxRate } from "@/lib/format"
import { SyncButton } from "@/components/sync-button"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"

export default async function ShipmentsPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()
  const [shipments, lastRun] = await Promise.all([
    supabase
      .from("shipments")
      .select("id, reference, buyer, destination, currency, invoice_amount, exchange_rate, exchange_rate_date, exchange_rate_source, export_value_clp, status, source")
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ingest_runs")
      .select("created_at, inserted")
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (shipments.error) console.error("[shipments]", shipments.error)
  const rows = shipments.data ?? []
  const canWrite = org.role !== "viewer"

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
        <p className="text-sm text-slate-500">
          {rows.length} export shipments · imported automatically, no manual entry
          {lastRun.data ? ` · last sync ${new Date(lastRun.data.created_at).toLocaleString("en-GB")}` : ""}
        </p>
      </div>

      {shipments.error && <LoadError what="shipments" />}

      {canWrite ? (
        <div className="rounded-lg border bg-white p-6">
          <SyncButton />
        </div>
      ) : (
        <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">Viewers can see shipments but cannot sync.</p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-500">Reference</th>
              <th className="px-4 py-3 font-medium text-slate-500">Buyer</th>
              <th className="px-4 py-3 font-medium text-slate-500">Destination</th>
              <th className="px-4 py-3 font-medium text-slate-500">Invoice</th>
              <th className="px-4 py-3 font-medium text-slate-500">FX → CLP</th>
              <th className="px-4 py-3 font-medium text-slate-500">FOB (CLP)</th>
              <th className="px-4 py-3 font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  No shipments yet. Press “Sync with SII (Demo)”.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  {s.reference}
                  {s.source === "sii_demo" && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Demo</span>
                  )}
                </td>
                <td className="px-4 py-3">{s.buyer}</td>
                <td className="px-4 py-3">{s.destination}</td>
                <td className="px-4 py-3 tabular-nums">
                  {s.currency} {Number(s.invoice_amount).toLocaleString("en-US")}
                </td>
                <td className="px-4 py-3 tabular-nums text-xs text-slate-600">
                  {s.exchange_rate ? (
                    <>
                      {formatFxRate(Number(s.exchange_rate))}
                      <span className="block text-slate-400">
                        {s.exchange_rate_date ? formatDate(s.exchange_rate_date) : ""} · {s.exchange_rate_source}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{s.export_value_clp != null ? formatClp(Number(s.export_value_clp)) : "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                    {String(s.status).replaceAll("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
