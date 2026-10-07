/** NetFlow/IPFIX (MikroTik traffic-flow) rollups for the Master console.
 *
 * Backend: `app/domains/traffic_flow` (cloud-guest), `GET
 * /platform/traffic-flow/overview` and `/routers/{id}/config|apply`, all
 * GLOBAL-pinned on the `traffic_flows.*` permission. Design:
 * `~/wyfy-ops/netflow/DESIGN.md`.
 *
 * Talkers and destinations are two INDEPENDENT lists by design: no stored
 * row says which guest went where (DESIGN.md §7). Do not build a UI that
 * implies otherwise. */

/** Per-router state, most-blocking first. A wire contract, matched by name. */
export type TrafficFlowState =
  | "disabled"
  | "not_allowlisted"
  | "collector_unreachable"
  | "no_windows"
  | "stale"
  | "ok";

export type TalkerMatch = "session" | "ambiguous" | "none";

export interface TrafficFlowTalker {
  ip: string;
  bytesUp: number;
  bytesDown: number;
  flows: number;
  match: TalkerMatch;
  guestSessionId: string | null;
}

export interface TrafficFlowDestination {
  ip: string;
  bytes: number;
  flows: number;
}

export interface TrafficFlowRouter {
  routerId: string;
  routerName: string | null;
  vendor: string | null;
  locationName: string | null;
  organizationName: string | null;
  allowlisted: boolean;
  state: TrafficFlowState;
  windows: number;
  newestWindowStart: string | null;
  source: string;
  approximate: boolean;
  bytesTotal: number;
  flowsTotal: number;
  bytesInternal: number;
  bytesUnclassified: number;
  talkers: TrafficFlowTalker[];
  destinations: TrafficFlowDestination[];
}

export interface TrafficFlowOverview {
  enabled: boolean;
  agentConfigured: boolean;
  periodMinutes: number;
  generatedAt: string;
  windowSeconds: number;
  lastPullAt: string | null;
  lastPullOk: boolean | null;
  lastError: string | null;
  lastWindowStart: string | null;
  unknownExporters: string[];
  routers: TrafficFlowRouter[];
}

export interface TrafficFlowConfigPreview {
  routerId: string;
  eligible: boolean;
  blockers: string[];
  collectorAddress: string | null;
  collectorPort: number | null;
  sourceAddress: string | null;
  routerosVersion: string | null;
  lines: string[];
}

export interface TrafficFlowApplyResult {
  routerId: string;
  dryRun: boolean;
  enabled: boolean;
  /** dry run only */
  plannedWrites?: string[];
  differences?: string[];
  /** real apply only */
  writes?: string[];
  matches?: boolean;
  mismatches?: string[];
}

export const TRAFFIC_FLOW_STATE_LABEL: Record<TrafficFlowState, string> = {
  disabled: "Disabled (flag off)",
  not_allowlisted: "Not allowlisted",
  collector_unreachable: "Collector unreachable",
  no_windows: "No flows received",
  stale: "Stale",
  ok: "Receiving",
};

/** MTag tone per state -- reuses MasterKit's existing palette keys. */
export const TRAFFIC_FLOW_STATE_TONE: Record<TrafficFlowState, string> = {
  disabled: "normal",
  not_allowlisted: "warning",
  collector_unreachable: "critical",
  no_windows: "pending",
  stale: "degraded",
  ok: "active",
};

/** What each state means, in operator words -- shown instead of an empty
 * table so "nothing here" is never mistaken for "no traffic". */
export const TRAFFIC_FLOW_STATE_HELP: Record<TrafficFlowState, string> = {
  disabled:
    "CLOUDGUEST_TRAFFIC_FLOW_ENABLED is off on this backend, so nothing is collected or ingested.",
  not_allowlisted:
    "Flows are arriving from this router, but it is not in CLOUDGUEST_TRAFFIC_FLOW_ROUTER_IDS.",
  collector_unreachable:
    "The last pull from the hub's flow agent failed -- see the error above. This is not 'no traffic'.",
  no_windows:
    "No flow window from this router in the period. Export may not be applied yet, the tunnel may be down, or the router is idle.",
  stale: "The newest window is more than 15 minutes old. Export or the tunnel may have stopped.",
  ok: "Flow windows are arriving.",
};
