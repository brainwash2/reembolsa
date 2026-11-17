"use client"

import { useState, useTransition } from "react"
import { ShieldCheck } from "lucide-react"
import { runChecks, type RunChecksState } from "@/actions/verify"
import { Button } from "@/components/ui/button"

export function RunChecksButton() {
  const [state, setState] = useState<RunChecksState>({ status: "idle", message: "" })
  const [pending, start] = useTransition()
  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={pending}
        className="min-h-[44px] bg-teal-600 hover:bg-teal-700"
        onClick={() =>
          start(async () => {
            try { setState(await runChecks()) } catch { setState({ status: "error", message: "Could not run the checks. Try again." }) }
          })
        }
      >
        <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
        {pending ? "Running checks…" : "Run checks now"}
      </Button>
      <div aria-live="polite">
        {state.status === "error" && <p role="alert" className="text-xs text-red-700">{state.message}</p>}
        {state.status === "success" && <p className="text-xs text-emerald-800">{state.message}</p>}
      </div>
    </div>
  )
}
