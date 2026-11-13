"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/mock-data";

interface IssuesPanelProps {
  issues: Issue[];
}

const severityConfig = {
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", border: "border-red-200", label: "error" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", label: "warning" },
  info: { icon: Info, color: "text-sky-500", bg: "bg-sky-50", border: "border-sky-200", label: "info" },
};

const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };

export function IssuesPanel({ issues }: IssuesPanelProps) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const toggleResolve = (id: string) => {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeIssues = issues.filter((i) => !resolved.has(i.id));
  const errors = activeIssues.filter((i) => i.severity === "error");
  const warnings = activeIssues.filter((i) => i.severity === "warning");
  const infos = activeIssues.filter((i) => i.severity === "info");

  const sorted = [...activeIssues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const headerParts: string[] = [];
  if (errors.length > 0) headerParts.push(`${errors.length} error${errors.length > 1 ? "s" : ""}`);
  if (warnings.length > 0) headerParts.push(`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`);
  if (infos.length > 0) headerParts.push(`${infos.length} info`);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Issues</h3>
        {activeIssues.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {headerParts.join(" · ")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> All clear
          </span>
        )}
      </div>

      <div className="p-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-900">No issues — ready to generate package</p>
            <p className="mt-0.5 text-xs text-slate-500">All validation checks passed</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((issue) => {
              const cfg = severityConfig[issue.severity];
              const Icon = cfg.icon;
              return (
                <div
                  key={issue.id}
                  className={cn("flex items-start gap-3 rounded-lg border p-3", cfg.bg, cfg.border)}
                >
                  <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", cfg.color)} style={{ width: 18, height: 18 }} />
                  <p className="flex-1 text-sm text-slate-700">{issue.message}</p>
                  <button
                    onClick={() => toggleResolve(issue.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-700"
                  >
                    Mark resolved
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {resolved.size > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">{resolved.size} resolved</p>
            {issues.filter((i) => resolved.has(i.id)).map((issue) => (
              <div key={issue.id} className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 line-through">
                <X className="h-3 w-3" />
                <span className="truncate">{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
