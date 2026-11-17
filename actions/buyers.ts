"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireOrg } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { verifyBuyer, type BuyerVerification } from "@/lib/buyer-verification"

const input = z.object({
  shipmentId: z.string().uuid(),
  country: z.string().trim().length(2),
  taxId: z.string().trim().min(4).max(40),
})

export type CheckBuyerResult = { ok: true; result: BuyerVerification; saved: boolean } | { ok: false; message: string }

/** Looks the buyer up in the official registry and stores the answer as evidence on the shipment. */
export async function checkBuyer(raw: z.input<typeof input>): Promise<CheckBuyerResult> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, message: "Enter a 2-letter country code and a tax ID." }
  const org = await requireOrg()
  if (!org) return { ok: false, message: "Your account has no organization yet." }
  if (org.role === "viewer") return { ok: false, message: "Your role (viewer) cannot run buyer checks." }

  const supabase = await createClient()
  // The shipment must be visible to this user (RLS) before anything is looked up or stored.
  const { data: ship } = await supabase.from("shipments").select("id").eq("id", parsed.data.shipmentId).eq("org_id", org.orgId).maybeSingle()
  if (!ship) return { ok: false, message: "Shipment not found." }

  const result = await verifyBuyer(parsed.data.country, parsed.data.taxId)

  const { error } = await supabase.from("buyer_verifications").insert({
    org_id: org.orgId,
    shipment_id: parsed.data.shipmentId,
    provider: result.provider,
    status: result.status,
    country: result.country,
    query: result.query.slice(0, 40),
    name: result.name?.slice(0, 300) ?? null,
    address: result.address?.slice(0, 500) ?? null,
    note: result.note.slice(0, 300),
  })
  if (error) console.error("[checkBuyer] save", error.code, error.message)
  revalidatePath(`/shipments/${parsed.data.shipmentId}`)
  return { ok: true, result, saved: !error }
}
