import { AlertTriangle } from "lucide-react"

export function NoOrgNotice() {
  return (
    <div className="p-8">
      <div className="flex max-w-xl items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Your account is not linked to an organization yet.</p>
          <p className="mt-1 text-amber-800">
            Apply migration <code>0003_security_hardening.sql</code> (it creates the organization on signup and back-fills
            existing users), then reload. Nothing is shown until then so you never see misleading $0 figures.
          </p>
        </div>
      </div>
    </div>
  )
}

export function LoadError({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Could not load {what}. This is shown instead of a $0 figure so a failed query is never mistaken for an empty
        account. Check the server logs.
      </p>
    </div>
  )
}
