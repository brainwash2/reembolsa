import type { ShipmentStatus, ClaimStatus } from "./mock-data";

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const eurFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
});

export function formatClp(amount: number): string {
  return clpFormatter.format(amount);
}

export function formatForeign(amount: number, currency: "USD" | "EUR"): string {
  return currency === "USD" ? usdFormatter.format(amount) : eurFormatter.format(amount);
}

export function formatFxRate(rate: number): string {
  return rate.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso: string): string {
  const date = new Date(iso + "T00:00:00");
  const day = date.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  draft: "Draft",
  documents_pending: "Documents pending",
  validated: "Validated",
  claim_filed: "Claim filed",
  refunded: "Refunded",
};

export const claimStatusLabels: Record<ClaimStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  filed: "Filed",
  approved: "Approved",
  paid: "Paid",
};
