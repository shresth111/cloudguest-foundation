export type QuotationStatus = "draft" | "sent" | "failed";

export interface QuotationLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  status: QuotationStatus;
  clientName: string;
  clientEmail: string;
  clientCompanyName: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  validUntil: string;
  notes: string | null;
  /** Operator-editable generic copy printed as its own PDF section. */
  paymentTerms: string | null;
  termsAndConditions: string | null;
  sentAt: string | null;
  emailError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateQuotationPayload {
  clientName: string;
  clientEmail: string;
  clientCompanyName: string;
  lineItems: QuotationLineItemInput[];
  taxPercentage: number;
  currency: string;
  validUntil: string;
  notes?: string;
  /** Generic blocks the operator can edit before sending; the create form
   *  prefills them, and clearing the textarea omits the section. */
  paymentTerms?: string;
  termsAndConditions?: string;
}

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  failed: "Failed",
};
