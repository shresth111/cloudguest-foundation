/** Manual Quotation / Tax Invoice documents from the Master console
 * (backend: app.domains.billing_document). Money arrives from the backend as
 * decimal strings; the service converts to numbers for display only. The
 * stored backend figures are the document of record. */

export type BillingDocumentType = "quotation" | "tax_invoice";
export type BillingDocumentStatus = "draft" | "issued" | "cancelled";
/** `auto` is request-only: the backend resolves it from place of supply. */
export type TaxMode = "auto" | "cgst_sgst" | "igst" | "none";

export const DOCUMENT_TYPE_LABEL: Record<BillingDocumentType, string> = {
  quotation: "Quotation",
  tax_invoice: "Tax Invoice",
};

export const DOCUMENT_STATUS_LABEL: Record<BillingDocumentStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Cancelled",
};

export const TAX_MODE_LABEL: Record<TaxMode, string> = {
  auto: "Auto (from place of supply)",
  cgst_sgst: "CGST + SGST (same state)",
  igst: "IGST (other state / outside India)",
  none: "No GST",
};

export interface BillTo {
  name: string;
  address: string;
  gstin: string;
  email: string;
  phone: string;
}

export interface LineItemInput {
  description: string;
  hsnSac: string;
  unit: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxRate: number;
}

export interface BillingDocumentInput {
  documentType: BillingDocumentType;
  /** Empty = take the next number in this type's series. */
  documentNumber: string;
  issueDate: string;
  validUntil: string;
  dueDate: string;
  organizationId: string | null;
  billTo: BillTo;
  placeOfSupply: string;
  taxMode: TaxMode;
  roundTotal: boolean;
  currency: string;
  lines: LineItemInput[];
  notes: string;
  terms: string;
}

export interface BillingDocumentLine extends LineItemInput {
  id: string;
  position: number;
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface SellerProfile {
  legalName: string;
  tradeName: string;
  address: string;
  state: string;
  gstin: string;
  pan: string;
  cin: string;
  email: string;
  phone: string;
  website: string;
  bankDetails: string;
}

export interface SellerProfileState extends SellerProfile {
  isConfigured: boolean;
  missingFields: string[];
}

export interface BillingDocument {
  id: string;
  documentType: BillingDocumentType;
  documentNumber: string;
  status: BillingDocumentStatus;
  issueDate: string;
  validUntil: string | null;
  dueDate: string | null;
  organizationId: string | null;
  billTo: BillTo;
  placeOfSupply: string | null;
  taxMode: Exclude<TaxMode, "auto">;
  roundTotal: boolean;
  currency: string;
  lines: BillingDocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  notes: string | null;
  terms: string | null;
  seller: Partial<SellerProfile>;
  sourceQuotationId: string | null;
  convertedInvoiceId: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingDocumentSummary {
  id: string;
  documentType: BillingDocumentType;
  documentNumber: string;
  status: BillingDocumentStatus;
  issueDate: string;
  billToName: string;
  grandTotal: number;
  currency: string;
  sourceQuotationId: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillToPrefill {
  organizationId: string;
  name: string;
  address: string | null;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
}

export interface BillingDocumentOptions {
  states: string[];
  outsideIndia: string;
  numberPrefixes: Record<BillingDocumentType, string>;
}
