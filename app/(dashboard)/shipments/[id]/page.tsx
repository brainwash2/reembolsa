"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Package, FileArchive, Loader2 } from "lucide-react";
import { shipments, issues, documents, ivaClaims } from "@/lib/mock-data";
import { ShipmentStatusBadge } from "@/components/status-badge";
import { UploadZone } from "@/components/upload-zone";
import { IssuesPanel } from "@/components/issues-panel";
import { formatForeign, formatFxRate, formatClp, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const shipment = shipments.find((s) => s.id === id);
  const [generating, setGenerating] = useState(false);

  const shipmentIssues = useMemo(() => issues.filter((i) => i.shipmentId === id), [id]);
  const shipmentDocs = useMemo(() => documents.filter((d) => d.shipmentId === id), [id]);
  const invoiceDoc = shipmentDocs.find((d) => d.type === "invoice") ?? null;
  const dusDoc = shipmentDocs.find((d) => d.type === "dus") ?? null;
  const claim = ivaClaims.find((c) => c.shipmentId === id);

  // Shipments 001-003 have no document rows — treat as fully uploaded & validated
  const isPreValidated = ["shp-001", "shp-002", "shp-003"].includes(id);

  if (!shipment) {
    return (
      <div className="mx-auto max-w-7xl py-20 text-center">
        <p className="text-slate-500">Shipment not found</p>
        <Link href="/shipments" className="mt-2 inline-block text-sm text-teal-600 hover:text-teal-700">
          Back to shipments
        </Link>
      </div>
    );
  }

  const estimatedClp = Math.round(shipment.invoiceAmount * shipment.exchangeRate);
  const errorCount = shipmentIssues.filter((i) => i.severity === "error").length;
  const hasErrors = errorCount > 0;

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      toast.success("Package generated (demo)", { description: "Formulario 3600 package ready for download" });
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/shipments" className="hover:text-slate-700">Shipments</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{shipment.reference}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{shipment.reference}</h1>
            <ShipmentStatusBadge status={shipment.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{shipment.buyer} · {shipment.destination}</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <SummaryItem label="Invoice" value={formatForeign(shipment.invoiceAmount, shipment.currency)} />
        <SummaryItem label="FX rate" value={formatFxRate(shipment.exchangeRate)} />
        <SummaryItem label="Est. export value" value={formatClp(estimatedClp)} subLabel="estimate" />
        <SummaryItem label="Incoterm" value={shipment.incoterm} />
        <SummaryItem label="Destination" value={shipment.destination} />
        <SummaryItem label="Shipment date" value={formatDate(shipment.shipmentDate)} />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Upload zones */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Documents</h2>
            <p className="mb-4 text-xs text-slate-500">Upload and validate your export paperwork</p>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Commercial invoice</p>
                <UploadZone doc={invoiceDoc} type="invoice" preValidated={isPreValidated} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">DUS (customs declaration)</p>
                <UploadZone doc={dusDoc} type="dus" preValidated={isPreValidated} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Issues */}
        <div>
          <IssuesPanel issues={shipmentIssues} />
        </div>
      </div>

      {/* Document package */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <FileArchive className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Document package</h2>
              <p className="text-xs text-slate-500">
                {claim ? `IVA claim: ${formatClp(claim.amountClp)}` : "Generate the Formulario 3600 filing package"}
              </p>
            </div>
          </div>
          {hasErrors ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400"
                >
                  <FileArchive className="h-4 w-4" />
                  Generate Formulario 3600 package
                </button>
              </TooltipTrigger>
              <TooltipContent>Resolve all errors first</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
              {generating ? "Generating…" : "Generate Formulario 3600 package"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, subLabel }: { label: string; value: string; subLabel?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
      {subLabel && <p className="text-xs text-slate-400">{subLabel}</p>}
    </div>
  );
}
