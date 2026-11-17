import { createAdminClient } from "@/lib/supabase/admin"
import { checkSiiRecord } from "@/lib/rules/sii-checks"
import type { SiiExportRecord } from "@/lib/sii-demo"

export interface EnrichResult {
  ready: number
  filed: number
  blocked: number
  warnings: string[]
}

/**
 * Writes the rules-engine verdict for already-inserted shipments (service role, scoped to one org).
 * Only the deterministic checks decide; the claim moves draft -> ready -> filed through the same
 * DB gate every other path goes through. Safe to run again: issues are replaced, documents upserted.
 */
export async function enrichShipments(orgId: string, rows: { rec: SiiExportRecord; id: string }[], now: Date): Promise<EnrichResult> {
  const admin = createAdminClient()
  const out: EnrichResult = { ready: 0, filed: 0, blocked: 0, warnings: [] }

  for (const { rec, id } of rows) {
    const verdict = checkSiiRecord(rec)
    const base = `${orgId}/${id}`
    try {
      // engine-owned rows: replace, never accumulate duplicates on a re-run
      const del = await admin.from("issues").delete().eq("org_id", orgId).eq("shipment_id", id)
      if (del.error) throw del.error
      if (verdict.issues.length > 0) {
        const { error } = await admin
          .from("issues")
          .insert(verdict.issues.map((i) => ({ org_id: orgId, shipment_id: id, severity: i.severity, code: i.code, message: i.message })))
        if (error) throw error
      }

      // SII e-documents have no uploaded file; file_url is a logical reference (see documents.source).
      const { error: docErr } = await admin.from("documents").upsert(
        [
          {
            org_id: orgId, shipment_id: id, type: "invoice", source: "sii_demo",
            file_url: `${base}/sii-dte-110-${rec.dteFolio}.json`, validated: verdict.invoiceOk,
            extracted_data: { dte_type: 110, folio: rec.dteFolio, total: rec.invoiceTotal, currency: rec.currency, freight_insurance: rec.freightInsurance, exporter_rut: rec.exporterRut },
          },
          {
            org_id: orgId, shipment_id: id, type: "dus", source: "sii_demo",
            file_url: `${base}/sii-dus-${rec.dusNumber}.json`, validated: verdict.dusOk,
            extracted_data: { dus: rec.dusNumber, fob: rec.dusFob, currency: rec.currency, legalized: rec.dusLegalized },
          },
        ],
        { onConflict: "shipment_id,type" }
      )
      if (docErr) throw docErr

      const hasError = verdict.issues.some((i) => i.severity === "error")
      if (hasError || !verdict.invoiceOk || !verdict.dusOk) {
        out.blocked += 1
        continue
      }

      const { error: readyErr } = await admin.from("iva_claims").update({ status: "ready" }).eq("org_id", orgId).eq("shipment_id", id).eq("status", "draft")
      if (readyErr) throw readyErr
      let shipmentStatus = "validated"

      if (rec.filedDaysAgo !== null) {
        const filedAt = new Date(now.getTime() - rec.filedDaysAgo * 86_400_000).toISOString()
        const { error: fileErr } = await admin.from("iva_claims").update({ status: "filed", filed_at: filedAt }).eq("org_id", orgId).eq("shipment_id", id).eq("status", "ready")
        if (fileErr) throw fileErr
        out.filed += 1
        shipmentStatus = "claim_filed"
      } else {
        out.ready += 1
      }
      await admin.from("shipments").update({ status: shipmentStatus }).eq("org_id", orgId).eq("id", id)
    } catch (e) {
      console.error("[enrich]", rec.externalRef, (e as { message?: string }).message)
      out.blocked += 1
      out.warnings.push(`${rec.reference}: validation step failed; claim left as draft.`)
    }
  }
  return out
}
