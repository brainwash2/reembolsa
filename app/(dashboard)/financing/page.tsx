export const dynamic = "force-dynamic"

import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireOrg } from "@/lib/auth"
import { inflowSchedule, REFUND_ETA_DAYS, type ClaimView } from "@/lib/cashflow"
import { FinancingSimulator, type EligibleClaim } from "@/components/financing-simulator"
import { NoOrgNotice, LoadError } from "@/components/no-org-notice"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function FinancingPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_shipment_claims")
    .select("claim_id, shipment_id, reference, buyer, claim_status, amount_clp, filed_at, open_errors")
    .eq("org_id", org.orgId)
  if (error) console.error("[financing]", error.message)

  const eligible: EligibleClaim[] = inflowSchedule((data ?? []) as ClaimView[])
    .filter((i) => i.filed)
    .map((i) => ({ id: i.claimId, reference: i.reference, buyer: i.buyer, amountClp: i.amountClp, daysToRefund: Math.max(0, i.daysUntil) }))

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Working capital</h1>
        <p className="text-sm text-slate-500">What your filed refunds could unlock today, and what it would cost</p>
      </div>
      {error && <LoadError what="claims (is migration 0006 applied?)" />}

      <Card>
        <CardHeader><CardTitle className="text-lg">Advance simulator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FinancingSimulator claims={eligible} />
          <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            Illustrative only. The advance rate and fee are numbers you type, not an offer. Reembolsa does not lend money and has no lender partner yet; SII decides the refund amount and timing
            (we assume {REFUND_ETA_DAYS} days after filing). Only claims already filed with SII are counted. Claims blocked by a failed check are never included.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Lender data pack</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>A bank or factoring company needs the same facts every time: which claims, how much, filed when, and whether the documents passed their checks. Download them as one CSV, or connect a lender&apos;s own AI assistant through the read-only MCP server in Settings.</p>
          <a href="/api/export/claims" className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700">
            <Download className="h-4 w-4" aria-hidden /> Download claims (CSV)
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
