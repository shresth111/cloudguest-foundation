/**
 * Device Logs (syslog) wire types -- mirror
 * cloud-guest-repo/backend/app/domains/device_logs/schemas.py. Master only.
 */

export type ReceivingState =
  | "feature_off"
  | "not_configured"
  | "awaiting_first_message"
  | "receiving"
  | "silent";

export type Attribution = "tunnel_ip" | "tag_mismatch" | "unattributed";

export type RouterLoggingBlocker = "NOT_MIKROTIK" | "NO_TUNNEL" | "NO_API_CREDENTIALS";

export interface DeviceLogEvent {
  id: number;
  received_at: string;
  device_time: string | null;
  organization_id: string | null;
  organization_name: string | null;
  location_id: string | null;
  location_name: string | null;
  router_id: string | null;
  router_name: string | null;
  source_ip: string;
  vendor: string;
  source: string;
  facility: number | null;
  /** RFC 5424: 0 emergency .. 7 debug. null = the line carried no priority. */
  severity: number | null;
  severity_name: string | null;
  hostname: string | null;
  topics: string | null;
  message: string;
  attribution: Attribution;
  claimed_tag: string | null;
}

export interface DeviceLogPage {
  feature_enabled: boolean;
  items: DeviceLogEvent[];
  next_cursor: string | null;
  since: string;
  until: string;
}

export interface RouterLoggingStatus {
  router_id: string;
  router_name: string | null;
  organization_id: string | null;
  location_id: string | null;
  location_name: string | null;
  organization_name: string | null;
  enabled: boolean;
  remote_host: string;
  remote_port: number;
  last_applied_at: string | null;
  last_verified_at: string | null;
  verified_ok: boolean | null;
  verify_detail: string | null;
  last_received_at: string | null;
  state: ReceivingState;
}

export interface DeviceLogsOverview {
  feature_enabled: boolean;
  routers: RouterLoggingStatus[];
  unattributed_last_24h: number;
}

export interface RouterLoggingDetail {
  feature_enabled: boolean;
  router_id: string;
  router_name: string;
  vendor: string;
  location_name: string | null;
  organization_name: string | null;
  blocker: RouterLoggingBlocker | null;
  blocker_detail: string | null;
  tunnel_ip: string | null;
  status: RouterLoggingStatus | null;
  script: string[] | null;
  state: ReceivingState;
}

export interface DeviceLogFilters {
  window: "1h" | "24h" | "7d" | "30d";
  organizationId: string;
  locationId: string;
  routerId: string;
  /** "" = every severity, including lines without one. */
  maxSeverity: string;
  q: string;
  unattributed: boolean;
}
