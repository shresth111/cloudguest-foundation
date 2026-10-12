/**
 * Traffic Lens wording and arithmetic, in one pure module so a script can
 * test it (scripts/test-traffic-flow.mjs).
 *
 * The rule this file exists to keep: an unmeasured value is never shown as
 * zero. A range with no window is "Not measured", not "0 B"; a router that
 * was set up but has never sent is a dash, not "0 of 12"; a timeline step
 * the backend did not send is a gap, not a point at zero; a figure the API
 * calls a lower bound is worded "at least". A real, measured zero still
 * reads as zero.
 *
 * Second rule: a service is a protocol, a port and the port's IANA label.
 * Nothing here ever names an application.
 */
import { formatAgo, verdictLabel, type StatePresentation } from "@/lib/device-logs-presentation";
import { formatBytes, formatCount } from "@/lib/analytics-format";
import type {
  FleetFilters,
  FlowBlockerCode,
  FlowDeviceMatch,
  FlowExportState,
  FlowServiceRef,
  FlowSummary,
  FlowWriteResult,
  RouterFlowConfig,
  RouterFlowStatus,
  TrafficFlowStatus,
} from "@/types/traffic-flow";

export { formatAgo, verdictLabel };
export type { StatePresentation };

/** The module's visible name: the Master nav item, the page title and every
 * banner read this one constant (wyfy-specs/flow-visibility/PRODUCT.md §1).
 * The route path, permission keys and code identifiers keep "traffic flow",
 * which is also MikroTik's name for the router feature. */
export const TRAFFIC_FLOW_MODULE_NAME = "Traffic Lens";

export const NOT_MEASURED = "Not measured";
const DASH = "—";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

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

/** Clock time for today, date and time otherwise. `now` injected for tests. */
export function clockLabel(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (new Date(now).toDateString() === d.toDateString()) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

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

// ---------------------------------------------------------------------------
// Bytes, rates, shares
// ---------------------------------------------------------------------------

/** Bytes for a value the API measured. Anything that is not a real,
 * non-negative number is a dash rather than a guess. */
export function flowBytes(bytes: number | null | undefined): string {
  return isNum(bytes) ? formatBytes(bytes) : DASH;
}

/** A rate in bits per second, as the API sends it. */
export function flowRate(bitsPerSecond: number | null | undefined): string {
  if (!isNum(bitsPerSecond)) return DASH;
  if (bitsPerSecond < 1000) return `${Math.round(bitsPerSecond)} b/s`;
  const units = ["kb/s", "Mb/s", "Gb/s"];
  let value = bitsPerSecond / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

/** API.md's formula: bytes * 8 / covered_seconds. null when nothing was
 * covered, so a step without data can never produce a rate of 0. */
export function rateFromBytes(
  bytes: number | null | undefined,
  coveredSeconds: number | null | undefined,
): number | null {
  if (!isNum(bytes) || !isNum(coveredSeconds) || coveredSeconds === 0) return null;
  return Math.round((bytes * 8) / coveredSeconds);
}

/** A 0..1 share as a percentage. A value outside 0..1 is not rescaled; it
 * is a dash, so a unit mismatch shows as missing, not as a wrong number. */
export function shareLabel(share: number | null | undefined): string {
  if (!isNum(share) || share > 1) return DASH;
  if (share === 0) return "0%";
  const pct = share * 100;
  if (pct < 0.1) return "<0.1%";
  return `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
}

/** Width of a share bar in percent; 0 when the share is unreadable. */
export function shareBarWidth(share: number | null | undefined): number {
  if (!isNum(share) || share > 1) return 0;
  return Math.round(share * 1000) / 10;
}

/** A figure the API marks as a lower bound reads "at least ...". */
export function atLeast(text: string, lowerBound: boolean): string {
  return lowerBound && text !== DASH ? `at least ${text}` : text;
}

// ---------------------------------------------------------------------------
// Services (protocol + port + IANA label). Never an application.
// ---------------------------------------------------------------------------

const PROTOCOL_BY_NUMBER: Record<number, string> = { 1: "ICMP", 6: "TCP", 17: "UDP", 58: "ICMPv6" };

/** "TCP" / "UDP" / "Protocol 47" / "Other". */
export function protocolLabel(
  protocol: number | null | undefined,
  name?: string | null,
): string {
  const n = (name ?? "").trim();
  if (n && n.toLowerCase() === "other") return "Other";
  if (n) return n.toUpperCase();
  if (typeof protocol === "number" && Number.isFinite(protocol))
    return PROTOCOL_BY_NUMBER[protocol] ?? `Protocol ${protocol}`;
  return "Other";
}

/** "TCP/443"; a protocol without a port stays just the protocol. */
export function servicePortLabel(s: FlowServiceRef): string {
  const proto = protocolLabel(s.protocol, s.protocol_name);
  return isNum(s.port) ? `${proto}/${s.port}` : proto;
}

/** "https (TCP/443)", or the bare "UDP/19305" when the port has no IANA
 * name. The name is a port label: no product or app name is ever added. */
export function serviceLabel(s: FlowServiceRef): string {
  const port = servicePortLabel(s);
  const name = (s.service_name ?? "").trim();
  return name ? `${name} (${port})` : port;
}

/** The key the timeline uses for a service: "<protocol>/<port>". */
export function serviceKey(s: FlowServiceRef): string {
  return `${s.protocol ?? "x"}/${s.port ?? "x"}`;
}

/** Band colours for the timeline, in fixed order: the Master theme's own
 * chart tokens, arranged so neighbouring bands differ most in lightness
 * (the tokens are one hue). A service keeps the colour of its position in
 * `timeline.series`; anything past the last token is "Other", never a
 * generated colour. */
export const FLOW_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
] as const;
export const FLOW_OTHER_COLOR = "var(--muted-foreground)";
export const FLOW_OTHER_KEY = "__other";

/** Colour of a service row, by its place in the timeline's series; null
 * when the service has no band of its own (it is inside "Other"). */
export function seriesColor(summary: FlowSummary | null | undefined, key: string): string | null {
  const i = (summary?.timeline?.series ?? []).findIndex((s) => s.key === key);
  return i >= 0 && i < FLOW_SERIES_COLORS.length ? FLOW_SERIES_COLORS[i] : null;
}

export interface ServiceRow {
  key: string;
  label: string;
  share: string;
  barWidth: number;
  rate: string;
  down: string;
  up: string;
  flows: string;
}

export type ServicesView =
  | { kind: "not_measured" }
  | { kind: "empty" }
  | { kind: "rows"; rows: ServiceRow[]; other: ServiceRow | null };

/** The Services table. `services_measured: false` means the collector rows
 * carried no protocol/port: that is "not measured", not an empty list. */
export function servicesView(summary: FlowSummary | null | undefined): ServicesView {
  if (!summary || summary.measured !== true || summary.services_measured !== true)
    return { kind: "not_measured" };
  const sv = summary.services;
  const items = sv?.items ?? [];
  const covered = summary.totals?.covered_seconds;
  const rows = items.map((it) => ({
    key: serviceKey(it),
    label: serviceLabel(it),
    share: shareLabel(it.share),
    barWidth: shareBarWidth(it.share),
    rate: flowRate(isNum(it.avg_bps) ? it.avg_bps : rateFromBytes(it.bytes, covered)),
    down: flowBytes(it.bytes_down),
    up: flowBytes(it.bytes_up),
    flows: isNum(it.flows) ? formatCount(it.flows) : DASH,
  }));
  const otherBytes = sv?.other_bytes;
  const other: ServiceRow | null =
    isNum(otherBytes) && otherBytes > 0
      ? {
          key: FLOW_OTHER_KEY,
          label: "All other services",
          share: shareLabel(sv?.other_share),
          barWidth: shareBarWidth(sv?.other_share),
          rate: flowRate(rateFromBytes(otherBytes, covered)),
          down: DASH,
          up: DASH,
          flows: DASH,
        }
      : null;
  if (rows.length === 0 && !other) return { kind: "empty" };
  return { kind: "rows", rows, other };
}

export interface ProtocolRow {
  label: string;
  bytes: string;
  share: string;
  barWidth: number;
}

/** The protocol breakdown, or null when it was not measured. Sent rows are
 * shown as sent, including a real zero. */
export function protocolRows(summary: FlowSummary | null | undefined): ProtocolRow[] | null {
  if (!summary || summary.measured !== true || summary.services_measured !== true) return null;
  return (summary.protocols ?? []).map((p) => ({
    label: protocolLabel(p.protocol, p.protocol_name),
    bytes: flowBytes(p.bytes),
    share: shareLabel(p.share),
    barWidth: shareBarWidth(p.share),
  }));
}

// ---------------------------------------------------------------------------
// Totals, freshness, "not measured" (M2)
// ---------------------------------------------------------------------------

export interface TotalsView {
  measured: boolean;
  download: string;
  upload: string;
  downloadRate: string;
  uploadRate: string;
  devicesPeak: string;
  destinationsPeak: string;
  /** Own lines, never folded into a list. null = nothing to say. */
  internal: string | null;
  unclassified: string | null;
}

/** The measured-versus-zero decision for the totals row. `measured: false`
 * (or totals missing) renders every tile as "Not measured" whatever numbers
 * happen to be in the payload; `measured: true` renders them as sent, so a
 * measured zero is "0 B". */
export function totalsView(summary: FlowSummary | null | undefined): TotalsView {
  const t = summary?.totals;
  if (!summary || summary.measured !== true || !t) {
    return {
      measured: false,
      download: NOT_MEASURED,
      upload: NOT_MEASURED,
      downloadRate: NOT_MEASURED,
      uploadRate: NOT_MEASURED,
      devicesPeak: NOT_MEASURED,
      destinationsPeak: NOT_MEASURED,
      internal: null,
      unclassified: null,
    };
  }
  return {
    measured: true,
    download: flowBytes(t.bytes_down),
    upload: flowBytes(t.bytes_up),
    downloadRate: flowRate(t.avg_bps_down),
    uploadRate: flowRate(t.avg_bps_up),
    // A peak in one window, not a distinct count over the range.
    devicesPeak: isNum(t.devices_peak) ? `Up to ${formatCount(t.devices_peak)} at once` : DASH,
    destinationsPeak: isNum(t.destinations_peak)
      ? `Up to ${formatCount(t.destinations_peak)} at once`
      : DASH,
    internal: isNum(t.bytes_internal) ? formatBytes(t.bytes_internal) : null,
    unclassified:
      isNum(t.bytes_unclassified) && t.bytes_unclassified > 0
        ? formatBytes(t.bytes_unclassified)
        : null,
  };
}

/** "Latest data: 14:10 (4 min ago)". The newest window's END, i.e. its
 * start plus the window length. Never the word "live". */
export function freshnessLine(summary: FlowSummary | null | undefined, now: number): string {
  const start = summary?.data_newest ? Date.parse(summary.data_newest) : NaN;
  if (Number.isNaN(start)) return "Latest data: none held for this scope.";
  const w = summary && isNum(summary.window_seconds) ? summary.window_seconds : 0;
  const end = new Date(start + w * 1000).toISOString();
  return `Latest data: ${clockLabel(end, now)} (${formatAgo(end, now)})`;
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

/** "5-minute steps" -- printed under the chart. */
export function stepLabel(stepSeconds: number | null | undefined): string {
  if (!isNum(stepSeconds) || stepSeconds === 0) return "Step not reported";
  if (stepSeconds % 3600 === 0) {
    const h = stepSeconds / 3600;
    return h === 1 ? "1-hour steps" : `${h}-hour steps`;
  }
  if (stepSeconds % 60 === 0) return `${stepSeconds / 60}-minute steps`;
  return `${stepSeconds}-second steps`;
}

// ---------------------------------------------------------------------------
// Timeline: gaps stay gaps
// ---------------------------------------------------------------------------

export interface TimelineSlot {
  /** Step start, epoch ms. */
  t: number;
  /** false = the backend sent no step here. A gap, not a zero. */
  measured: boolean;
  /** Bits per second; null in a gap. */
  up: number | null;
  down: number | null;
  /** false = this step's rows carried no protocol/port. */
  servicesMeasured: boolean;
  /** Bits per second per series key plus FLOW_OTHER_KEY; null when the
   * step is a gap or its services were not measured. */
  services: Record<string, number> | null;
}

/** More slots than this and the grid is not laid out. */
const MAX_TIMELINE_SLOTS = 2000;

/** Lays the timeline on a fixed grid of `step_seconds` across the range, so
 * a step the backend left out is an explicit unmeasured slot (drawn as a
 * gap) instead of being closed up or drawn at zero. Per-service bytes
 * become rates with the step's own `covered_seconds`, as API.md specifies.
 *
 * If the step size is unusable the sent steps are returned in time order
 * and nothing is invented. */
export function timelineSlots(summary: FlowSummary | null | undefined): TimelineSlot[] {
  if (!summary || summary.measured !== true || !summary.timeline) return [];
  const keys = summary.timeline.series.slice(0, FLOW_SERIES_COLORS.length).map((s) => s.key);
  const sent: TimelineSlot[] = [];
  for (const s of summary.timeline.steps ?? []) {
    const t = Date.parse(s.start);
    if (Number.isNaN(t)) continue;
    const up = isNum(s.bps_up) ? s.bps_up : rateFromBytes(s.bytes_up, s.covered_seconds);
    const down = isNum(s.bps_down) ? s.bps_down : rateFromBytes(s.bytes_down, s.covered_seconds);
    let services: Record<string, number> | null = null;
    if (s.services_measured === true && isNum(s.covered_seconds) && s.covered_seconds > 0) {
      services = {};
      let listed = 0;
      for (const k of keys) {
        const b = isNum(s.services?.[k]) ? s.services[k] : 0;
        listed += b;
        services[k] = rateFromBytes(b, s.covered_seconds) ?? 0;
      }
      // "Other" is the rest of the step's client traffic, so the bands add
      // up to up + down even when fewer series are drawn than were sent.
      const total = (isNum(s.bytes_up) ? s.bytes_up : 0) + (isNum(s.bytes_down) ? s.bytes_down : 0);
      services[FLOW_OTHER_KEY] = rateFromBytes(Math.max(0, total - listed), s.covered_seconds) ?? 0;
    }
    sent.push({ t, measured: true, up, down, servicesMeasured: services !== null, services });
  }
  sent.sort((a, b) => a.t - b.t);

  const step = summary.step_seconds * 1000;
  const since = Date.parse(summary.since);
  const until = Date.parse(summary.until);
  if (!isNum(step) || step === 0 || Number.isNaN(since) || !(until > since)) return sent;
  // Anchor the grid on a sent step when there is one, so slots line up with
  // the backend's own step boundaries rather than with the request time.
  const anchor = sent.length > 0 ? sent[0].t : since;
  const first = anchor - Math.ceil((anchor - since) / step) * step;
  const count = Math.ceil((until - first) / step);
  if (count <= 0 || count > MAX_TIMELINE_SLOTS) return sent;
  const byStart = new Map(sent.map((s) => [Math.round((s.t - first) / step), s]));
  const slots: TimelineSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    slots.push(
      byStart.get(i) ?? {
        t: first + i * step,
        measured: false,
        up: null,
        down: null,
        servicesMeasured: false,
        services: null,
      },
    );
  }
  return slots;
}

/** "3 of 12 steps have no data" -- said under the chart so a gap is read
 * as a gap. null when every step was measured. */
export function timelineGapNote(slots: TimelineSlot[]): string | null {
  const gaps = slots.filter((s) => !s.measured).length;
  if (gaps === 0) return null;
  return `${gaps} of ${slots.length} steps have no data and are left blank. Blank means not measured, not zero.`;
}

/** Axis/tooltip time label: clock time inside a day, date + time beyond. */
export function timelineTickLabel(t: number, rangeMs: number): string {
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (rangeMs <= 24 * 60 * 60 * 1000) return time;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

// ---------------------------------------------------------------------------
// Devices and destinations: two separate lists, both lower bounds
// ---------------------------------------------------------------------------

/** Whether the API marks this list's figures as lower bounds. */
export function isLowerBound(
  summary: FlowSummary | null | undefined,
  list: "devices" | "destinations",
): boolean {
  const a = summary?.list_accuracy;
  return !!a && a.lower_bound === true && (a.applies_to ?? []).includes(list);
}

/** The footnote under a lower-bound list. Driven by the API's own field. */
export function lowerBoundNote(
  summary: FlowSummary | null | undefined,
  list: "devices" | "destinations",
): string | null {
  if (!isLowerBound(summary, list)) return null;
  const n = summary?.list_accuracy?.per_window_top_n;
  const what = list === "devices" ? "devices" : "outside addresses";
  return `Lower bounds. Each window keeps only its top ${isNum(n) ? n : "few"} ${what}, so an address just outside that in some window lost that window's traffic. Every figure here is "at least"; the true ranking may differ.`;
}

/** The "everything else" line of a bounded list. */
export function otherAtMostLabel(bytes: number | null | undefined, lowerBound: boolean): string | null {
  if (!isNum(bytes)) return null;
  return lowerBound ? `at most ${formatBytes(bytes)}` : formatBytes(bytes);
}

export function deviceMatchLabel(match: FlowDeviceMatch | string | null | undefined): string {
  if (match === "session") return "Guest login";
  if (match === "ambiguous") return "Ambiguous (address reused)";
  if (match === "none") return "Not a guest login";
  return "Not known";
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
export function applyBlockers(config: RouterFlowConfig | null | undefined, canApply: boolean): string[] {
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
