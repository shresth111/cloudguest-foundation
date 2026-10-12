/**
 * Traffic Lens (NetFlow/IPFIX rollups) wire types for the Master console --
 * mirror wyfy-specs/flow-visibility/API.md ("Traffic flow: Master API after
 * PR B"). Backend: `app/domains/traffic_flow` (cloud-guest), every route
 * under `/platform/traffic-flow`, GLOBAL-pinned on `traffic_flows.*`.
 *
 * Keys are the wire's own snake_case (as in src/types/deviceLogs.ts); the
 * `{success, data}` envelope is already unwrapped by `api`'s interceptor.
 *
 * Devices, destinations and services are three INDEPENDENT lists by design:
 * no response pairs a device with a destination or a service, and the
 * database holds no such pairing. Do not build a UI that implies otherwise.
 */

export type FlowExportState =
  | "feature_off"
  | "unsupported_vendor"
  | "not_configured"
  | "awaiting_first_data"
  | "receiving"
  | "silent";

/** One row of GET /status `routers[]`; also `status` in the config payload. */
export interface RouterFlowStatus {
  router_id: string;
  router_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  location_id: string | null;
  location_name: string | null;
  vendor: string | null;
  state: FlowExportState;
  /** The per-router switch: Apply sets it, Remove clears it. */
  configured: boolean;
  configured_at: string | null;
  last_verified_at: string | null;
  /** null = never applied; false = written but the read-back did not match. */
  last_verdict_ok: boolean | null;
  last_verdict_detail: string | null;
  /** null when no data is held. */
  last_window_start: string | null;
  last_window_end: string | null;
  /** 5-minute windows received in the last hour (0..12). Meaningless for a
   * router that is not set up or has never sent; see `windowsLastHourLabel`. */
  windows_last_hour: number | null;
  bytes_last_hour: number | null;
}

/** Health of the pull from the hub's collector. Not a per-router state. */
export interface FlowCollectorStatus {
  agent_configured: boolean;
  last_pull_at: string | null;
  /** null = no pull has run yet. */
  last_pull_ok: boolean | null;
  last_error: string | null;
  last_window_start: string | null;
  /** Tunnel addresses sending records that match no router. */
  unknown_exporters: string[];
}

export interface TrafficFlowStatus {
  feature_enabled: boolean;
  generated_at: string;
  window_seconds: number;
  silent_after_seconds: number;
  collector: FlowCollectorStatus | null;
  routers: RouterFlowStatus[];
}

export type FlowBlockerCode =
  | "FEATURE_OFF"
  | "UNSUPPORTED_VENDOR"
  | "NO_TUNNEL"
  | "ROUTEROS_VERSION"
  | "NO_API_CREDENTIALS";

export interface FlowExportDesired {
  target_host: string;
  target_port: number;
  /** The router's own tunnel address (Master only, never customer-facing). */
  src_address: string;
  version: string;
}

/** GET /routers/{id}/config. A database read; the router is not contacted. */
export interface RouterFlowConfig {
  router_id: string;
  status: RouterFlowStatus | null;
  /** "Apply can run now". */
  eligible: boolean;
  /** Sentences for display, parallel to `blocker_codes`. */
  blockers: string[];
  blocker_codes: FlowBlockerCode[];
  routeros_version: string | null;
  /** null when the router has no tunnel. */
  desired: FlowExportDesired | null;
  /** Lines rendered by the backend. `[]`/null when there is no tunnel. */
  paste_script: string[] | null;
  /** Always present for a MikroTik; `[]` for other vendors. */
  removal_script: string[] | null;
}

/** POST /routers/{id}/apply (dry run or real) and POST /routers/{id}/remove.
 * A real write carries the read-back verdict in `ok`: a 200 is NOT by
 * itself "configured". A dry run carries neither `ok` nor `state`. */
export interface FlowWriteResult {
  router_id: string;
  dry_run: boolean;
  enabled: boolean;
  /** dry run only */
  planned_writes?: string[];
  differences?: string[];
  /** real write only */
  ok?: boolean;
  detail?: string | null;
  state?: FlowExportState;
  writes?: string[];
  matches?: boolean;
  mismatches?: string[];
}

export interface FlowTotals {
  bytes_up: number;
  bytes_down: number;
  /** Both ends private. Reported apart; in no list. */
  bytes_internal: number;
  /** Neither end private. Reported apart; in no list. */
  bytes_unclassified: number;
  flows: number;
  /** How much of the range actually has data. */
  covered_seconds: number;
  /** Bits per second. */
  avg_bps_up: number;
  avg_bps_down: number;
  /** Largest count in any single window -- NOT distinct over the range. */
  devices_peak: number;
  destinations_peak: number;
}

/** A service is a protocol plus the outside end's port. `service_name` is
 * the IANA port label, never an application. */
export interface FlowServiceRef {
  protocol: number | null;
  protocol_name: string | null;
  port: number | null;
  service_name: string | null;
}

export interface FlowServiceItem extends FlowServiceRef {
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
  /** 0..1 fraction of client traffic in the range. */
  share: number;
  avg_bps: number;
}

export interface FlowServices {
  exact: boolean;
  items: FlowServiceItem[];
  /** Everything not in `items`. */
  other_bytes: number;
  other_share: number;
}

export interface FlowProtocolItem {
  protocol: number | null;
  protocol_name: string;
  bytes: number;
  share: number;
}

export interface FlowTimelineSeries extends FlowServiceRef {
  /** "<protocol>/<port>", the key into each step's `services`. */
  key: string;
}

export interface FlowTimelineStep {
  start: string;
  covered_seconds: number;
  bytes_up: number;
  bytes_down: number;
  bps_up: number;
  bps_down: number;
  /** false = this step's rows carried no protocol/port: not measured. */
  services_measured: boolean;
  /** Bytes per series key. */
  services: Record<string, number>;
  other_bytes: number;
  protocols: Record<string, number>;
}

export interface FlowTimeline {
  series: FlowTimelineSeries[];
  /** A step with no window is ABSENT. A gap, not a zero. */
  steps: FlowTimelineStep[];
}

export type FlowDeviceMatch = "session" | "ambiguous" | "none";

export interface FlowDeviceItem {
  router_id: string | null;
  ip: string;
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
  share_at_least: number;
  match: FlowDeviceMatch;
  guest_session_id: string | null;
}

export interface FlowDestinationItem {
  ip: string;
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
  share_at_least: number;
}

export interface FlowBoundedList<T> {
  items: T[];
  /** Client traffic minus the listed items: an upper bound. */
  other_bytes_at_most: number | null;
}

export interface FlowListAccuracy {
  method: string;
  per_window_top_n: number;
  /** true = every figure in the named lists is a lower bound. */
  lower_bound: boolean;
  applies_to: string[];
}

/** GET /summary. `measured: false` = no window in the range: `totals` is
 * null, every list is empty, and nothing may be drawn as zero. */
export interface FlowSummary {
  feature_enabled: boolean;
  measured: boolean;
  since: string;
  until: string;
  window_seconds: number;
  step_seconds: number;
  windows: number;
  /** Start of the oldest / newest window held for the scope at all. */
  data_oldest: string | null;
  data_newest: string | null;
  totals: FlowTotals | null;
  /** false = the rows carried no protocol/port: services not measured. */
  services_measured: boolean;
  services: FlowServices | null;
  protocols: FlowProtocolItem[];
  timeline: FlowTimeline | null;
  list_accuracy: FlowListAccuracy | null;
  devices: FlowBoundedList<FlowDeviceItem> | null;
  destinations: FlowBoundedList<FlowDestinationItem> | null;
}

export type FlowWindow = "1h" | "6h" | "24h" | "7d";

/** What the venue view is looking at. Nothing is requested until a venue or
 * a router is picked (the API refuses a summary with neither). */
export interface FlowScope {
  window: FlowWindow;
  locationId: string;
  routerId: string;
}

export interface FleetFilters {
  organizationId: string;
  locationId: string;
  /** "" = every state. */
  state: FlowExportState | "";
  q: string;
}
