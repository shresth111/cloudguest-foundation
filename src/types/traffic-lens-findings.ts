/**
 * Traffic Lens findings: wire types for the "Findings API" section of
 * wyfy-specs/flow-visibility/API.md. One shape for the Master route
 * (`/platform/traffic-flow/findings`) and the customer route
 * (`/traffic-flow/locations/{id}/findings`); the customer one has no
 * `feature_enabled` and adds the two small-venue fields.
 *
 * A finding names a device OR a destination OR a service OR nothing
 * (`names`), never a device and a destination together. No type here may
 * grow a field that would hold both.
 */
import type { FlowDeviceMatch } from "@/types/traffic-flow";

export type FindingId =
  | "upload_heavy"
  | "quiet_hours_traffic"
  | "dominant_device"
  | "unusual_service"
  | "known_bad_destinations";

/** `could_not_check` is never shown as `clear`. */
export type FindingState = "flagged" | "clear" | "could_not_check";

/** Only `act` may use alarm styling. */
export type FindingSeverity = "info" | "look" | "act";

export type FindingReason =
  | "feature_off"
  | "not_measured"
  | "not_enough_traffic"
  | "baseline_too_short"
  | "no_quiet_hours"
  | "too_few_devices"
  | "no_device_list"
  | "services_not_measured"
  | "destinations_not_measured"
  | "list_unavailable"
  | "list_stale"
  | "withheld_small_venue";

/** The device identity, exactly as the top-devices list returns it. */
export interface FindingDevice {
  router_id: string | null;
  ip: string | null;
  match: FlowDeviceMatch | string | null;
  guest_session_id: string | null;
}

export interface Finding {
  id: FindingId | string;
  state: FindingState;
  /** Set only when `could_not_check`. A string so a reason added on the
   * server later still renders ("could not be checked"). */
  reason: FindingReason | string | null;
  /** Set only when `flagged`. */
  severity: FindingSeverity | null;
  names: "nothing" | "device" | "destination" | "service";
  period?: { since: string; until: string };
  /** What a sentence needs; only when `flagged`. Read defensively. */
  parts: Record<string, unknown> | null;
  /** The numbers behind it; present in every state. */
  evidence: Record<string, unknown>;
  thresholds: Record<string, unknown>;
}

export interface FindingsThreatList {
  name: string;
  available: boolean;
  /** The list's own date, YYYY-MM-DD. null when it is not on the server. */
  date: string | null;
  stale: boolean;
  max_age_days: number;
  entries: number;
  copyright?: string | null;
  credit: { text: string; url: string; terms_url?: string };
}

export interface FindingsResponse {
  /** Master only. */
  feature_enabled?: boolean;
  location_id: string;
  measured: boolean;
  since: string;
  until: string;
  window_seconds: number;
  windows: number;
  data_oldest: string | null;
  data_newest: string | null;
  baseline: { since: string; until: string; days: number; derived: boolean; timezone: string };
  counts: Record<FindingState, number>;
  /** Always false in this version: nothing is sent anywhere. */
  notifications: boolean;
  threat_list: FindingsThreatList;
  findings: Finding[];
  /** Customer only. */
  min_devices?: number;
  windows_withheld?: number;
}
