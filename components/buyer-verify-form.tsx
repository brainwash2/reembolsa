"use client"

import { useState, useTransition } from "react"
import { BadgeCheck, CircleAlert, CircleHelp, Search } from "lucide-react"
import { checkBuyer } from "@/actions/buyers"
import type { BuyerVerification } from "@/lib/buyer-verification"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const look = {
  valid: { icon: BadgeCheck, cls: "border-emerald-200 bg-emerald-50 text-emerald-900", label: "Verified" },
  invalid: { icon: CircleAlert, cls: "border-red-200 bg-red-50 text-red-900", label: "Not found / inactive" },
  unavailable: { icon: CircleHelp, cls: "border-amber-200 bg-amber-50 text-amber-900", label: "Registry unavailable" },
  not_checkable: { icon: CircleHelp, cls: "border-slate-200 bg-slate-50 text-slate-700", label: "Not checkable" },
} as const

export interface PastCheck extends BuyerVerification { checkedAt: string }

export function BuyerVerifyForm({ shipmentId, country, taxId, history, canCheck, isDemo }: {
  shipmentId: string; country: string; taxId: string; history: PastCheck[]; canCheck: boolean; isDemo: boolean
}) {
  const [c, setC] = useState(country)
  const [t, setT] = useState(taxId)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const latest = history[0]

  function run() {
    setError("")
    start(async () => {
      try {
        const r = await checkBuyer({ shipmentId, country: c, taxId: t })
        if (!r.ok) setError(r.message)
      } catch { setError("The check failed. Try again.") }
    })
  }

  return (
    <div className="space-y-3">
      {isDemo && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          Demo buyers use fictional tax IDs, so a real registry will not know them. Type a real VAT number (for example your own EU customer) to see a live answer.
        </p>
      )}
      {canCheck ? (
        <form onSubmit={(e) => { e.preventDefault(); run() }} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="bv-country">Country (2 letters)</label>
          <Input id="bv-country" value={c} onChange={(e) => setC(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="min-h-[44px] sm:w-20" placeholder="DE" />
          <label className="sr-only" htmlFor="bv-tax">Buyer tax / VAT ID</label>
          <Input id="bv-tax" value={t} onChange={(e) => setT(e.target.value)} className="min-h-[44px] flex-1" placeholder="VAT or organisation number" />
          <Button type="submit" disabled={pending} className="min-h-[44px] bg-teal-600 hover:bg-teal-700">
            <Search className="mr-2 h-4 w-4" aria-hidden />{pending ? "Checking…" : "Verify buyer"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-slate-500">Your role (viewer) can read results but not run checks.</p>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

      {latest ? (
        <ul className="space-y-2" aria-label="Buyer checks">
          {history.slice(0, 3).map((h, i) => {
            const L = look[h.status]
            return (
              <li key={i} className={`rounded-lg border p-3 text-sm ${L.cls}`}>
                <p className="flex items-center gap-2 font-medium"><L.icon className="h-4 w-4 shrink-0" aria-hidden />{L.label}{h.name ? ` · ${h.name}` : ""}</p>
                <p className="mt-1 text-xs">{h.note}</p>
                <p className="mt-1 text-[11px] opacity-80">{h.provider === "vies" ? "VIES (European Commission)" : h.provider === "brreg" ? "Brønnøysund Register" : "No registry"} · {h.country} {h.query} · {new Date(h.checkedAt).toISOString().slice(0, 16).replace("T", " ")} UTC</p>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Not checked yet.</p>
      )}
    </div>
  )
}
