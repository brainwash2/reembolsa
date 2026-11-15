import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type OrgRole = "owner" | "accountant" | "viewer"

export interface CurrentOrg {
  userId: string
  email: string
  orgId: string
  orgName: string
  role: OrgRole
}

/**
 * Authenticated user, verified with Supabase Auth (getUser, never getSession).
 * React `cache()` dedupes the network call across layout + page + components
 * within one request.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * The organization the signed-in user acts in.
 *
 * - `.limit(1).maybeSingle()` instead of `.single()`: `.single()` throws when a
 *   user belongs to 2+ orgs (accountants will), which silently produced empty data.
 * - Ordered by membership age so the result is deterministic.
 * - Returns null when the user has no membership. Callers must render an explicit
 *   empty state instead of showing "$0" - that was the original bug.
 */
export const getCurrentOrg = cache(async (): Promise<CurrentOrg | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[getCurrentOrg]", error.message)
    return null
  }
  if (!data) return null

  // PostgREST returns the embedded to-one relation as an object; guard for array typing.
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations

  return {
    userId: user.id,
    email: user.email ?? "",
    orgId: data.org_id as string,
    orgName: (org?.name as string | undefined) ?? "Unnamed organization",
    role: data.role as OrgRole,
  }
})

/** For pages/actions: redirect to /login when signed out; null when signed in without an org. */
export async function requireOrg(): Promise<CurrentOrg | null> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return getCurrentOrg()
}
