/**
 * IPDR wire types -- `GET /api/v1/ipdr/connections` (cloud-guest#423,
 * `app/domains/ipdr/formatting.py::list_item`). The on-screen row is already
 * masked by the backend: `contact_no`, `email` and a phone/email-shaped
 * `user_id` arrive as `98xxxxxx20` / `a***@example.com`. The full values only
 * ever exist in the CSV download.
 */

/** Where Translated IP / Port came from. */
export type IpdrTranslatedSource = "nat_event" | "derived" | "ambiguous" | "none";

/** Who a row belongs to (table only, never one of the 18 CSV columns):
 * a matched guest session, known infrastructure (`user_id` = `device`), or
 * nothing known (`unknown`). cloud-guest#424. */
export type IpdrUserClass = "guest" | "device" | "unknown";

/** Why a row is `device`. */
export type IpdrDeviceKind = "router" | "monitored_hardware" | "authorized_mac";

/** Where the MAC / the allocation start-end came from. */
export type IpdrValueSource = "session" | "dhcp" | "inventory";

export interface IpdrItem {
  time_stamp_ist: string;
  name: string;
  contact_no: string;
  alternate_contact_no: string;
  email: string;
  user_id: string;
  source_ip: string;
  source_port: string;
  translated_ip: string;
  translated_port: string;
  allocation: string;
  destination_ip: string;
  destination_port: string;
  protocol: string;
  allocation_start_ist: string;
  allocation_end_ist: string;
  total_online_time: string;
  mac: string;
  /** UTC instant, for keys and sorting. */
  ts: string;
  location_id: string | null;
  router_id: string | null;
  translated_source: IpdrTranslatedSource | string;
  ts_source: "flow" | "window" | string | null;
  user_known: boolean;
  ports_merged: boolean;
  /** cloud-guest#424; absent from an older backend. */
  user_class?: IpdrUserClass | string;
  device_kind?: IpdrDeviceKind | string | null;
  mac_source?: IpdrValueSource | string | null;
  allocation_source?: IpdrValueSource | string | null;
  /** Only NAT events, no traffic record (e.g. a fast-tracked connection). */
  nat_event_only?: boolean;
}

export interface IpdrCoverageDay {
  /** IST day, `YYYY-MM-DD`. */
  day: string;
  archived: number;
  live: number;
  records_incomplete: boolean;
  unreadable: number;
  status: "archived" | "live" | "missing" | string;
}

export interface IpdrPage {
  since: string;
  until: string;
  items: IpdrItem[];
  next_cursor: string | null;
  coverage: IpdrCoverageDay[];
}
