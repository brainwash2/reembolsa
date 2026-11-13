"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ivaClaims, shipments } from "@/lib/mock-data";
import { ClaimStepper } from "@/components/claim-stepper";
import { formatClp, formatDate, claimStatusLabels } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClaimStatus } from "@/lib/mock-data";
import { FileText, CheckCircle2, Send, Stamp, Wallet, ArrowRight } from "lucide-react";

const stages: { status: ClaimStatus; label: string; icon: typeof FileText }[] = [
  { status: "draft", label: "Draft", icon: FileText },
  { status: "ready", label: "Ready", icon: CheckCircle2 },
  { status: "filed", label: "Filed", icon: Send },
  { status: "approved", label: "Approved", icon: Stamp },
  { status: "paid", label: "Paid", icon: Wallet },
];

type FilterTab = "all" | "in_progress" | "paid";

export default function IvaPage() {
  const [tab, setTab] = useState<FilterTab>("all");

  const shipmentMap = useMemo(() => {
    const map = new Map<string, { reference: string; buyer: string }>();
    shipments.forEach((s) => map.set(s.id, { reference: s.reference, buyer: s.buyer }));
    return map;
  }, []);

  const stageData = useMemo(() => {
    return stages.map((stage) => {
      const claims = ivaClaims.filter((c) => c.status === stage.status);
      const sum = claims.reduce((acc, c) => acc + c.amountClp, 0);
      return { ...stage, count: claims.length, sum };
    });
  }, []);

  const filteredClaims = useMemo(() => {
    if (tab === "in_progress") return ivaClaims.filter((c) => c.status !== "paid");
    if (tab === "paid") return ivaClaims.filter((c) => c.status === "paid");
    return ivaClaims;
  }, [tab]);

  const tabs: { value: FilterTab; label: string; count: number }[] = [
    { value: "all", label: "All", count: ivaClaims.length },
    { value: "in_progress", label: "In progress", count: ivaClaims.filter((c) => c.status !== "paid").length },
    { value: "paid", label: "Paid", count: ivaClaims.filter((c) => c.status === "paid").length },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">IVA Refund Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">Formulario 3600 — Track your export VAT refund claims with the SII</p>
      </div>

      {/* Pipeline stages */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stageData.map((stage, i) => {
          const Icon = stage.icon;
          const isPaid = stage.status === "paid";
          return (
            <div
              key={stage.status}
              className={cn(
                "relative rounded-xl border bg-white p-4 shadow-sm transition-colors",
                isPaid ? "border-emerald-200" : i === 0 ? "border-slate-200" : "border-slate-200"
              )}
            >
              {/* Connector */}
              {i < stageData.length - 1 && (
                <div className="absolute -right-1.5 top-1/2 z-10 hidden h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-slate-200 bg-slate-50 lg:block" />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    isPaid ? "bg-emerald-50" : stage.count > 0 ? "bg-teal-50" : "bg-slate-100"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isPaid ? "text-emerald-600" : stage.count > 0 ? "text-teal-600" : "text-slate-400")} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage.label}</span>
              </div>
              <div className="mt-3">
                <p className={cn("text-lg font-semibold tabular-nums", stage.count > 0 ? "text-slate-900" : "text-slate-300")}>
                  {stage.count}
                </p>
                <p className="text-xs text-slate-400">{stage.count === 1 ? "claim" : "claims"}</p>
                <p className="mt-1 text-sm font-medium tabular-nums text-slate-700">
                  {stage.sum > 0 ? formatClp(stage.sum) : "—"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.value ? "text-teal-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs tabular-nums text-slate-400">{t.count}</span>
            {tab === t.value && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-teal-600" />}
          </button>
        ))}
      </div>

      {/* Claims table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-4 py-3 text-left font-medium text-slate-500">Shipment</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Buyer</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Amount (CLP)</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500" style={{ minWidth: 180 }}>Progress</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Filed date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Missing docs</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No claims in this view
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => {
                  const s = shipmentMap.get(claim.shipmentId);
                  return (
                    <tr key={claim.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link href={`/shipments/${claim.shipmentId}`} className="font-medium text-slate-900 hover:text-teal-600">
                          {s?.reference ?? claim.shipmentId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s?.buyer ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                        {formatClp(claim.amountClp)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <ClaimStepper status={claim.status} />
                          <p className="text-xs text-slate-400">{claimStatusLabels[claim.status]}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {claim.filedAt ? formatDate(claim.filedAt) : <span className="text-slate-300">Not filed</span>}
                      </td>
                      <td className="px-4 py-3">
                        {claim.missingDocs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {claim.missingDocs.map((doc) => (
                              <span
                                key={doc}
                                className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"
                              >
                                {doc}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-600">Complete</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/shipments/${claim.shipmentId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
