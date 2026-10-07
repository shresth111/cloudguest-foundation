/** GET /guest-sessions/{id}/device-events -- see the backend's
 * `app/domains/device_logs/session_events.py` for the matching rule. */

export type GuestDeviceEventKind =
  | "ip_assigned"
  | "ip_released"
  | "router_sign_in"
  | "router_sign_out";

/** Whether an empty `events` list means "nothing happened" (`covered`) or
 * "we could not have known" (the other two). */
export type GuestDeviceEventsCoverage = "not_sending" | "not_sending_during_session" | "covered";

export interface GuestDeviceEvent {
  occurred_at: string;
  device_time: string | null;
  kind: GuestDeviceEventKind | string;
  ip_address: string;
  mac_address: string | null;
  detail: string | null;
}

export interface GuestSessionDeviceEvents {
  session_id: string;
  coverage: GuestDeviceEventsCoverage | string;
  logging_since: string | null;
  linkable: boolean;
  window_start: string;
  window_end: string;
  events: GuestDeviceEvent[];
  ambiguous_count: number;
}
