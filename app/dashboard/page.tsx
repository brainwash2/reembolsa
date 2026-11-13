"use client";

import Link from "next/link";
import { Lock, Clock, FileCheck2, AlertTriangle, ArrowUpRight, Sparkles, Copy } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { CashflowChart } from "@/components/cashflow-chart";
import { ShipmentStatusBadge } from "@/components/status-badge";
import { ivaClaims, issues, shipments, mcpExamplePrompts } from "@/lib/mock-data";
import { formatClp, formatDate } from "@/lib/format";
import { toast } from "sonner";

export default function DashboardPage() {
  // KPI calculations
  const lockedCash = ivaClaims
    .filter((c) => c.status !== "paid")
    .reduce((sum, c) => sum + c.amountClp, 0);

  const pendingClaims = ivaClaims.filter((c) => c.status === "filed" || c.status === "approved");
  const refundsPending = pendingClaims.reduce((sum, c) => sum + c.amountClp, 0);

  const readyClaims = ivaClaims.filter((c) => c.status === "ready");
  const readyToFile = readyClaims.reduce((sum, c) => sum + c.amountClp, 0);

  const openErrorIssues = issues.filter((i) => i.severity === "error");

  // Needs attention: shipments with most error issues
  const errorIssuesByShipment = new Map<string, number>();
  issues.filter((i) => i.severity === "error").forEach((i) => {
    errorIssuesByShipment.set(i.shipmentId, (errorIssuesByShipment.get(i.shipmentId) || 0) + 1);
  });
  const needsAttention = Array.from(errorIssuesByShipment.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ shipment: shipments.find((s) => s.id === id)!, errorCount: count }));

  const copyToken = () => {
    toast.success("Token copied (demo)", { description: "rb_live_••••••••••••a91f" });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Overview of your IVA Exportador recovery pipeline</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Locked Cash"
          value={formatClp(lockedCash)}
          helperText="IVA not yet recovered"
          icon={<Lock className="h-4 w-4" />}
          tone="teal"
        />
        <KpiCard
          label="Refunds Pending"
          value={formatClp(refundsPending)}
          subtitle={`${pendingClaims.length} claim${pendingClaims.length > 1 ? "s" : ""} awaiting SII`}
          icon={<Clock className="h-4 w-4" />}
          tone="sky"
        />
        <KpiCard
          label="Ready to File"
          value={formatClp(readyToFile)}
          subtitle={`${readyClaims.length} claim${readyClaims.length > 1 ? "s" : ""} ready`}
          icon={<FileCheck2 className="h-4 w-4" />}
          tone="emerald"
        />
        <KpiCard
          label="Open Issues"
          value={String(openErrorIssues.length)}
          subtitle={`${openErrorIssues.length} error${openErrorIssues.length > 1 ? "s" : ""} to resolve`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="red"
          href="/shipments"
        />
      </div>

      {/* Chart + MCP Card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Cash flow forecast (CLP millions)</h2>
          <p className="mb-4 text-xs text-slate-500">Expected refunds vs. remaining locked cash</p>
          <CashflowChart />
        </div>

        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-900">Ask your data</h2>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Preview</span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Connect Claude or ChatGPT via MCP to query your Reembolsa data
          </p>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs text-slate-600">rb_live_••••••••••••a91f</code>
            <button
              onClick={copyToken}
              className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
              aria-label="Copy token"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mb-2 text-xs font-medium text-slate-700">Example prompts</p>
          <div className="flex flex-wrap gap-2">
            {mcpExamplePrompts.map((prompt) => (
              <span
                key={prompt}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
              >
                {prompt}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Needs attention */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
          <Link href="/shipments" className="text-xs font-medium text-teal-600 hover:text-teal-700">
            View all shipments
          </Link>
        </div>
        {needsAttention.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No shipments need attention</div>
        ) : (
          <div className="space-y-2">
            {needsAttention.map(({ shipment, errorCount }) => (
              <Link
                key={shipment.id}
                href={`/shipments/${shipment.id}`}
                className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{shipment.reference}</p>
                    <p className="text-xs text-slate-500">{shipment.buyer} · {shipment.destination}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 tabular-nums">
                    {errorCount} error{errorCount > 1 ? "s" : ""}
                  </span>
                  <ShipmentStatusBadge status={shipment.status} />
                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
