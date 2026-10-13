/**
 * Traffic Lens on the CUSTOMER dashboard, Records view, for a customer who
 * holds the second add-on (`traffic_flow_records`; API.md, F-1c): the
 * columns, the empty states and the words. Pure, so
 * scripts/test-traffic-lens-flow-records.mjs can run it. The shared rules
 * (cells, filters, the incomplete notice) are in src/lib/flow-records.ts.
 *
 * Which table the Records view draws is decided from what the backend says
 * about the add-on, never from anything the browser works out:
 * `lensRecordsMode` reads `/me/entitlements`, and a 402 from the records
 * route itself always wins.
 *
 * The customer never receives the platform's own equipment address, so this
 * table has the reference flow table's twelve data columns and no thirteenth.
 * Like the other customer files, nothing here says how records are gathered.
 */
import {
  FLOW_BASE_COLUMN_FIELDS,
  FLOW_EXTRA_COLUMNS,
  FLOW_REFERENCE_COLUMNS,
  columnsForResult,
  flowRow,
  toggleColumn,
  truncatedNote,
  type FlowBaseColumnId,
  type FlowColumn,
} from "@/lib/flow-records";
import { recordTime, type RecordsRow } from "@/lib/records-table";
import { TRAFFIC_LENS_NAME } from "@/lib/traffic-lens-customer";
import type { FlowRecordBase, FlowRecordsPage } from "@/types/flow-records";

/** The name of the second add-on, as the Master console lists it. */
export const LENS_RECORDS_ADDON_NAME = `${TRAFFIC_LENS_NAME}: flow records`;

export type LensRecordsMode =
  /** The customer holds the add-on: the connection-record table. */
  | "connections"
  /** The backend says it does not: the venue-level table, with the line. */
  | "venue_locked"
  /** Not known yet (entitlements still loading, or not reported): the
   * venue-level table, and no claim either way. */
  | "venue";

/** Which Records table to draw. `entitled` is `/me/entitlements` for the
 * second add-on's key: true, false, or null while unknown. `refused` is set
 * once the records route itself answered 402: the backend's refusal is the
 * truth, whatever the entitlement list said. Nothing else is consulted. */
export function lensRecordsMode(entitled: boolean | null, refused = false): LensRecordsMode {
  if (refused || entitled === false) return "venue_locked";
  return entitled === true ? "connections" : "venue";
}

/** The one line under the venue-level table when the add-on is not held. */
export const LENS_RECORDS_LOCKED_LINE = `Source address, source port and address translation for each connection are part of a separate add-on, "${LENS_RECORDS_ADDON_NAME}", which is not enabled for your organisation. Without it this table is for the venue as a whole.`;

export const LENS_CONNECTIONS_INTRO =
  "One row is one connection record, in one direction: which device address reached which outside address, on which ports, and how much. A long connection appears again each minute, and its two directions are separate rows. Addresses and ports only: nothing here looks inside traffic or names a site.";

export type LensFlowColumnId = Exclude<FlowBaseColumnId, "router">;

/** Start, End, Src addr, S.port, Dst addr, D.port, Protocol, S.NAT, D.NAT,
 * Bytes, Packets, Service -- then three more, off until switched on. */
export const LENS_FLOW_COLUMNS: FlowColumn<LensFlowColumnId>[] = [
  ...FLOW_REFERENCE_COLUMNS,
  ...FLOW_EXTRA_COLUMNS,
].filter((c): c is FlowColumn<LensFlowColumnId> => c.id !== "router");

export const LENS_FLOW_DEFAULT_COLUMNS: LensFlowColumnId[] = LENS_FLOW_COLUMNS.filter(
  (c) => c.initial,
).map((c) => c.id);

export function lensFlowColumns(
  result: { fields_not_recorded?: string[] | null } | null | undefined,
): FlowColumn<LensFlowColumnId>[] {
  return columnsForResult(LENS_FLOW_COLUMNS, FLOW_BASE_COLUMN_FIELDS, result);
}

export function toggleLensFlowColumn(
  visible: readonly LensFlowColumnId[],
  id: LensFlowColumnId,
): LensFlowColumnId[] {
  return toggleColumn(LENS_FLOW_COLUMNS, visible, id);
}

export function lensFlowRow(
  row: FlowRecordBase,
  index: number,
  timeZone?: string | null,
): RecordsRow<LensFlowColumnId> {
  return flowRow(row, index, LENS_FLOW_COLUMNS, { timeZone });
}

export type LensFlowState =
  /** The add-on is held, but no record is stored for this venue at all. */
  | { kind: "nothing_held"; title: string; body: string }
  /** Records are held; none matched this period and these filters. */
  | { kind: "no_match"; title: string; body: string }
  | { kind: "rows" };

export function lensFlowState(
  r: Pick<FlowRecordsPage, "total" | "rows" | "data_oldest">,
  timeZone?: string | null,
): LensFlowState {
  const total = typeof r.total === "number" && r.total > 0 ? r.total : 0;
  if (total > 0 || r.rows.length > 0) return { kind: "rows" };
  if (!r.data_oldest)
    return {
      kind: "nothing_held",
      title: "No connection records are held for this venue yet.",
      body: "The add-on is enabled, but keeping connection records for a venue is switched on separately by Wyfy support. Nothing stored is not the same as no traffic: the Overview shows what was measured.",
    };
  return {
    kind: "no_match",
    title: "No records match this period and these filters.",
    body: `Connection records are held from ${recordTime(r.data_oldest, timeZone)}; none of them matched.`,
  };
}

/** Lines under the table. The server's own sentence about a row is not
 * printed here: this page says it in its own words (LENS_CONNECTIONS_INTRO). */
export function lensFlowNotes(
  r: Pick<FlowRecordsPage, "truncated" | "returned">,
  timeBasis: string,
): string[] {
  return [
    truncatedNote(r),
    `Start and End are when the record began and ended, to the second, in ${timeBasis}. A greyed "not recorded" is a value the record did not carry: it is not zero and not none; hover it for why. "Not applicable" is used only where the value cannot exist, such as a port on a protocol that has none. A greyed heading means no returned row carried that column. Service is the protocol and port with the port's standard name; it does not say which app or site was used. Sorting asks again for the same search.`,
  ].filter((n): n is string => !!n);
}
