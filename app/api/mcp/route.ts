/**
 * Reembolsa MCP server  ->  POST/GET /api/mcp   (Streamable HTTP, stateless)
 *
 * Tools (all READ-ONLY):
 *   list_pending_claims      open IVA-exportador claims of the caller's org
 *   get_live_exchange_rate   live/dated FX (Frankfurter -> mindicador -> open.er-api)
 *   estimate_refund          estimated CLP refund + expected date for one shipment
 *   get_cashflow_forecast    dated cash forecast: what lands in 30/60/90 days, what is blocked
 *   get_alerts               overdue refunds, blocked claims, claims ready to file
 *   get_financing_estimate   illustrative advance on filed claims (not a lending offer)
 *
 * Two ways to authenticate (Authorization: Bearer ...):
 *   1. Supabase OAuth 2.1 access token (Claude connector flow). The token is verified and every
 *      query runs AS THE USER, so RLS is the authorization layer. OAuth-client sessions are
 *      additionally read-only in the database (0006).
 *   2. Personal access token "rbs_..." created with create_mcp_token() (0006). Hash lookup via the
 *      service role, then only the SECURITY DEFINER function mcp_claims(), which scopes every row
 *      to the token's org and re-checks revocation/expiry/scope on each call.
 *
 * Requires: mcp-handler@^2, @modelcontextprotocol/server@^2, zod@^4, Node 20+.
 */
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { z } from "zod"
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin"
import { getFxRate } from "@/lib/api-client"
import { buildAlerts, cashWindows, estimateAdvance, expectedRefundDate, inflowSchedule, isBlocked, projectCashflow, REFUND_ETA_DAYS, type ClaimView } from "@/lib/cashflow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SCOPES = ["claims:read", "fx:read", "refund:estimate"]

type Mode = "jwt" | "pat"
interface Principal {
  mode: Mode
  token: string
  userId: string
  tokenId?: string
  orgId?: string
  scopes: string[]
  clientId: string
}

const URL_ = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ----------------------------------------------------------------------------- auth
async function verifyToken(_req: Request, bearer?: string) {
  if (!bearer) return undefined

  // Personal access token
  if (bearer.startsWith("rbs_")) {
    if (!hasAdminClient()) return undefined
    const hash = createHash("sha256").update(bearer).digest("hex")
    const { data, error } = await createAdminClient().rpc("mcp_authenticate_token", { p_hash: hash })
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row) return undefined
    return {
      token: bearer,
      clientId: "pat",
      scopes: row.scopes as string[],
      expiresAt: Math.floor(new Date(row.expires_at).getTime() / 1000),
      extra: { mode: "pat", userId: row.user_id, orgId: row.org_id, tokenId: row.token_id },
    }
  }

  // Supabase OAuth / session JWT: verified against the project's JWKS.
  const supa = createClient(URL_(), ANON(), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supa.auth.getClaims(bearer)
  const claims = data?.claims
  if (error || !claims?.sub) return undefined
  return {
    token: bearer,
    clientId: String((claims as Record<string, unknown>).client_id ?? "supabase-session"),
    scopes: SCOPES, // data access is bounded by RLS, not by these labels
    expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
    extra: { mode: "jwt", userId: claims.sub },
  }
}

// ----------------------------------------------------------------------------- data access
interface ClaimRow {
  claim_id: string
  org_id: string
  shipment_id: string
  reference: string
  buyer: string
  destination: string
  currency: string
  invoice_amount: number | string
  export_value_clp: number | string | null
  exchange_rate: number | string | null
  exchange_rate_date: string | null
  shipment_status: string
  claim_status: "draft" | "ready" | "filed" | "approved" | "paid"
  amount_clp: number | string
  local_currency: string
  missing_docs: string[]
  filed_at: string | null
  open_errors: number | string
  source: string
}

async function fetchClaims(p: Principal, opts: { reference?: string; onlyOpen: boolean; limit: number }): Promise<ClaimRow[]> {
  if (p.mode === "pat") {
    const { data, error } = await createAdminClient().rpc("mcp_claims", {
      p_token: p.tokenId,
      p_reference: opts.reference ?? null,
      p_only_open: opts.onlyOpen,
      p_limit: opts.limit,
    })
    if (error) throw new Error("claims lookup failed")
    return (data ?? []) as ClaimRow[]
  }

  // JWT: query AS THE USER (RLS enforced; security_invoker view).
  const supa = createClient(URL_(), ANON(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${p.token}` } },
  })
  let q = supa.from("v_shipment_claims").select("*").order("created_at", { ascending: false }).limit(opts.limit)
  if (opts.onlyOpen) q = q.neq("claim_status", "paid")
  if (opts.reference) {
    q = /^[0-9a-f-]{36}$/i.test(opts.reference) ? q.eq("shipment_id", opts.reference) : q.eq("reference", opts.reference)
  }
  const { data, error } = await q
  if (error) throw new Error("claims lookup failed")
  return (data ?? []) as ClaimRow[]
}

async function audit(p: Principal, tool: string, args: unknown, outcome: "ok" | "denied" | "error", started: number) {
  if (!hasAdminClient()) return
  try {
    await createAdminClient().from("mcp_tool_calls").insert({
      org_id: p.orgId ?? null,
      user_id: p.userId,
      client_id: p.clientId,
      tool,
      args_sha256: createHash("sha256").update(JSON.stringify(args ?? {})).digest("hex"), // hash only: args may hold PII
      outcome,
      duration_ms: Date.now() - started,
    })
  } catch {
    /* logging must never break a tool call */
  }
}

// ----------------------------------------------------------------------------- tools
type Ctx = { http?: { authInfo?: { token: string; clientId: string; scopes: string[]; extra?: Record<string, unknown> } } } | undefined

function principalOf(ctx: Ctx): Principal | null {
  const a = ctx?.http?.authInfo
  if (!a?.extra?.userId) return null
  return {
    mode: a.extra.mode as Mode,
    token: a.token,
    userId: String(a.extra.userId),
    tokenId: a.extra.tokenId as string | undefined,
    orgId: a.extra.orgId as string | undefined,
    scopes: a.scopes,
    clientId: a.clientId,
  }
}

const text = (t: string, structured?: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: t }],
  ...(structured ? { structuredContent: structured } : {}),
})
const toolError = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true as const })
const n = (v: unknown) => Number(v ?? 0)
const clp = (v: number) => `CLP ${Math.round(v).toLocaleString("en-US")}`

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_pending_claims",
      {
        title: "List pending IVA claims",
        description:
          "Lists the caller's IVA-exportador claims that are not paid yet (draft, ready, filed, approved) with amount in CLP, missing documents and blocking errors. Read-only.",
        inputSchema: z.object({
          status: z.enum(["draft", "ready", "filed", "approved"]).optional().describe("Only claims in this state"),
          limit: z.number().int().min(1).max(100).default(25),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args, ctx) => {
        const started = Date.now()
        const p = principalOf(ctx as Ctx)
        if (!p || !p.scopes.includes("claims:read")) return toolError("Not authorized for claims:read.")
        try {
          let rows = await fetchClaims(p, { onlyOpen: true, limit: args.limit })
          if (args.status) rows = rows.filter((r) => r.claim_status === args.status)
          const claims = rows.map((r) => ({
            claim_id: r.claim_id,
            reference: r.reference,
            buyer: r.buyer,
            destination: r.destination,
            status: r.claim_status,
            amount_clp: n(r.amount_clp),
            missing_docs: r.missing_docs,
            open_errors: n(r.open_errors),
            filed_at: r.filed_at,
            source: r.source,
          }))
          const total = claims.reduce((s, c) => s + c.amount_clp, 0)
          await audit(p, "list_pending_claims", args, "ok", started)
          return text(
            claims.length === 0
              ? "No pending claims."
              : `${claims.length} pending claim(s), ${clp(total)} locked.\n` +
                  claims.map((c) => `- ${c.reference} (${c.buyer}): ${clp(c.amount_clp)} [${c.status}]${c.open_errors ? ` - ${c.open_errors} blocking error(s)` : ""}`).join("\n"),
            { claims, total_clp: total }
          )
        } catch (e) {
          console.error("[mcp] list_pending_claims", (e as Error).message)
          await audit(p, "list_pending_claims", args, "error", started)
          return toolError("Could not load claims.")
        }
      }
    )

    server.registerTool(
      "get_live_exchange_rate",
      {
        title: "Live exchange rate",
        description:
          "Live FX rate (default USD->CLP) from free public sources (Frankfurter, Banco Central via mindicador.cl, open.er-api). Optional date for the rate on a past day. Reports the provider and any disagreement between providers.",
        inputSchema: z.object({
          base: z.string().length(3).default("USD").describe("ISO code, e.g. USD or EUR"),
          quote: z.string().length(3).default("CLP"),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD; omit for the latest rate"),
        }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async (args, ctx) => {
        const started = Date.now()
        const p = principalOf(ctx as Ctx)
        if (!p || !p.scopes.includes("fx:read")) return toolError("Not authorized for fx:read.")
        const q = await getFxRate(args.base, args.quote, { date: args.date })
        if (!q) {
          await audit(p, "get_live_exchange_rate", args, "error", started)
          return toolError("All FX providers are unreachable right now. No rate is being guessed.")
        }
        await audit(p, "get_live_exchange_rate", args, "ok", started)
        return text(
          `1 ${q.base} = ${q.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${q.quote} (${q.asOf}, source: ${q.source})` +
            (q.warnings.length ? `\nWarnings: ${q.warnings.join("; ")}` : "") +
            (q.attribution ? `\n${q.attribution}` : ""),
          { ...q }
        )
      }
    )

    server.registerTool(
      "estimate_refund",
      {
        title: "Estimate IVA refund for a shipment",
        description:
          "Estimated CLP refund for one shipment, by reference (e.g. EXP-2026-0101) or id. The refund is the input-VAT credit tied to the export (not 19% of the invoice). Includes the expected date (filing + 45 days, a planning assumption), the FOB value at today's live FX, and what blocks filing.",
        inputSchema: z.object({ shipment: z.string().min(1).max(80).describe("Shipment reference or UUID") }),
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async (args, ctx) => {
        const started = Date.now()
        const p = principalOf(ctx as Ctx)
        if (!p || !p.scopes.includes("refund:estimate")) return toolError("Not authorized for refund:estimate.")
        try {
          const [row] = await fetchClaims(p, { reference: args.shipment, onlyOpen: false, limit: 1 })
          if (!row) {
            await audit(p, "estimate_refund", args, "denied", started)
            return toolError("Shipment not found (or not visible to you).")
          }
          const amount = n(row.amount_clp)
          const filed = (row.claim_status === "filed" || row.claim_status === "approved") && !!row.filed_at
          const eta = expectedRefundDate({ status: row.claim_status === "paid" ? "paid" : row.claim_status, filed_at: row.filed_at })
          const fx = await getFxRate(row.currency, "CLP")
          const fobNow = fx && row.export_value_clp != null && row.exchange_rate ? Math.round((n(row.export_value_clp) / n(row.exchange_rate)) * fx.rate) : null

          const blockers: string[] = []
          if (row.missing_docs.length) blockers.push(`missing documents: ${row.missing_docs.join(", ")}`)
          if (n(row.open_errors) > 0) blockers.push(`${n(row.open_errors)} unresolved error(s) from the rules engine`)

          const out = {
            reference: row.reference,
            claim_status: row.claim_status,
            estimated_refund_clp: row.claim_status === "paid" ? 0 : amount,
            basis: "input VAT credit tied to this export (shipments.input_vat_local)",
            expected_refund_date: row.claim_status === "paid" ? null : eta.toISOString().slice(0, 10),
            date_basis: filed ? `filed ${row.filed_at?.slice(0, 10)} + ${REFUND_ETA_DAYS} days` : `if filed today + ${REFUND_ETA_DAYS} days`,
            fileable_now: blockers.length === 0 && (row.claim_status === "draft" || row.claim_status === "ready"),
            blockers,
            fob_clp_at_shipment: row.export_value_clp != null ? n(row.export_value_clp) : null,
            fob_clp_at_live_rate: fobNow,
            live_fx: fx ? { pair: `${fx.base}/${fx.quote}`, rate: fx.rate, asOf: fx.asOf, source: fx.source } : null,
            disclaimer: "Estimate only. SII decides the amount and timing.",
          }
          await audit(p, "estimate_refund", args, "ok", started)
          return text(
            `${row.reference}: estimated refund ${clp(out.estimated_refund_clp)} around ${out.expected_refund_date ?? "n/a"} (${out.date_basis}).` +
              (blockers.length ? ` Blocked: ${blockers.join("; ")}.` : ""),
            out
          )
        } catch (e) {
          console.error("[mcp] estimate_refund", (e as Error).message)
          await audit(p, "estimate_refund", args, "error", started)
          return toolError("Could not estimate the refund.")
        }
      }
    )

    const asView = (r: ClaimRow): ClaimView => ({
      claim_id: r.claim_id, shipment_id: r.shipment_id, reference: r.reference, buyer: r.buyer, claim_status: r.claim_status,
      amount_clp: r.amount_clp, filed_at: r.filed_at, missing_docs: r.missing_docs, open_errors: r.open_errors, source: r.source,
    })

    server.registerTool(
      "get_cashflow_forecast",
      {
        title: "Cash-flow forecast of export-VAT refunds",
        description:
          "When the exporter's IVA refunds are expected to land: totals arriving within 30/60/90 days (filed claims only), cash that could start its clock if filed today, and cash stuck behind a failed check. Refund date = filing date + 45 days (planning assumption, not an SII deadline). Read-only.",
        inputSchema: z.object({ top: z.number().int().min(1).max(50).default(10).describe("How many dated inflows to list") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args, ctx) => {
        const started = Date.now()
        const p = principalOf(ctx as Ctx)
        if (!p || !p.scopes.includes("claims:read")) return toolError("Not authorized for claims:read.")
        try {
          const views = (await fetchClaims(p, { onlyOpen: true, limit: 100 })).map(asView)
          const schedule = inflowSchedule(views)
          const w = cashWindows(schedule)
          const proj = projectCashflow(views.map((v) => ({ amount_clp: v.amount_clp, status: v.claim_status, filed_at: v.filed_at, blocked: isBlocked(v) })))
          const out = {
            assumption: `refund = filing date + ${REFUND_ETA_DAYS} days (planning assumption, not an SII commitment)`,
            total_locked_clp: proj.totalLockedClp,
            arriving_30d_clp: w.filed30,
            arriving_60d_clp: w.filed60,
            arriving_90d_clp: w.filed90,
            fileable_not_filed_clp: w.fileableClp,
            blocked_clp: w.blockedClp,
            overdue_claims: proj.overdueCount,
            by_month_clp_millions: proj.points,
            inflows: schedule.slice(0, args.top).map((i) => ({ reference: i.reference, buyer: i.buyer, amount_clp: i.amountClp, status: i.status, expected_date: i.blocked ? null : i.expectedDate, days_until: i.blocked ? null : i.daysUntil, overdue: i.overdue, blocked: i.blocked })),
            disclaimer: "Estimate only. SII decides the amount and timing.",
          }
          await audit(p, "get_cashflow_forecast", args, "ok", started)
          return text(
            `${clp(out.total_locked_clp)} locked. Arriving within 30 days: ${clp(w.filed30)}; 60 days: ${clp(w.filed60)}; 90 days: ${clp(w.filed90)}. Ready to file (clock not started): ${clp(w.fileableClp)}. Blocked by a failed check: ${clp(w.blockedClp)}.` +
              (proj.overdueCount ? ` ${proj.overdueCount} filed claim(s) are past the ${REFUND_ETA_DAYS}-day estimate.` : ""),
            out
          )
        } catch (e) {
          console.error("[mcp] get_cashflow_forecast", (e as Error).message)
          await audit(p, "get_cashflow_forecast", args, "error", started)
          return toolError("Could not build the forecast.")
        }
      }
    )

    server.registerTool(
      "get_alerts",
      {
        title: "Cash alerts",
        description: "Alerts derived by fixed rules from the caller's claims: refunds past the expected date, claims blocked by a failed check, claims ready to file, claims the rules engine has not checked. Read-only.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (_args, ctx) => {
        const started = Date.now()
        const p = principalOf(ctx as Ctx)
        if (!p || !p.scopes.includes("claims:read")) return toolError("Not authorized for claims:read.")
        try {
          const alerts = buildAlerts((await fetchClaims(p, { onlyOpen: true, limit: 100 })).map(asView))
          await audit(p, "get_alerts", {}, "ok", started)
          return text(alerts.length === 0 ? "No alerts: nothing overdue or blocked." : alerts.map((a) => `[${a.level}] ${a.title}. ${a.detail}`).join("\n"), { alerts })
        } catch (e) {
          console.error("[mcp] get_alerts", (e as Error).message)
          await audit(p, "get_alerts", {}, "error", started)
          return toolError("Could not load alerts.")
        }
      }
    )

    server.registerTool(
      "get_financing_estimate",
      {
        title: "Illustrative advance on filed refunds",
        description:
          "What an advance against ALREADY-FILED refund claims could look like for a given advance rate and annual fee. Illustrative arithmetic only: Reembolsa does not lend and this is not an offer. Blocked or unfiled claims are never included.",
        inputSchema: z.object({
          advance_rate: z.number().min(0).max(0.95).default(0.8).describe("Share of each claim advanced, 0 to 0.95"),
          annual_fee_rate: z.number().min(0).max(1.2).default(0.24).describe("Assumed simple annual fee on the advanced amount, e.g. 0.24 = 24%"),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args, ctx) => {
        const started = Date.now()
        const p = principalOf(ctx as Ctx)
        if (!p || !p.scopes.includes("claims:read")) return toolError("Not authorized for claims:read.")
        try {
          const filed = inflowSchedule((await fetchClaims(p, { onlyOpen: true, limit: 100 })).map(asView)).filter((i) => i.filed)
          const rows = filed.map((i) => ({ reference: i.reference, refund_clp: i.amountClp, days_to_refund: Math.max(0, i.daysUntil), ...estimateAdvance({ amountClp: i.amountClp, daysToRefund: Math.max(0, i.daysUntil), advanceRate: args.advance_rate, annualFeeRate: args.annual_fee_rate }) }))
          const sum = (k: "advanceClp" | "feeClp" | "netTodayClp" | "remainderAtRefundClp") => rows.reduce((t, r) => t + r[k], 0)
          const out = { filed_claims: rows.length, filed_total_clp: filed.reduce((t, i) => t + i.amountClp, 0), cash_today_clp: sum("netTodayClp"), fee_clp: sum("feeClp"), still_arriving_from_sii_clp: sum("remainderAtRefundClp"), claims: rows, disclaimer: "Illustrative arithmetic, not an offer. Reembolsa does not lend." }
          await audit(p, "get_financing_estimate", args, "ok", started)
          return text(rows.length === 0 ? "No filed claims yet, so nothing to advance against." : `${rows.length} filed claim(s) worth ${clp(out.filed_total_clp)}. At ${Math.round(args.advance_rate * 100)}% advance and ${Math.round(args.annual_fee_rate * 100)}% annual fee: ${clp(out.cash_today_clp)} cash today, fee ${clp(out.fee_clp)}. Illustrative only.`, out)
        } catch (e) {
          console.error("[mcp] get_financing_estimate", (e as Error).message)
          await audit(p, "get_financing_estimate", args, "error", started)
          return toolError("Could not estimate.")
        }
      }
    )
  },
  { serverInfo: { name: "reembolsa", version: "1.1.0" }, verboseLogs: false }
)

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: [],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
})

export { authed as GET, authed as POST }
