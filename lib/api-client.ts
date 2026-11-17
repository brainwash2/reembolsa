/**
 * External data sources for Reembolsa. All free, no API key, server-side only.
 *
 * Selection (probed against official docs/specs on 16 Nov 2026 - see REPORT):
 *
 *  FX (USD/EUR -> CLP, also COP/PEN for the LatAm roadmap)
 *   1. Frankfurter v2   https://api.frankfurter.dev/v2/rate/{base}/{quote}[?date=YYYY-MM-DD]
 *        - no key, no daily cap, OpenAPI-documented, historical back to 1982 for CLP
 *          (CLP is supplied by Banco Central de Chile), COP and PEN covered too.
 *   2. mindicador.cl    https://mindicador.cl/api            (Banco Central de Chile data, CLP-native)
 *        - also the source of UF / UTM / dólar observado / euro.
 *   3. ExchangeRate-API https://open.er-api.com/v6/latest/{base}   (latest only, daily)
 *        - requires the visible credit "Rates By Exchange Rate API"; no redistribution.
 *
 *  Chilean indicators (UF, UTM)
 *   1. mindicador.cl  2. findic.cl (same family of API)
 *
 *  Not available as a free JSON API (verified): the customs "dólar aduanero". The official table
 *  is published by Banco Central / Aduanas under DS Hacienda 309. `dolar_intercambio` ("dólar
 *  acuerdo") on mindicador is only used when its date is fresh; otherwise it is reported unavailable.
 *
 * Every provider is queried in parallel with a hard timeout. The first healthy provider in
 * priority order wins; the others become a cross-check. Nothing here ever invents a number: when
 * every provider fails the function returns null and callers must show "unavailable".
 */
import { z } from "zod"

const TIMEOUT_MS = 5_000
const REVALIDATE_LATEST_S = 60 * 60 // 1 h
const REVALIDATE_DATED_S = 60 * 60 * 24 // historical rates do not change

// Overridable so tests (or a proxy) can point elsewhere; defaults are the public endpoints.
const BASE = {
  frankfurter: process.env.FRANKFURTER_BASE_URL ?? "https://api.frankfurter.dev",
  mindicador: process.env.MINDICADOR_BASE_URL ?? "https://mindicador.cl",
  findic: process.env.FINDIC_BASE_URL ?? "https://findic.cl",
  erApi: process.env.EXCHANGERATE_BASE_URL ?? "https://open.er-api.com",
}

export const DATA_SOURCES = [
  { id: "frankfurter", name: "Frankfurter v2", url: "https://frankfurter.dev", use: "FX (primary, historical)" },
  { id: "mindicador", name: "mindicador.cl", url: "https://mindicador.cl", use: "UF, UTM, dólar, euro (Banco Central)" },
  { id: "findic", name: "findic.cl", url: "https://findic.cl", use: "UF/UTM fallback" },
  { id: "open.er-api", name: "ExchangeRate-API (open access)", url: "https://www.exchangerate-api.com", use: "FX fallback (latest)" },
] as const

export type FxSource = "frankfurter" | "mindicador" | "open.er-api"

export interface FxQuote {
  base: string
  quote: string
  rate: number
  /** Date the rate is valid for (may be earlier than requested on weekends/holidays). */
  asOf: string
  source: FxSource
  /** Other healthy providers and how far they are from the chosen one. */
  crossChecks: { source: FxSource; rate: number; divergencePct: number }[]
  warnings: string[]
  /** Credit that MUST be shown in the UI when this source is used. */
  attribution?: string
}

export interface Indicator {
  value: number
  /** ISO date (YYYY-MM-DD) the value applies to. */
  date: string
}

export interface ChileIndicators {
  uf?: Indicator
  utm?: Indicator
  dolarObservado?: Indicator
  euro?: Indicator
  /** "Dólar acuerdo" - only present when fresh (<= 10 days old). Not guaranteed to be the customs rate. */
  dolarAcuerdo?: Indicator
  source: "mindicador" | "findic"
  warnings: string[]
}

// ---------------------------------------------------------------- helpers
async function getJson(url: string, revalidate: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  return res.json()
}

const isoDay = (s: string) => s.slice(0, 10)
const todayIsoChile = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date()) // YYYY-MM-DD

function daysBetween(a: string, b: string) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000
}

const CCY = /^[A-Z]{3}$/

// ---------------------------------------------------------------- schemas
const FrankfurterRate = z.object({
  date: z.string(),
  base: z.string(),
  quote: z.string(),
  rate: z.number().positive(),
})

const MindicadorItem = z.object({ fecha: z.string(), valor: z.number() })
const MindicadorSerie = z.object({ serie: z.array(z.object({ fecha: z.string(), valor: z.number() })) })

const ErApi = z.object({
  result: z.literal("success"),
  time_last_update_utc: z.string().optional(),
  rates: z.record(z.string(), z.number()),
})

// ---------------------------------------------------------------- Chilean indicators
function parseMindicadorItem(raw: unknown): Indicator | undefined {
  const p = MindicadorItem.safeParse(raw)
  return p.success ? { value: p.data.valor, date: isoDay(p.data.fecha) } : undefined
}

function latestOnOrBefore(serie: { fecha: string; valor: number }[], today: string): Indicator | undefined {
  const rows = serie
    .map((r) => ({ date: isoDay(r.fecha), value: r.valor }))
    .filter((r) => r.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return rows[0]
}

async function indicatorsFromMindicador(): Promise<ChileIndicators> {
  const json = (await getJson(`${BASE.mindicador}/api`, REVALIDATE_LATEST_S)) as Record<string, unknown>
  const today = todayIsoChile()
  const warnings: string[] = []

  let dolarAcuerdo = parseMindicadorItem(json.dolar_intercambio)
  if (dolarAcuerdo && daysBetween(dolarAcuerdo.date, today) > 10) {
    warnings.push(`dolar_intercambio is stale (${dolarAcuerdo.date}); customs dollar unavailable`)
    dolarAcuerdo = undefined
  }

  return {
    uf: parseMindicadorItem(json.uf),
    utm: parseMindicadorItem(json.utm),
    dolarObservado: parseMindicadorItem(json.dolar),
    euro: parseMindicadorItem(json.euro),
    dolarAcuerdo,
    source: "mindicador",
    warnings,
  }
}

async function indicatorsFromFindic(): Promise<ChileIndicators> {
  const today = todayIsoChile()
  const [uf, utm] = await Promise.allSettled(
    ["uf", "utm"].map(async (code) => {
      const p = MindicadorSerie.parse(await getJson(`${BASE.findic}/api/${code}`, REVALIDATE_LATEST_S))
      return latestOnOrBefore(p.serie, today)
    })
  )
  return {
    uf: uf.status === "fulfilled" ? uf.value : undefined,
    utm: utm.status === "fulfilled" ? utm.value : undefined,
    source: "findic",
    warnings: ["Served by fallback provider findic.cl"],
  }
}

/** UF, UTM, dólar observado, euro. null when no provider answered. */
export async function getChileIndicators(): Promise<ChileIndicators | null> {
  try {
    const primary = await indicatorsFromMindicador()
    if (primary.uf) return primary
  } catch (e) {
    console.error("[api-client] mindicador indicators failed:", (e as Error).message)
  }
  try {
    const fallback = await indicatorsFromFindic()
    if (fallback.uf || fallback.utm) return fallback
  } catch (e) {
    console.error("[api-client] findic indicators failed:", (e as Error).message)
  }
  return null
}

// ---------------------------------------------------------------- FX
async function fxFrankfurter(base: string, quote: string, date?: string): Promise<FxQuote> {
  const qs = date ? `?date=${date}` : ""
  const raw = await getJson(`${BASE.frankfurter}/v2/rate/${base}/${quote}${qs}`, date ? REVALIDATE_DATED_S : REVALIDATE_LATEST_S)
  const p = FrankfurterRate.parse(raw)
  return { base, quote, rate: p.rate, asOf: p.date, source: "frankfurter", crossChecks: [], warnings: [] }
}

async function fxMindicador(base: string, quote: string, date?: string): Promise<FxQuote> {
  if (quote !== "CLP" || (base !== "USD" && base !== "EUR")) throw new Error("mindicador only serves USD/EUR -> CLP")
  const code = base === "USD" ? "dolar" : "euro"

  if (!date) {
    const ind = await indicatorsFromMindicador()
    const item = base === "USD" ? ind.dolarObservado : ind.euro
    if (!item) throw new Error("mindicador returned no value")
    return { base, quote, rate: item.value, asOf: item.date, source: "mindicador", crossChecks: [], warnings: [] }
  }

  const [y, m, d] = date.split("-")
  const p = MindicadorSerie.parse(await getJson(`${BASE.mindicador}/api/${code}/${d}-${m}-${y}`, REVALIDATE_DATED_S))
  const row = p.serie[0]
  if (!row) throw new Error("no rate published for that date")
  return { base, quote, rate: row.valor, asOf: isoDay(row.fecha), source: "mindicador", crossChecks: [], warnings: [] }
}

async function fxErApi(base: string, quote: string): Promise<FxQuote> {
  const p = ErApi.parse(await getJson(`${BASE.erApi}/v6/latest/${base}`, REVALIDATE_LATEST_S))
  const rate = p.rates[quote]
  if (!rate || rate <= 0) throw new Error(`no ${quote} rate`)
  const asOf = p.time_last_update_utc ? new Date(p.time_last_update_utc).toISOString().slice(0, 10) : todayIsoChile()
  return {
    base,
    quote,
    rate,
    asOf,
    source: "open.er-api",
    crossChecks: [],
    warnings: [],
    attribution: "Rates By Exchange Rate API",
  }
}

/**
 * Live (or dated) FX rate. `date` = YYYY-MM-DD for the rate on the shipment / invoice date.
 * Returns null if every provider failed.
 */
export async function getFxRate(base: string, quote = "CLP", opts: { date?: string } = {}): Promise<FxQuote | null> {
  base = base.toUpperCase()
  quote = quote.toUpperCase()
  if (!CCY.test(base) || !CCY.test(quote)) return null
  if (base === quote) {
    return { base, quote, rate: 1, asOf: opts.date ?? todayIsoChile(), source: "frankfurter", crossChecks: [], warnings: [] }
  }
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) return null

  const attempts: { name: string; run: () => Promise<FxQuote> }[] = [
    { name: "frankfurter", run: () => fxFrankfurter(base, quote, opts.date) },
    { name: "mindicador", run: () => fxMindicador(base, quote, opts.date) },
  ]
  if (!opts.date) attempts.push({ name: "open.er-api", run: () => fxErApi(base, quote) })

  const settled = await Promise.allSettled(attempts.map((a) => a.run()))
  settled.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[api-client] fx ${attempts[i].name} failed:`, (r.reason as Error).message)
  })
  const healthy = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
  if (healthy.length === 0) return null

  const [primary, ...others] = healthy
  const crossChecks = others.map((o) => ({
    source: o.source,
    rate: o.rate,
    divergencePct: (Math.abs(o.rate - primary.rate) / primary.rate) * 100,
  }))
  const warnings: string[] = []
  const worst = Math.max(0, ...crossChecks.map((c) => c.divergencePct))
  if (worst > 1.5) warnings.push(`Providers disagree by ${worst.toFixed(2)}% - check before filing`)
  if (opts.date && primary.asOf !== opts.date) warnings.push(`No fixing on ${opts.date}; used ${primary.asOf}`)

  return { ...primary, crossChecks, warnings }
}

/** Convenience for the dashboard KPI. */
export const getUsdClp = () => getFxRate("USD", "CLP")
