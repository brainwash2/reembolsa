import assert from "node:assert/strict"
import { verifyBuyer, normalizeVat } from "../lib/buyer-verification.ts"

const mk = (status: number, body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
let seen = ""
const spy = (body: unknown, status = 200): typeof fetch => (async (u: string) => { seen = String(u); return new Response(JSON.stringify(body), { status }) }) as unknown as typeof fetch

assert.equal(normalizeVat("NL", "NL 0000.00.001 B01"), "000000001B01")
assert.equal(normalizeVat("GR", "EL123456789"), "123456789")

let r = await verifyBuyer("DE", "DE 123456789", spy({ isValid: true, name: "ACME GMBH", address: "BERLIN" }))
assert.equal(r.status, "valid"); assert.equal(r.name, "ACME GMBH")
assert.ok(seen.endsWith("/ms/DE/vat/123456789"), seen)
r = await verifyBuyer("GR", "EL123456789", spy({ isValid: false, name: "---", address: "---" }))
assert.equal(r.status, "invalid"); assert.equal(r.name, null); assert.ok(seen.includes("/ms/EL/vat/"))
// provider errors are NEVER reported as invalid
r = await verifyBuyer("FR", "FR00000000001", mk(503, { actionSucceed: false }))
assert.equal(r.status, "unavailable")
r = await verifyBuyer("FR", "FR00000000001", (async () => { throw new Error("net") }) as unknown as typeof fetch)
assert.equal(r.status, "unavailable")
// Norway
r = await verifyBuyer("NO", "923 609 016 MVA", spy({ navn: "EQUINOR ASA", forretningsadresse: { adresse: ["Forusbeen 50"], postnummer: "4035", poststed: "STAVANGER" } }))
assert.equal(r.status, "valid"); assert.ok(seen.endsWith("/enheter/923609016")); assert.match(r.address!, /STAVANGER/)
r = await verifyBuyer("NO", "923609016", spy({ navn: "X AS", konkurs: true }))
assert.equal(r.status, "invalid")
r = await verifyBuyer("NO", "923609016", mk(404, {}))
assert.equal(r.status, "invalid")
r = await verifyBuyer("NO", "12345", mk(200, {}))
assert.equal(r.status, "invalid")
// unsupported + bad input
r = await verifyBuyer("US", "00-0000001"); assert.equal(r.status, "not_checkable")
r = await verifyBuyer("", "x"); assert.equal(r.status, "not_checkable")
console.log("buyer tests OK")
