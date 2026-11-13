"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentRecord } from "@/lib/mock-data";
import { toast } from "sonner";

interface UploadZoneProps {
  doc: DocumentRecord | null;
  type: "invoice" | "dus";
  // For shipments 001-003 without a doc row, treat as uploaded & validated
  preValidated?: boolean;
}

export function UploadZone({ doc, type, preValidated }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(
    preValidated ? `${type === "invoice" ? "factura" : "DUS"}-preloaded.pdf` : doc?.fileName ?? null
  );
  const [validated, setValidated] = useState<boolean>(preValidated || doc?.validated || false);
  const [extractedData, setExtractedData] = useState<Record<string, string | number | boolean> | undefined>(
    preValidated
      ? type === "invoice"
        ? { invoiceNumber: "AUTO", total: "—", currency: "—", lineItems: "—" }
        : { dusNumber: "AUTO", legalized: true, value: "—" }
      : doc?.extractedData
  );

  const label = type === "invoice" ? "Commercial invoice" : "DUS (customs declaration)";

  const handleFile = useCallback((fileName: string) => {
    setUploadedFile(fileName);
    setExtracting(true);
    setValidated(false);
    setTimeout(() => {
      setExtracting(false);
      setValidated(true);
      setExtractedData(
        type === "invoice"
          ? { invoiceNumber: "FE-EXTRACTED", total: "—", currency: "USD", lineItems: "—" }
          : { dusNumber: "DUS-EXTRACTED", legalized: true, value: "—" }
      );
      toast.success("Document uploaded (demo)", { description: `${fileName} — data extracted` });
    }, 1500);
  }, [type]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file.name);
  }, [handleFile]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file.name);
  };

  const runValidation = () => {
    toast.success("Validation complete (demo)", { description: "All checks passed" });
  };

  // Extracting state
  if (extracting) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-teal-200 bg-teal-50/50 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className="mt-3 text-sm font-medium text-teal-700">Extracting data…</p>
        <p className="mt-0.5 text-xs text-teal-600/70">{uploadedFile}</p>
      </div>
    );
  }

  // File uploaded state
  if (uploadedFile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", validated ? "bg-emerald-50" : "bg-amber-50")}>
            {validated ? <FileCheck2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{uploadedFile}</p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              {validated ? (
                <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Uploaded · Validated</>
              ) : (
                <><AlertTriangle className="h-3 w-3 text-amber-500" /> Uploaded · Needs review</>
              )}
            </p>
          </div>
          <button
            onClick={() => { setUploadedFile(null); setExtractedData(undefined); setValidated(false); }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Remove
          </button>
        </div>

        {extractedData && Object.keys(extractedData).length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted fields</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(extractedData).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <dt className="capitalize text-slate-500">{key.replace(/([A-Z])/g, " $1").trim()}</dt>
                  <dd className="font-medium text-slate-700 tabular-nums">{String(val)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <button
          onClick={runValidation}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <FileCheck2 className="h-4 w-4 text-teal-600" />
          Run validation
        </button>
      </div>
    );
  }

  // Empty drop zone
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
        dragOver ? "border-teal-400 bg-teal-50" : "border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-50"
      )}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={onChange} accept=".pdf,.png,.jpg" />
      <UploadCloud className={cn("h-7 w-7", dragOver ? "text-teal-500" : "text-slate-400")} />
      <p className="mt-2 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">Drag & drop or click to upload</p>
    </div>
  );
}
