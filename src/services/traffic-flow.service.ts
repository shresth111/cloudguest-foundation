/**
 * Master console calls for Traffic Lens (NetFlow/IPFIX rollups). Every route
 * is GLOBAL-pinned on the backend (`traffic_flows.read` / `.update`); an
 * org-scoped session gets 403 by design. Nothing in the customer dashboard
 * may import this file -- guest traffic metadata is operator-only
 * (~/wyfy-ops/netflow/DESIGN.md §7).
 *
 * Shapes: wyfy-specs/flow-visibility/API.md. `api`'s response interceptor
 * already unwraps the `{success, data}` envelope.
 */
import { api } from "./api";
import type {
  FlowScope,
  FlowSummary,
  FlowWindow,
  FlowWriteResult,
  RouterFlowConfig,
  TrafficFlowStatus,
} from "@/types/traffic-flow";

const BASE = "/platform/traffic-flow";

/** The backend refuses a range longer than 7 days (it never shortens one
 * silently), so that is the longest offered. */
export const FLOW_WINDOW_MS: Record<FlowWindow, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/** How many services get their own band in the timeline. Four, because the
 * Master theme has four chart tokens that stay apart on both surfaces (see
 * FLOW_SERIES_COLORS); a fifth service folds into "Other" rather than
 * getting an invented colour. */
export const FLOW_TIMELINE_SERIES = 4;

/** The range a scope means, as the explicit instants every request sends.
 * A custom range is used as given; a preset ends at `now`. One function, so
 * the summary, the Destinations search and the drill-down can never describe
 * different ranges. */
export function flowRange(scope: FlowScope, now: number): { since: string; until: string } {
  if (scope.custom) return { since: scope.custom.since, until: scope.custom.until };
  return {
    since: new Date(now - FLOW_WINDOW_MS[scope.window]).toISOString(),
    until: new Date(now).toISOString(),
  };
}

/** Length of that range in milliseconds (for the timeline's tick labels). */
export function flowRangeMs(scope: FlowScope): number {
  if (!scope.custom) return FLOW_WINDOW_MS[scope.window];
  const ms = Date.parse(scope.custom.until) - Date.parse(scope.custom.since);
  return Number.isFinite(ms) && ms > 0 ? ms : FLOW_WINDOW_MS[scope.window];
}

/** Query params for GET /summary. The window is turned into explicit
 * `since`/`until` at request time so every block on the screen describes the
 * same range. Both ids are sent when both are picked (the API allows it). */
export function flowSummaryParams(scope: FlowScope, now: number): Record<string, string> {
  const params: Record<string, string> = {
    ...flowRange(scope, now),
    limit: "10",
    series: String(FLOW_TIMELINE_SERIES),
  };
  if (scope.locationId) params.location_id = scope.locationId;
  if (scope.routerId) params.router_id = scope.routerId;
  return params;
}

export const trafficFlowService = {
  async status(): Promise<TrafficFlowStatus> {
    const { data } = await api.get<TrafficFlowStatus>(`${BASE}/status`);
    return data;
  },

  /** The scripts the backend renders for this router, plus every reason
   * Apply cannot run. Database read only. */
  async config(routerId: string): Promise<RouterFlowConfig> {
    const { data } = await api.get<RouterFlowConfig>(
      `${BASE}/routers/${encodeURIComponent(routerId)}/config`,
    );
    return data;
  },

  /** `dry_run` defaults to TRUE on the backend, so it is always sent
   * explicitly: a real write must say so. */
  async apply(routerId: string, opts: { dryRun: boolean }): Promise<FlowWriteResult> {
    const { data } = await api.post<FlowWriteResult>(
      `${BASE}/routers/${encodeURIComponent(routerId)}/apply`,
      { enabled: true, dry_run: opts.dryRun },
    );
    return data;
  },

  /** Removes the platform's export target, switches export off, reads back. */
  async remove(routerId: string): Promise<FlowWriteResult> {
    const { data } = await api.post<FlowWriteResult>(
      `${BASE}/routers/${encodeURIComponent(routerId)}/remove`,
    );
    return data;
  },

  async summary(params: Record<string, string>): Promise<FlowSummary> {
    const { data } = await api.get<FlowSummary>(`${BASE}/summary`, { params });
    return data;
  },
};
