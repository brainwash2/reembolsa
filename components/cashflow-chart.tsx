"use client"

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { CashflowPoint } from "@/lib/cashflow"

interface TooltipPayloadItem {
  value: number
  name: string
  color: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-slate-900">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-xs tabular-nums text-slate-600">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: entry.color }} />
          {entry.name}: <span className="font-medium text-slate-900">{Number(entry.value).toFixed(1)}</span> CLP M
        </p>
      ))}
    </div>
  )
}

/** Data comes from real iva_claims rows (see lib/cashflow.ts), not mock data. */
export function CashflowChart({ data, etaDays }: { data: CashflowPoint[]; etaDays: number }) {
  const empty = data.every((d) => d.expectedRefunds === 0 && d.potentialRefunds === 0 && d.lockedCash === 0)

  if (empty) {
    return (
      <div className="flex h-72 flex-col items-center justify-center text-center text-sm text-slate-500">
        <p>No open claims to project yet.</p>
        <p className="text-xs text-slate-400">Run “Sync with SII (Demo)” on the Shipments page.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}M`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" formatter={(v) => <span className="text-slate-600">{v}</span>} />
            <Bar dataKey="expectedRefunds" name="Filed - expected refund" stackId="r" fill="#0d9488" barSize={36} />
            <Bar dataKey="potentialRefunds" name="Not filed - if filed today" stackId="r" fill="#99f6e4" stroke="#0d9488" strokeDasharray="4 2" radius={[4, 4, 0, 0]} barSize={36} />
            <Line type="monotone" dataKey="lockedCash" name="Locked cash after month" stroke="#334155" strokeWidth={2.5} dot={{ r: 3, fill: "#334155" }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Projection from your iva_claims: refund expected {etaDays} days after filing (planning assumption, not an SII commitment).
      </p>
    </div>
  )
}
