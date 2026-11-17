"use server"

import { revalidatePath } from "next/cache"
import { requireOrg } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { hasAdminClient } from "@/lib/supabase/admin"
import { enrichShipments } from "@/lib/sii-enrich"
import { SII_DEMO_RECORDS } from "@/lib/sii-demo"

export interface RunChecksState {
  status: "idle" | "success" | "error"
  message: string
}

/**
 * "Run checks": applies the deterministic rules engine to shipments that were synced but whose
 * claims are still draft (for example because the service-role key was added after the first sync).
 */
export async function runChecks(): Promise<RunChecksState> {
  const org = await requireOrg()
  if (!org) return { status: "error", message: "Your account has no organization yet." }
  if (org.role === "viewer") return { status: "error", message: "Your role (viewer) cannot run checks." }
  if (!hasAdminClient()) {
    return {
      status: "error",
      message: "The server has no SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel > Project > Settings > Environment Variables, redeploy, then run the checks again.",
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("shipments")
    .select("id, external_ref, iva_claims(status)")
    .eq("org_id", org.orgId)
    .eq("source", "sii_demo")
  if (error) return { status: "error", message: "Could not read your shipments." }

  const byRef = new Map(SII_DEMO_RECORDS.map((r) => [r.externalRef, r]))
  const todo: { rec: (typeof SII_DEMO_RECORDS)[number]; id: string }[] = []
  for (const s of data ?? []) {
    const claim = Array.isArray(s.iva_claims) ? s.iva_claims[0] : s.iva_claims
    const rec = byRef.get(String(s.external_ref))
    if (rec && claim?.status === "draft") todo.push({ rec, id: String(s.id) })
  }
  if (todo.length === 0) return { status: "success", message: "Nothing to check: no draft claims from the SII feed." }

  const r = await enrichShipments(org.orgId, todo, new Date())
  revalidatePath("/dashboard")
  revalidatePath("/shipments")
  revalidatePath("/iva")
  return {
    status: "success",
    message: `Checked ${todo.length} shipment(s): ${r.filed} filed, ${r.ready} ready to file, ${r.blocked} blocked by a failed check.`,
  }
}
