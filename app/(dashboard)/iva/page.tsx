export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { formatClp } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"

type ClaimStatus = "draft" | "ready" | "filed" | "approved" | "paid"
const STATUSES: ClaimStatus[] = ["draft", "ready", "filed", "approved", "paid"]

interface ClaimRow {
  id: string
  amount_clp: number | null
  status: ClaimStatus
  missing_docs: string[] | null
  shipments: { reference: string; buyer: string } | null
}

export default async function IvaPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("iva_claims")
    .select("id, amount_clp, status, missing_docs, shipments(reference, buyer)")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false })

  if (error) console.error("[iva]", error)
  const claims = (data ?? []) as unknown as ClaimRow[]

  const stats = Object.fromEntries(STATUSES.map((s) => [s, { count: 0, amount: 0 }])) as Record<
    ClaimStatus,
    { count: number; amount: number }
  >
  for (const c of claims) {
    const bucket = stats[c.status]
    if (bucket) {
      bucket.count += 1
      bucket.amount += Number(c.amount_clp ?? 0)
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">IVA Refund Tracker</h1>
        <p className="text-sm text-slate-500">Formulario 3600 — Track your export VAT refund claims with the SII</p>
      </div>

      {error && <LoadError what="IVA claims" />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {STATUSES.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase text-slate-500">{status}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold">{stats[status].count} claims</p>
              <p className="text-sm tabular-nums text-slate-500">{formatClp(stats[status].amount)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Shipment</th>
              <th className="px-6 py-3 font-medium text-slate-500">Buyer</th>
              <th className="px-6 py-3 font-medium text-slate-500">Amount (CLP)</th>
              <th className="px-6 py-3 font-medium text-slate-500">Status</th>
              <th className="px-6 py-3 font-medium text-slate-500">Missing docs</th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No refund claims found. A draft claim is created automatically for every shipment.
                </td>
              </tr>
            )}
            {claims.map((claim) => (
              <tr key={claim.id} className="border-b last:border-0">
                <td className="px-6 py-4 font-medium">{claim.shipments?.reference ?? "Unknown"}</td>
                <td className="px-6 py-4">{claim.shipments?.buyer ?? "Unknown"}</td>
                <td className="px-6 py-4 tabular-nums">{formatClp(Number(claim.amount_clp ?? 0))}</td>
                <td className="px-6 py-4 capitalize">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {claim.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {claim.missing_docs && claim.missing_docs.length > 0 ? (
                    <span className="text-xs font-medium text-red-500">{claim.missing_docs.join(", ")}</span>
                  ) : (
                    <span className="text-xs font-medium text-emerald-600">Complete</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
