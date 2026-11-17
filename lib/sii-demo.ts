/**
 * SIMULATED SII feed (demo only).
 *
 * There is no public SII API for an exporter's DUS / export invoices (DTE type 110) / purchase
 * ledger (RCV). A production integration needs the taxpayer's own SII credentials/certificate or
 * an accredited intermediary - not verified here. This module imitates that payload so the whole
 * downstream pipeline (FX, deterministic checks, claims, dashboard, MCP) can be exercised.
 *
 * All buyers, tax IDs and folios are FICTIONAL. Rows created from this feed are stored with
 * source = 'sii_demo' and labelled "Demo" in the UI so they can never be mistaken for real data.
 */
import { buildRut } from "@/lib/rut"

export const IVA_RATE = 0.19

export interface SiiExportRecord {
  /** Stable id of the record in the (simulated) SII feed. */
  externalRef: string
  reference: string
  dteFolio: number
  dusNumber: string
  /** null = DUS not legalized yet. */
  dusLegalized: boolean
  exporterRut: string
  buyer: { name: string; country: string; taxId: string }
  destination: string
  incoterm: "FOB" | "CIF" | "CFR"
  goods: string
  currency: "USD" | "EUR"
  /** Invoice total in `currency` (what the DTE 110 says). */
  invoiceTotal: number
  /** Freight + insurance included in the invoice total (0 for FOB). */
  freightInsurance: number
  /** FOB value declared in the DUS, in `currency`. */
  dusFob: number
  /** Net purchases of the period tied to this export (from the simulated RCV), CLP. */
  inputNetClp: number
  shipmentDaysAgo: number
  /** Days ago the F3600 was filed with SII; null = not filed. */
  filedDaysAgo: number | null
}

const EXPORTER_RUT = buildRut("76543210")

type Seed = Omit<SiiExportRecord, "externalRef" | "reference" | "dteFolio" | "dusNumber" | "exporterRut" | "dusLegalized"> & {
  dusLegalized?: boolean
}

// Pattern per block of 5: filed, filed, ready-to-file, ready-to-file, DUS/invoice mismatch (error).
const SEEDS: Seed[] = [
  // ---- block 1
  { buyer: { name: "Shanghai Cherry Partners Ltd (demo)", country: "CN", taxId: "91310000DEMO00001X" }, destination: "China", incoterm: "CIF", goods: "Fresh cherries, 5 kg boxes", currency: "USD", invoiceTotal: 76_500, freightInsurance: 6_500, dusFob: 70_000, inputNetClp: 41_800_000, shipmentDaysAgo: 52, filedDaysAgo: 38 },
  { buyer: { name: "Hamburg Fresh Imports GmbH (demo)", country: "DE", taxId: "DE000000001" }, destination: "Germany", incoterm: "CIF", goods: "Blueberries, 125 g punnets", currency: "EUR", invoiceTotal: 48_200, freightInsurance: 3_800, dusFob: 44_400, inputNetClp: 25_300_000, shipmentDaysAgo: 41, filedDaysAgo: 14 },
  { buyer: { name: "Rotterdam Wijn Handel BV (demo)", country: "NL", taxId: "NL000000001B01" }, destination: "Netherlands", incoterm: "FOB", goods: "Bottled wine, 12 x 750 ml cases", currency: "EUR", invoiceTotal: 31_900, freightInsurance: 0, dusFob: 31_900, inputNetClp: 17_400_000, shipmentDaysAgo: 24, filedDaysAgo: null },
  { buyer: { name: "Pacific Berry Distributors LLC (demo)", country: "US", taxId: "00-0000001" }, destination: "United States", incoterm: "FOB", goods: "Frozen raspberries, 10 kg bags", currency: "USD", invoiceTotal: 54_300, freightInsurance: 0, dusFob: 54_300, inputNetClp: 29_700_000, shipmentDaysAgo: 19, filedDaysAgo: null },
  { buyer: { name: "Nordic Salmon Trading AS (demo)", country: "NO", taxId: "000000001MVA" }, destination: "Norway", incoterm: "CIF", goods: "Atlantic salmon fillets", currency: "EUR", invoiceTotal: 62_400, freightInsurance: 3_500, dusFob: 56_900, inputNetClp: 33_900_000, shipmentDaysAgo: 11, filedDaysAgo: null },
  // ---- block 2
  { buyer: { name: "Guangzhou Orchard Co Ltd (demo)", country: "CN", taxId: "91440000DEMO00002X" }, destination: "China", incoterm: "CFR", goods: "Fresh cherries, 2.5 kg boxes", currency: "USD", invoiceTotal: 118_200, freightInsurance: 7_200, dusFob: 111_000, inputNetClp: 66_100_000, shipmentDaysAgo: 60, filedDaysAgo: 45 },
  { buyer: { name: "London Cellar Imports Ltd (demo)", country: "GB", taxId: "GB000000001" }, destination: "United Kingdom", incoterm: "FOB", goods: "Bottled wine, 6 x 750 ml cases", currency: "USD", invoiceTotal: 22_750, freightInsurance: 0, dusFob: 22_750, inputNetClp: 12_600_000, shipmentDaysAgo: 33, filedDaysAgo: 9 },
  { buyer: { name: "Seoul Fruit Network Inc (demo)", country: "KR", taxId: "000-00-00001" }, destination: "South Korea", incoterm: "CIF", goods: "Table grapes", currency: "USD", invoiceTotal: 40_800, freightInsurance: 2_800, dusFob: 38_000, inputNetClp: 21_900_000, shipmentDaysAgo: 22, filedDaysAgo: null },
  { buyer: { name: "Antwerp Avocado Wholesale NV (demo)", country: "BE", taxId: "BE0000000001" }, destination: "Belgium", incoterm: "FOB", goods: "Hass avocados", currency: "EUR", invoiceTotal: 27_300, freightInsurance: 0, dusFob: 27_300, inputNetClp: 15_200_000, shipmentDaysAgo: 16, filedDaysAgo: null },
  { buyer: { name: "Osaka Marine Foods KK (demo)", country: "JP", taxId: "T0000000000001" }, destination: "Japan", incoterm: "CIF", goods: "Frozen salmon portions", currency: "USD", invoiceTotal: 83_000, freightInsurance: 5_000, dusFob: 74_800, inputNetClp: 44_800_000, shipmentDaysAgo: 8, filedDaysAgo: null },
  // ---- block 3
  { buyer: { name: "Lyon Primeur SAS (demo)", country: "FR", taxId: "FR00000000001" }, destination: "France", incoterm: "FOB", goods: "Kiwifruit trays", currency: "EUR", invoiceTotal: 19_800, freightInsurance: 0, dusFob: 19_800, inputNetClp: 10_900_000, shipmentDaysAgo: 47, filedDaysAgo: 30 },
  { buyer: { name: "Dubai Gourmet Trading LLC (demo)", country: "AE", taxId: "100000000000001" }, destination: "United Arab Emirates", incoterm: "CFR", goods: "Dried apricots and walnuts", currency: "USD", invoiceTotal: 36_400, freightInsurance: 2_400, dusFob: 34_000, inputNetClp: 18_700_000, shipmentDaysAgo: 29, filedDaysAgo: 6 },
  { buyer: { name: "Toronto Harvest Corp (demo)", country: "CA", taxId: "000000001RT0001" }, destination: "Canada", incoterm: "FOB", goods: "Frozen blueberries, 15 kg", currency: "USD", invoiceTotal: 47_900, freightInsurance: 0, dusFob: 47_900, inputNetClp: 26_400_000, shipmentDaysAgo: 18, filedDaysAgo: null },
  { buyer: { name: "Madrid Mar y Tierra SL (demo)", country: "ES", taxId: "ESB00000001" }, destination: "Spain", incoterm: "CIF", goods: "Olive oil, 5 L tins", currency: "EUR", invoiceTotal: 29_100, freightInsurance: 1_900, dusFob: 27_200, inputNetClp: 15_500_000, shipmentDaysAgo: 13, filedDaysAgo: null },
  { buyer: { name: "Mumbai Dry Fruit Exports Pvt (demo)", country: "IN", taxId: "00AAAAA0000A1Z5" }, destination: "India", incoterm: "CIF", goods: "Dried plums", currency: "USD", invoiceTotal: 58_000, freightInsurance: 3_000, dusFob: 52_600, inputNetClp: 31_000_000, shipmentDaysAgo: 7, filedDaysAgo: null },
]

export const SII_DEMO_RECORDS: readonly SiiExportRecord[] = SEEDS.map((s, i) => {
  const n = i + 1
  return {
    ...s,
    externalRef: `SII-DEMO-${String(n).padStart(4, "0")}`,
    reference: `EXP-2026-${String(100 + n).padStart(4, "0")}`,
    dteFolio: 4_100 + n * 7,
    dusNumber: `DUS-${6_000_000 + n * 113}`,
    exporterRut: EXPORTER_RUT,
    dusLegalized: s.dusLegalized ?? true,
  }
})

/** Next `n` records the org has not synced yet (idempotent: clicking twice never duplicates). */
export function pickNextBatch(alreadySynced: ReadonlySet<string>, n = 5): SiiExportRecord[] {
  return SII_DEMO_RECORDS.filter((r) => !alreadySynced.has(r.externalRef)).slice(0, n)
}

/** Input VAT credit (IVA crédito fiscal) from the simulated purchase ledger, CLP. */
export const inputVatClp = (r: SiiExportRecord) => Math.round(r.inputNetClp * IVA_RATE)

export function isoDaysAgo(days: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - days))
  return d.toISOString().slice(0, 10)
}
