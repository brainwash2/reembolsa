export const dynamic = "force-dynamic"

import { headers } from "next/headers"
import { requireOrg } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/format"
import { DATA_SOURCES } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NoOrgNotice } from "@/components/no-org-notice"
import { McpTokenManager, type TokenView } from "@/components/mcp-token-manager"

const day = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : null)

export default async function SettingsPage() {
  const org = await requireOrg()
  if (!org) return <NoOrgNotice />

  const supabase = await createClient()
  // token_hash is not selectable by clients (column grant in 0006)
  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("id, name, token_prefix, scopes, created_at, expires_at, last_used_at, revoked_at")
    .eq("org_id", org.orgId)
    .order("created_at", { ascending: false })

  const now = Date.now()
  const tokens: TokenView[] = (data ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    name: t.name as string,
    prefix: t.token_prefix as string,
    scopes: t.scopes as string[],
    status: t.revoked_at ? "revoked" : new Date(t.expires_at as string).getTime() <= now ? "expired" : "active",
    created: day(t.created_at as string) ?? "",
    expires: day(t.expires_at as string) ?? "",
    lastUsed: day(t.last_used_at as string | null),
  }))

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const mcpUrl = `${proto}://${host}/api/mcp`

  return (
    <div className="max-w-2xl space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account, AI agent access and data sources.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Profile Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Email Address</p>
            <p className="break-all text-sm font-semibold text-slate-900">{org.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Organization Name</p>
            <p className="text-sm font-semibold text-slate-900">{org.orgName}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Your role</p>
            <p className="text-sm font-semibold capitalize text-slate-900">{org.role}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI agent access (MCP)</CardTitle>
          <CardDescription>
            Let Claude or any MCP client read your pending claims, live FX and refund estimates. Read-only, scoped to this organization, revocable any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <McpTokenManager
            tokens={tokens}
            canCreate={org.role !== "viewer"}
            mcpUrl={mcpUrl}
            migrationMissing={!!error && (error.code === "42P01" || error.code === "PGRST205")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live data sources</CardTitle>
          <CardDescription>Free public APIs used for FX, UF and UTM. Shown for transparency and attribution.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {DATA_SOURCES.map((s) => (
              <li key={s.id} className="flex flex-col sm:flex-row sm:justify-between sm:gap-4">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 hover:underline">{s.name}</a>
                <span className="text-slate-500">{s.use}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">Rates By Exchange Rate API (fallback provider, attribution required).</p>
        </CardContent>
      </Card>
    </div>
  )
}
