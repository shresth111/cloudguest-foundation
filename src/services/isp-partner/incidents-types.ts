/** INCIDENTS-1 response shapes (BE `incidents_service.py`). */

export type IncidentStatus = "investigating" | "identified" | "resolved";
export type IncidentScopeKind = "router" | "fiber_node" | "zone";
export type IncidentSeverity = "minor" | "major" | "critical";
export type RfoReason = "fiber_cut" | "power_olt" | "cpe_fault" | "upstream" | "other";
export type BroadcastKind = "outage" | "restored";

export interface Incident {
  id: string;
  number: number;
  code: string;
  title: string;
  scope_kind: IncidentScopeKind;
  scope_label: string;
  isp_router_id: string | null;
  fiber_node_id: string | null;
  zone_id: string | null;
  isp_customer_id: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  started_at: string;
  identified_at: string | null;
  resolved_at: string | null;
  duration_minutes: number;
  rfo_reason: RfoReason | null;
  rfo_label: string | null;
  rfo_note: string | null;
  affected_total: number;
  affected_visible: number;
  grace_hours: number | null;
  grace_applied_at: string | null;
}

export interface IncidentEvent {
  id: string;
  kind: string;
  status: IncidentStatus | null;
  body: string | null;
  detail: Record<string, unknown>;
  at: string;
  actor: string | null;
}

export interface AffectedSubscriber {
  subscriber_id: string;
  label: string | null;
  identifier: string | null;
  phone: string | null;
  status: string | null;
  isp_customer_id: string;
  customer_name: string | null;
  source: "router" | "fiber" | "zone";
  node_name: string | null;
  port_no: number | null;
  grace_status: "applied" | "skipped" | null;
  grace_detail: string | null;
  outage_message: string | null;
  restored_message: string | null;
}

export interface IncidentDetail extends Incident {
  events: IncidentEvent[];
  affected: AffectedSubscriber[];
  suggested_grace_hours: number;
}

export interface IncidentPage {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
  summary: {
    open: number;
    resolved: number;
    mttr_minutes: number | null;
    subscriber_minutes_lost: number;
  };
}

export interface NetworkHealth {
  routers_total: number;
  routers_up: number;
  routers_down: number;
  routers_not_reporting: number;
  /** CI-INTEG: Omada / Aruba venues, kept out of up/down and health %. */
  routers_controller_managed?: number;
  health_percent: number | null;
  basis: string;
  open_incidents: number;
  as_of: string;
}

export interface IncidentPreview {
  scope_label: string;
  affected_total: number;
  affected_visible: number;
  sample: { subscriber_id: string; label: string; identifier: string }[];
}

export interface GraceResult {
  dry_run: boolean;
  hours: number;
  affected_visible: number;
  eligible: number;
  skipped: { subscriber_id: string; reason: string }[];
  applied: number;
  failed: { subscriber_id: string; reason: string }[];
}

export interface BroadcastResult {
  kind: BroadcastKind;
  mode: "whatsapp" | "share";
  dry_run: boolean;
  unavailable_reasons: string[];
  recipients: number;
  no_consent: number;
  no_phone: number;
  already: number;
  message: string;
  csv_path: string;
  sent: number;
  failed: number;
  share: { subscriber_id: string; label: string; phone: string; whatsapp_url: string }[];
}

export interface IncidentTarget {
  scope_kind: IncidentScopeKind;
  isp_router_id?: string;
  fiber_node_id?: string;
  zone_id?: string;
}
