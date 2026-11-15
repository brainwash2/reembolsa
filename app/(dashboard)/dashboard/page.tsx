export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { formatClp } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CashflowChart } from "@/components/cashflow-chart"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"

export default async function DashboardPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()

  // Every query is explicitly scoped to the org (RLS is the guarantee, the filter keeps
  // multi-org users correct and lets Postgres use the org_id indexes).
  const [recent, pending, total, claims] = await Promise.all([
    supabase
      .from("shipments")
      .select("id, reference, buyer, status")
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.orgId)
      .in("status", ["draft", "documents_pending"]),
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("org_id", org.orgId),
    supabase.from("iva_claims").select("amount_clp, status").eq("org_id", org.orgId).neq("status", "paid"),
  ])

  const loadFailed = recent.error || pending.error || total.error || claims.error
  if (loadFailed) {
    console.error("[dashboard]", recent.error ?? pending.error ?? total.error ?? claims.error)
  }

  // "Locked cash" = VAT credit of every claim that has not been paid out yet.
  const lockedCash = (claims.data ?? []).reduce((sum, c) => sum + Number(c.amount_clp ?? 0), 0)
  const shipments = recent.data ?? []

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your IVA Exportador recovery pipeline</p>
      </div>

      {loadFailed && <LoadError what="dashboard data" />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Locked Cash (CLP)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{loadFailed ? "—" : formatClp(lockedCash)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Shipments awaiting documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{loadFailed ? "—" : (pending.count ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{loadFailed ? "—" : (total.count ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash flow forecast (CLP millions)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {/* Still demo data (lib/mock-data.ts) - replace once claims carry expected payout dates. */}
            <CashflowChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            {shipments.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center text-slate-500">
                <p>No shipments yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shipments.map((s) => (
                  <div key={s.id} className="flex justify-between rounded border p-3 text-sm">
                    <span>
                      {s.reference} - {s.buyer}
                    </span>
                    <span className="font-medium capitalize">{String(s.status).replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
