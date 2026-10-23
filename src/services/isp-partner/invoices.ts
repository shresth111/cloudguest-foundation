/** ADDENDUM_03 §12 endpoints: unified invoices, zones, reminders, recharge,
 * reports. SMS reminders are deferred (founder): only `channel: "email"`. */
import api from "@/services/api";
import { cleanParams, downloadFile, type FileDownload } from "@/services/isp-partner/isp";
import type {
  BulkMarkPaidResult,
  BulkReminderResult,
  CollectionsReport,
  InvoiceDetail,
  InvoiceListPage,
  InvoiceListQuery,
  InvoiceRow,
  InvoiceSettings,
  ManualInvoiceBody,
  OutstandingReport,
  RechargeBody,
  RechargeResult,
  Zone,
  ZoneBody,
} from "@/services/isp-partner/invoices-types";

export const invoicesService = {
  async list(q: InvoiceListQuery): Promise<InvoiceListPage> {
    const { data } = await api.get<InvoiceListPage>("/isp/invoices", { params: cleanParams(q) });
    return data;
  },
  async get(id: string): Promise<InvoiceDetail> {
    const { data } = await api.get<InvoiceDetail>(`/isp/invoices/${id}`);
    return data;
  },
  pdf(inv: Pick<InvoiceRow, "id" | "number">): Promise<FileDownload> {
    return downloadFile(`/isp/invoices/${inv.id}/pdf`, {}, `${inv.number.replace(/\//g, "-")}.pdf`);
  },
  async createManual(body: ManualInvoiceBody): Promise<InvoiceRow> {
    const { data } = await api.post<InvoiceRow>("/isp/invoices", body);
    return data;
  },
  async creditNote(
    id: string,
    body: { amount_paise?: number; reason: string },
  ): Promise<InvoiceRow> {
    const { data } = await api.post<InvoiceRow>(`/isp/invoices/${id}/credit-note`, body);
    return data;
  },
  async remindEmail(id: string): Promise<unknown> {
    const { data } = await api.post(`/isp/invoices/${id}/remind`, { channel: "email" });
    return data;
  },
  async bulkMarkPaid(
    ids: string[],
    payment: { mode: string; reference_prefix: string | null; received_at: string | null },
  ): Promise<BulkMarkPaidResult> {
    const { data } = await api.post<BulkMarkPaidResult>("/isp/invoices/bulk", {
      action: "mark_paid",
      invoice_ids: ids,
      payment,
    });
    return data;
  },
  async bulkRemind(ids: string[]): Promise<BulkReminderResult> {
    const { data } = await api.post<BulkReminderResult>("/isp/invoices/bulk", {
      action: "send_reminder",
      invoice_ids: ids,
      channel: "email",
    });
    return data;
  },
  async bulkPdfs(ids: string[]): Promise<FileDownload> {
    const res = await api.post<Blob>(
      "/isp/invoices/bulk",
      { action: "download_pdfs", invoice_ids: ids },
      { responseType: "blob", timeout: 300_000 },
    );
    const cd = res.headers["content-disposition"];
    const m = typeof cd === "string" ? /filename="?([^";]+)"?/i.exec(cd) : null;
    return { blob: res.data, filename: m ? m[1] : "invoices.zip" };
  },
  exportList(format: "csv" | "xlsx", q: InvoiceListQuery): Promise<FileDownload> {
    const filters: InvoiceListQuery = { ...q };
    delete filters.page;
    delete filters.page_size;
    return downloadFile(
      "/isp/invoices/export",
      cleanParams({ format, ...filters }),
      `invoices.${format}`,
    );
  },
  async getSettings(): Promise<InvoiceSettings> {
    const { data } = await api.get<InvoiceSettings>("/isp/invoices/settings");
    return data;
  },
  async putSettings(body: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
    const { data } = await api.put<InvoiceSettings>("/isp/invoices/settings", body);
    return data;
  },
  async collections(q: {
    group_by: "zone" | "month" | "package";
    since: string;
    until: string;
  }): Promise<CollectionsReport> {
    const { data } = await api.get<CollectionsReport>("/isp/invoices/reports/collections", {
      params: cleanParams(q),
    });
    return data;
  },
  async outstanding(q: { as_of?: string; zone_id?: string }): Promise<OutstandingReport> {
    const { data } = await api.get<OutstandingReport>("/isp/invoices/reports/outstanding", {
      params: cleanParams(q),
    });
    return data;
  },
  async recharge(subscriberId: string, body: RechargeBody): Promise<RechargeResult> {
    const { data } = await api.post<RechargeResult>(
      `/isp/subscribers/${subscriberId}/recharge`,
      body,
      {
        headers: { "Idempotency-Key": body.idempotency_key },
      },
    );
    return data;
  },
};

export const zonesService = {
  /** Accepts a page or a bare list; the contract does not pin it. */
  async list(): Promise<Zone[]> {
    const { data } = await api.get<Zone[] | { items: Zone[] }>("/isp/zones", {
      params: { page_size: 100 },
    });
    return Array.isArray(data) ? data : (data?.items ?? []);
  },
  async create(body: ZoneBody): Promise<Zone> {
    const { data } = await api.post<Zone>("/isp/zones", body);
    return data;
  },
  async update(id: string, body: ZoneBody): Promise<Zone> {
    const { data } = await api.patch<Zone>(`/isp/zones/${id}`, body);
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/isp/zones/${id}`);
  },
};
