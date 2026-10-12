/**
 * Traffic Lens "Destinations" wire types: the search, its CSV download and
 * the drill-down from a service. Mirror wyfy-specs/flow-visibility/API.md
 * ("Destinations: search, download and service drill-down", D-1 to D-3).
 *
 * Everything here is VENUE-LEVEL. A record says which outside address and
 * service a venue exchanged bytes with in a 5-minute window; it never says
 * which device did. There is no device, MAC, guest or session field in any
 * of these shapes, and none may be added on this side either.
 *
 * Keys are the wire's own snake_case; the `{success, data}` envelope is
 * already unwrapped by `api`'s interceptor.
 */

export type DestinationDirection = "any" | "up" | "down";

export type DestinationSortKey =
  | "time"
  | "address"
  | "protocol"
  | "port"
  | "bytes"
  | "bytes_up"
  | "bytes_down"
  | "flows";

export type DestinationSortOrder = "asc" | "desc";

export interface DestinationByteTotals {
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
}

/** One (5-minute window, outside address, protocol, port) for the venue. */
export interface DestinationRecord {
  window_start: string;
  window_end: string;
  address: string;
  protocol: number;
  protocol_name: string;
  port: number;
  /** IANA port label or null. A port label, never an application. */
  service_name: string | null;
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
}

/** Fields D-1 and D-3 share. */
export interface DestinationRangeFields {
  feature_enabled?: boolean;
  /** false = no window in the range. Not the same as zero. */
  measured: boolean;
  location_id: string;
  router_id?: string | null;
  since: string;
  until: string;
  window_seconds: number;
  windows: number;
  /** Windows that carried protocol and port, so have destination records. */
  windows_measured: number;
  data_oldest: string | null;
  data_newest: string | null;
  /** Destinations kept per window; the rest is "unlisted". */
  per_window_top_n: number;
  /** Small-venue threshold in force (customer routes), else null. */
  min_devices: number | null;
  /** Windows left out because too few devices were connected. */
  windows_withheld: number;
}

export interface DestinationSearchResult extends DestinationRangeFields {
  retention_days: number;
  filters: {
    address: string | null;
    protocol: number | null;
    port: number | null;
    direction: DestinationDirection;
  };
  sort: DestinationSortKey;
  order: DestinationSortOrder;
  limit: number;
  /** Records matching the filters; `rows` holds at most `limit` of them. */
  total: number;
  returned: number;
  truncated: boolean;
  query_ms: number;
  /** Over ALL matching records. null when nothing was measured. */
  totals: DestinationByteTotals | null;
  /** Traffic outside each window's stored top. null = cannot be known for
   * these filters (never read null as zero). */
  unlisted: DestinationByteTotals | null;
  rows: DestinationRecord[];
}

export interface ServiceDestinationItem {
  address: string;
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
  /** Of the service's bytes. A lower bound. */
  share: number;
}

export interface ServiceDestinationsResult extends DestinationRangeFields {
  service:
    | (DestinationByteTotals & {
        protocol: number;
        protocol_name: string;
        port: number;
        service_name: string | null;
        /** false = the service's own total is a lower bound too. */
        exact: boolean;
      })
    | null;
  lower_bound: boolean;
  destinations_listed: number;
  listed_bytes: number;
  unlisted_bytes: number;
  unlisted_share: number;
  items: ServiceDestinationItem[];
}

/** What the search form holds. Strings, as typed; `destinationSearchParams`
 * turns them into request params and refuses what the API would refuse. */
export interface DestinationFilterForm {
  address: string;
  /** "" = any; otherwise an IP protocol number as text. */
  protocol: string;
  port: string;
  direction: DestinationDirection;
}

export interface DestinationSort {
  key: DestinationSortKey;
  order: DestinationSortOrder;
}

export interface DestinationExport {
  blob: Blob;
  filename: string;
  /** null when the browser could not read the response headers. */
  total: number | null;
  rows: number | null;
  truncated: boolean | null;
}
