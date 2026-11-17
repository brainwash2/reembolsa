import Link from "next/link"
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import type { CashAlert } from "@/lib/cashflow"

const style = {
  critical: { icon: AlertOctagon, box: "border-red-200 bg-red-50", text: "text-red-800", sub: "text-red-700" },
  warning: { icon: AlertTriangle, box: "border-amber-200 bg-amber-50", text: "text-amber-900", sub: "text-amber-800" },
  info: { icon: Info, box: "border-sky-200 bg-sky-50", text: "text-sky-900", sub: "text-sky-800" },
} as const

export function AlertsPanel({ alerts }: { alerts: CashAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        Nothing needs your attention: no overdue refunds and no blocked claims.
      </div>
    )
  }
  return (
    <ul className="space-y-2" aria-label="Cash alerts">
      {alerts.map((a) => {
        const s = style[a.level]
        return (
          <li key={a.code}>
            <Link href={a.href} className={`flex min-h-[44px] items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:brightness-95 ${s.box}`}>
              <s.icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} aria-hidden />
              <span className="min-w-0">
                <span className={`block font-medium ${s.text}`}>{a.title}</span>
                <span className={`block text-xs ${s.sub}`}>{a.detail}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
