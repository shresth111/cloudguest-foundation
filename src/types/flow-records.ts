/**
 * Flow records, the part of the wire shape that both consoles receive
 * (wyfy-specs/flow-visibility/API.md, F-1 and F-1c). One row is one
 * connection record in one direction. `null` in a row means "not recorded":
 * never zero, never empty.
 *
 * What only the Master console receives is added in
 * src/types/traffic-flow-records.ts.
 */

export type FlowRecordSortKey =
  | "start"
  | "end"
  | "src_address"
  | "src_port"
  | "dst_address"
  | "dst_port"
  | "protocol"
  | "bytes"
  | "packets";

export interface FlowRecordBase {
  start: string | null;
  end: string | null;
  arrived_at: string | null;
  window_start: string | null;
  window_end: string | null;
  src_address: string | null;
  src_port: number | null;
  dst_address: string | null;
  dst_port: number | null;
  protocol: number | null;
  protocol_name: string | null;
  nat_src_address: string | null;
  nat_src_port: number | null;
  nat_dst_address: string | null;
  nat_dst_port: number | null;
  bytes: number | null;
  packets: number | null;
  /** The protocol and the outside end's port with its IANA label. A port
   * label, never an inspected application. */
  application: string | null;
  direction: string | null;
  router_id: string | null;
  /** How many exported records this row stands for; 1 = one record. */
  records_merged?: number | null;
  /** true: those records came from different ports on the venue side, so
   * that port (and its translated twin) is null. "Several", not unknown. */
  ports_merged?: boolean | null;
}

/** What happened to the records received, per whole UTC day the range
 * touches. `records_received` is always the sum of the other four. */
export interface FlowStorage {
  from_day: string;
  to_day: string;
  records_received: number;
  rows_stored: number;
  records_merged: number;
  not_stored: { internal: number; daily_cap: number };
  internal_records_stored: boolean;
  ports_merged: boolean;
}

export interface FlowIncompleteStretch {
  router_id: string | null;
  since: string;
  until: string;
  records_not_stored: number;
}

export interface FlowRecordsPage<Row extends FlowRecordBase = FlowRecordBase> {
  location_id: string | null;
  router_id: string | null;
  since: string;
  until: string;
  window_seconds: number;
  retention_days: number;
  daily_cap: number;
  data_oldest: string | null;
  data_newest: string | null;
  incomplete: boolean;
  incomplete_message: string | null;
  incomplete_stretches: FlowIncompleteStretch[];
  /** Columns that are null in every returned row. */
  fields_not_recorded: string[];
  row_meaning: string;
  filters: Record<string, string | number | null>;
  sort: FlowRecordSortKey;
  order: "asc" | "desc";
  limit: number;
  total: number;
  returned: number;
  truncated: boolean;
  query_ms: number;
  totals: { bytes: number; packets: number } | null;
  storage?: FlowStorage | null;
  rows: Row[];
}

/** The search form. Every field is a string; empty means "no filter". */
export interface FlowRecordFilterForm {
  address: string;
  src_address: string;
  dst_address: string;
  port: string;
  src_port: string;
  dst_port: string;
  protocol: string;
}

export interface FlowRecordSort {
  key: FlowRecordSortKey;
  order: "asc" | "desc";
}

export interface FlowRecordsExport {
  blob: Blob;
  filename: string;
  total: number | null;
  rows: number | null;
  truncated: boolean | null;
  /** `X-Records-Incomplete-Since`, when the daily cap cut the range. */
  incompleteSince: string | null;
}
