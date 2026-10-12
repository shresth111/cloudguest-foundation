/**
 * Traffic Lens "Destinations": presentation rules for the search, the
 * download and the service drill-down. Pure functions, no React, so
 * scripts/test-traffic-flow-destinations.mjs can run them.
 *
 * The rules, worst mistake first:
 *
 *   1. VENUE-LEVEL ONLY. A record is "this venue, this outside address and
 *      service, this 5-minute window". Nothing here names, shows or accepts
 *      a device, a MAC, a guest or a session, and no filter asks for one.
 *   2. UNMEASURED IS NEVER ZERO. No window in the range, windows without
 *      protocol and port, windows withheld for too few devices, and a
 *      search that matched nothing are four different sentences.
 *   3. WHAT IS MISSING IS SAID. A capped page says how many matched; traffic
 *      outside each window's stored top is "unlisted", and when the filters
 *      make that amount unknowable the screen says unknown, not nothing.
 *   4. A SERVICE IS A PORT. Protocol, port and the port's IANA label; never
 *      an application name.
 */
import { formatCount } from "@/lib/analytics-format";
import {
  atLeast,
  clockLabel,
  flowBytes,
  serviceLabel,
  shareBarWidth,
  shareLabel,
} from "@/lib/traffic-flow";
import type { FlowCustomRange } from "@/types/traffic-flow";
import type {
  DestinationExport,
  DestinationFilterForm,
  DestinationRangeFields,
  DestinationRecord,
  DestinationSearchResult,
  DestinationSort,
  DestinationSortKey,
  ServiceDestinationsResult,
} from "@/types/traffic-flow-destinations";

/** The backend keeps 7 days and refuses a longer or older range. */
export const FLOW_RETENTION_DAYS = 7;
const DAY_MS = 86_400_000;
/** The backend allows a start this much before the retention edge. */
const RETENTION_SLACK_MS = 15 * 60_000;
/** Records in one CSV download (the backend's cap). */
export const DESTINATION_CSV_MAX_ROWS = 50_000;

export const AUDIT_NOTE =
  "Each search, download and service drill-down is recorded in the audit log.";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// ---------------------------------------------------------------------------
// Custom date-time range
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

/** An instant as a `<input type="datetime-local">` value: the browser's
 * local wall clock, minute precision. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "12 Oct 13:07". */
function dateTimeLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** "12 Oct 13:07 to 12 Oct 13:52". */
export function rangeLabel(range: FlowCustomRange | { since: string; until: string }): string {
  const a = Date.parse(range.since);
  const b = Date.parse(range.until);
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  return `${dateTimeLabel(a)} to ${dateTimeLabel(b)}`;
}

export type CustomRangeResult =
  | { ok: true; range: FlowCustomRange }
  | { ok: false; message: string };

/**
 * Turns the two date-time inputs into the range the API will accept, or
 * says why not. The same three refusals the backend makes, made here first
 * so the operator is not sent a request that can only fail. A zone-less
 * input value is the browser's local time; `new Date` parses it that way.
 */
export function customRangeFromInputs(
  sinceLocal: string,
  untilLocal: string,
  now: number,
): CustomRangeResult {
  if (!sinceLocal || !untilLocal) return { ok: false, message: "Pick a start and an end." };
  const since = new Date(sinceLocal).getTime();
  const until = new Date(untilLocal).getTime();
  if (Number.isNaN(since) || Number.isNaN(until))
    return { ok: false, message: "That is not a date and time." };
  if (since >= until) return { ok: false, message: "The start must be before the end." };
  if (until - since > FLOW_RETENTION_DAYS * DAY_MS)
    return {
      ok: false,
      message: `A range may not be longer than ${FLOW_RETENTION_DAYS} days.`,
    };
  const earliest = now - FLOW_RETENTION_DAYS * DAY_MS;
  if (since < earliest - RETENTION_SLACK_MS)
    return {
      ok: false,
      message: `Traffic data is kept for ${FLOW_RETENTION_DAYS} days. The start may not be earlier than ${dateTimeLabel(earliest)}.`,
    };
  return {
    ok: true,
    range: { since: new Date(since).toISOString(), until: new Date(until).toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Search form -> request params
// ---------------------------------------------------------------------------

export const EMPTY_DESTINATION_FILTERS: DestinationFilterForm = {
  address: "",
  protocol: "",
  port: "",
  direction: "any",
};

export const DEFAULT_DESTINATION_SORT: DestinationSort = { key: "time", order: "desc" };

/** Protocols offered by name. Any other number can still be typed through
 * the API; these are the ones a venue's traffic is made of. */
export const DESTINATION_PROTOCOL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any protocol" },
  { value: "6", label: "TCP" },
  { value: "17", label: "UDP" },
  { value: "1", label: "ICMP" },
  { value: "58", label: "ICMPv6" },
];

export const DESTINATION_DIRECTION_OPTIONS: {
  value: DestinationFilterForm["direction"];
  label: string;
}[] = [
  { value: "any", label: "Any" },
  { value: "down", label: "Download" },
  { value: "up", label: "Upload" },
];

export type DestinationParamsResult =
  | { ok: true; params: Record<string, string> }
  | { ok: false; field: keyof DestinationFilterForm | "venue"; message: string };

const ADDRESS_SHAPE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

/**
 * The request for a search or a download. Refuses what the API would refuse
 * (it is the authority; this only saves a round trip and an audit row for a
 * request that could not succeed). An empty field is "no filter", never a
 * zero: an empty port is not port 0.
 */
export function destinationSearchParams(
  scope: { locationId: string; routerId: string },
  range: { since: string; until: string },
  form: DestinationFilterForm,
  sort: DestinationSort,
): DestinationParamsResult {
  if (!scope.locationId) return { ok: false, field: "venue", message: "Pick a venue first." };
  const params: Record<string, string> = {
    location_id: scope.locationId,
    since: range.since,
    until: range.until,
    sort: sort.key,
    order: sort.order,
  };
  if (scope.routerId) params.router_id = scope.routerId;

  const address = form.address.trim();
  if (address) {
    if (!ADDRESS_SHAPE.test(address) || !/[.:]/.test(address))
      return {
        ok: false,
        field: "address",
        message: "Enter an outside address or a prefix, such as 203.0.113.7 or 203.0.113.0/24.",
      };
    params.address = address;
  }
  const protocol = form.protocol.trim();
  if (protocol) {
    const n = Number(protocol);
    if (!Number.isInteger(n) || n < 0 || n > 255)
      return { ok: false, field: "protocol", message: "Protocol must be a number from 0 to 255." };
    params.protocol = String(n);
  }
  const port = form.port.trim();
  if (port) {
    const n = Number(port);
    if (!Number.isInteger(n) || n < 0 || n > 65535)
      return { ok: false, field: "port", message: "Port must be a number from 0 to 65535." };
    params.port = String(n);
  }
  if (form.direction !== "any") params.direction = form.direction;
  return { ok: true, params };
}

/** Clicking a column: the same column flips its order; a new column starts
 * with the order that puts the interesting end first. */
export function nextSort(current: DestinationSort, key: DestinationSortKey): DestinationSort {
  if (current.key === key) return { key, order: current.order === "desc" ? "asc" : "desc" };
  const ascendingFirst = key === "address" || key === "protocol" || key === "port";
  return { key, order: ascendingFirst ? "asc" : "desc" };
}

/** `aria-sort` for a column header. */
export function ariaSort(
  current: DestinationSort,
  key: DestinationSortKey,
): "ascending" | "descending" | "none" {
  if (current.key !== key) return "none";
  return current.order === "asc" ? "ascending" : "descending";
}

// ---------------------------------------------------------------------------
// Search result
// ---------------------------------------------------------------------------

/** "Showing 1,000 of 1,834 records · 38 ms". The time is the database's,
 * as the server measured it. */
export function resultLine(r: DestinationSearchResult): string {
  const ms = isNum(r.query_ms) ? ` · ${formatCount(r.query_ms)} ms` : "";
  const total = isNum(r.total) ? r.total : 0;
  const shown = isNum(r.returned) ? r.returned : r.rows.length;
  if (total === 0) return `No records${ms}`;
  if (shown < total) return `Showing ${formatCount(shown)} of ${formatCount(total)} records${ms}`;
  return `${formatCount(total)} ${plural(total, "record", "records")}${ms}`;
}

export type RangeState =
  /** The platform switch is off; the table was not read. */
  | { kind: "feature_off" }
  /** No window in the range at all. */
  | { kind: "not_measured"; dataStarts: string | null }
  /** Windows exist, but every one is withheld (too few devices). */
  | { kind: "withheld"; minDevices: number }
  /** Windows exist, but none carried protocol and port. */
  | { kind: "no_detail" }
  /** There is something to read. */
  | { kind: "measured" };

/** Which empty state, if any, a D-1 or D-3 response is in. Order matters:
 * each state is a more specific reason than the one after it. */
export function rangeState(r: DestinationRangeFields, now: number): RangeState {
  if (r.feature_enabled === false) return { kind: "feature_off" };
  if (r.measured !== true || !isNum(r.windows) || r.windows === 0)
    return { kind: "not_measured", dataStarts: clockLabel(r.data_oldest, now) };
  if (isNum(r.min_devices) && r.min_devices > 0 && r.windows_withheld >= r.windows)
    return { kind: "withheld", minDevices: r.min_devices };
  if (!isNum(r.windows_measured) || r.windows_measured === 0) return { kind: "no_detail" };
  return { kind: "measured" };
}

export interface StateMessage {
  title: string;
  body: string;
}

/** The sentence for a state that has nothing to list. null for `measured`. */
export function rangeStateMessage(state: RangeState): StateMessage | null {
  switch (state.kind) {
    case "feature_off":
      return {
        title: "Switched off for the platform.",
        body: "Nothing was read. This is not an empty result.",
      };
    case "not_measured":
      return {
        title: "Not measured for this period.",
        body: state.dataStarts
          ? `There is no measurement for this range. Data starts ${state.dataStarts}.`
          : "No measurement is held for this venue at all. That is not the same as no traffic.",
      };
    case "withheld":
      return {
        title: `Not shown while fewer than ${state.minDevices} devices are connected.`,
        body: "With only a few devices online, the venue's destinations would in effect be one person's. Traffic was measured; its destinations are withheld.",
      };
    case "no_detail":
      return {
        title: "Destinations were not measured in this period.",
        body: "Traffic records arrived, but none carried a protocol and port, so there are no destination records. That is not the same as no destinations.",
      };
    default:
      return null;
  }
}

/** Lines under a result that say what it does NOT cover. Empty when the
 * result is the whole picture. */
export function coverageNotes(r: DestinationRangeFields): string[] {
  const notes: string[] = [];
  const windows = isNum(r.windows) ? r.windows : 0;
  if (isNum(r.min_devices) && r.min_devices > 0 && r.windows_withheld > 0)
    notes.push(
      `${formatCount(r.windows_withheld)} of ${formatCount(windows)} five-minute windows are not shown, because fewer than ${r.min_devices} devices were connected in them.`,
    );
  if (isNum(r.windows_measured) && r.windows_measured < windows)
    notes.push(
      `Destination records cover ${formatCount(r.windows_measured)} of ${formatCount(windows)} five-minute windows; the others carried no protocol or port and are not measured here.`,
    );
  return notes;
}

/** What a search result leaves out, in words. */
export function searchNotes(r: DestinationSearchResult): string[] {
  const notes: string[] = [];
  const top = isNum(r.per_window_top_n) ? r.per_window_top_n : 50;
  if (r.truncated)
    notes.push(
      `Only the first ${formatCount(r.returned)} are shown, in this order. Narrow the filters or the range, or download.`,
    );
  if (r.unlisted === null)
    notes.push(
      `Each window keeps its top ${top} destinations. Traffic to the rest has no record, and how much of it would match these filters is not known.`,
    );
  else if (isNum(r.unlisted.bytes) && r.unlisted.bytes > 0)
    notes.push(
      `Plus ${flowBytes(r.unlisted.bytes)} to addresses outside each window's top ${top}, which have no record of their own.`,
    );
  return [...notes, ...coverageNotes(r)];
}

/** "Download 420 MB · Upload 31 MB in the matching records". */
export function totalsLine(r: DestinationSearchResult): string | null {
  if (!r.totals) return null;
  return `Download ${flowBytes(r.totals.bytes_down)} · Upload ${flowBytes(r.totals.bytes_up)} across all matching records`;
}

export interface RecordView {
  key: string;
  /** "14:05 to 14:10" (date added when it is not today). */
  window: string;
  address: string;
  service: string;
  down: string;
  up: string;
  total: string;
  flows: string;
}

export function recordView(row: DestinationRecord, now: number): RecordView {
  const start = clockLabel(row.window_start, now) ?? "—";
  const end = row.window_end
    ? new Date(row.window_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";
  return {
    key: `${row.window_start}|${row.address}|${row.protocol}|${row.port}`,
    window: `${start} to ${end}`,
    address: row.address,
    service: serviceLabel(row),
    down: flowBytes(row.bytes_down),
    up: flowBytes(row.bytes_up),
    total: flowBytes(row.bytes),
    flows: isNum(row.flows) ? formatCount(row.flows) : "—",
  };
}

/** What to say after a download. A file that was cut must be said; a file
 * whose completeness could not be read is not called complete. */
export function exportMessage(e: Pick<DestinationExport, "total" | "rows" | "truncated">): {
  tone: "success" | "warning";
  text: string;
} {
  const cap = formatCount(DESTINATION_CSV_MAX_ROWS);
  if (e.truncated === true)
    return {
      tone: "warning",
      text:
        isNum(e.rows) && isNum(e.total)
          ? `The file holds the first ${formatCount(e.rows)} of ${formatCount(e.total)} records. Narrow the filters or the range for the rest.`
          : `The file was cut at ${cap} records. Narrow the filters or the range for the rest.`,
    };
  if (e.truncated === false && isNum(e.rows))
    return {
      tone: "success",
      text: `Downloaded ${formatCount(e.rows)} ${plural(e.rows, "record", "records")}.`,
    };
  return {
    tone: "warning",
    text: `Downloaded. A file holds at most ${cap} records; whether this one was cut could not be read.`,
  };
}

// ---------------------------------------------------------------------------
// Drill-down: a service's destinations
// ---------------------------------------------------------------------------

export interface ServiceRef {
  protocol: number;
  port: number;
  protocol_name?: string | null;
  service_name?: string | null;
}

/** "6/443" -> { protocol: 6, port: 443 }. null for the "all other
 * services" row and anything else that is not one service. */
export function serviceFromKey(key: string): { protocol: number; port: number } | null {
  const m = /^(\d{1,3})\/(\d{1,5})$/.exec(key);
  if (!m) return null;
  const protocol = Number(m[1]);
  const port = Number(m[2]);
  return protocol <= 255 && port <= 65535 ? { protocol, port } : null;
}

export function serviceDestinationParams(
  scope: { locationId: string; routerId: string },
  range: { since: string; until: string },
  service: { protocol: number; port: number },
): Record<string, string> | null {
  if (!scope.locationId) return null;
  const params: Record<string, string> = {
    location_id: scope.locationId,
    since: range.since,
    until: range.until,
    protocol: String(service.protocol),
    port: String(service.port),
    limit: "10",
  };
  if (scope.routerId) params.router_id = scope.routerId;
  return params;
}

export interface ServiceDestinationRow {
  address: string;
  down: string;
  up: string;
  share: string;
  barWidth: number;
}

export type ServiceDestinationsView =
  | { kind: "state"; message: StateMessage }
  | { kind: "empty"; title: string; notes: string[] }
  | {
      kind: "rows";
      /** "https (TCP/443)" */
      title: string;
      /** "430 MB in this period" / "at least 430 MB ..." */
      total: string;
      rows: ServiceDestinationRow[];
      notes: string[];
    };

export function serviceDestinationsView(
  r: ServiceDestinationsResult,
  now: number,
): ServiceDestinationsView {
  const message = rangeStateMessage(rangeState(r, now));
  if (message) return { kind: "state", message };
  const service = r.service;
  if (!service)
    return {
      kind: "state",
      message: {
        title: "Not measured for this period.",
        body: "The server sent no figure for this service.",
      },
    };
  const title = serviceLabel(service);
  const notes = coverageNotes(r);
  if (r.items.length === 0)
    return {
      kind: "empty",
      title:
        service.bytes > 0
          ? `No destination of ${title} was among any window's top ${r.per_window_top_n} in this period.`
          : `No ${title} traffic recorded in this period.`,
      notes,
    };
  const lowerBound = r.lower_bound !== false;
  const exact = service.exact === true;
  const top = isNum(r.per_window_top_n) ? r.per_window_top_n : 50;
  const more = r.destinations_listed - r.items.length;
  if (more > 0)
    notes.unshift(
      `${formatCount(more)} more ${plural(more, "address", "addresses")} of this service ${plural(more, "is", "are")} not listed here; use the Destinations tab to see every record.`,
    );
  if (isNum(r.unlisted_bytes) && r.unlisted_bytes > 0)
    notes.unshift(
      `${atLeast(flowBytes(r.unlisted_bytes), !exact)} (${shareLabel(r.unlisted_share)}) of this service went to addresses outside a window's top ${top}, which have no record of their own.`,
    );
  if (lowerBound)
    notes.push(
      `Each figure is "at least": a five-minute window keeps its top ${top} destinations, so an address below that in some window lost that window's bytes.`,
    );
  if (!exact)
    notes.push(
      "This service was itself outside the stored top services in part of the period, so its total is a lower bound and each share is a share of the measured part.",
    );
  return {
    kind: "rows",
    title,
    total: `${atLeast(flowBytes(service.bytes), !exact)} in this period`,
    rows: r.items.map((it) => ({
      address: it.address,
      down: atLeast(flowBytes(it.bytes_down), lowerBound),
      up: atLeast(flowBytes(it.bytes_up), lowerBound),
      share: atLeast(shareLabel(it.share), lowerBound),
      barWidth: shareBarWidth(it.share),
    })),
    notes,
  };
}
