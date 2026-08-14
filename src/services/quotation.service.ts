import { api } from "@/services/api";
import type { CreateQuotationPayload, Quotation, QuotationStatus } from "@/types/quotation";

interface BackendQuotationLineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
}

interface BackendQuotation {
  id: string;
  quotation_number: string;
  status: QuotationStatus;
  client_name: string;
  client_email: string;
  client_company_name: string;
  line_items: BackendQuotationLineItem[];
  subtotal: string;
  tax_percentage: string;
  tax_amount: string;
  total_amount: string;
  currency: string;
  valid_until: string;
  notes: string | null;
  sent_at: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendQuotationListResponse {
  items: BackendQuotation[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toQuotation(q: BackendQuotation): Quotation {
  return {
    id: q.id,
    quotationNumber: q.quotation_number,
    status: q.status,
    clientName: q.client_name,
    clientEmail: q.client_email,
    clientCompanyName: q.client_company_name,
    lineItems: q.line_items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      amount: Number(item.amount),
    })),
    subtotal: Number(q.subtotal),
    taxPercentage: Number(q.tax_percentage),
    taxAmount: Number(q.tax_amount),
    totalAmount: Number(q.total_amount),
    currency: q.currency,
    validUntil: q.valid_until,
    notes: q.notes,
    sentAt: q.sent_at,
    emailError: q.email_error,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  };
}

export const quotationService = {
  /** Master console -- generates a branded PDF quotation and emails it to
   * the client in one step, gated by quotations.create. Always resolves
   * with the created quotation (never throws on a failed/unconfigured
   * email send -- that outcome is reflected in the returned `status`/
   * `emailError` fields instead; see the backend's own
   * app.domains.quotation.service.QuotationService docstring). */
  async createAndSend(payload: CreateQuotationPayload): Promise<Quotation> {
    const { data } = await api.post<BackendQuotation>("/quotations", {
      client_name: payload.clientName,
      client_email: payload.clientEmail,
      client_company_name: payload.clientCompanyName,
      line_items: payload.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      tax_percentage: payload.taxPercentage,
      currency: payload.currency,
      valid_until: payload.validUntil,
      notes: payload.notes || undefined,
    });
    return toQuotation(data);
  },

  /** Master console -- lists every generated quotation, gated by
   * quotations.read. */
  async list(params?: { status?: QuotationStatus; search?: string }): Promise<Quotation[]> {
    const { data } = await api.get<BackendQuotationListResponse>("/quotations", {
      params: { page_size: 100, ...params },
    });
    return data.items.map(toQuotation);
  },

  /** Master console -- fetches one quotation, gated by quotations.read. */
  async get(quotationId: string): Promise<Quotation> {
    const { data } = await api.get<BackendQuotation>(`/quotations/${quotationId}`);
    return toQuotation(data);
  },

  /** Downloads the same PDF that was (or would have been) emailed -- the
   * fallback an operator uses when a send fails. GET /quotations/{id}/pdf
   * requires the operator's own Bearer token (gated by quotations.read),
   * so this resolves to a real blob URL through `api` itself, mirroring
   * `billingService.generateInvoice`'s identical
   * `responseType: "blob"` -> `URL.createObjectURL` pattern -- a plain
   * `<a href>` to the raw endpoint would 401 (no browser-native way to
   * attach the Authorization header to a bare link). */
  async downloadPdf(quotationId: string, quotationNumber: string) {
    const response = await api.get(`/quotations/${quotationId}/pdf`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data as Blob);
    return { url, fileName: `${quotationNumber}.pdf` };
  },
};
