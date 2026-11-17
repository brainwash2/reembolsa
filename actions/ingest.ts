"use server"

import { revalidatePath } from "next/cache"
import { requireOrg } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { hasAdminClient } from "@/lib/supabase/admin"
import { enrichShipments } from "@/lib/sii-enrich"
import { getFxRate, type FxQuote } from "@/lib/api-client"
import { inputVatClp, isoDaysAgo, pickNextBatch, type SiiExportRecord } from "@/lib/sii-demo"

export interface SyncState {
  status: "idle" | "success" | "error"
  message: string
  synced?: number
  skipped?: number
  claimsReady?: number
  claimsFiled?: number
  claimsBlocked?: number
  fx?: { pair: string; rate: number; asOf: string; source: string }[]
  warnings?: string[]
}

const fail = (message: string): SyncState => ({ status: "error", message })

/**
 * "Sync with SII (demo)".
 *
 * 1. Fetches 5 simulated SII export records (lib/sii-demo.ts) the org has not synced yet.
 * 2. Converts each FOB value to CLP with the FX rate of the shipment date (Frankfurter v2 ->
 *    mindicador.cl fallback). If a rate is unavailable NOTHING is written (fail closed, no invented rates).
 * 3. Inserts shipments with the USER's session -> RLS enforces tenant + role. The DB trigger
 *    creates the draft iva_claims row.
 * 4. If SUPABASE_SERVICE_ROLE_KEY is set, runs the deterministic checks and writes the engine-owned
 *    rows (documents.validated, issues, claim status) via the service role. Without it the claims
 *    simply stay as drafts - the DB gate remains the authority either way.
 *
 * Idempotent: records already synced (unique org_id + external_ref) are skipped.
 * Callable as syncWithSII() from a client transition or a form action.
 */
export async function syncWithSII(_prev?: SyncState): Promise<SyncState> {
  const org = await requireOrg()
  if (!org) return fail("Your account has no organization yet.")
  if (org.role === "viewer") return fail("Your role (viewer) cannot sync shipments.")

  const supabase = await createClient()

  // Demo feed is Chilean (SII). Orgs of other jurisdictions are not served by it.
  const { data: orgRow } = await supabase.from("organizations").select("country").eq("id", org.orgId).maybeSingle()
  if (orgRow?.country && orgRow.country !== "CL") return fail("The SII demo feed is only available for Chilean organizations.")

  const { data: existing, error: exErr } = await supabase
    .from("shipments")
    .select("external_ref")
    .eq("org_id", org.orgId)
    .not("external_ref", "is", null)
  if (exErr) {
    console.error("[syncWithSII] load existing", exErr.message)
    return fail("Could not read your shipments. Is migration 0007 applied?")
  }

  const batch = pickNextBatch(new Set<string>((existing ?? []).map((r) => r.external_ref as string)), 5)
  if (batch.length === 0) {
    return { status: "success", message: "Everything in the demo feed is already synced.", synced: 0, skipped: 0 }
  }

  // ---- FX: one call per (currency, shipment date)
  const now = new Date()
  const keyOf = (r: SiiExportRecord) => `${r.currency}|${isoDaysAgo(r.shipmentDaysAgo, now)}`
  const keys = Array.from(new Set(batch.map(keyOf)))
  const quotes = new Map<string, FxQuote>()
  await Promise.all(
    keys.map(async (k) => {
      const [ccy, date] = k.split("|")
      const q = await getFxRate(ccy, "CLP", { date })
      if (q) quotes.set(k, q)
    })
  )
  const missing = keys.filter((k) => !quotes.has(k))
  if (missing.length > 0) {
    return fail(`Live FX is unavailable for ${missing.map((m) => m.replace("|", " on ")).join(", ")}. Nothing was synced - try again in a minute.`)
  }

  // ---- insert shipments with the user's session (RLS)
  const inserted: { rec: SiiExportRecord; id: string }[] = []
  let skipped = 0
  const warnings: string[] = []
  for (const rec of batch) {
    const q = quotes.get(keyOf(rec))!
    const date = isoDaysAgo(rec.shipmentDaysAgo, now)
    const { data, error } = await supabase
      .from("shipments")
      .insert({
        org_id: org.orgId,
        reference: rec.reference,
        buyer: rec.buyer.name,
        buyer_tax_id: rec.buyer.taxId,
        buyer_country: rec.buyer.country,
        destination: rec.destination,
        incoterm: rec.incoterm,
        invoice_amount: rec.invoiceTotal,
        currency: rec.currency,
        exchange_rate: q.rate,
        exchange_rate_date: q.asOf,
        exchange_rate_source: q.source,
        export_value_clp: Math.round(rec.dusFob * q.rate),
        shipment_date: date,
        input_vat_local: inputVatClp(rec),
        status: "documents_pending",
        source: "sii_demo",
        external_ref: rec.externalRef,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") {
        skipped += 1 // double click / concurrent sync
        continue
      }
      console.error("[syncWithSII] insert", rec.externalRef, error.code, error.message)
      warnings.push(`${rec.reference}: could not be saved (${error.code ?? "error"})`)
      continue
    }
    inserted.push({ rec, id: data.id as string })
  }

  // ---- engine-owned writes (service role), strictly scoped to this org's new rows
  let claimsReady = 0
  let claimsFiled = 0
  let claimsBlocked = 0
  if (inserted.length > 0) {
    if (hasAdminClient()) {
      const r = await enrichShipments(org.orgId, inserted, now)
      claimsReady = r.ready
      claimsFiled = r.filed
      claimsBlocked = r.blocked
      warnings.push(...r.warnings)
    } else {
      claimsBlocked = inserted.length
      warnings.push("SUPABASE_SERVICE_ROLE_KEY is not set on the server: claims stay as drafts and no document checks ran. Add it in Vercel, redeploy, then use \"Run checks\" on the dashboard.")
    }
  }

  // ---- sync history (non-fatal)
  const fx = Array.from(quotes.values()).map((q) => ({ pair: `${q.base}/${q.quote}`, rate: q.rate, asOf: q.asOf, source: q.source }))
  await supabase.from("ingest_runs").insert({
    org_id: org.orgId,
    source: "sii_demo",
    fetched: batch.length,
    inserted: inserted.length,
    skipped,
    fx,
  })

  Array.from(quotes.values()).forEach((q) => warnings.push(...q.warnings))
  revalidatePath("/shipments")
  revalidatePath("/dashboard")
  revalidatePath("/iva")

  if (inserted.length === 0 && skipped === 0) return { ...fail("No shipment could be saved."), warnings }

  return {
    status: "success",
    message: `Synced ${inserted.length} shipment${inserted.length === 1 ? "" : "s"} from the SII demo feed and converted them to CLP with live FX.`,
    synced: inserted.length,
    skipped,
    claimsReady,
    claimsFiled,
    claimsBlocked,
    fx,
    warnings: Array.from(new Set(warnings)),
  }
}
