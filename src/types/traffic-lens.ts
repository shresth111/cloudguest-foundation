/**
 * Traffic Lens wire types for the CUSTOMER dashboard -- mirror the
 * "Customer API" section of wyfy-specs/flow-visibility/API.md. Two
 * read-only routes under `/traffic-flow/locations/{location_id}`.
 *
 * Deliberately a separate file from src/types/traffic-flow.ts (Master): the
 * customer response carries nothing about how the data is gathered, and no
 * type here may grow such a field. A customer cannot switch collection on
 * or off; that stays in the Master console.
 *
 * Devices, destinations and services are three INDEPENDENT lists: no
 * response pairs a device with a destination or a service.
 */
import type {
  FlowBoundedList,
  FlowDestinationItem,
  FlowDeviceMatch,
  FlowSummary,
} from "@/types/traffic-flow";

/** The add-on's key in `GET /me/entitlements` and in the 402 body. */
export const TRAFFIC_LENS_FEATURE_KEY = "traffic_flow";

/** The only thing the customer is told about the venue's equipment. */
export type LensCollection = "collecting" | "not_collecting_yet" | "not_available";

/** GET /traffic-flow/locations/{id}/status. No traffic figures. */
export interface LensStatus {
  location_id: string;
  collection: LensCollection;
  /** END of the newest 5-minute period held. null = nothing held. */
  latest_data: string | null;
  /** Start of the oldest period held. null = nothing held. */
  data_starts: string | null;
  window_seconds: number;
  retention_days: number;
}

/** A device is its local address. Nothing else is sent: no name, no phone
 * number, no MAC, no host name. */
export interface LensDeviceItem {
  router_id: string | null;
  ip: string;
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
  share_at_least: number;
  match: FlowDeviceMatch;
  /** Set only when `match` is "session". */
  guest_session_id: string | null;
}

/** Destinations are for the venue as a whole. A 5-minute period in which
 * fewer than `min_devices` devices were seen contributes nothing. */
export interface LensDestinations extends FlowBoundedList<FlowDestinationItem> {
  min_devices: number | null;
  /** How many periods in the range were left out for that reason. */
  windows_withheld: number | null;
}

/** GET /traffic-flow/locations/{id}/summary: the Master summary without
 * `feature_enabled`, plus the venue's collection state. */
export interface LensSummary extends Omit<
  FlowSummary,
  "feature_enabled" | "devices" | "destinations"
> {
  location_id: string;
  collection: LensCollection;
  latest_data: string | null;
  devices: FlowBoundedList<LensDeviceItem> | null;
  destinations: LensDestinations | null;
}
