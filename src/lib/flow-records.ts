/**
 * Flow records: the presentation rules both consoles share
 * (wyfy-specs/flow-visibility/API.md, F-1 and F-1c). Pure functions, no
 * React. The Master console adds its own columns and states in
 * src/lib/traffic-flow-records.ts; the customer dashboard adds its own in
 * src/lib/traffic-lens-flow-records.ts. Because the customer dashboard
 * imports this file, nothing here says how records are gathered.
 *
 * The rules, worst mistake first:
 *
 *   1. NULL IS "NOT RECORDED". Never zero, never an empty cell, never a
 *      dash that reads as "none". Each such cell carries its reason. A
 *      field that is null in every returned row greys its whole column.
 *   2. "NOT APPLICABLE" IS SAID ONLY WHEN IT IS A FACT: a protocol without
 *      ports has no port. Nothing else is inferred; a missing translation is
 *      "not recorded", with what is known about why.
 *   3. AN INCOMPLETE RANGE IS SAID whenever the API sets `incomplete`, with
 *      since when and how many records were not stored, and never otherwise.
 *   4. THE SERVICE COLUMN IS A PORT LABEL. `application` is the protocol and
 *      port with the port's IANA name; no product is ever named.
 */
import { formatCount } from "@/lib/analytics-format";
import { recordTime, type RecordsColumn, type RecordsRow } from "@/lib/records-table";
import { exportMessage } from "@/lib/traffic-flow-destinations";
import { flowBytes } from "@/lib/traffic-lens-shared";
import type {
  FlowRecordBase,
  FlowRecordFilterForm,
  FlowRecordSort,
  FlowRecordSortKey,
  FlowRecordsExport,
  FlowRecordsPage,
} from "@/types/flow-records";

/** What a cell says when the API sent null for it. */
export const NOT_RECORDED_CELL = "not recorded";
/** What a cell says when the value cannot exist for that record. */
export const NOT_APPLICABLE_CELL = "not applicable";

export const NOT_RECORDED_REASON = "Not recorded for this record. That is not zero and not none.";
export const NO_PORTS_REASON = "Not applicable: this protocol has no ports.";
export const NAT_V6_REASON =
  "Not recorded. IPv6 addresses are normally not translated, so there may be nothing to record.";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

// ---------------------------------------------------------------------------
// Columns: the reference flow table's, in its order
// ---------------------------------------------------------------------------

export type FlowBaseColumnId =
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
  | "direction"
  | "arrived_at"
  | "window"
  | "router";

export type FlowColumn<Id extends string = FlowBaseColumnId> = RecordsColumn<Id, FlowRecordSortKey>;

export const flowColumn = <Id extends string>(
  id: Id,
  label: string,
  sort: FlowRecordSortKey | null,
  over: Partial<FlowColumn<Id>> = {},
): FlowColumn<Id> => ({
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
 * BYTES, PACKETS and the port label, in the reference table's order. */
export const FLOW_REFERENCE_COLUMNS: FlowColumn[] = [
  flowColumn("start", "Start", "start", { fixed: true }),
  flowColumn("end", "End", "end"),
  flowColumn("src_address", "Src addr", "src_address", { fixed: true }),
  flowColumn("src_port", "S.port", "src_port", { numeric: true }),
  flowColumn("dst_address", "Dst addr", "dst_address", { fixed: true }),
  flowColumn("dst_port", "D.port", "dst_port", { numeric: true }),
  flowColumn("protocol", "Protocol", "protocol"),
  flowColumn("nat_src", "S.NAT", null),
  flowColumn("nat_dst", "D.NAT", null),
  flowColumn("bytes", "Bytes", "bytes", { numeric: true }),
  flowColumn("packets", "Packets", "packets", { numeric: true }),
  flowColumn("service", "Service", null),
];

/** Also returned for every record; off until switched on in Columns. */
export const FLOW_EXTRA_COLUMNS: FlowColumn[] = [
  flowColumn("direction", "Direction", null, { initial: false }),
  flowColumn("arrived_at", "Arrived", null, { initial: false }),
  flowColumn("window", "Window", null, { initial: false }),
  flowColumn("router", "Router", null, { initial: false }),
];

/** The API fields each column is drawn from. A column is "not recorded" for
 * a result when EVERY one of its fields is in `fields_not_recorded`. */
export const FLOW_BASE_COLUMN_FIELDS: Record<FlowBaseColumnId, readonly string[]> = {
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
  direction: ["direction"],
  arrived_at: ["arrived_at"],
  window: ["window_start"],
  router: ["router_id"],
};

export const FLOW_COLUMN_NOT_RECORDED =
  "Not recorded in any row of this result. That is not the same as none.";

/** The columns for one result: any whose fields the API lists as null in
 * every returned row is greyed and loses its sort. Order never changes. */
export function columnsForResult<Id extends string>(
  columns: readonly FlowColumn<Id>[],
  fields: Readonly<Record<string, readonly string[]>>,
  result: { fields_not_recorded?: string[] | null } | null | undefined,
): FlowColumn<Id>[] {
  const absent = new Set(result?.fields_not_recorded ?? []);
  return columns.map((c) => {
    const drawnFrom = fields[c.id] ?? [];
    return drawnFrom.length > 0 && drawnFrom.every((f) => absent.has(f))
      ? { ...c, notRecorded: FLOW_COLUMN_NOT_RECORDED }
      : c;
  });
}

/** Flip one column; a fixed column cannot be hidden. Order is the table's. */
export function toggleColumn<Id extends string>(
  columns: readonly FlowColumn<Id>[],
  visible: readonly Id[],
  id: Id,
): Id[] {
  const hit = columns.find((c) => c.id === id);
  if (!hit || hit.fixed) return [...visible];
  const next = new Set(visible);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return columns.filter((c) => c.fixed || next.has(c.id)).map((c) => c.id);
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

/** ICMP and ICMPv6 have no ports. Nothing else is assumed to have none. */
const PORTLESS = new Set([1, 58]);

function protocolCell(row: FlowRecordBase): string | null {
  const name = text(row.protocol_name);
  if (name && name.toLowerCase() !== "other") return name.toUpperCase();
  return isNum(row.protocol) ? `Protocol ${row.protocol}` : null;
}

function directionCell(direction: string | null): string | null {
  const d = text(direction);
  if (!d) return null;
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/**
 * One flow record as a table row, for the given columns. Every null becomes
 * "not recorded" (or "not applicable" for a port of a protocol without
 * ports), is listed in `missing` so it is drawn greyed, and carries its
 * reason. `extra` supplies the cells of columns this module does not know.
 */
export function flowRow<Row extends FlowRecordBase, Id extends string>(
  row: Row,
  index: number,
  columns: readonly FlowColumn<Id>[],
  options: {
    routerNames?: ReadonlyMap<string, string>;
    timeZone?: string | null;
    extra?: (row: Row) => Partial<Record<string, string | null>>;
  } = {},
): RecordsRow<Id> {
  const zone = options.timeZone;
  const start = text(row.start);
  const end = text(row.end);
  const windowStart = text(row.window_start);
  const windowEnd = text(row.window_end);
  const routerId = text(row.router_id);
  const values: Record<string, string | null> = {
    start: start ? recordTime(start, zone) : null,
    end: end ? recordTime(end, zone) : null,
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
    direction: directionCell(row.direction),
    arrived_at: text(row.arrived_at) ? recordTime(row.arrived_at, zone) : null,
    window:
      windowStart && windowEnd
        ? `${recordTime(windowStart, zone)} to ${recordTime(windowEnd, zone).slice(11)}`
        : null,
    router: routerId ? (options.routerNames?.get(routerId) ?? routerId) : null,
    ...(options.extra ? options.extra(row) : {}),
  };
  const portless = isNum(row.protocol) && PORTLESS.has(row.protocol);
  const v6 = (text(row.src_address) ?? "").includes(":");
  const missing: Id[] = [];
  const reasons: Partial<Record<Id, string>> = {};
  const cells = {} as Record<Id, string>;
  for (const c of columns) {
    const v = values[c.id] ?? null;
    if (v !== null) {
      cells[c.id] = v;
      continue;
    }
    missing.push(c.id);
    if ((c.id === "src_port" || c.id === "dst_port") && portless) {
      cells[c.id] = NOT_APPLICABLE_CELL;
      reasons[c.id] = NO_PORTS_REASON;
    } else {
      cells[c.id] = NOT_RECORDED_CELL;
      reasons[c.id] =
        (c.id === "nat_src" || c.id === "nat_dst") && v6 ? NAT_V6_REASON : NOT_RECORDED_REASON;
    }
  }
  return {
    // Rows are not unique by their fields (a long flow is recorded again
    // each minute), so the position in the page is part of the key.
    key: `${index}|${row.start ?? row.window_start ?? ""}|${row.src_address ?? ""}|${row.src_port ?? ""}|${row.dst_address ?? ""}|${row.dst_port ?? ""}`,
    cells,
    missing,
    reasons,
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
 * The range, sort and filters of a search or a download. Refuses what the
 * API would refuse (it is the authority; this only saves a round trip and an
 * audit row for a request that could not succeed). An empty field is "no
 * filter", never a zero: an empty port is not port 0. Whose records are
 * asked for is added by the caller, not here.
 */
export function flowFilterParams(
  range: { since: string; until: string },
  form: FlowRecordFilterForm,
  sort: FlowRecordSort,
): FlowRecordParamsResult {
  const params: Record<string, string> = {
    since: range.since,
    until: range.until,
    sort: sort.key,
    order: sort.order,
  };
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
// What the result leaves out
// ---------------------------------------------------------------------------

export interface FlowNotice {
  title: string;
  body: string;
}

/** The notice above the table when the daily cap left the range incomplete.
 * Driven by the API's `incomplete` flag alone; null when it is not set.
 * `totalsWhere` names the screen whose totals are not affected. */
export function incompleteNotice(
  r: Pick<
    FlowRecordsPage,
    "incomplete" | "incomplete_message" | "incomplete_stretches" | "daily_cap"
  >,
  totalsWhere = "the venue view",
  timeZone?: string | null,
): FlowNotice | null {
  if (r.incomplete !== true) return null;
  const stretches = (r.incomplete_stretches ?? []).filter(
    (s) => !Number.isNaN(Date.parse(s.since)),
  );
  if (stretches.length === 0)
    return {
      title: "Records incomplete in this range.",
      body:
        text(r.incomplete_message) ??
        "The daily limit on stored records was reached, so some records in this range were not stored.",
    };
  const first = stretches.reduce((a, b) => (Date.parse(b.since) < Date.parse(a.since) ? b : a));
  const lost = stretches.reduce(
    (sum, s) => sum + (isNum(s.records_not_stored) ? s.records_not_stored : 0),
    0,
  );
  const cap = isNum(r.daily_cap) ? ` of ${formatCount(r.daily_cap)} a day` : "";
  return {
    title: `Records incomplete since ${recordTime(first.since, timeZone)}.`,
    body: `The limit${cap} on stored records was reached, and ${lost > 0 ? `${formatCount(lost)} ${lost === 1 ? "record" : "records"}` : "some records"} in this range ${lost === 1 ? "was" : "were"} not stored. Storing resumes at the start of the next day (UTC). Totals for the period are in ${totalsWhere}, which is not affected.`,
  };
}

/** "61.3 MB · 51,200 packets across all matching records". */
export function flowTotalsLine(r: Pick<FlowRecordsPage, "totals">): string | null {
  if (!r.totals) return null;
  const parts = [
    isNum(r.totals.bytes) ? flowBytes(r.totals.bytes) : null,
    isNum(r.totals.packets) ? `${formatCount(r.totals.packets)} packets` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(" · ")} across all matching records` : null;
}

/** "Only the first 1,000 are shown ..." when the page was capped. */
export function truncatedNote(r: Pick<FlowRecordsPage, "truncated" | "returned">): string | null {
  return r.truncated
    ? `Only the first ${formatCount(r.returned)} are shown, in this order. Narrow the filters or the range, or download.`
    : null;
}

/** "Kept for 7 days", from the retention the API reports. null without one. */
export function retentionNote(days: number | null | undefined): string | null {
  if (!isNum(days) || days === 0) return null;
  return `Kept for ${days} ${days === 1 ? "day" : "days"}`;
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
