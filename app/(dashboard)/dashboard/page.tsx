export const dynamic = "force-dynamic"

import Link from "next/link"
import { ArrowRight, Banknote, CalendarClock, Landmark, ShieldAlert, TrendingUp, Wallet } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { hasAdminClient } from "@/lib/supabase/admin"
import { formatClp, formatDate, formatFxRate } from "@/lib/format"
import { getChileIndicators, getUsdClp } from "@/lib/api-client"
import { buildAlerts, cashWindows, inflowSchedule, isBlocked, projectCashflow, REFUND_ETA_DAYS, type ClaimView } from "@/lib/cashflow"
import { KpiCard } from "@/components/kpi-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CashflowTimeline } from "@/components/cashflow-timeline"
import { AlertsPanel } from "@/components/alerts-panel"
import { InflowSchedule } from "@/components/inflow-schedule"
import { RunChecksButton } from "@/components/run-checks-button"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"

export default async function DashboardPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()
  const [claimsRes, usdClp, indicators] = await Promise.all([
    supabase
      .from("v_shipment_claims")
      .select("claim_id, shipment_id, reference, buyer, claim_status, amount_clp, filed_at, missing_docs, open_errors, source, shipment_date")
      .eq("org_id", org.orgId),
    getUsdClp(),
    getChileIndicators(),
  ])

  if (claimsRes.error) console.error("[dashboard]", claimsRes.error.message)
  const rows = (claimsRes.data ?? []) as ClaimView[]
  const now = new Date()

  const projection = projectCashflow(
    rows.map((r) => ({ amount_clp: r.amount_clp, status: r.claim_status, filed_at: r.filed_at, blocked: isBlocked(r) })),
    now
  )
  const schedule = inflowSchedule(rows, now)
  const windows = cashWindows(schedule)
  const alerts = buildAlerts(rows, now)
  const nextFiled = schedule.find((i) => i.filed)
  const unchecked = rows.filter((r) => r.claim_status === "draft" && r.source === "sii_demo" && Number(r.open_errors ?? 0) === 0 && (r.missing_docs?.length ?? 0) > 0)
  const uf = indicators?.uf
  const canRun = hasAdminClient() && org.role !== "viewer"

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Cash flow</h1>
        <p className="text-sm text-slate-500">Export VAT you have paid, when it comes back, and what is in the way</p>
      </div>

      {claimsRes.error && <LoadError what="claims (is migration 0006 applied?)" />}

      {unchecked.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">{unchecked.length} synced shipment{unchecked.length > 1 ? "s are" : " is"} still waiting for the rules engine</p>
          {canRun ? (
            <>
              <p className="text-xs">The deterministic checks (RUT, FOB against invoice, DUS legalization) have not run on them. Run them now to see which claims are ready, filed or blocked.</p>
              <RunChecksButton />
            </>
          ) : hasAdminClient() ? (
            <p className="text-xs">Ask an owner or accountant of this organization to run the checks.</p>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-xs">
              <li>Supabase: Project Settings, API, copy the <code>service_role</code> key.</li>
              <li>Vercel: Project Settings, Environment Variables, add <code>SUPABASE_SERVICE_ROLE_KEY</code> (never with a NEXT_PUBLIC_ prefix).</li>
              <li>Redeploy, come back here and press “Run checks now”.</li>
            </ol>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Export VAT locked" value={claimsRes.error ? "—" : formatClp(projection.totalLockedClp)} subtitle={`${rows.filter((r) => r.claim_status !== "paid").length} open claims`} icon={<Banknote className="h-4 w-4" />} tone="teal" href="/iva" />
        <KpiCard
          label="Arriving in 30 days"
          value={formatClp(windows.filed30)}
          subtitle={nextFiled ? `Next: ${formatDate(nextFiled.expectedDate)}${nextFiled.overdue ? " (late)" : ""}` : "No filed claims yet"}
          icon={<CalendarClock className="h-4 w-4" />}
          tone={projection.overdueCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard label="Ready to file" value={formatClp(windows.fileableClp)} subtitle="Clock starts when filed" icon={<Wallet className="h-4 w-4" />} tone="sky" href="/iva" />
        <KpiCard label="Stuck by a failed check" value={formatClp(windows.blockedClp)} subtitle={windows.blockedClp > 0 ? "Fix the error to release it" : "Nothing blocked"} icon={<ShieldAlert className="h-4 w-4" />} tone={windows.blockedClp > 0 ? "red" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">When the cash lands</CardTitle></CardHeader>
          <CardContent>
            <CashflowTimeline points={projection.points} etaDays={REFUND_ETA_DAYS} blockedM={projection.blockedClp / 1_000_000} />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-lg">Needs attention</CardTitle></CardHeader>
          <CardContent><AlertsPanel alerts={alerts} /></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Money arriving</CardTitle></CardHeader>
          <CardContent><InflowSchedule rows={schedule} /></CardContent>
        </Card>
        <div className="grid min-w-0 grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <KpiCard label="USD / CLP (live)" value={usdClp ? `$${formatFxRate(usdClp.rate)}` : "Unavailable"} subtitle={usdClp ? `${usdClp.source} · ${formatDate(usdClp.asOf)}` : "All FX providers unreachable - not guessing"} helperText={usdClp?.attribution ?? usdClp?.warnings[0]} icon={<TrendingUp className="h-4 w-4" />} tone="sky" />
          <KpiCard label="UF today" value={uf ? `$${uf.value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Unavailable"} subtitle={uf ? `${indicators?.source} · ${formatDate(uf.date)}` : "Indicator providers unreachable"} helperText={indicators?.utm ? `UTM ${formatClp(indicators.utm.value)}` : undefined} icon={<Landmark className="h-4 w-4" />} tone="neutral" />
        </div>
      </div>

      {windows.filed60 > 0 && (
        <Link href="/financing" className="flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900 hover:bg-teal-100">
          <span><strong>Need the cash sooner?</strong> See what an advance on your filed claims would cost.</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      )}
    </div>
  )
}
