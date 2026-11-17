"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireOrg } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export interface TokenResult {
  ok: boolean
  message?: string
  /** Plaintext token. Returned ONCE; only its SHA-256 is stored (migration 0006). */
  token?: string
  expiresAt?: string
}

const Input = z.object({
  name: z.string().trim().min(1, "Give the token a name").max(80),
  ttlDays: z.number().int().min(1).max(90),
  scopes: z.array(z.enum(["claims:read", "fx:read", "refund:estimate"])).min(1, "Pick at least one permission"),
})

export async function createMcpToken(input: z.input<typeof Input>): Promise<TokenResult> {
  const org = await requireOrg()
  if (!org) return { ok: false, message: "Your account has no organization yet." }
  if (org.role === "viewer") return { ok: false, message: "Only owners and accountants can create tokens." }

  const parsed = Input.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_mcp_token", {
    p_org: org.orgId,
    p_name: parsed.data.name,
    p_scopes: parsed.data.scopes,
    p_ttl_days: parsed.data.ttlDays,
  })

  if (error) {
    // never log the token; the error carries none
    console.error("[createMcpToken]", error.code, error.message)
    if (error.code === "42501") return { ok: false, message: "You are not allowed to create tokens for this organization." }
    if (error.code === "PGRST202") return { ok: false, message: "Migration 0006 is not applied yet." }
    return { ok: false, message: "Could not create the token." }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.token) return { ok: false, message: "Could not create the token." }

  revalidatePath("/settings")
  return { ok: true, token: row.token as string, expiresAt: row.expires_at as string }
}

export async function revokeMcpToken(id: string): Promise<TokenResult> {
  const org = await requireOrg()
  if (!org) return { ok: false, message: "Your account has no organization yet." }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid token id." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("revoke_mcp_token", { p_id: id })
  if (error) {
    console.error("[revokeMcpToken]", error.code, error.message)
    return { ok: false, message: error.code === "42501" ? "You cannot revoke this token." : "Could not revoke the token." }
  }
  revalidatePath("/settings")
  return { ok: true }
}
