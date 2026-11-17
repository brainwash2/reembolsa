"use client"

import { useState, useTransition } from "react"
import { Check, Copy, KeyRound, ShieldAlert } from "lucide-react"
import { createMcpToken, revokeMcpToken } from "@/actions/mcp-tokens"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export interface TokenView {
  id: string
  name: string
  prefix: string
  scopes: string[]
  status: "active" | "expired" | "revoked"
  created: string
  expires: string
  lastUsed: string | null
}

const SCOPE_LABELS: Record<string, string> = {
  "claims:read": "Read my pending IVA claims",
  "fx:read": "Read live exchange rates",
  "refund:estimate": "Estimate refunds",
}
const STATUS_STYLE = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
  revoked: "bg-red-50 text-red-700 border-red-200",
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      /* clipboard blocked: the text is selectable in the box next to it */
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="h-10 shrink-0 gap-1.5" aria-label={label}>
      {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {done ? "Copied" : "Copy"}
    </Button>
  )
}

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">{title}</p>
        <CopyButton value={code} label={`Copy ${title}`} />
      </div>
      <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{code}</pre>
    </div>
  )
}

export function McpTokenManager({
  tokens, canCreate, mcpUrl, migrationMissing,
}: { tokens: TokenView[]; canCreate: boolean; mcpUrl: string; migrationMissing: boolean }) {
  const [name, setName] = useState("")
  const [ttl, setTtl] = useState(30)
  const [scopes, setScopes] = useState<string[]>(Object.keys(SCOPE_LABELS))
  const [created, setCreated] = useState<{ token: string; expiresAt?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (s: string) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await createMcpToken({ name, ttlDays: ttl, scopes: scopes as never })
      if (r.ok && r.token) {
        setCreated({ token: r.token, expiresAt: r.expiresAt })
        setName("")
      } else setError(r.message ?? "Could not create the token.")
    })
  }

  function revoke(id: string) {
    startTransition(async () => {
      const r = await revokeMcpToken(id)
      if (!r.ok) setError(r.message ?? "Could not revoke the token.")
    })
  }

  if (migrationMissing) {
    return <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Apply migration <code>0006_scaling_features.sql</code> to enable MCP tokens.</p>
  }

  const shown = created?.token ?? "rbs_<your-token>"
  const claudeCode = `claude mcp add --transport http reembolsa ${mcpUrl} --header "Authorization: Bearer ${shown}"`
  const desktop = JSON.stringify(
    { mcpServers: { reembolsa: { command: "npx", args: ["-y", "mcp-remote", mcpUrl, "--header", `Authorization: Bearer ${shown}`] } } },
    null, 2
  )

  return (
    <div className="space-y-6">
      {canCreate ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <label htmlFor="tok-name" className="text-sm font-medium text-slate-700">Token name</label>
              <input
                id="tok-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required
                placeholder="e.g. Claude Desktop - laptop"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tok-ttl" className="text-sm font-medium text-slate-700">Expires in</label>
              <select
                id="tok-ttl" value={ttl} onChange={(e) => setTtl(Number(e.target.value))}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base sm:w-32 sm:text-sm"
              >
                <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Permissions (read-only)</legend>
            {Object.entries(SCOPE_LABELS).map(([s, label]) => (
              <label key={s} className="flex min-h-[44px] items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} className="h-5 w-5 accent-teal-600" />
                <span>{label} <code className="text-xs text-slate-400">{s}</code></span>
              </label>
            ))}
          </fieldset>

          <Button type="submit" disabled={pending || !name.trim() || scopes.length === 0} className="h-11 w-full bg-teal-600 hover:bg-teal-700 sm:w-auto">
            <KeyRound className="mr-2 h-4 w-4" aria-hidden />
            {pending ? "Working…" : "Generate MCP token"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Only owners and accountants can create tokens.</p>
      )}

      <div aria-live="polite" className="space-y-3">
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        {created && (
          <div className="space-y-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Copy this token now. It is shown only once and cannot be recovered.
            </p>
            <div className="flex gap-2">
              <input readOnly value={created.token} onFocus={(e) => e.currentTarget.select()} aria-label="New MCP token"
                className="h-10 min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 font-mono text-xs" />
              <CopyButton value={created.token} label="Copy token" />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>I saved it - hide</Button>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-lg border bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">Connect an AI agent</p>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">Server URL</p>
          <div className="flex gap-2">
            <input readOnly value={mcpUrl} aria-label="MCP server URL" className="h-10 min-w-0 flex-1 rounded-md border bg-white px-3 font-mono text-xs" />
            <CopyButton value={mcpUrl} label="Copy server URL" />
          </div>
        </div>
        <Snippet title="Claude Code" code={claudeCode} />
        <Snippet title="Claude Desktop (claude_desktop_config.json, via mcp-remote)" code={desktop} />
        <p className="text-xs text-slate-500">Tools: list_pending_claims, get_live_exchange_rate, estimate_refund. Tokens are read-only and limited to this organization.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-800">Your tokens</p>
        {tokens.length === 0 ? (
          <p className="text-sm text-slate-500">No tokens yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-white">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    <span className="truncate">{t.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                  </p>
                  <p className="font-mono text-xs text-slate-500">{t.prefix}…</p>
                  <p className="text-xs text-slate-400">
                    Created {t.created} · expires {t.expires} · {t.lastUsed ? `last used ${t.lastUsed}` : "never used"}
                  </p>
                  <p className="text-xs text-slate-400">{t.scopes.join(", ")}</p>
                </div>
                {t.status === "active" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 self-start text-red-600 sm:self-center" disabled={pending}>Revoke</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke “{t.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>Any agent using this token loses access immediately. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => revoke(t.id)} className="bg-red-600 hover:bg-red-700">Revoke</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
