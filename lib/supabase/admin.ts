import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role client. BYPASSES RLS - server-only, never import it from a Client Component and
 * never expose SUPABASE_SERVICE_ROLE_KEY with a NEXT_PUBLIC_ prefix.
 *
 * Every caller MUST already have verified the user's org + role (requireOrg / MCP auth) and MUST
 * scope each query with .eq("org_id", <verified org>).
 */
let cached: SupabaseClient | null = null

export function hasAdminClient(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("createAdminClient() is server-only")
  if (!hasAdminClient()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  cached ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
