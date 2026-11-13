import { cn } from "@/lib/utils";
import { shipmentStatusLabels } from "@/lib/format";
import type { ShipmentStatus, ClaimStatus } from "@/lib/mock-data";
import { claimStatusLabels } from "@/lib/format";

const shipmentStatusStyles: Record<ShipmentStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  documents_pending: "bg-amber-50 text-amber-700 border-amber-200",
  validated: "bg-teal-50 text-teal-700 border-teal-200",
  claim_filed: "bg-sky-50 text-sky-700 border-sky-200",
  refunded: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
        shipmentStatusStyles[status]
      )}
    >
      {shipmentStatusLabels[status]}
    </span>
  );
}

const claimStatusStyles: Record<ClaimStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  ready: "bg-teal-50 text-teal-700 border-teal-200",
  filed: "bg-sky-50 text-sky-700 border-sky-200",
  approved: "bg-sky-50 text-sky-700 border-sky-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
        claimStatusStyles[status]
      )}
    >
      {claimStatusLabels[status]}
    </span>
  );
}
