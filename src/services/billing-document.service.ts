import { api } from "@/services/api";
import { orNull, toRequestBody } from "@/lib/billing-document-request";
import type {
  BillToPrefill,
  BillingDocument,
  BillingDocumentInput,
  BillingDocumentOptions,
  BillingDocumentStatus,
  BillingDocumentSummary,
  BillingDocumentType,
  SellerProfile,
  SellerProfileState,
} from "@/types/billing-document";

/**
 * Master console -- manual Quotations / Tax Invoices
 * (backend: app/domains/billing_document/router.py). Every route is gated on
 * `billing_documents.*` pinned to GLOBAL scope, so a customer-org session
 * 403s on all of them whatever headers it sends. Nothing here emails anyone:
 * the operator downloads the PDF and sends it themselves.
 *
 * The request body is the exact shape the backend's `extra="forbid"` schemas
 * accept (nested `bill_to`, `lines[]` with `rate`/`tax_rate`); a renamed or
 * flattened field is a 422, never a silently-dropped value.
 */

type Money = string;

interface BackendLine {
  id: string;
  position: number;
  description: string;
  hsn_sac: string | null;
  unit: string | null;
  quantity: Money;
  rate: Money;
  discount_percent: Money;
  tax_rate: Money;
  gross_amount: Money;
  discount_amount: Money;
  taxable_amount: Money;
  cgst_amount: Money;
  sgst_amount: Money;
  igst_amount: Money;
  line_total: Money;
}

interface BackendDocument {
  id: string;
  document_type: BillingDocumentType;
  document_number: string;
  status: BillingDocumentStatus;
  issue_date: string;
  valid_until: string | null;
  due_date: string | null;
  organization_id: string | null;
  bill_to: {
    name: string;
    address: string | null;
    gstin: string | null;
    email: string | null;
    phone: string | null;
  };
  place_of_supply: string | null;
  tax_mode: BillingDocument["taxMode"];
  round_total: boolean;
  currency: string;
  lines: BackendLine[];
  subtotal: Money;
  discount_total: Money;
  taxable_total: Money;
  cgst_total: Money;
  sgst_total: Money;
  igst_total: Money;
  tax_total: Money;
  round_off: Money;
  grand_total: Money;
  amount_in_words: string;
  notes: string | null;
  terms: string | null;
  seller: Record<string, string | null>;
  source_quotation_id: string | null;
  converted_invoice_id: string | null;
  issued_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendSummary {
  id: string;
  document_type: BillingDocumentType;
  document_number: string;
  status: BillingDocumentStatus;
  issue_date: string;
  bill_to_name: string;
  grand_total: Money;
  currency: string;
  source_quotation_id: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendList {
  items: BackendSummary[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
}

interface BackendSeller {
  legal_name: string;
  trade_name: string | null;
  address: string | null;
  state: string | null;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  bank_details: string | null;
  is_configured: boolean;
  missing_fields: string[];
}

const n = (value: Money | null | undefined) => (value == null ? 0 : Number(value));

function toSeller(s: Partial<BackendSeller>): SellerProfile {
  return {
    legalName: s.legal_name ?? "",
    tradeName: s.trade_name ?? "",
    address: s.address ?? "",
    state: s.state ?? "",
    gstin: s.gstin ?? "",
    pan: s.pan ?? "",
    cin: s.cin ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    website: s.website ?? "",
    bankDetails: s.bank_details ?? "",
  };
}

function toDocument(d: BackendDocument): BillingDocument {
  return {
    id: d.id,
    documentType: d.document_type,
    documentNumber: d.document_number,
    status: d.status,
    issueDate: d.issue_date,
    validUntil: d.valid_until,
    dueDate: d.due_date,
    organizationId: d.organization_id,
    billTo: {
      name: d.bill_to.name,
      address: d.bill_to.address ?? "",
      gstin: d.bill_to.gstin ?? "",
      email: d.bill_to.email ?? "",
      phone: d.bill_to.phone ?? "",
    },
    placeOfSupply: d.place_of_supply,
    taxMode: d.tax_mode,
    roundTotal: d.round_total,
    currency: d.currency,
    lines: d.lines.map((l) => ({
      id: l.id,
      position: l.position,
      description: l.description,
      hsnSac: l.hsn_sac ?? "",
      unit: l.unit ?? "",
      quantity: n(l.quantity),
      rate: n(l.rate),
      discountPercent: n(l.discount_percent),
      taxRate: n(l.tax_rate),
      grossAmount: n(l.gross_amount),
      discountAmount: n(l.discount_amount),
      taxableAmount: n(l.taxable_amount),
      cgstAmount: n(l.cgst_amount),
      sgstAmount: n(l.sgst_amount),
      igstAmount: n(l.igst_amount),
      lineTotal: n(l.line_total),
    })),
    subtotal: n(d.subtotal),
    discountTotal: n(d.discount_total),
    taxableTotal: n(d.taxable_total),
    cgstTotal: n(d.cgst_total),
    sgstTotal: n(d.sgst_total),
    igstTotal: n(d.igst_total),
    taxTotal: n(d.tax_total),
    roundOff: n(d.round_off),
    grandTotal: n(d.grand_total),
    amountInWords: d.amount_in_words,
    notes: d.notes,
    terms: d.terms,
    seller: toSeller(d.seller as Partial<BackendSeller>),
    sourceQuotationId: d.source_quotation_id,
    convertedInvoiceId: d.converted_invoice_id,
    issuedAt: d.issued_at,
    cancelledAt: d.cancelled_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function toSummary(s: BackendSummary): BillingDocumentSummary {
  return {
    id: s.id,
    documentType: s.document_type,
    documentNumber: s.document_number,
    status: s.status,
    issueDate: s.issue_date,
    billToName: s.bill_to_name,
    grandTotal: n(s.grand_total),
    currency: s.currency,
    sourceQuotationId: s.source_quotation_id,
    convertedInvoiceId: s.converted_invoice_id,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function blobUrl(data: unknown) {
  return URL.createObjectURL(data as Blob);
}

export const billingDocumentService = {
  async list(params?: {
    documentType?: BillingDocumentType;
    status?: BillingDocumentStatus;
    search?: string;
    page?: number;
  }): Promise<{ items: BillingDocumentSummary[]; totalItems: number; hasNext: boolean }> {
    const { data } = await api.get<BackendList>("/billing-documents", {
      params: {
        page: params?.page ?? 1,
        page_size: 100,
        document_type: params?.documentType,
        status: params?.status,
        search: params?.search || undefined,
      },
    });
    return {
      items: data.items.map(toSummary),
      totalItems: data.total_items,
      hasNext: data.has_next,
    };
  },

  async get(id: string): Promise<BillingDocument> {
    const { data } = await api.get<BackendDocument>(`/billing-documents/${id}`);
    return toDocument(data);
  },

  async create(input: BillingDocumentInput): Promise<BillingDocument> {
    const { data } = await api.post<BackendDocument>("/billing-documents", toRequestBody(input));
    return toDocument(data);
  },

  async update(id: string, input: BillingDocumentInput): Promise<BillingDocument> {
    const { data } = await api.put<BackendDocument>(
      `/billing-documents/${id}`,
      toRequestBody(input, false),
    );
    return toDocument(data);
  },

  async remove(id: string): Promise<BillingDocument> {
    const { data } = await api.delete<BackendDocument>(`/billing-documents/${id}`);
    return toDocument(data);
  },

  async issue(id: string): Promise<BillingDocument> {
    const { data } = await api.post<BackendDocument>(`/billing-documents/${id}/issue`);
    return toDocument(data);
  },

  async cancel(id: string): Promise<BillingDocument> {
    const { data } = await api.post<BackendDocument>(`/billing-documents/${id}/cancel`);
    return toDocument(data);
  },

  async duplicate(id: string): Promise<BillingDocument> {
    const { data } = await api.post<BackendDocument>(`/billing-documents/${id}/duplicate`);
    return toDocument(data);
  },

  async convertToInvoice(id: string): Promise<BillingDocument> {
    const { data } = await api.post<BackendDocument>(`/billing-documents/${id}/convert-to-invoice`);
    return toDocument(data);
  },

  /** The saved document's PDF, through `api` so the Bearer token rides along
   * (a bare `<a href>` to the endpoint would 401). */
  async downloadPdf(id: string, documentNumber: string) {
    const response = await api.get(`/billing-documents/${id}/pdf`, { responseType: "blob" });
    const safe = documentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
    return { url: blobUrl(response.data), fileName: `${safe}.pdf` };
  },

  /** PDF of the unsaved form. Writes nothing and takes no number. */
  async previewPdf(input: BillingDocumentInput) {
    const response = await api.post("/billing-documents/preview", toRequestBody(input), {
      responseType: "blob",
    });
    return { url: blobUrl(response.data) };
  },

  async getOptions(): Promise<BillingDocumentOptions> {
    const { data } = await api.get<{
      states: string[];
      outside_india: string;
      number_prefixes: Record<BillingDocumentType, string>;
    }>("/billing-documents/options");
    return {
      states: data.states,
      outsideIndia: data.outside_india,
      numberPrefixes: data.number_prefixes,
    };
  },

  async getSellerProfile(): Promise<SellerProfileState> {
    const { data } = await api.get<BackendSeller>("/billing-documents/seller-profile");
    return {
      ...toSeller(data),
      isConfigured: data.is_configured,
      missingFields: data.missing_fields,
    };
  },

  async updateSellerProfile(profile: SellerProfile): Promise<SellerProfileState> {
    const { data } = await api.put<BackendSeller>("/billing-documents/seller-profile", {
      legal_name: profile.legalName.trim(),
      trade_name: orNull(profile.tradeName),
      address: orNull(profile.address),
      state: orNull(profile.state),
      gstin: orNull(profile.gstin),
      pan: orNull(profile.pan),
      cin: orNull(profile.cin),
      email: orNull(profile.email),
      phone: orNull(profile.phone),
      website: orNull(profile.website),
      bank_details: orNull(profile.bankDetails),
    });
    return {
      ...toSeller(data),
      isConfigured: data.is_configured,
      missingFields: data.missing_fields,
    };
  },

  async billToPrefill(organizationId: string): Promise<BillToPrefill> {
    const { data } = await api.get<{
      organization_id: string;
      name: string;
      address: string | null;
      gstin: string | null;
      email: string | null;
      phone: string | null;
      state: string | null;
    }>("/billing-documents/bill-to-prefill", { params: { organization_id: organizationId } });
    return {
      organizationId: data.organization_id,
      name: data.name,
      address: data.address,
      gstin: data.gstin,
      email: data.email,
      phone: data.phone,
      state: data.state,
    };
  },
};
