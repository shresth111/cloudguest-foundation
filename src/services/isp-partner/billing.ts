/**
 * ADDENDUM_01 endpoints: customer service control (§A.8) and Phase 1b
 * billing (§B.3). Online payment links (1c) are deliberately absent.
 */
import api from "@/services/api";
import { cleanParams, downloadFile, type FileDownload } from "@/services/isp-partner/isp";
import type { IspPage } from "@/services/isp-partner/types";
import type {
  BillingSettings,
  BillingSettingsUpdate,
  CustomerBillingPlan,
  CustomerLedger,
  InvoiceCreate,
  InvoiceQuery,
  IspInvoice,
  IspPayment,
  PaymentCreate,
  PaymentQuery,
  ServiceState,
  SuspendServiceBody,
} from "@/services/isp-partner/billing-types";

/** One key per user action, so a double click or a retried request cannot
 * suspend or record twice (§A.4 Idempotency-Key). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const serviceControl = {
  async get(ispCustomerId: string): Promise<ServiceState> {
    const { data } = await api.get<ServiceState>(`/isp/customers/${ispCustomerId}/service`);
    return data;
  },
  async suspend(
    ispCustomerId: string,
    body: SuspendServiceBody,
    key: string,
  ): Promise<ServiceState> {
    const { data } = await api.post<ServiceState>(
      `/isp/customers/${ispCustomerId}/service/suspend`,
      body,
      { headers: { "Idempotency-Key": key } },
    );
    return data;
  },
  async resume(ispCustomerId: string, note: string, key: string): Promise<ServiceState> {
    const { data } = await api.post<ServiceState>(
      `/isp/customers/${ispCustomerId}/service/resume`,
      { note },
      { headers: { "Idempotency-Key": key } },
    );
    return data;
  },
  async retry(ispCustomerId: string): Promise<ServiceState> {
    const { data } = await api.post<ServiceState>(`/isp/customers/${ispCustomerId}/service/retry`);
    return data;
  },
};

export const billingService = {
  async getSettings(): Promise<BillingSettings> {
    const { data } = await api.get<BillingSettings>("/isp/billing/settings");
    return data;
  },
  async putSettings(body: BillingSettingsUpdate): Promise<BillingSettings> {
    const { data } = await api.put<BillingSettings>("/isp/billing/settings", body);
    return data;
  },
  async getPlan(ispCustomerId: string): Promise<CustomerBillingPlan | null> {
    const { data } = await api.get<CustomerBillingPlan | null>(
      `/isp/billing/customers/${ispCustomerId}/plan`,
    );
    return data ?? null;
  },
  async putPlan(ispCustomerId: string, body: CustomerBillingPlan): Promise<CustomerBillingPlan> {
    const { data } = await api.put<CustomerBillingPlan>(
      `/isp/billing/customers/${ispCustomerId}/plan`,
      body,
    );
    return data;
  },
  async ledger(ispCustomerId: string): Promise<CustomerLedger> {
    const { data } = await api.get<CustomerLedger>(
      `/isp/billing/customers/${ispCustomerId}/ledger`,
    );
    return data;
  },
  async listInvoices(q: InvoiceQuery): Promise<IspPage<IspInvoice>> {
    const { data } = await api.get<IspPage<IspInvoice>>("/isp/billing/invoices", {
      params: cleanParams(q),
    });
    return data;
  },
  async createInvoice(body: InvoiceCreate): Promise<IspInvoice> {
    const { data } = await api.post<IspInvoice>("/isp/billing/invoices", body);
    return data;
  },
  async generateDue(): Promise<{ created: IspInvoice[] }> {
    const { data } = await api.post<{ created: IspInvoice[] }>(
      "/isp/billing/invoices/generate-due",
    );
    return { created: data?.created ?? [] };
  },
  async voidInvoice(invoiceId: string, reason: string): Promise<IspInvoice> {
    const { data } = await api.post<IspInvoice>(`/isp/billing/invoices/${invoiceId}/void`, {
      reason,
    });
    return data;
  },
  invoicePdf(invoice: Pick<IspInvoice, "id" | "number">): Promise<FileDownload> {
    return downloadFile(
      `/isp/billing/invoices/${invoice.id}/pdf`,
      {},
      `invoice-${invoice.number}.pdf`,
    );
  },
  async listPayments(q: PaymentQuery): Promise<IspPage<IspPayment>> {
    const { data } = await api.get<IspPage<IspPayment>>("/isp/billing/payments", {
      params: cleanParams(q),
    });
    return data;
  },
  async recordPayment(body: PaymentCreate, key: string): Promise<IspPayment> {
    const { data } = await api.post<IspPayment>("/isp/billing/payments", body, {
      headers: { "Idempotency-Key": key },
    });
    return data;
  },
  async voidPayment(paymentId: string, reason: string): Promise<IspPayment> {
    const { data } = await api.post<IspPayment>(`/isp/billing/payments/${paymentId}/void`, {
      reason,
    });
    return data;
  },
  receiptPdf(payment: Pick<IspPayment, "id" | "receipt_number">): Promise<FileDownload> {
    return downloadFile(
      `/isp/billing/payments/${payment.id}/receipt.pdf`,
      {},
      `receipt-${payment.receipt_number}.pdf`,
    );
  },
  async suspendForDues(ispCustomerId: string, key: string): Promise<ServiceState> {
    const { data } = await api.post<ServiceState>(
      `/isp/billing/customers/${ispCustomerId}/suspend-for-dues`,
      undefined,
      { headers: { "Idempotency-Key": key } },
    );
    return data;
  },
  exportCsv(
    kind: "invoices" | "payments" | "dues",
    since: string,
    until: string,
  ): Promise<FileDownload> {
    return downloadFile("/isp/billing/export.csv", { kind, since, until }, `isp-${kind}.csv`);
  },
};
