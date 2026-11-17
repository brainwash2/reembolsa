/**
 * Buyer verification against free official registries. Read-only lookups, no AI.
 *
 *  - EU buyers  -> VIES, the European Commission VAT validation service
 *  - Norway     -> Bronnoysund Register Centre (Enhetsregisteret), open data
 *  - everything else -> "not_checkable": we say so instead of guessing.
 *
 * The result is INFORMATIONAL evidence stored next to the shipment. It never blocks or releases a
 * claim: validity of the claim stays with the deterministic rules in lib/rules.
 * Both endpoints are public, keyless and rate-limited; they are called with a short timeout and
 * any failure is reported as "unavailable", never as "invalid".
 */

export type VerificationStatus = "valid" | "invalid" | "unavailable" | "not_checkable"
export type VerificationProvider = "vies" | "brreg" | "none"

export interface BuyerVerification {
  provider: VerificationProvider
  status: VerificationStatus
  country: string
  query: string
  name: string | null
  address: string | null
  note: string
}

const EU = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"])
const TIMEOUT_MS = 6000

/** Strips the country prefix, spaces and punctuation: "NL 0000.00.001 B01" -> "000000001B01". */
export function normalizeVat(country: string, raw: string): string {
  let v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const prefix = country === "GR" ? ["EL", "GR"] : [country]
  for (const p of prefix) if (v.startsWith(p)) { v = v.slice(p.length); break }
  return v
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<{ ok: boolean; status: number; json: unknown }> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { accept: "application/json" }, cache: "no-store" })
    let json: unknown = null
    try { json = await res.json() } catch { /* not json */ }
    return { ok: res.ok, status: res.status, json }
  } finally {
    clearTimeout(t)
  }
}

export async function verifyBuyer(countryIn: string, taxIdIn: string, fetchImpl: typeof fetch = fetch): Promise<BuyerVerification> {
  const country = countryIn.trim().toUpperCase()
  const base = { country, query: taxIdIn.trim() }

  if (!/^[A-Z]{2}$/.test(country) || taxIdIn.trim().length < 4) {
    return { ...base, provider: "none", status: "not_checkable", name: null, address: null, note: "Enter a 2-letter country code and a tax ID." }
  }

  try {
    if (EU.has(country)) {
      const cc = country === "GR" ? "EL" : country
      const id = normalizeVat(country, taxIdIn)
      const r = await getJson(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${cc}/vat/${encodeURIComponent(id)}`, fetchImpl)
      const j = (r.json ?? {}) as Record<string, unknown>
      if (r.ok && typeof j.isValid === "boolean") {
        const clean = (v: unknown) => (typeof v === "string" && v.trim() && v.trim() !== "---" ? v.trim() : null)
        return {
          ...base, query: `${cc}${id}`, provider: "vies",
          status: j.isValid ? "valid" : "invalid",
          name: clean(j.name), address: clean(j.address),
          note: j.isValid ? "Registered for intra-EU VAT in VIES." : "VIES does not list this VAT number as active.",
        }
      }
      return { ...base, provider: "vies", status: "unavailable", name: null, address: null, note: `VIES did not answer (HTTP ${r.status}). Try again later; nothing was concluded.` }
    }

    if (country === "NO") {
      const id = taxIdIn.toUpperCase().replace(/MVA$/, "").replace(/\D/g, "")
      if (id.length !== 9) {
        return { ...base, provider: "brreg", status: "invalid", name: null, address: null, note: "Norwegian organisation numbers have 9 digits." }
      }
      const r = await getJson(`https://data.brreg.no/enhetsregisteret/api/enheter/${id}`, fetchImpl)
      const j = (r.json ?? {}) as Record<string, unknown>
      if (r.status === 404) return { ...base, query: id, provider: "brreg", status: "invalid", name: null, address: null, note: "Not found in the Norwegian business register." }
      if (r.ok && typeof j.navn === "string") {
        const a = (j.forretningsadresse ?? {}) as { adresse?: string[]; postnummer?: string; poststed?: string }
        const address = [a.adresse?.join(", "), [a.postnummer, a.poststed].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null
        const gone = Boolean(j.konkurs || j.slettedato || j.underAvvikling)
        return {
          ...base, query: id, provider: "brreg", status: gone ? "invalid" : "valid", name: j.navn, address,
          note: gone ? "Registered, but flagged as bankrupt, dissolved or in liquidation." : "Active in the Norwegian business register.",
        }
      }
      return { ...base, provider: "brreg", status: "unavailable", name: null, address: null, note: `The register did not answer (HTTP ${r.status}).` }
    }
  } catch {
    return { ...base, provider: EU.has(country) ? "vies" : "brreg", status: "unavailable", name: null, address: null, note: "The registry could not be reached (timeout or network). Nothing was concluded." }
  }

  return {
    ...base, provider: "none", status: "not_checkable", name: null, address: null,
    note: `No free official registry is wired for ${country} yet. Reembolsa does not guess.`,
  }
}
