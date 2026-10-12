/**
 * Traffic Lens wording for the MASTER console only: router states, platform
 * banners, the "not measured" reasons an operator gets, and the setup
 * drawer. Tested by scripts/test-traffic-flow.mjs.
 *
 * Everything both consoles share (bytes, rates, shares, services, totals,
 * the gap-preserving timeline, lower-bound wording) lives in
 * src/lib/traffic-lens-shared.ts and is re-exported here, so Master files
 * keep importing from this one module. The customer dashboard must NOT
 * import this file: it talks about tunnels, collectors and router config.
 */
import { verdictLabel, type StatePresentation } from "@/lib/device-logs-presentation";
import { formatBytes, formatCount } from "@/lib/analytics-format";
import {
  DASH,
  TRAFFIC_FLOW_MODULE_NAME,
  clockLabel,
  formatAgo,
  isNum,
} from "@/lib/traffic-lens-shared";
import type {
  FleetFilters,
  FlowBlockerCode,
  FlowExportState,
  FlowSummary,
  FlowWriteResult,
  RouterFlowConfig,
  RouterFlowStatus,
  TrafficFlowStatus,
} from "@/types/traffic-flow";

export * from "@/lib/traffic-lens-shared";
export { verdictLabel };
export type { StatePresentation };

// ---------------------------------------------------------------------------
// Router states (M1, M3)
// ---------------------------------------------------------------------------

export const FLOW_STATE: Record<FlowExportState, StatePresentation> = {
  feature_off: {
    label: "Switched off",
    tone: "normal",
    detail: `${TRAFFIC_FLOW_MODULE_NAME} is switched off on this platform (CLOUDGUEST_TRAFFIC_FLOW_ENABLED). Nothing is collected and no router is written.`,
  },
  unsupported_vendor: {
    label: "Not supported on this equipment",
    tone: "normal",
    detail:
      "Flow export is only built for MikroTik routers. Nothing can be set up on this device and its traffic is not measured here.",
  },
  not_configured: {
    label: "Not set up",
    tone: "normal",
    detail: `${TRAFFIC_FLOW_MODULE_NAME} is not set up on this router, and no data from it is held.`,
  },
  awaiting_first_data: {
    label: "Waiting for first data",
    tone: "pending",
    detail:
      "Export is switched on, but no window has ever arrived. Unknown, not quiet: check the collector before assuming the venue has no traffic.",
  },
  receiving: {
    label: "Receiving",
    tone: "online",
    detail: "Windows from this router are arriving.",
  },
  silent: {
    label: "Silent",
    tone: "warning",
    detail:
      "Data is held, but nothing has arrived for an hour or more. The router may be offline, or its tunnel or export config changed. The gap is not measured.",
  },
};

const UNKNOWN_STATE: StatePresentation = {
  label: "Unknown state",
  tone: "warning",
  detail: "The platform reported a state this screen does not know. Treat it as not measured.",
};

/** An unrecognised state from the wire is never dressed as a healthy one. */
export function flowState(state: unknown): StatePresentation {
  return (FLOW_STATE as Record<string, StatePresentation>)[String(state)] ?? UNKNOWN_STATE;
}

export const FLOW_STATE_FILTER_OPTIONS: { value: FlowExportState | ""; label: string }[] = [
  { value: "", label: "All states" },
  ...(Object.keys(FLOW_STATE) as FlowExportState[]).map((s) => ({
    value: s,
    label: FLOW_STATE[s].label,
  })),
];

/** The state cell. A silent router says since when, from the end of the
 * last window it sent. */
export function stateLabel(row: RouterFlowStatus, now: number): string {
  const st = flowState(row.state);
  if (row.state !== "silent") return st.label;
  const since = clockLabel(row.last_window_end, now);
  return since ? `Silent since ${since}` : st.label;
}

/** States in which the last-hour counters are not a reading: nothing was
 * ever switched on, or nothing has ever arrived. API.md: "show a dash, not
 * these zeros". */
const NO_LAST_HOUR_READING: ReadonlySet<string> = new Set([
  "feature_off",
  "unsupported_vendor",
  "not_configured",
  "awaiting_first_data",
]);

/** "9 of 12" windows in the last hour. Only a router the platform has
 * actually heard from shows a number, including a real 0 (silent). */
export function windowsLastHourLabel(row: RouterFlowStatus, windowSeconds: number): string {
  if (NO_LAST_HOUR_READING.has(row.state) || !isNum(row.windows_last_hour)) return DASH;
  const expected = isNum(windowSeconds) && windowSeconds > 0 ? Math.round(3600 / windowSeconds) : 0;
  return expected > 0
    ? `${row.windows_last_hour} of ${expected}`
    : formatCount(row.windows_last_hour);
}

export function bytesLastHourLabel(row: RouterFlowStatus): string {
  if (NO_LAST_HOUR_READING.has(row.state) || !isNum(row.bytes_last_hour)) return DASH;
  return formatBytes(row.bytes_last_hour);
}

/** "Last data" cell: when the newest window ended. null = none held. */
export function lastDataLabel(row: RouterFlowStatus, now: number): string {
  return row.last_window_end ? formatAgo(row.last_window_end, now) : "none held";
}

export function filterRouters(routers: RouterFlowStatus[], f: FleetFilters): RouterFlowStatus[] {
  const q = f.q.trim().toLowerCase();
  return routers.filter(
    (r) =>
      (!f.organizationId || r.organization_id === f.organizationId) &&
      (!f.locationId || r.location_id === f.locationId) &&
      (!f.state || r.state === f.state) &&
      (!q || (r.router_name ?? r.router_id).toLowerCase().includes(q)),
  );
}

export interface FlowBanner {
  tone: "info" | "warning" | "error";
  title: string;
  body: string;
}

/** Platform-level notices above the fleet table. Collector health is not a
 * router state, so it is said once here rather than on every row. */
export function statusBanners(status: TrafficFlowStatus, now: number): FlowBanner[] {
  const out: FlowBanner[] = [];
  if (!status.feature_enabled) {
    out.push({
      tone: "info",
      title: `${TRAFFIC_FLOW_MODULE_NAME} is switched off on this platform.`,
      body: "Nothing is collected and no router is written.",
    });
    return out;
  }
  const c = status.collector;
  if (!c) return out;
  if (!c.agent_configured)
    out.push({
      tone: "warning",
      title: "The collector is not connected",
      body: "The platform has no collector to pull from, so no window can arrive. This is not 'no traffic'.",
    });
  if (c.last_pull_ok === false)
    out.push({
      tone: "error",
      title: `The last pull from the collector failed (${formatAgo(c.last_pull_at, now)})`,
      body: `${c.last_error?.trim() || "No error text was recorded."} Routers are not quiet; their data is not arriving.`,
    });
  if (c.agent_configured && c.last_pull_ok === null)
    out.push({
      tone: "info",
      title: "No pull from the collector has run yet",
      body: "Until one does, every router reads as waiting. Unknown, not quiet.",
    });
  if ((c.unknown_exporters ?? []).length > 0)
    out.push({
      tone: "warning",
      title: "Records are arriving that match no router",
      body: `${c.unknown_exporters.join(", ")}: these tunnel addresses belong to no router the platform knows. Their traffic is not attributed to any venue, and is not guessed.`,
    });
  return out;
}

/** Why the range reads "Not measured", from the summary and the states of
 * the routers in the picked scope. Never says "no traffic". */
export function notMeasuredMessage(
  summary: FlowSummary | null | undefined,
  states: FlowExportState[],
  now: number,
): { title: string; body: string; offerSetup: boolean } {
  if (summary && summary.feature_enabled === false)
    return {
      title: `${TRAFFIC_FLOW_MODULE_NAME} is switched off on this platform.`,
      body: "Nothing is collected, so nothing was measured.",
      offerSetup: false,
    };
  const starts = clockLabel(summary?.data_oldest, now);
  if (starts)
    return {
      title: "Not measured for this period.",
      body: `Data starts ${starts}. Nothing was stored for the range picked: the router may have been offline or not exporting then. That is not zero traffic.`,
      offerSetup: false,
    };
  if (states.length > 0 && states.every((s) => s === "unsupported_vendor"))
    return {
      title: "Not supported on this equipment.",
      body: FLOW_STATE.unsupported_vendor.detail,
      offerSetup: false,
    };
  if (
    states.length > 0 &&
    states.every((s) => s === "not_configured" || s === "unsupported_vendor")
  )
    return {
      title: `${TRAFFIC_FLOW_MODULE_NAME} is not set up on this router.`,
      body: "Nothing has been collected, so there is nothing to show. No data is not the same as no traffic.",
      offerSetup: true,
    };
  if (states.length > 0 && states.every((s) => s === "awaiting_first_data"))
    return {
      title: "Not measured for this period.",
      body: FLOW_STATE.awaiting_first_data.detail,
      offerSetup: false,
    };
  return {
    title: "Not measured for this period.",
    body: "No window is held for this scope. Unknown, not quiet.",
    offerSetup: false,
  };
}

/** What the numbers exclude. Each is a hardware question that has not been
 * measured yet, and the API has no per-router answer, so the panel says
 * "Not yet checked" rather than nothing (PRODUCT.md §3.1). */
export const NOT_COUNTED_ITEMS: { title: string; body: string }[] = [
  {
    title: "Fast-tracked connections",
    body: "MikroTik may not count fast-tracked connections. If it does not, long downloads are under-counted.",
  },
  {
    title: "Sampling",
    body: "If the router samples packets rather than counting all of them, every figure is an estimate.",
  },
  {
    title: "Delay",
    body: "How long traffic takes to appear here after it happens.",
  },
  {
    title: "Devices behind a second router",
    body: "Devices behind a guest access point in router mode appear as one address.",
  },
];
export const NOT_YET_CHECKED = "Not yet checked on this router";

// ---------------------------------------------------------------------------
// Setup drawer (M3)
// ---------------------------------------------------------------------------

/** Script lines as text. Blank means the backend rendered no script. */
export function scriptText(lines: string[] | string | null | undefined): string | null {
  if (lines == null) return null;
  const text = (Array.isArray(lines) ? lines.join("\n") : String(lines)).trim();
  return text === "" ? null : text;
}

const BLOCKER_FALLBACK: Record<FlowBlockerCode, string> = {
  FEATURE_OFF: `${TRAFFIC_FLOW_MODULE_NAME} is switched off on this platform.`,
  UNSUPPORTED_VENDOR: "Not a MikroTik router.",
  NO_TUNNEL: "The router has no tunnel to the platform.",
  ROUTEROS_VERSION: "RouterOS is older than version 7.",
  NO_API_CREDENTIALS: "No RouterOS API credentials are stored for this router.",
};

/** Why Apply is unavailable, one sentence per reason. Empty = it can run.
 * The backend's sentences win; a code without a sentence still gets one. */
export function applyBlockers(
  config: RouterFlowConfig | null | undefined,
  canApply: boolean,
): string[] {
  if (!config) return [];
  const out: string[] = [];
  if (!canApply) out.push("Needs the traffic_flows.update permission.");
  const sentences = (config.blockers ?? []).map((b) => String(b).trim()).filter(Boolean);
  if (sentences.length > 0) out.push(...sentences);
  else
    for (const code of config.blocker_codes ?? [])
      out.push(BLOCKER_FALLBACK[code] ?? `Blocked: ${code}`);
  if (out.length === 0 && config.eligible !== true)
    out.push("The platform says Apply cannot run on this router, without a reason.");
  return out;
}

/** What the toast and the drawer say after a real Apply / Remove. The
 * verdict is the device read-back: anything but `ok === true` on a 200 is
 * a warning, never a success. */
export function writeVerdictMessage(
  op: "apply" | "remove",
  result: FlowWriteResult,
): { tone: "success" | "warning"; text: string } {
  if (result.ok === true)
    return {
      tone: "success",
      text:
        op === "apply"
          ? `${TRAFFIC_FLOW_MODULE_NAME} set up and verified on the router.`
          : `${TRAFFIC_FLOW_MODULE_NAME} removed and verified on the router.`,
    };
  const which =
    result.detail?.trim() || (result.mismatches ?? []).join("; ").trim() || "no detail given";
  return {
    tone: "warning",
    text: `${op === "apply" ? "Written" : "Removed"}, but the read-back does not match: ${which}`,
  };
}

/** One line summarising a dry run. Nothing was written. */
export function dryRunSummary(result: FlowWriteResult): string {
  const n = (result.planned_writes ?? []).length;
  if (n === 0) return "Dry run: the router already matches. Nothing would be written.";
  return `Dry run: ${n} write${n === 1 ? "" : "s"} would be issued. Nothing was written.`;
}
