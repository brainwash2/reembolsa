/**
 * Chilean RUT / RUN validation (modulo 11). Pure logic - no API needed or exists for it.
 * Accepts "76.123.456-K", "76123456K", "76123456-k".
 */
export function cleanRut(input: string): string {
  return input.replace(/[.\s-]/g, "").toUpperCase()
}

export function rutCheckDigit(body: string): string {
  let sum = 0
  let factor = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const remainder = 11 - (sum % 11)
  if (remainder === 11) return "0"
  if (remainder === 10) return "K"
  return String(remainder)
}

export function validateRut(input: string | null | undefined): boolean {
  if (!input) return false
  const clean = cleanRut(input)
  if (!/^\d{6,8}[0-9K]$/.test(clean)) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return rutCheckDigit(body) === dv
}

export function formatRut(input: string): string {
  const clean = cleanRut(input)
  if (clean.length < 2) return input
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`
}

/** Builds a syntactically valid RUT from a body (used for demo data only). */
export function buildRut(body: string): string {
  return formatRut(`${body}${rutCheckDigit(body)}`)
}
