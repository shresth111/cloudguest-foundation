/** IPDR-2 endpoints (ADDENDUM_06): LEA reverse-IP trace, retention card,
 * field coverage. All 404 while ISP_IPDR_LEA_ENABLED is off. */
import api from "@/services/api";
import { filenameFromDisposition, type FileDownload } from "@/services/isp-partner/isp";

export interface LeaTraceBody {
  public_ip: string;
  public_port?: number | null;
  /** Local wall time `YYYY-MM-DDTHH:MM`, read in `tz`. */
  at: string;
  tz: string;
  tolerance_seconds: number;
  lea_reference: string;
  reason: string;
  gap_minutes: number;
  isp_customer_id?: string | null;
  format?: "json" | "pdf" | "xlsx";
}

export interface TimePair {
  event_time_ist: string | null;
  event_time_reported: boolean;
  receipt_time_ist: string | null;
  receipt_basis: "arrived_at" | "collector_window" | null;
  gap_minutes: number | null;
  gap_flag: boolean;
}

export interface LeaNatRow extends TimePair {
  router_id: string;
  router_name: string | null;
  private_ip: string;
  private_port: number | null;
  public_ip: string;
  public_port: number | null;
  dst_ip: string;
  dst_port: number | null;
  protocol: number | null;
}

export interface LeaMatch extends TimePair {
  candidate: string;
  confidence: "high" | "medium" | "low" | "none";
  customer_name: string | null;
  user_id: string | null;
  mac: string | null;
  router_name: string | null;
  interface: string | null;
  private_ip: string | null;
  private_port: number | null;
  nat_source: string | null;
  lease_start_ist: string | null;
  lease_end_ist: string | null;
  subscriber_id: string | null;
  circuit_id: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  installation_address: string | null;
  permanent_address: string | null;
  id_proof_type: string | null;
  id_number_masked: string | null;
  caf_number: string | null;
  caf_pdf: string | null;
}

export interface LeaReport {
  lea_reference: string;
  reason: string;
  generated_at_ist: string;
  generated_by: string | null;
  query: {
    public_ip: string;
    public_port: number | null;
    at_ist: string;
    window_start_ist: string;
    window_end_ist: string;
  };
  verdict: string;
  nat_data_in_window: boolean;
  gap_minutes: number;
  nat_rows: LeaNatRow[];
  matches: LeaMatch[];
  time_basis: string;
}

export interface RetentionRouter {
  isp_router_id: string;
  router_name: string;
  isp_customer_id: string;
  oldest_nat_ist: string | null;
  oldest_session_ist: string | null;
  nat_days_held: number | null;
  session_days_held: number | null;
  target_days: number;
  target_met: boolean;
  days_to_target: number | null;
  zero_row_days: string[];
  zero_row_day_count: number;
}

export interface Retention {
  as_of_ist: string;
  target_days: number;
  gap_window: { from: string; to: string };
  never_pruned: string[];
  up_basis: string;
  routers: RetentionRouter[];
}

export interface FieldCoverage {
  fields: {
    field: string;
    status: "available" | "partial" | "not_collected" | "not_applicable";
    source: string;
  }[];
  note: string;
}

export const ipdrLeaService = {
  async trace(body: LeaTraceBody): Promise<LeaReport> {
    const { data } = await api.post<LeaReport>("/isp/compliance/lea-trace", {
      ...body,
      format: "json",
    });
    return data;
  },
  async traceFile(body: LeaTraceBody, format: "pdf" | "xlsx"): Promise<FileDownload> {
    const res = await api.post<Blob>(
      "/isp/compliance/lea-trace",
      { ...body, format },
      { responseType: "blob", timeout: 180_000 },
    );
    return {
      blob: res.data,
      filename: filenameFromDisposition(res.headers["content-disposition"], `ip-trace.${format}`),
    };
  },
  async retention(gapDays = 90): Promise<Retention> {
    const { data } = await api.get<Retention>("/isp/compliance/retention", {
      params: { gap_days: gapDays },
    });
    return data;
  },
  async coverage(): Promise<FieldCoverage> {
    const { data } = await api.get<FieldCoverage>("/isp/compliance/ipdr-field-coverage");
    return data;
  },
};
