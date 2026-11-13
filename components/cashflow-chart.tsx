"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { cashFlowForecast } from "@/lib/mock-data";

interface TooltipPayloadItem {
  value: number;
  name: string;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-slate-900">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-xs tabular-nums text-slate-600">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: entry.color }} />
          {entry.name}: <span className="font-medium text-slate-900">{entry.value.toFixed(2)}</span> CLP M
        </p>
      ))}
    </div>
  );
}

export function CashflowChart() {
  return (
    <div className="w-full">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={cashFlowForecast} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="barTeal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}M`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
              formatter={(value) => <span className="text-slate-600">{value}</span>}
            />
            <Bar
              dataKey="expectedRefunds"
              name="Expected refunds"
              fill="url(#barTeal)"
              radius={[4, 4, 0, 0]}
              barSize={36}
            />
            <Line
              type="monotone"
              dataKey="lockedCash"
              name="Locked cash remaining"
              stroke="#334155"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#334155" }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-400">Forecast based on current claim status (demo data)</p>
    </div>
  );
}
