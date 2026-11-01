/**
 * STATICIP-2 (BE flag `ISP_STATICIP2_ENABLED`, default off -> 404): the
 * static IP lease ledger, a lease's invoices, and one-step release (ends the
 * lease and frees the IP from the subscriber's binding).
 */
import api from "@/services/api";
import { cleanParams, downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export interface StaticIpRow {
  id: string;
  isp_customer_id: string;
  customer_name: string | null;
  subscriber_id: string | null;
  subscriber_name: string | null;
  subscriber_identifier: string | null;
  zone_id: string | null;
  zone_name: string | null;
  ip_address: string;
  monthly_amount_paise: number;
  price_includes_gst: boolean;
  active_since: string | null;
  active_until: string | null;
  billed_through: string | null;
  status: "active" | "ended";
  notes: string | null;
  invoices: number;
  billed_paise: number;
  due_paise: number;
}

export interface StaticIpLedgerPage {
  items: StaticIpRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  summary: { active: number; ended: number; monthly_paise: number };
}

export interface StaticIpLedgerQuery {
  status?: "active" | "ended";
  isp_customer_id?: string;
  zone_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface LeaseInvoice {
  id: string;
  number: string;
  doc_type: string;
  period_start: string | null;
  period_end: string | null;
  total_paise: number;
  balance_paise: number;
  status: string;
}

export interface ReleaseResult {
  released_binding_ids: string[];
  ip_back_in_pool: boolean;
  warnings: string[];
}

export const staticIpService = {
  async ledger(q: StaticIpLedgerQuery): Promise<StaticIpLedgerPage> {
    const { data } = await api.get<StaticIpLedgerPage>("/isp/static-ips/ledger", {
      params: cleanParams(q),
    });
    return data;
  },
  exportCsv(q: StaticIpLedgerQuery): Promise<FileDownload> {
    const { page: _p, page_size: _s, ...rest } = q;
    return downloadFile(
      "/isp/static-ips/ledger/export.csv",
      cleanParams(rest),
      "static-ip-leases.csv",
    );
  },
  async invoices(leaseId: string): Promise<LeaseInvoice[]> {
    const { data } = await api.get<{ items: LeaseInvoice[] }>(
      `/isp/static-ips/leases/${leaseId}/invoices`,
    );
    return data.items;
  },
  async release(
    leaseId: string,
    body: { until?: string; reason?: string },
  ): Promise<ReleaseResult> {
    const { data } = await api.post<ReleaseResult>(
      `/isp/static-ips/leases/${leaseId}/release`,
      body,
    );
    return data;
  },
};
