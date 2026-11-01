/**
 * `/isp/compliance/*` (backend `isp_partner/compliance_router.py`, lane JAZE-3).
 * Counters, NAT-log feed, CGNAT lookup, session dump, KYC/CAF, TRAI PMR,
 * AGR, report catalogue and schedules.
 */
import api from "@/services/api";
import { downloadFile } from "@/services/isp-partner/isp";

export interface ComplianceCounters {
  counters: Record<
    | "online"
    | "active"
    | "expiring_7d"
    | "expired"
    | "suspended"
    | "frozen"
    | "blocked"
    | "churned"
    | "new_7d"
    | "scheduled_renewals"
    | "total",
    number
  >;
  online_sessions: number;
  definitions: Record<string, string>;
  overlay_source: "derived" | "jaze1" | "pending";
  as_of: string;
}

export type NatFeedState =
  | "ok"
  | "stale"
  | "never_received"
  | "not_configured"
  | "router_offline"
  // CI-INTEG: venue run through a vendor controller (Omada / Aruba); never alerting.
  | "not_applicable";

export interface NatFeedRouter {
  isp_router_id: string;
  router_name: string;
  isp_customer_id: string;
  customer_name: string | null;
  isp_location_id: string;
  location_name: string | null;
  router_status: string;
  public_ip: string | null;
  state: NatFeedState;
  alerting: boolean;
  last_nat_record_at: string | null;
  last_flow_record_at: string | null;
  export_configured: boolean;
  export_last_verified_at: string | null;
  export_last_verdict_ok: boolean | null;
  export_last_verdict_detail: string | null;
  ipdr_ports: boolean;
}

export interface NatFeed {
  as_of: string;
  stale_after_minutes: number;
  routers: NatFeedRouter[];
  alerting_count: number;
  banner: boolean;
  source: string;
}

export interface CgnatQuery {
  public_ip: string;
  public_port?: string;
  at: string;
  tz?: string;
  tolerance_seconds?: string;
  protocol?: "" | "tcp" | "udp" | "icmp";
  dst_ip?: string;
  dst_port?: string;
  isp_customer_id?: string;
}

export interface CgnatDossier {
  subscriber_id: string;
  circuit_id: number;
  username: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  valid_until: string | null;
  caf_number: string | null;
  id_proof_type: string | null;
  id_number_masked: string | null;
  kyc_on_file: boolean;
}

export interface CgnatMatch {
  record: Record<string, unknown> & {
    ts: string;
    ts_end?: string | null;
    ts_source?: string;
    src_ip?: string;
    src_port?: number | null;
    nat_ip?: string | null;
    nat_port?: number | null;
    nat_source?: string;
    dst_ip?: string;
    dst_port?: number | null;
    protocol?: number | null;
    user_id?: string;
    user_known?: boolean;
    name?: string | null;
    phone?: string | null;
    mac?: string | null;
  };
  subscriber: CgnatDossier | null;
  customer_name: string | null;
}

export type CgnatVerdict =
  | "unique_match"
  | "multiple_candidates"
  | "no_match"
  | "no_nat_data_for_window";

export interface CgnatResult {
  query: {
    public_ip: string;
    public_port: number | null;
    at_utc: string;
    at_ist: string;
    window_start: string;
    window_end: string;
  };
  verdict: CgnatVerdict;
  nat_data_in_window: boolean;
  public_ip_is_router_wan: {
    isp_router_id: string;
    router_name: string;
    isp_customer_id: string;
  }[];
  matches: CgnatMatch[];
  customers_searched: number;
  time_basis: string;
  evidence_notes: string[];
}

export interface ComplianceSettings {
  legal_name: string | null;
  licence_number: string | null;
  licence_category: string | null;
  registered_address: string | null;
  gstin: string | null;
  compliance_email: string | null;
  caf_prefix: string;
  caf_next_seq: number;
  nat_feed_stale_minutes: number;
  gigabit_threshold_mbps: number;
  churn_after_days: number;
}

export interface KycRecord {
  applicant_type: "individual" | "organization";
  full_name: string | null;
  father_or_spouse_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  alternate_phone: string | null;
  permanent_address: string | null;
  installation_address: string | null;
  installation_pincode: string | null;
  address_proof_type: string | null;
  address_proof_same_as_id: boolean;
  installed_at: string | null;
  notes: string | null;
  id_proof_type: string | null;
  id_number: string | null;
  id_number_last4: string | null;
  caf_number: string | null;
  caf_number_source: "auto" | "custom" | null;
  caf_generated_at: string | null;
  verified_at: string | null;
}

export interface KycDocument {
  id: string;
  kind: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string | null;
}

export interface SubscriberKyc {
  subscriber_id: string;
  kyc: KycRecord | null;
  documents: KycDocument[];
  id_types: string[];
  document_kinds: string[];
}

export interface TraiPmr {
  period: string;
  period_start: string;
  period_end: string;
  timezone: string;
  subscriptions_by_speed: { tier: string; subscribers: number }[];
  subscriptions_total: number;
  gigabit_threshold_mbps: number;
  gigabit_subscribers: {
    circuit_id: number;
    username: string;
    customer_name: string | null;
    download_mbps: number;
  }[];
  public_wifi_hotspots: {
    venues: number;
    nas_routers: number;
    access_points: number | null;
    access_points_note: string;
    registered_users: number;
    users_active_in_period: number;
    sessions_in_period: number;
    download_bytes: number;
    upload_bytes: number;
  };
  data_usage: {
    download_bytes: number;
    upload_bytes: number;
    download_tb: number;
    upload_tb: number;
    source: string;
  };
  notes: string[];
}

export interface AgrReport {
  since: string;
  until: string;
  telecom_taxable_paise: number;
  other_taxable_paise: number;
  gross_taxable_paise: number;
  gst_collected_paise: number;
  by_sac: { sac_code: string; taxable_paise: number }[];
  invoice_lines: number;
  partial_view: boolean;
  notes: string[];
}

export interface ReportCatalogueItem {
  key: string;
  title: string;
  category: string;
  available: boolean;
  pending: string | null;
}

export interface ReportResult {
  key: string;
  title: string;
  category: string;
  since: string;
  until: string;
  available: boolean;
  pending?: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  truncated?: boolean;
}

export interface ReportSchedule {
  report_key: string;
  day_of_month: number;
  recipients: string[];
  enabled: boolean;
  last_period_sent: string | null;
  last_sent_at: string | null;
  last_status: string | null;
}

function clean(params: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") out[k] = v;
  return out;
}

const P = "/isp/compliance";

export const complianceService = {
  async counters(isp_customer_id?: string): Promise<ComplianceCounters> {
    const { data } = await api.get<ComplianceCounters>(`${P}/counters`, {
      params: clean({ isp_customer_id }),
    });
    return data;
  },
  async natFeed(): Promise<NatFeed> {
    const { data } = await api.get<NatFeed>(`${P}/nat-feed`);
    return data;
  },
  async cgnatLookup(q: CgnatQuery): Promise<CgnatResult> {
    const { data } = await api.get<CgnatResult>(`${P}/cgnat-lookup`, {
      params: clean({ ...q }),
      timeout: 120_000,
    });
    return data;
  },
  cgnatExport(q: CgnatQuery) {
    return downloadFile(`${P}/cgnat-lookup/export.csv`, clean({ ...q }), "cgnat-lookup.csv");
  },
  sessionDump(params: { since: string; until: string; isp_customer_id?: string }) {
    return downloadFile(`${P}/session-dump.csv`, clean(params), "session-dump.csv");
  },
  async settings(): Promise<ComplianceSettings> {
    const { data } = await api.get<ComplianceSettings>(`${P}/settings`);
    return data;
  },
  async saveSettings(body: Partial<ComplianceSettings>): Promise<ComplianceSettings> {
    const { data } = await api.put<ComplianceSettings>(`${P}/settings`, body);
    return data;
  },
  async kyc(subscriberId: string): Promise<SubscriberKyc> {
    const { data } = await api.get<SubscriberKyc>(`${P}/subscribers/${subscriberId}/kyc`);
    return data;
  },
  async saveKyc(
    subscriberId: string,
    body: Partial<KycRecord> & { id_number?: string; verified?: boolean },
  ): Promise<KycRecord> {
    const { data } = await api.put<KycRecord>(`${P}/subscribers/${subscriberId}/kyc`, body);
    return data;
  },
  async uploadDocument(subscriberId: string, kind: string, file: File): Promise<KycDocument> {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    // Content-Type undefined: let the browser set the multipart boundary
    // (see brand-asset.service.ts for why the shared default breaks this).
    const { data } = await api.post<KycDocument>(
      `${P}/subscribers/${subscriberId}/documents`,
      form,
      { headers: { "Content-Type": undefined } },
    );
    return data;
  },
  downloadDocument(subscriberId: string, doc: KycDocument) {
    return downloadFile(`${P}/subscribers/${subscriberId}/documents/${doc.id}`, {}, doc.filename);
  },
  async deleteDocument(subscriberId: string, documentId: string): Promise<void> {
    await api.delete(`${P}/subscribers/${subscriberId}/documents/${documentId}`);
  },
  async assignCaf(subscriberId: string, caf_number?: string) {
    const { data } = await api.post<{ caf_number: string; source: string }>(
      `${P}/subscribers/${subscriberId}/caf`,
      caf_number ? { caf_number } : {},
    );
    return data;
  },
  cafPdf(subscriberId: string) {
    return downloadFile(`${P}/subscribers/${subscriberId}/caf.pdf`, {}, "caf.pdf");
  },
  async traiPmr(period: string): Promise<TraiPmr> {
    const { data } = await api.get<TraiPmr>(`${P}/trai-pmr`, { params: { period } });
    return data;
  },
  traiExport(period: string, report: string) {
    return downloadFile(`${P}/trai-pmr/export.csv`, { period, report }, `trai-${report}.csv`);
  },
  async agr(since?: string, until?: string): Promise<AgrReport> {
    const { data } = await api.get<AgrReport>(`${P}/agr`, { params: clean({ since, until }) });
    return data;
  },
  agrExport(since?: string, until?: string) {
    return downloadFile(`${P}/agr/export.csv`, clean({ since, until }), "agr.csv");
  },
  async catalogue(): Promise<ReportCatalogueItem[]> {
    const { data } = await api.get<{ reports: ReportCatalogueItem[] }>(`${P}/reports`);
    return data.reports;
  },
  async report(key: string, since?: string, until?: string): Promise<ReportResult> {
    const { data } = await api.get<ReportResult>(`${P}/reports/${key}`, {
      params: clean({ since, until }),
      timeout: 120_000,
    });
    return data;
  },
  reportExport(key: string, since?: string, until?: string) {
    return downloadFile(`${P}/reports/${key}/export.csv`, clean({ since, until }), `${key}.csv`);
  },
  async schedules(): Promise<{
    schedules: ReportSchedule[];
    report_keys: string[];
    delivery_enabled: boolean;
  }> {
    const { data } = await api.get<{
      schedules: ReportSchedule[];
      report_keys: string[];
      delivery_enabled: boolean;
    }>(`${P}/report-schedules`);
    return data;
  },
  async saveSchedule(
    key: string,
    body: { day_of_month: number; recipients: string[]; enabled: boolean },
  ): Promise<ReportSchedule> {
    const { data } = await api.put<ReportSchedule>(`${P}/report-schedules/${key}`, body);
    return data;
  },
};
