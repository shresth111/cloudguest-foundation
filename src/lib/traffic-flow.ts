/** Wire mappers for the Master traffic-flow page. Pure, so
 * scripts/test-traffic-flow.mjs can exercise them without a browser.
 *
 * Unknown values are never coerced into a healthy-looking one: an
 * unrecognised state becomes `no_windows` (an explicit "nothing received"),
 * and a missing number stays 0 only where the backend sent a real total. */
import type {
  TalkerMatch,
  TrafficFlowApplyResult,
  TrafficFlowConfigPreview,
  TrafficFlowDestination,
  TrafficFlowOverview,
  TrafficFlowRouter,
  TrafficFlowState,
  TrafficFlowTalker,
} from "@/types/traffic-flow";

type Raw = Record<string, unknown>;

const STATES: readonly TrafficFlowState[] = [
  "disabled",
  "not_allowlisted",
  "collector_unreachable",
  "no_windows",
  "stale",
  "ok",
];
const MATCHES: readonly TalkerMatch[] = ["session", "ambiguous", "none"];

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

export function toTrafficFlowState(v: unknown): TrafficFlowState {
  return STATES.includes(v as TrafficFlowState) ? (v as TrafficFlowState) : "no_windows";
}

export function toTalker(r: Raw): TrafficFlowTalker {
  return {
    ip: String(r.ip ?? ""),
    bytesUp: num(r.bytes_up),
    bytesDown: num(r.bytes_down),
    flows: num(r.flows),
    match: MATCHES.includes(r.match as TalkerMatch) ? (r.match as TalkerMatch) : "none",
    guestSessionId: str(r.guest_session_id),
  };
}

export function toDestination(r: Raw): TrafficFlowDestination {
  return { ip: String(r.ip ?? ""), bytes: num(r.bytes), flows: num(r.flows) };
}

export function toTrafficFlowRouter(r: Raw): TrafficFlowRouter {
  return {
    routerId: String(r.router_id ?? ""),
    routerName: str(r.router_name),
    vendor: str(r.vendor),
    locationName: str(r.location_name),
    organizationName: str(r.organization_name),
    allowlisted: r.allowlisted === true,
    state: toTrafficFlowState(r.state),
    windows: num(r.windows),
    newestWindowStart: str(r.newest_window_start),
    source: String(r.source ?? ""),
    approximate: r.approximate !== false,
    bytesTotal: num(r.bytes_total),
    flowsTotal: num(r.flows_total),
    bytesInternal: num(r.bytes_internal),
    bytesUnclassified: num(r.bytes_unclassified),
    talkers: arr(r.talkers).map(toTalker),
    destinations: arr(r.destinations).map(toDestination),
  };
}

export function toTrafficFlowOverview(r: Raw): TrafficFlowOverview {
  return {
    enabled: r.enabled === true,
    agentConfigured: r.agent_configured === true,
    periodMinutes: num(r.period_minutes),
    generatedAt: String(r.generated_at ?? ""),
    windowSeconds: num(r.window_seconds),
    lastPullAt: str(r.last_pull_at),
    lastPullOk: typeof r.last_pull_ok === "boolean" ? r.last_pull_ok : null,
    lastError: str(r.last_error),
    lastWindowStart: str(r.last_window_start),
    unknownExporters: Array.isArray(r.unknown_exporters)
      ? (r.unknown_exporters as unknown[]).map(String)
      : [],
    routers: arr(r.routers).map(toTrafficFlowRouter),
  };
}

export function toConfigPreview(r: Raw): TrafficFlowConfigPreview {
  return {
    routerId: String(r.router_id ?? ""),
    eligible: r.eligible === true,
    blockers: Array.isArray(r.blockers) ? (r.blockers as unknown[]).map(String) : [],
    collectorAddress: str(r.collector_address),
    collectorPort: typeof r.collector_port === "number" ? r.collector_port : null,
    sourceAddress: str(r.source_address),
    routerosVersion: str(r.routeros_version),
    lines: Array.isArray(r.lines) ? (r.lines as unknown[]).map(String) : [],
  };
}

export function toApplyResult(r: Raw): TrafficFlowApplyResult {
  const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : undefined);
  return {
    routerId: String(r.router_id ?? ""),
    dryRun: r.dry_run === true,
    enabled: r.enabled === true,
    plannedWrites: list(r.planned_writes),
    differences: list(r.differences),
    writes: list(r.writes),
    matches: typeof r.matches === "boolean" ? r.matches : undefined,
    mismatches: list(r.mismatches),
  };
}

/** 1536 -> "1.5 KB". Binary units, one decimal. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
