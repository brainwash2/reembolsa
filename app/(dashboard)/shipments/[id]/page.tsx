export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, FileText, Info } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { formatClp, formatDate, formatFxRate } from "@/lib/format"
import { expectedRefundDate, REFUND_ETA_DAYS } from "@/lib/cashflow"
import { ShipmentStatusBadge } from "@/components/status-badge"
import { ClaimStepper } from "@/components/claim-stepper"
import { BuyerVerifyForm, type PastCheck } from "@/components/buyer-verify-form"
import { NoOrgNotice } from "@/components/no-org-notice"
import type { ShipmentStatus, ClaimStatus } from "@/lib/mock-data"

const sev = {
  error: { icon: AlertCircle, cls: "border-red-200 bg-red-50 text-red-900" },
  warning: { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-900" },
  info: { icon: Info, cls: "border-sky-200 bg-sky-50 text-sky-900" },
} as const

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const [shipRes, docsRes, issuesRes, claimRes, verRes] = await Promise.all([
    supabase.from("shipments").select("*").eq("id", id).eq("org_id", org.orgId).maybeSingle(),
    supabase.from("documents").select("type, source, validated, extracted_data").eq("shipment_id", id).eq("org_id", org.orgId),
    supabase.from("issues").select("id, severity, code, message").eq("shipment_id", id).eq("org_id", org.orgId).eq("resolved", false),
    supabase.from("iva_claims").select("status, amount_clp, filed_at, missing_docs").eq("shipment_id", id).eq("org_id", org.orgId).maybeSingle(),
    supabase.from("buyer_verifications").select("provider, status, country, query, name, address, note, checked_at").eq("shipment_id", id).eq("org_id", org.orgId).order("checked_at", { ascending: false }).limit(5),
  ])
  const s = shipRes.data
  if (!s) notFound()

  const docs = docsRes.data ?? []
  const issues = [...(issuesRes.data ?? [])].sort((a, b) => ["error", "warning", "info"].indexOf(a.severity) - ["error", "warning", "info"].indexOf(b.severity))
  const claim = claimRes.data
  const claimStatus = (claim?.status ?? "draft") as ClaimStatus
  const filed = (claimStatus === "filed" || claimStatus === "approved") && !!claim?.filed_at
  const eta = claim && claimStatus !== "paid" ? expectedRefundDate({ status: claimStatus, filed_at: claim.filed_at }) : null
  const history: PastCheck[] = (verRes.data ?? []).map((v) => ({ ...v, checkedAt: v.checked_at, provider: v.provider, status: v.status }))
  const isDemo = s.source === "sii_demo"

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/shipments" className="hover:text-slate-700">Shipments</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium text-slate-900">{s.reference}</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{s.reference}</h1>
          <ShipmentStatusBadge status={s.status as ShipmentStatus} />
          {isDemo && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Demo</span>}
        </div>
        <p className="mt-1 text-sm text-slate-500">{s.buyer} · {s.destination}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5 lg:grid-cols-5">
        <Item label="Invoice" value={`${s.currency} ${Number(s.invoice_amount).toLocaleString("en-US")}`} />
        <Item label="Incoterm" value={s.incoterm ?? "—"} />
        <Item label="FX → CLP" value={s.exchange_rate ? formatFxRate(Number(s.exchange_rate)) : "—"} sub={s.exchange_rate_source ? `${s.exchange_rate_source}${s.exchange_rate_date ? ` · ${formatDate(s.exchange_rate_date)}` : ""}` : undefined} />
        <Item label="FOB (CLP)" value={s.export_value_clp != null ? formatClp(Number(s.export_value_clp)) : "—"} />
        <Item label="Shipped" value={s.shipment_date ? formatDate(s.shipment_date) : "—"} />
      </div>

      <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5" aria-labelledby="claim-h">
        <h2 id="claim-h" className="text-sm font-semibold text-slate-900">IVA refund claim</h2>
        {claim ? (
          <div className="mt-3 space-y-4">
            <ClaimStepper status={claimStatus} />
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <Item label="Refund (input VAT credit)" value={formatClp(Number(claim.amount_clp))} />
              <Item label="Filed" value={claim.filed_at ? formatDate(claim.filed_at.slice(0, 10)) : "Not filed yet"} />
              <Item
                label={filed ? "Expected" : "If filed today"}
                value={eta ? formatDate(eta.toISOString().slice(0, 10)) : "—"}
                sub={`filing + ${REFUND_ETA_DAYS} days, a planning assumption`}
              />
            </div>
            {(claim.missing_docs?.length ?? 0) > 0 && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Missing documents: {claim.missing_docs.join(", ")}</p>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No claim has been created for this shipment.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5" aria-labelledby="checks-h">
          <h2 id="checks-h" className="text-sm font-semibold text-slate-900">Rules-engine checks</h2>
          <p className="mb-3 text-xs text-slate-500">Deterministic rules decide. No AI is involved in this verdict.</p>
          {docs.length === 0 && issues.length === 0 ? (
            <p className="text-sm text-slate-500">The checks have not run on this shipment yet.</p>
          ) : (
            <div className="space-y-3">
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.type} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <span className="truncate">{d.type === "dus" ? "DUS (customs declaration)" : "Commercial invoice (DTE 110)"}</span>
                    </span>
                    <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${d.validated ? "text-emerald-700" : "text-red-700"}`}>
                      {d.validated ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertCircle className="h-4 w-4" aria-hidden />}
                      {d.validated ? "Passed" : "Failed"}
                    </span>
                  </li>
                ))}
              </ul>
              {issues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden /> No open issues.</p>
              ) : (
                <ul className="space-y-2">
                  {issues.map((i) => {
                    const S = sev[i.severity as keyof typeof sev] ?? sev.info
                    return (
                      <li key={i.id} className={`flex gap-2 rounded-lg border p-3 text-sm ${S.cls}`}>
                        <S.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span><span className="block text-[11px] font-semibold uppercase tracking-wide opacity-80">{i.code}</span>{i.message}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5" aria-labelledby="buyer-h">
          <h2 id="buyer-h" className="text-sm font-semibold text-slate-900">Buyer verification</h2>
          <p className="mb-3 text-xs text-slate-500">{s.buyer}{s.buyer_tax_id ? ` · ${s.buyer_country ?? ""} ${s.buyer_tax_id}` : ""}</p>
          <BuyerVerifyForm
            shipmentId={s.id}
            country={String(s.buyer_country ?? "").trim()}
            taxId={s.buyer_tax_id ?? ""}
            history={history}
            canCheck={org.role !== "viewer"}
            isDemo={isDemo}
          />
        </section>
      </div>
    </div>
  )
}

function Item({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}
