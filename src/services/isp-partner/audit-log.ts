/** AUDIT-LOG endpoints (owner/admin only). All 404 while
 * ISP_AUDIT_LOG_ENABLED is off. Read-only. */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export type AuditSource = "all" | "actions" | "sign_ins";

export interface AuditRow {
  id: string;
  source: "action" | "sign_in";
  at: string;
  action: string;
  action_label: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  actor: {
    isp_user_id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    is_isp_staff: boolean;
  } | null;
  customer: { isp_customer_id: string; name: string | null } | null;
  ip: string | null;
  ip_recorded: boolean;
  detail: Record<string, unknown>;
}

export interface AuditPage {
  items: AuditRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditFacets {
  actions: { action: string; label: string; count: number }[];
  staff: { isp_user_id: string; name: string; role: string | null }[];
}

export interface AuditQuery {
  source?: AuditSource;
  isp_user_id?: string;
  action?: string;
  search?: string;
  since?: string;
  until?: string;
  page?: number;
}

function params(q: AuditQuery): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== "" && v !== null) out[k] = String(v);
  }
  return out;
}

export const auditLogService = {
  async list(q: AuditQuery): Promise<AuditPage> {
    const { data } = await api.get<AuditPage>("/isp/audit-log", {
      params: { ...params(q), page_size: "50" },
    });
    return data;
  },
  async facets(): Promise<AuditFacets> {
    const { data } = await api.get<AuditFacets>("/isp/audit-log/facets");
    return data;
  },
  exportCsv(q: AuditQuery): Promise<FileDownload> {
    const p = params(q);
    delete p.page;
    return downloadFile("/isp/audit-log/export.csv", p, "isp-audit-log.csv");
  },
};
