import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrg } from "@/lib/auth"
import { expectedRefundDate } from "@/lib/cashflow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** CSV cells starting with = + - @ are executed as formulas by spreadsheets: neutralise them. */
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET() {
  const org = await getCurrentOrg()
  if (!org) return new NextResponse("Unauthorized", { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("v_shipment_claims")
    .select("reference, buyer, destination, currency, invoice_amount, export_value_clp, exchange_rate, exchange_rate_date, claim_status, amount_clp, filed_at, open_errors, source")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false })
  if (error) return new NextResponse("Could not load claims", { status: 500 })

  const head = ["reference", "buyer", "destination", "currency", "invoice_amount", "export_value_clp", "fx_rate", "fx_date", "claim_status", "refund_clp", "filed_at", "expected_refund_date", "open_errors", "data_source"]
  const lines = (data ?? []).map((r) => {
    const open = r.claim_status !== "paid"
    const eta = open ? expectedRefundDate({ status: r.claim_status, filed_at: r.filed_at }).toISOString().slice(0, 10) : ""
    return [r.reference, r.buyer, r.destination, r.currency, r.invoice_amount, r.export_value_clp, r.exchange_rate, r.exchange_rate_date, r.claim_status, r.amount_clp, r.filed_at, eta, r.open_errors, r.source === "sii_demo" ? "DEMO (simulated)" : r.source].map(cell).join(",")
  })
  return new NextResponse([head.join(","), ...lines].join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reembolsa-claims-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  })
}
