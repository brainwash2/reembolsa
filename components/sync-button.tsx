"use client"

import { useState, useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { syncWithSII, type SyncState } from "@/actions/ingest"
import { Button } from "@/components/ui/button"

export function SyncButton() {
  const [state, setState] = useState<SyncState>({ status: "idle", message: "" })
  const [pending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      try {
        setState(await syncWithSII())
      } catch {
        setState({ status: "error", message: "Sync failed. Please try again." })
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={run} disabled={pending} className="bg-teal-600 hover:bg-teal-700">
          <RefreshCw className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
          {pending ? "Syncing with SII…" : "Sync with SII (Demo)"}
        </Button>
        <p className="text-xs text-slate-500">Simulated SII export feed · FX converted with live rates · no manual entry</p>
      </div>

      <div aria-live="polite">
        {state.status === "error" && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium">{state.message}</p>
            {state.synced ? (
              <p className="text-xs">
                {state.claimsFiled ?? 0} filed · {state.claimsReady ?? 0} ready to file · {state.claimsBlocked ?? 0} blocked by checks
                {state.skipped ? ` · ${state.skipped} already present` : ""}
              </p>
            ) : null}
            {state.fx && state.fx.length > 0 && (
              <ul className="text-xs tabular-nums">
                {state.fx.map((f) => (
                  <li key={`${f.pair}${f.asOf}`}>
                    {f.pair} {f.rate.toLocaleString("en-US", { maximumFractionDigits: 2 })} on {f.asOf} ({f.source})
                  </li>
                ))}
              </ul>
            )}
            {state.warnings?.map((w) => (
              <p key={w} className="text-xs text-amber-800">⚠ {w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
