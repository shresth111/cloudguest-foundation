/** SUB360-2 workbench + the JAZE-5 helpdesk shapes it uses (LANE_NOTES
 * [SUB360-2] and the JAZE-5 ticket contract). */

export interface WorkbenchLive {
  kind: "hotspot" | "pppoe";
  session_id: string;
  router_id: string | null;
  router_name: string | null;
  nas: string | null;
  /** PPPoE NAS port; hotspot does not record one (null). */
  interface: string | null;
  ip: string | null;
  mac: string | null;
  started_at: string;
  uptime_seconds: number;
  bytes_down: number | null;
  bytes_up: number | null;
}

export type WorkbenchService =
  | { kind: "isp"; package_name: string | null; speed: string | null }
  | {
      kind: "tr069";
      cpe_id: string;
      serial: string | null;
      model: string | null;
      online: boolean;
      last_inform_at: string | null;
    };

export interface Workbench {
  subscriber_id: string;
  breadcrumb: {
    zone_path: { id: string; name: string }[];
    package: { id: string; name: string } | null;
  };
  validity: { valid_until: string | null; seconds_left: number | null };
  /** null: helpdesk off or the role cannot read tickets. */
  open_tickets: number | null;
  tickets: TicketView[] | null;
  live: WorkbenchLive[];
  auth: { hotspot: boolean; pppoe: boolean; mac_bound: boolean | null; static_ip: string | null };
  services: WorkbenchService[];
  pppoe_enabled: boolean;
}

export interface DisconnectResult {
  ended: string[];
  unconfirmed: string[];
}

// ---------------------------------------------------------------- JAZE-5

export type TicketSource =
  | "phone"
  | "whatsapp"
  | "walk_in"
  | "email"
  | "portal"
  | "field"
  | "other";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type RfoReason = "fiber_cut" | "power_olt" | "cpe_fault" | "upstream" | "other";
export type TicketStatus = "open" | "in_progress" | "on_hold" | "resolved" | "closed";

export interface TicketType {
  id: string;
  name: string;
  sla_minutes: number | null;
  requires_rfo: boolean;
  active: boolean;
}

/** `POST /isp/apps/tickets` (IspAppsTicketCreateRequest, extra=forbid). */
export interface TicketCreateBody {
  isp_customer_id: string;
  subscriber_id?: string | null;
  type_id?: string | null;
  subject: string;
  description?: string | null;
  source: TicketSource;
  priority: TicketPriority;
  assignee_user_id?: string | null;
  close_after_raising: boolean;
  rfo_reason?: RfoReason | null;
  resolution_note?: string | null;
}

export interface TicketView {
  id: string;
  number: string;
  isp_customer_id: string;
  customer_name: string | null;
  subscriber_id: string | null;
  subscriber_label: string | null;
  type_id: string | null;
  type_name: string | null;
  subject: string;
  description: string | null;
  source: TicketSource | string;
  priority: TicketPriority | string;
  status: TicketStatus | string;
  assignee_user_id: string | null;
  assignee_name: string | null;
  rfo_reason: RfoReason | string | null;
  resolution_note: string | null;
  opened_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  due_at: string | null;
  sla_minutes: number | null;
  tat_minutes: number | null;
  sla_state: "within" | "breached" | "no_sla" | string;
}
