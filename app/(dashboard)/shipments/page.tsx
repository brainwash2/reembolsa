export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { SyncButton } from "@/components/sync-button"
import { ShipmentsList, type ShipmentRow } from "@/components/shipments-list"
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
  const rows = (shipments.data ?? []) as ShipmentRow[]
  const canWrite = org.role !== "viewer"

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Shipments</h1>
        <p className="text-sm text-slate-500">
          {rows.length} export shipments · imported automatically, no manual entry
          {lastRun.data ? ` · last sync ${new Date(lastRun.data.created_at).toLocaleString("en-GB")}` : ""}
        </p>
      </div>

      {shipments.error && <LoadError what="shipments" />}

      {canWrite ? (
        <div className="rounded-lg border bg-white p-4 sm:p-6">
          <SyncButton />
        </div>
      ) : (
        <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">Viewers can see shipments but cannot sync.</p>
      )}

      <ShipmentsList rows={rows} />
    </div>
  )
}
