/**
 * Master "Traffic Lens" -> Flows: what this console adds to the shared flow
 * record rules in src/lib/flow-records.ts (API.md, F-1 and F-2). Pure, so
 * scripts/test-traffic-flow-records.mjs can run it.
 *
 * MASTER CONSOLE ONLY. Added here and nowhere else: the Export column (the
 * address a record was exported from, which is platform equipment), the two
 * platform switches and their empty states, and the API's own sentence about
 * what a row is. Nothing under the customer dashboard may import this file
 * (the test suite checks).
 *
 * Four empty answers are four sentences: switched off for the platform,
 * flow records switched off, nothing held for this scope, and nothing
 * matched the filters.
 */
import { recordTime, type RecordsRow } from "@/lib/records-table";
import {
  FLOW_BASE_COLUMN_FIELDS,
  FLOW_EXTRA_COLUMNS,
  FLOW_REFERENCE_COLUMNS,
  columnsForResult,
  flowColumn,
  flowFilterParams,
  flowRow,
  toggleColumn,
  truncatedNote,
  type FlowBaseColumnId,
  type FlowColumn,
  type FlowRecordParamsResult,
} from "@/lib/flow-records";
import type {
  FlowRecord,
  FlowRecordFilterForm,
  FlowRecordSort,
  FlowRecordsResult,
} from "@/types/traffic-flow-records";

export {
  DEFAULT_FLOW_RECORD_SORT,
  EMPTY_FLOW_RECORD_FILTERS,
  FLOW_COLUMN_NOT_RECORDED,
  FLOW_RECORD_FILTERS,
  NOT_APPLICABLE_CELL,
  NOT_RECORDED_CELL,
  endpointLabel,
  flowExportMessage,
  flowRecordChips,
  flowTotalsLine,
  incompleteNotice,
  nextFlowRecordSort,
  retentionNote,
  storageLine,
} from "@/lib/flow-records";

export const FLOW_RECORDS_AUDIT_NOTE =
  "Each search and download of flow records is recorded in the audit log.";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export type FlowRecordColumnId = FlowBaseColumnId | "exporter";
export type FlowRecordColumn = FlowColumn<FlowRecordColumnId>;

/** The reference table's thirteen columns in its order (Export last), then
 * four more the API returns, off until switched on in Columns. */
export const FLOW_RECORD_COLUMNS: FlowRecordColumn[] = [
  ...FLOW_REFERENCE_COLUMNS,
  flowColumn<FlowRecordColumnId>("exporter", "Export", null),
  // "Records" (how many exported records a row sums) is on here.
  ...FLOW_EXTRA_COLUMNS.map((c) => (c.id === "records" ? { ...c, initial: true } : c)),
];

export const FLOW_RECORD_DEFAULT_COLUMNS: FlowRecordColumnId[] = FLOW_RECORD_COLUMNS.filter(
  (c) => c.initial,
).map((c) => c.id);

export const FLOW_COLUMN_FIELDS: Record<FlowRecordColumnId, readonly string[]> = {
  ...FLOW_BASE_COLUMN_FIELDS,
  exporter: ["exporter"],
};

export function flowRecordColumns(
  result: Pick<FlowRecordsResult, "fields_not_recorded"> | null | undefined,
): FlowRecordColumn[] {
  return columnsForResult(FLOW_RECORD_COLUMNS, FLOW_COLUMN_FIELDS, result);
}

export function toggleFlowRecordColumn(
  visible: readonly FlowRecordColumnId[],
  id: FlowRecordColumnId,
): FlowRecordColumnId[] {
  return toggleColumn(FLOW_RECORD_COLUMNS, visible, id);
}

/** One record as a row of this console's table. */
export function flowRecordRow(
  row: FlowRecord,
  index: number,
  routerNames: ReadonlyMap<string, string> = new Map(),
): RecordsRow<FlowRecordColumnId> {
  return flowRow(row, index, FLOW_RECORD_COLUMNS, {
    routerNames,
    extra: (r) => ({ exporter: text(r.exporter) }),
  });
}

/** The request: a venue or a router is required, then the shared filters. */
export function flowRecordParams(
  scope: { locationId: string; routerId: string },
  range: { since: string; until: string },
  form: FlowRecordFilterForm,
  sort: FlowRecordSort,
): FlowRecordParamsResult {
  if (!scope.locationId && !scope.routerId)
    return { ok: false, field: "scope", message: "Pick a venue or a router first." };
  const built = flowFilterParams(range, form, sort);
  if (!built.ok) return built;
  const params = { ...built.params };
  if (scope.locationId) params.location_id = scope.locationId;
  if (scope.routerId) params.router_id = scope.routerId;
  return { ok: true, params };
}

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

/** Lines under the table: what the page leaves out, and the API's own
 * sentence about what a row is. */
export function flowRecordNotes(r: FlowRecordsResult): string[] {
  return [truncatedNote(r), text(r.row_meaning)].filter((n): n is string => !!n);
}
