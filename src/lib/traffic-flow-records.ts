/**
 * Master "Traffic Lens" -> Flows: presentation rules for the flow table
 * (wyfy-specs/flow-visibility/API.md, F-1 and F-2). Pure functions, no
 * React, so scripts/test-traffic-flow-records.mjs can run them.
 *
 * MASTER CONSOLE ONLY. A row here places a device's address beside the
 * address it reached; there is no customer route, and the customer
 * dashboard's own table keeps those columns as placeholders. Nothing under
 * the customer dashboard may import this file (the test suite checks).
 *
 * The rules, worst mistake first:
 *
 *   1. NULL IS "NOT RECORDED". Never zero, never an empty cell, never a
 *      dash that reads as "none". A field that is null in every returned
 *      row greys its whole column, with the reason in the heading.
 *   2. AN INCOMPLETE RANGE IS SAID ABOVE THE TABLE, whenever the API sets
 *      `incomplete`, with since when and how many records were not stored.
 *   3. FOUR EMPTY ANSWERS ARE FOUR SENTENCES: switched off for the platform,
 *      flow records switched off, nothing held for this scope, and nothing
 *      matched the filters.
 *   4. THE LAST DATA COLUMN OF THE REFERENCE IS A PORT LABEL. `application`
 *      is the protocol and port with the port's IANA name; the column is
 *      headed "Service" and no product is ever named.
 */
import { formatCount } from "@/lib/analytics-format";
import { recordTime, type RecordsColumn, type RecordsRow } from "@/lib/records-table";
import { exportMessage } from "@/lib/traffic-flow-destinations";
import { flowBytes } from "@/lib/traffic-lens-shared";
import type {
  FlowRecord,
  FlowRecordFilterForm,
  FlowRecordSort,
  FlowRecordSortKey,
  FlowRecordsExport,
  FlowRecordsResult,
} from "@/types/traffic-flow-records";

export const FLOW_RECORDS_AUDIT_NOTE =
  "Each search and download of flow records is recorded in the audit log.";

/** What a cell says when the API sent null for it. */
export const NOT_RECORDED_CELL = "not recorded";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

// ---------------------------------------------------------------------------
// Columns: the reference flow table's, in its order
// ---------------------------------------------------------------------------

export type FlowRecordColumnId =
  | "start"
  | "end"
  | "src_address"
  | "src_port"
  | "dst_address"
  | "dst_port"
  | "protocol"
  | "nat_src"
  | "nat_dst"
  | "bytes"
  | "packets"
  | "service"
  | "exporter"
  | "direction"
  | "arrived_at"
  | "window"
  | "router";

export type FlowRecordColumn = RecordsColumn<FlowRecordColumnId, FlowRecordSortKey>;

const column = (
  id: FlowRecordColumnId,
  label: string,
  sort: FlowRecordSortKey | null,
  over: Partial<FlowRecordColumn> = {},
): FlowRecordColumn => ({
  id,
  label,
  sort,
  fixed: false,
  numeric: false,
  notRecorded: null,
  initial: true,
  ...over,
});

/** START, END, SRC ADDR, S.PORT, DST ADDR, D.PORT, PROTOCOL, S. NAT, D. NAT,
 * BYTES, PACKETS, APPLICATION, EXPORT -- then four more the API returns,
 * off until switched on in Columns. */
export const FLOW_RECORD_COLUMNS: FlowRecordColumn[] = [
  column("start", "Start", "start", { fixed: true }),
  column("end", "End", "end"),
  column("src_address", "Src addr", "src_address", { fixed: true }),
  column("src_port", "S.port", "src_port", { numeric: true }),
  column("dst_address", "Dst addr", "dst_address", { fixed: true }),
  column("dst_port", "D.port", "dst_port", { numeric: true }),
  column("protocol", "Protocol", "protocol"),
  column("nat_src", "S.NAT", null),
  column("nat_dst", "D.NAT", null),
  column("bytes", "Bytes", "bytes", { numeric: true }),
  column("packets", "Packets", "packets", { numeric: true }),
  column("service", "Service", null),
  column("exporter", "Export", null),
  column("direction", "Direction", null, { initial: false }),
  column("arrived_at", "Arrived", null, { initial: false }),
  column("window", "Window", null, { initial: false }),
  column("router", "Router", null, { initial: false }),
];

export const FLOW_RECORD_DEFAULT_COLUMNS: FlowRecordColumnId[] = FLOW_RECORD_COLUMNS.filter(
  (c) => c.initial,
).map((c) => c.id);

/** The API fields each column is drawn from. A column is "not recorded" for
 * a result when EVERY one of its fields is in `fields_not_recorded`. */
export const FLOW_COLUMN_FIELDS: Record<FlowRecordColumnId, readonly (keyof FlowRecord)[]> = {
  start: ["start"],
  end: ["end"],
  src_address: ["src_address"],
  src_port: ["src_port"],
  dst_address: ["dst_address"],
  dst_port: ["dst_port"],
  protocol: ["protocol"],
  nat_src: ["nat_src_address"],
  nat_dst: ["nat_dst_address"],
  bytes: ["bytes"],
  packets: ["packets"],
  service: ["application"],
  exporter: ["exporter"],
  direction: ["direction"],
  arrived_at: ["arrived_at"],
  window: ["window_start"],
  router: ["router_id"],
};

export const FLOW_COLUMN_NOT_RECORDED =
  "Not recorded in any row of this result. That is not the same as none.";

/** The columns for one result: any whose fields the API lists as null in
 * every returned row is greyed and loses its sort. */
export function flowRecordColumns(
  result: Pick<FlowRecordsResult, "fields_not_recorded"> | null | undefined,
): FlowRecordColumn[] {
  const absent = new Set(result?.fields_not_recorded ?? []);
  return FLOW_RECORD_COLUMNS.map((c) =>
    FLOW_COLUMN_FIELDS[c.id].every((f) => absent.has(f))
      ? { ...c, notRecorded: FLOW_COLUMN_NOT_RECORDED }
      : c,
  );
}

export function toggleFlowRecordColumn(
  visible: readonly FlowRecordColumnId[],
  id: FlowRecordColumnId,
): FlowRecordColumnId[] {
  const hit = FLOW_RECORD_COLUMNS.find((c) => c.id === id);
  if (!hit || hit.fixed) return [...visible];
  const next = new Set(visible);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return FLOW_RECORD_COLUMNS.filter((c) => c.fixed || next.has(c.id)).map((c) => c.id);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** "203.0.114.9:40001", "[2001:db8::1]:443", or the address alone when the
 * port was not recorded. null when the address was not. */
export function endpointLabel(
  address: string | null | undefined,
  port: number | null | undefined,
): string | null {
  const a = text(address);
  if (!a) return null;
  if (!isNum(port)) return a;
  return a.includes(":") ? `[${a}]:${port}` : `${a}:${port}`;
}

function protocolCell(row: FlowRecord): string | null {
  const name = text(row.protocol_name);
  if (name && name.toLowerCase() !== "other") return name.toUpperCase();
  return isNum(row.protocol) ? `Protocol ${row.protocol}` : null;
}

function directionCell(direction: string | null): string | null {
  const d = text(direction);
  if (!d) return null;
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** One flow record as a table row. Every null becomes "not recorded" and is
 * listed in `missing`, so it is drawn greyed and never reads as a value. */
export function flowRecordRow(
  row: FlowRecord,
  index: number,
  routerNames: ReadonlyMap<string, string> = new Map(),
): RecordsRow<FlowRecordColumnId> {
  const start = text(row.start);
  const end = text(row.end);
  const windowStart = text(row.window_start);
  const windowEnd = text(row.window_end);
  const routerId = text(row.router_id);
  const values: Record<FlowRecordColumnId, string | null> = {
    start: start ? recordTime(start) : null,
    end: end ? recordTime(end) : null,
    src_address: text(row.src_address),
    src_port: isNum(row.src_port) ? String(row.src_port) : null,
    dst_address: text(row.dst_address),
    dst_port: isNum(row.dst_port) ? String(row.dst_port) : null,
    protocol: protocolCell(row),
    nat_src: endpointLabel(row.nat_src_address, row.nat_src_port),
    nat_dst: endpointLabel(row.nat_dst_address, row.nat_dst_port),
    bytes: isNum(row.bytes) ? flowBytes(row.bytes) : null,
    packets: isNum(row.packets) ? formatCount(row.packets) : null,
    service: text(row.application),
    exporter: text(row.exporter),
    direction: directionCell(row.direction),
    arrived_at: text(row.arrived_at) ? recordTime(row.arrived_at) : null,
    window:
      windowStart && windowEnd
        ? `${recordTime(windowStart)} to ${recordTime(windowEnd).slice(11)}`
        : null,
    router: routerId ? (routerNames.get(routerId) ?? routerId) : null,
  };
  const missing: FlowRecordColumnId[] = [];
  const cells = {} as Record<FlowRecordColumnId, string>;
  for (const c of FLOW_RECORD_COLUMNS) {
    const v = values[c.id];
    if (v === null) missing.push(c.id);
    cells[c.id] = v ?? NOT_RECORDED_CELL;
  }
  return {
    // Rows are not unique by their fields (a long flow is exported again
    // each minute), so the position in the page is part of the key.
    key: `${index}|${row.start ?? row.window_start ?? ""}|${row.src_address ?? ""}|${row.src_port ?? ""}|${row.dst_address ?? ""}|${row.dst_port ?? ""}`,
    cells,
    missing,
  };
}

// ---------------------------------------------------------------------------
// Search form -> request params
// ---------------------------------------------------------------------------

export const EMPTY_FLOW_RECORD_FILTERS: FlowRecordFilterForm = {
  address: "",
  src_address: "",
  dst_address: "",
  port: "",
  src_port: "",
  dst_port: "",
  protocol: "",
};

export const DEFAULT_FLOW_RECORD_SORT: FlowRecordSort = { key: "start", order: "desc" };

/** The filters, in the order the form and the chips show them. */
export const FLOW_RECORD_FILTERS: {
  field: keyof FlowRecordFilterForm;
  label: string;
  kind: "address" | "port" | "protocol";
}[] = [
  { field: "address", label: "Address, either end", kind: "address" },
  { field: "src_address", label: "Src addr", kind: "address" },
  { field: "dst_address", label: "Dst addr", kind: "address" },
  { field: "port", label: "Port, either end", kind: "port" },
  { field: "src_port", label: "S.port", kind: "port" },
  { field: "dst_port", label: "D.port", kind: "port" },
  { field: "protocol", label: "Protocol", kind: "protocol" },
];

export type FlowRecordParamsResult =
  | { ok: true; params: Record<string, string> }
  | { ok: false; field: keyof FlowRecordFilterForm | "scope"; message: string };

const ADDRESS_SHAPE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

/**
 * The request for a search or a download. Refuses what the API would refuse
 * (it is the authority; this only saves a round trip and an audit row for a
 * request that could not succeed). An empty field is "no filter", never a
 * zero: an empty port is not port 0.
 */
export function flowRecordParams(
  scope: { locationId: string; routerId: string },
  range: { since: string; until: string },
  form: FlowRecordFilterForm,
  sort: FlowRecordSort,
): FlowRecordParamsResult {
  if (!scope.locationId && !scope.routerId)
    return { ok: false, field: "scope", message: "Pick a venue or a router first." };
  const params: Record<string, string> = {
    since: range.since,
    until: range.until,
    sort: sort.key,
    order: sort.order,
  };
  if (scope.locationId) params.location_id = scope.locationId;
  if (scope.routerId) params.router_id = scope.routerId;
  for (const f of FLOW_RECORD_FILTERS) {
    const value = form[f.field].trim();
    if (!value) continue;
    if (f.kind === "address") {
      if (!ADDRESS_SHAPE.test(value) || !/[.:]/.test(value))
        return {
          ok: false,
          field: f.field,
          message: `${f.label}: enter an address or a prefix, such as 203.0.113.7 or 203.0.113.0/24.`,
        };
      params[f.field] = value;
      continue;
    }
    const n = Number(value);
    const max = f.kind === "port" ? 65535 : 255;
    if (!Number.isInteger(n) || n < 0 || n > max)
      return {
        ok: false,
        field: f.field,
        message: `${f.label} must be a number from 0 to ${max}.`,
      };
    params[f.field] = String(n);
  }
  return { ok: true, params };
}

/** Clicking a column: the same column flips; a new one starts with the end
 * that is usually wanted first. */
export function nextFlowRecordSort(
  current: FlowRecordSort,
  key: FlowRecordSortKey,
): FlowRecordSort {
  if (current.key === key) return { key, order: current.order === "desc" ? "asc" : "desc" };
  const descendingFirst = key === "start" || key === "end" || key === "bytes" || key === "packets";
  return { key, order: descendingFirst ? "desc" : "asc" };
}

const PROTOCOL_NAMES: Record<string, string> = { 1: "ICMP", 6: "TCP", 17: "UDP", 58: "ICMPv6" };

export interface FlowRecordChip {
  field: keyof FlowRecordFilterForm;
  label: string;
}

/** The filters of the search on screen, as removable chips. Read from the
 * request that was sent, so a chip is always a filter in force. */
export function flowRecordChips(params: Record<string, string> | null): FlowRecordChip[] {
  if (!params) return [];
  return FLOW_RECORD_FILTERS.filter((f) => !!params[f.field]).map((f) => ({
    field: f.field,
    label:
      f.kind === "protocol"
        ? `Protocol ${PROTOCOL_NAMES[params[f.field]] ?? params[f.field]}`
        : `${f.label} ${params[f.field]}`,
  }));
}

// ---------------------------------------------------------------------------
// What the result is, and what it leaves out
// ---------------------------------------------------------------------------

export type FlowRecordsState =
  /** The platform switch is off; nothing was read. */
  | { kind: "feature_off"; title: string; body: string }
  /** Flow records are switched off and nothing is held. */
  | { kind: "records_off"; title: string; body: string }
  /** Switched on, but no record is held for this venue or router at all. */
  | { kind: "nothing_held"; title: string; body: string }
  /** Records are held; none matched this range and these filters. */
  | { kind: "no_match"; title: string; body: string }
  | { kind: "rows" };

export function flowRecordsState(r: FlowRecordsResult): FlowRecordsState {
  if (r.feature_enabled === false)
    return {
      kind: "feature_off",
      title: "Switched off for the platform.",
      body: "Nothing was read. This is not an empty result.",
    };
  const total = isNum(r.total) ? r.total : 0;
  if (total > 0 || r.rows.length > 0) return { kind: "rows" };
  if (r.records_enabled === false)
    return {
      kind: "records_off",
      title: "Flow records are switched off.",
      body: "Individual flow records are stored only while their own switch is on, and none is held for this scope. The venue view and Destinations do not depend on it.",
    };
  if (!r.data_oldest)
    return {
      kind: "nothing_held",
      title: "No flow records are held for this scope.",
      body: "Nothing has been stored for this venue or router yet. That is not the same as no traffic: the venue view shows what was measured.",
    };
  return {
    kind: "no_match",
    title: "No records match this range and these filters.",
    body: `Flow records are held from ${recordTime(r.data_oldest)}; none of them matched.`,
  };
}

/** Said beside rows that are shown although the switch is now off. */
export function recordsSwitchedOffNote(r: FlowRecordsResult): string | null {
  if (r.records_enabled !== false || flowRecordsState(r).kind !== "rows") return null;
  return `Flow records are switched off now, so nothing new is being stored. What is held stays searchable until it is ${isNum(r.retention_days) ? `${r.retention_days} days` : "a few days"} old.`;
}

export interface FlowNotice {
  title: string;
  body: string;
}

/** The notice above the table when the daily cap left the range incomplete.
 * Driven by the API's `incomplete` flag alone; null when it is not set. */
export function incompleteNotice(r: FlowRecordsResult): FlowNotice | null {
  if (r.incomplete !== true) return null;
  const stretches = (r.incomplete_stretches ?? []).filter(
    (s) => !Number.isNaN(Date.parse(s.since)),
  );
  const fallback = text(r.incomplete_message);
  if (stretches.length === 0)
    return {
      title: "Records incomplete in this range.",
      body:
        fallback ??
        "The daily limit on stored flow records was reached, so some records in this range were not stored.",
    };
  const first = stretches.reduce((a, b) => (Date.parse(b.since) < Date.parse(a.since) ? b : a));
  const lost = stretches.reduce(
    (sum, s) => sum + (isNum(s.records_not_stored) ? s.records_not_stored : 0),
    0,
  );
  const cap = isNum(r.daily_cap) ? ` of ${formatCount(r.daily_cap)} a day per router` : "";
  const routers = new Set(stretches.map((s) => s.router_id ?? "")).size;
  return {
    title: `Records incomplete since ${recordTime(first.since)}.`,
    body: `The limit${cap} on stored flow records was reached${routers > 1 ? ` on ${routers} routers` : ""}, and ${lost > 0 ? `${formatCount(lost)} ${lost === 1 ? "record" : "records"}` : "some records"} in this range ${lost === 1 ? "was" : "were"} not stored. Storing resumes at the start of the next day (UTC). Totals for the period are in the venue view, which is not affected.`,
  };
}

/** "61.3 MB · 51,200 packets across all matching records". */
export function flowTotalsLine(r: FlowRecordsResult): string | null {
  if (!r.totals) return null;
  const parts = [
    isNum(r.totals.bytes) ? flowBytes(r.totals.bytes) : null,
    isNum(r.totals.packets) ? `${formatCount(r.totals.packets)} packets` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(" · ")} across all matching records` : null;
}

/** Lines under the table: what the page leaves out, and what a row is. */
export function flowRecordNotes(r: FlowRecordsResult): string[] {
  const notes: string[] = [];
  if (r.truncated)
    notes.push(
      `Only the first ${formatCount(r.returned)} are shown, in this order. Narrow the filters or the range, or download.`,
    );
  const meaning = text(r.row_meaning);
  if (meaning) notes.push(meaning);
  return notes;
}

/** What to say after a download: what the file holds, and whether the daily
 * cap left its range incomplete. */
export function flowExportMessage(file: FlowRecordsExport): {
  tone: "success" | "warning";
  text: string;
} {
  const base = exportMessage(file);
  if (!file.incompleteSince) return base;
  const t = Date.parse(file.incompleteSince);
  const since = Number.isNaN(t) ? file.incompleteSince : recordTime(new Date(t).toISOString());
  return {
    tone: "warning",
    text: `${base.text} Records in this range are incomplete since ${since}: the daily limit was reached.`,
  };
}
