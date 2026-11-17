/**
 * Deterministic checks on an SII-sourced export record.
 * No AI is involved: the verdict comes only from these rules (the product's core rule).
 */
import { validateRut } from "@/lib/rut"
import type { SiiExportRecord } from "@/lib/sii-demo"

export interface RuleIssue {
  severity: "error" | "warning" | "info"
  code: string
  message: string
}

export interface RecordVerdict {
  invoiceOk: boolean
  dusOk: boolean
  issues: RuleIssue[]
}

/** Invoice (minus freight/insurance) must equal the FOB declared in the DUS, within 0.5 %. */
const FOB_TOLERANCE = 0.005

export function checkSiiRecord(r: SiiExportRecord): RecordVerdict {
  const issues: RuleIssue[] = []
  let invoiceOk = true
  let dusOk = true

  if (!validateRut(r.exporterRut)) {
    invoiceOk = false
    issues.push({ severity: "error", code: "RUT_INVALID", message: `Exporter RUT ${r.exporterRut} fails the modulo-11 check.` })
  }

  const impliedFob = r.invoiceTotal - r.freightInsurance
  const diff = Math.abs(impliedFob - r.dusFob) / r.dusFob
  if (diff > FOB_TOLERANCE) {
    dusOk = false
    issues.push({
      severity: "error",
      code: "FOB_MISMATCH",
      message: `Invoice ${r.invoiceTotal.toLocaleString("en-US")} ${r.currency} minus freight/insurance gives ${impliedFob.toLocaleString("en-US")}, but the DUS declares FOB ${r.dusFob.toLocaleString("en-US")} (${(diff * 100).toFixed(1)}% apart).`,
    })
  }

  if (!r.dusLegalized) {
    dusOk = false
    issues.push({ severity: "error", code: "DUS_NOT_LEGALIZED", message: "The DUS has not been legalized by Aduanas yet." })
  }

  return { invoiceOk, dusOk, issues }
}
