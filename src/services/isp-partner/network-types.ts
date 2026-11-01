/**
 * JAZE-2 network enforcement (ADDENDUM_05 J3/J8/J13/J20/J21). These mirror the
 * backend views in `isp_partner/enforcement_router.py`, `enforcement.py`
 * (`fup_view`) and `network_router.py` on `feat/isp-jaze2-enforcement`.
 * Field names and nullability follow the pydantic request models and the
 * dict views exactly; do not add fields the backend does not send.
 */

export type FupReset = "cycle" | "day" | "month";
export type ValidityStarts = "activation" | "first_login";
export type EnforcementLiveMode = "next_auth" | "reauth";

/** Body of `PUT /isp/packages/{package_id}/policy` (`PolicyRequest`, extra=forbid). */
export interface PackagePolicyBody {
  /** 1..1_000_000_000, or null for no FUP. */
  fup_limit_mb: number | null;
  fup_reset: FupReset;
  /** Needs `fup_limit_mb`. */
  fup_fallback_speed_group_id: string | null;
  fup_exclude_upload: boolean;
  fup_carry_forward: boolean;
  /** Boost: all three set, or all three null. Start != end. */
  boost_speed_group_id: string | null;
  /** Minutes after local midnight, 0..1439. */
  boost_start_minute: number | null;
  boost_end_minute: number | null;
  validity_starts: ValidityStarts;
  /** 1..8, or null for the speed group's own priority. */
  queue_priority: number | null;
  /** 0..16: auto-bind the first N device MACs. */
  mac_bind_count: number;
  mac_restriction: boolean;
  ip_restriction: boolean;
  /** 1..64, or null for no limit. */
  max_simultaneous: number | null;
  /** 60..604800 seconds, or null. */
  idle_timeout_s: number | null;
  /** 300..7776000 seconds, or null. */
  hard_timeout_s: number | null;
}

/** `GET|PUT /isp/packages/{package_id}/policy` (`_policy_view`). */
export interface PackagePolicy extends PackagePolicyBody {
  package_id: string;
  /** false: no row yet; every field is the request default. */
  configured: boolean;
  /** `ISP_PARTNER_ENFORCEMENT_ENABLED`. Off: stored and shown, never applied. */
  enforcement_enabled: boolean;
  live_mode: EnforcementLiveMode | string;
  fup_fallback_speed_group_name: string | null;
  boost_speed_group_name: string | null;
}

/** `GET /isp/subscribers/{id}/fup` and the reset / top-up answers. */
export interface FupStatus {
  subscriber_id: string;
  policy_configured: boolean;
  enforcement_enabled: boolean;
  fup_enabled: boolean;
  allowance_bytes: number | null;
  used_bytes: number;
  used_down_bytes: number;
  used_up_bytes: number;
  carry_bytes: number;
  topup_bytes: number;
  remaining_bytes: number | null;
  throttled: boolean;
  throttled_at: string | null;
  period_start: string | null;
  period_end: string | null;
  reset: FupReset | null;
  exclude_upload: boolean;
  fallback_speed_group: { id: string; name: string | null } | null;
  /** null until the sweep has run once for this subscriber. */
  computed_at: string | null;
}

export interface MacBinding {
  id: string;
  mac: string;
  source: "auto" | "manual" | string;
  bound_at: string | null;
}

export type EnforcementEventKind =
  | "fup_throttle"
  | "fup_restore"
  | "fup_topup"
  | "fup_reset"
  | "boost_on"
  | "boost_off"
  | "mac_bound"
  | "mac_reject"
  | "ip_reject"
  | "concurrency"
  | "idle_timeout"
  | "hard_timeout"
  | "validity_start"
  | "reauth";

export interface EnforcementEvent {
  id: string;
  kind: EnforcementEventKind | string;
  detail: Record<string, unknown> | null;
  session_id: string | null;
  occurred_at: string;
}

/** `GET /isp/locations/{isp_location_id}/ip-pools`. */
export interface IpPool {
  id: string;
  name: string;
  range_start: string;
  range_end: string;
  gateway: string | null;
  router_id: string;
  /** null when the range is not IPv4 or is larger than 65536 hosts. */
  size: number | null;
  pinned: number;
  next_free: string | null;
}

export interface NextFreeIp {
  ip: string;
  pool_id: string;
}

/** `IpBindingRequest` (extra=forbid). Omit `ip` for the next free address. */
export interface IpBindingBody {
  isp_location_id: string;
  pool_id: string;
  ip?: string | null;
  mac?: string | null;
  static_queue?: boolean;
}

export interface IpBinding {
  id: string;
  ip: string;
  mac: string | null;
  location_id: string;
  pool_id: string | null;
  router_id: string | null;
  static_queue: boolean;
  queue_status: "none" | "active" | "failed" | string;
  queue_error: string | null;
}

// ---------------------------------------------------------------- router (J13/J20)

export interface LiveInterface {
  name: string;
  type: string | null;
  running: boolean;
  disabled: boolean;
  rx_bps: number | null;
  tx_bps: number | null;
  rx_pps: number | null;
  tx_pps: number | null;
  rx_bytes: number | null;
  tx_bytes: number | null;
  rx_errors: number | null;
  tx_errors: number | null;
  rx_drops: number | null;
  tx_drops: number | null;
}

export interface RouterHealthUnreachable {
  router_id: string;
  read_at: string;
  reachable: false;
  reason: "not_mikrotik" | "not_set_up" | "unreachable" | string;
  detail?: string;
}

export interface RouterHealthLive {
  router_id: string;
  read_at: string;
  reachable: true;
  cpu_load_percent: number | null;
  cpu_count: number | null;
  cpu_cores: { cpu: string | null; load_percent: number | null }[];
  cpu_model: string | null;
  memory_total_bytes: number | null;
  memory_free_bytes: number | null;
  memory_used_percent: number | null;
  uptime: string | null;
  uptime_seconds: number | null;
  version: string | null;
  board_name: string | null;
  architecture: string | null;
  model: string | null;
  serial_number: string | null;
  interfaces: LiveInterface[];
}

export type RouterHealth = RouterHealthLive | RouterHealthUnreachable;

export interface RouterHistoryPoint {
  at: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  uptime_seconds: number | null;
  clients: number | null;
  status: string | null;
}

export interface ThroughputPoint {
  at: string;
  in_mbps: number;
  out_mbps: number;
}

export interface RouterHistory {
  router_id: string;
  hours: number;
  points: RouterHistoryPoint[];
  interfaces: Record<string, ThroughputPoint[]>;
  interfaces_source: "snmp" | "none";
}

export interface ActiveSession {
  session_id: string;
  kind: "hotspot" | "pppoe";
  started_at: string;
  uptime_seconds: number;
  ip: string | null;
  mac: string | null;
  /** Masked unless it is an ISP-entered subscriber identifier. */
  guest: string | null;
  subscriber_id: string | null;
  circuit_id: number | null;
  bytes_down: number | null;
  bytes_up: number | null;
  last_activity_at: string | null;
}

export interface RouterActiveSessions {
  router_id: string;
  sessions: ActiveSession[];
}

// ---------------------------------------------------------------- TR-069 (J21)

export interface Tr069Summary {
  total: number;
  active: number;
  offline: number;
  new_today: number;
  configured_today: number;
  unassigned: number;
  day_start_utc: string;
}

export type OpticalBand = "good" | "warn" | "bad";

export interface Tr069Optical {
  cpe_id: string;
  available: boolean;
  dbm: number | null;
  raw: string | number | null;
  path: string | null;
  band: OpticalBand | null;
  params_refreshed_at: string | null;
}
