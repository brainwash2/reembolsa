export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { formatClp } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClaimsList, type ClaimRow } from "@/components/claims-list"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"

type ClaimStatus = ClaimRow["status"]
const STATUSES: ClaimStatus[] = ["draft", "ready", "filed", "approved", "paid"]

export default async function IvaPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("iva_claims")
    .select("id, amount_clp, status, missing_docs, filed_at, shipments(reference, buyer)")
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
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">IVA Refund Tracker</h1>
        <p className="text-sm text-slate-500">Formulario 3600 — track your export VAT refund claims with the SII</p>
      </div>

      {error && <LoadError what="IVA claims" />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {STATUSES.map((status) => (
          <Card key={status}>
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-xs font-medium uppercase text-slate-500">{status}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-base font-bold sm:text-lg">{stats[status].count} claims</p>
              <p className="truncate text-sm tabular-nums text-slate-500">{formatClp(stats[status].amount)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ClaimsList claims={claims} />
    </div>
  )
}
