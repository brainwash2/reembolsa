"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, ArrowUpDown, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { shipments, issues, ivaClaims } from "@/lib/mock-data";
import { ShipmentStatusBadge } from "@/components/status-badge";
import { formatForeign, formatFxRate, formatClp, formatDate } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/lib/mock-data";

const statusFilters: { value: "all" | ShipmentStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "documents_pending", label: "Documents pending" },
  { value: "validated", label: "Validated" },
  { value: "claim_filed", label: "Claim filed" },
  { value: "refunded", label: "Refunded" },
];

export default function ShipmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ShipmentStatus>("all");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);

  const issuesByShipment = useMemo(() => {
    const map = new Map<string, number>();
    issues.forEach((i) => map.set(i.shipmentId, (map.get(i.shipmentId) || 0) + 1));
    return map;
  }, []);

  const claimByShipment = useMemo(() => {
    const map = new Map<string, number>();
    ivaClaims.forEach((c) => map.set(c.shipmentId, c.amountClp));
    return map;
  }, []);

  const filtered = useMemo(() => {
    let result = shipments.filter((s) => {
      const matchesSearch =
        s.reference.toLowerCase().includes(search.toLowerCase()) ||
        s.buyer.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result = [...result].sort((a, b) => {
      let cmp: number;
      if (sortKey === "date") {
        cmp = new Date(a.shipmentDate).getTime() - new Date(b.shipmentDate).getTime();
      } else {
        cmp = a.invoiceAmount - b.invoiceAmount;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: "date" | "amount") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ column }: { column: "date" | "amount" }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-teal-600" /> : <ChevronDown className="h-3 w-3 text-teal-600" />;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Shipments</h1>
          <p className="mt-1 text-sm text-slate-500">{shipments.length} export shipments tracked</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-600 text-white hover:bg-teal-700">
              <Plus className="mr-1.5 h-4 w-4" />
              New shipment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New shipment</DialogTitle>
              <DialogDescription>Register a new export shipment (demo only — nothing will be saved)</DialogDescription>
            </DialogHeader>
            <NewShipmentForm onSubmit={() => { setDialogOpen(false); toast("Demo only — nothing was saved"); }} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by reference or buyer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-4 py-3 text-left font-medium text-slate-500">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Buyer</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Destination</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Incoterm</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Invoice</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">FX rate</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">
                  <button onClick={() => toggleSort("date")} className="flex items-center gap-1 hover:text-slate-700">
                    Shipment date <SortIcon column="date" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">IVA claim</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    No shipments match your filters
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const issueCount = issuesByShipment.get(s.id) || 0;
                  const claimAmount = claimByShipment.get(s.id);
                  return (
                    <tr key={s.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link href={`/shipments/${s.id}`} className="font-medium text-slate-900 hover:text-teal-600">
                          {s.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.buyer}</td>
                      <td className="px-4 py-3 text-slate-600">{s.destination}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {s.incoterm}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatForeign(s.invoiceAmount, s.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">{formatFxRate(s.exchangeRate)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(s.shipmentDate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-700">
                        {claimAmount ? formatClp(claimAmount) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShipmentStatusBadge status={s.status} />
                          {issueCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 tabular-nums" title={`${issueCount} issue${issueCount > 1 ? "s" : ""}`}>
                              <AlertTriangle className="h-3 w-3" />
                              {issueCount}
                            </span>
                          )}
                        </div>
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

function NewShipmentForm({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="ref">Reference</Label>
        <Input id="ref" placeholder="EXP-2026-009" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="buyer">Buyer</Label>
        <Input id="buyer" placeholder="Buyer name" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dest">Destination</Label>
          <Input id="dest" placeholder="Country" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incoterm">Incoterm</Label>
          <Select defaultValue="FOB">
            <SelectTrigger id="incoterm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["FOB", "CIF", "CFR", "FCA", "EXW", "DAP"].map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" placeholder="50000" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select defaultValue="USD">
            <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="bg-teal-600 text-white hover:bg-teal-700">Create shipment</Button>
      </DialogFooter>
    </form>
  );
}
