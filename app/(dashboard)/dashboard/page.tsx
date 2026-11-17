export const dynamic = "force-dynamic"

import { Banknote, CalendarClock, FileWarning, Landmark, PackageCheck, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { formatClp, formatDate, formatFxRate } from "@/lib/format"
import { getChileIndicators, getUsdClp } from "@/lib/api-client"
import { expectedRefundDate, projectCashflow, REFUND_ETA_DAYS, type ClaimForForecast } from "@/lib/cashflow"
import { KpiCard } from "@/components/kpi-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CashflowChart } from "@/components/cashflow-chart"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"

export default async function DashboardPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()

  // DB reads (RLS) and live market data run in parallel. The market calls never throw:
  // they return null when every provider is down and the KPI says so instead of showing a number.
  const [recent, pending, total, claims, usdClp, indicators] = await Promise.all([
    supabase.from("shipments").select("id, reference, buyer, status").eq("org_id", org.orgId).order("created_at", { ascending: false }).limit(5),
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("org_id", org.orgId).in("status", ["draft", "documents_pending"]),
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("org_id", org.orgId),
    supabase.from("iva_claims").select("amount_clp, status, filed_at").eq("org_id", org.orgId).neq("status", "paid"),
    getUsdClp(),
    getChileIndicators(),
  ])

  const loadFailed = recent.error || pending.error || total.error || claims.error
  if (loadFailed) console.error("[dashboard]", recent.error ?? pending.error ?? total.error ?? claims.error)

  const openClaims = (claims.data ?? []) as ClaimForForecast[]
  const projection = projectCashflow(openClaims)
  const nextRefund = openClaims
    .filter((c) => (c.status === "filed" || c.status === "approved") && c.filed_at)
    .map((c) => expectedRefundDate(c))
    .sort((a, b) => a.getTime() - b.getTime())[0]
  const shipments = recent.data ?? []
  const uf = indicators?.uf

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Your IVA Exportador recovery pipeline, with live market data</p>
      </div>

      {loadFailed && <LoadError what="dashboard data" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Locked cash (CLP)"
          value={loadFailed ? "—" : formatClp(projection.totalLockedClp)}
          subtitle={`${formatClp(projection.filedClp)} filed · ${formatClp(projection.unfiledClp)} not filed yet`}
          icon={<Banknote className="h-4 w-4" />}
          tone="teal"
        />
        <KpiCard
          label="Next expected refund"
          value={nextRefund ? formatDate(nextRefund.toISOString().slice(0, 10)) : "—"}
          subtitle={
            projection.overdueCount > 0
              ? `${projection.overdueCount} filed claim(s) past the ${REFUND_ETA_DAYS}-day estimate`
              : `Filing date + ${REFUND_ETA_DAYS} days (estimate)`
          }
          icon={<CalendarClock className="h-4 w-4" />}
          tone={projection.overdueCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Shipments awaiting documents"
          value={loadFailed ? "—" : String(pending.count ?? 0)}
          subtitle={`${total.count ?? 0} total shipments`}
          icon={<FileWarning className="h-4 w-4" />}
          tone="amber"
          href="/shipments"
        />
        <KpiCard
          label="USD / CLP (live)"
          value={usdClp ? `$${formatFxRate(usdClp.rate)}` : "Unavailable"}
          subtitle={usdClp ? `${usdClp.source} · ${formatDate(usdClp.asOf)}` : "All FX providers unreachable - not guessing"}
          helperText={usdClp?.attribution ?? usdClp?.warnings[0]}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="sky"
        />
        <KpiCard
          label="UF today"
          value={uf ? `$${uf.value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Unavailable"}
          subtitle={uf ? `${indicators?.source} · ${formatDate(uf.date)}` : "Indicator providers unreachable"}
          helperText={indicators?.utm ? `UTM ${formatClp(indicators.utm.value)}` : undefined}
          icon={<Landmark className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Claims by state"
          value={`${openClaims.filter((c) => c.status === "filed" || c.status === "approved").length} filed`}
          subtitle={`${openClaims.filter((c) => c.status === "ready").length} ready · ${openClaims.filter((c) => c.status === "draft").length} draft`}
          icon={<PackageCheck className="h-4 w-4" />}
          tone="neutral"
          href="/iva"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cash-flow projection (CLP millions)</CardTitle>
          </CardHeader>
          <CardContent>
            <CashflowChart data={projection.points} etaDays={REFUND_ETA_DAYS} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent shipments</CardTitle>
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
                    <span>{s.reference} - {s.buyer}</span>
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
