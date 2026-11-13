export type ShipmentStatus = "draft" | "documents_pending" | "validated" | "claim_filed" | "refunded";
export type ClaimStatus = "draft" | "ready" | "filed" | "approved" | "paid";
export type Severity = "error" | "warning" | "info";

export interface Shipment {
  id: string; reference: string; buyer: string; destination: string; incoterm: string;
  invoiceAmount: number; currency: "USD" | "EUR"; exchangeRate: number; // CLP per 1 unit
  shipmentDate: string; status: ShipmentStatus;
}
export interface IvaClaim {
  id: string; shipmentId: string; amountClp: number; status: ClaimStatus;
  missingDocs: string[]; filedAt?: string;
}
export interface Issue { id: string; shipmentId: string; severity: Severity; message: string }
export interface DocumentRecord {
  id: string; shipmentId: string; type: "invoice" | "dus"; fileName: string | null;
  validated: boolean; extractedData?: Record<string, string | number | boolean>;
}

export const shipments: Shipment[] = [
  { id: "shp-001", reference: "EXP-2026-001", buyer: "Hamburg Fresh Imports GmbH", destination: "Germany", incoterm: "CIF", invoiceAmount: 48200, currency: "EUR", exchangeRate: 1045.3, shipmentDate: "2026-09-12", status: "refunded" },
  { id: "shp-002", reference: "EXP-2026-002", buyer: "Shanghai Cherry Partners Ltd", destination: "China", incoterm: "FOB", invoiceAmount: 76500, currency: "USD", exchangeRate: 948.1, shipmentDate: "2026-09-28", status: "claim_filed" },
  { id: "shp-003", reference: "EXP-2026-003", buyer: "Rotterdam Wine Co BV", destination: "Netherlands", incoterm: "CIF", invoiceAmount: 31900, currency: "EUR", exchangeRate: 1038.75, shipmentDate: "2026-10-05", status: "claim_filed" },
  { id: "shp-004", reference: "EXP-2026-004", buyer: "Miami Berry Distributors LLC", destination: "United States", incoterm: "FOB", invoiceAmount: 54300, currency: "USD", exchangeRate: 951.4, shipmentDate: "2026-10-14", status: "validated" },
  { id: "shp-005", reference: "EXP-2026-005", buyer: "Tokyo Salmon Imports KK", destination: "Japan", incoterm: "CFR", invoiceAmount: 92800, currency: "USD", exchangeRate: 946.85, shipmentDate: "2026-10-22", status: "documents_pending" },
  { id: "shp-006", reference: "EXP-2026-006", buyer: "Lima Andean Foods SAC", destination: "Peru", incoterm: "FCA", invoiceAmount: 21400, currency: "USD", exchangeRate: 953.2, shipmentDate: "2026-10-30", status: "documents_pending" },
  { id: "shp-007", reference: "EXP-2026-007", buyer: "Madrid Vinos Selectos SL", destination: "Spain", incoterm: "CIF", invoiceAmount: 27650, currency: "EUR", exchangeRate: 1041.6, shipmentDate: "2026-11-04", status: "draft" },
  { id: "shp-008", reference: "EXP-2026-008", buyer: "Seoul Fresh Trade Co Ltd", destination: "South Korea", incoterm: "CIF", invoiceAmount: 68200, currency: "USD", exchangeRate: 949.9, shipmentDate: "2026-11-08", status: "draft" },
];

export const ivaClaims: IvaClaim[] = [
  { id: "clm-001", shipmentId: "shp-001", amountClp: 7940000,  status: "paid",     missingDocs: [], filedAt: "2026-09-30" },
  { id: "clm-002", shipmentId: "shp-002", amountClp: 11260000, status: "filed",    missingDocs: [], filedAt: "2026-10-15" },
  { id: "clm-003", shipmentId: "shp-003", amountClp: 5410000,  status: "approved", missingDocs: [], filedAt: "2026-10-20" },
  { id: "clm-004", shipmentId: "shp-004", amountClp: 8070000,  status: "ready",    missingDocs: [] },
  { id: "clm-005", shipmentId: "shp-005", amountClp: 13950000, status: "draft",    missingDocs: ["DUS legalization"] },
  { id: "clm-006", shipmentId: "shp-006", amountClp: 3120000,  status: "draft",    missingDocs: ["Commercial invoice"] },
  { id: "clm-007", shipmentId: "shp-007", amountClp: 4380000,  status: "draft",    missingDocs: ["Commercial invoice", "DUS"] },
  { id: "clm-008", shipmentId: "shp-008", amountClp: 10250000, status: "draft",    missingDocs: ["Commercial invoice", "DUS"] },
];

export const issues: Issue[] = [
  { id: "iss-1", shipmentId: "shp-005", severity: "error",   message: "Invoice total (USD 92,800.00) does not match DUS declared value (USD 91,200.00)." },
  { id: "iss-2", shipmentId: "shp-005", severity: "error",   message: "DUS is not legalized; Formulario 3600 cannot be filed yet." },
  { id: "iss-3", shipmentId: "shp-005", severity: "warning", message: "Incoterm CFR: DUS value may not be directly comparable to the invoice total. Review." },
  { id: "iss-4", shipmentId: "shp-006", severity: "error",   message: "Buyer tax ID format is invalid for Peru (RUC must have 11 digits)." },
  { id: "iss-5", shipmentId: "shp-006", severity: "error",   message: "Commercial invoice not uploaded." },
  { id: "iss-6", shipmentId: "shp-007", severity: "error",   message: "Commercial invoice not uploaded." },
  { id: "iss-7", shipmentId: "shp-007", severity: "error",   message: "DUS not uploaded." },
  { id: "iss-8", shipmentId: "shp-008", severity: "warning", message: "No documents uploaded yet." },
];

export const documents: DocumentRecord[] = [
  { id: "doc-1", shipmentId: "shp-004", type: "invoice", fileName: "factura-exportacion-004.pdf", validated: true,  extractedData: { invoiceNumber: "FE-2026-0412", total: 54300, currency: "USD", lineItems: 6 } },
  { id: "doc-2", shipmentId: "shp-004", type: "dus",     fileName: "DUS-004-legalizada.pdf",      validated: true,  extractedData: { dusNumber: "DUS-004", legalized: true, value: 54300 } },
  { id: "doc-3", shipmentId: "shp-005", type: "invoice", fileName: "factura-exportacion-005.pdf", validated: true,  extractedData: { invoiceNumber: "FE-2026-0455", total: 92800, currency: "USD", lineItems: 9 } },
  { id: "doc-4", shipmentId: "shp-005", type: "dus",     fileName: "DUS-005.pdf",                 validated: false, extractedData: { dusNumber: "DUS-005", legalized: false, value: 91200 } },
  { id: "doc-5", shipmentId: "shp-006", type: "invoice", fileName: null,                          validated: false },
  { id: "doc-6", shipmentId: "shp-006", type: "dus",     fileName: "DUS-006.pdf",                 validated: true,  extractedData: { dusNumber: "DUS-006", legalized: true, value: 21400 } },
];

export const cashFlowForecast = [
  { month: "Nov 2026", expectedRefunds: 5.41,  lockedCash: 51.03 },
  { month: "Dec 2026", expectedRefunds: 11.26, lockedCash: 39.77 },
  { month: "Jan 2027", expectedRefunds: 8.07,  lockedCash: 31.7 },
  { month: "Feb 2027", expectedRefunds: 13.95, lockedCash: 17.75 },
  { month: "Mar 2027", expectedRefunds: 7.5,   lockedCash: 10.25 },
  { month: "Apr 2027", expectedRefunds: 10.25, lockedCash: 0 },
];

export const mcpExamplePrompts = [
  "What is the status of my pending IVA refunds?",
  "How much VAT is locked in my current export invoices?",
  "Prepare the documentation package for shipment EXP-2026-004.",
];
