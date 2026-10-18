/**
 * Customer NetLogs wire types -- `GET /api/v1/device-logs`, `/summary` and
 * `/export.csv` (cloud-guest#420, `app/domains/device_logs/schemas.py`:
 * `NetLogEventView`, `NetLogPage`, `NetLogSummary`).
 *
 * Deliberately narrower than the Master viewer's `DeviceLogEventView`: no
 * `source_ip` (the router's tunnel address), no `claimed_tag`, no
 * `attribution`. Those are Master-only and the backend does not send them
 * here, so they must not be added to these types either.
 */

export type NetLogSource = "syslog" | "radius_server" | "captive_portal";

export interface NetLogEvent {
  id: number;
  /** When the platform received the line; every filter uses this time. */
  received_at: string;
  /** The router's own clock, best-effort; null for platform-written rows. */
  device_time: string | null;
  location_id: string | null;
  location_name: string | null;
  router_id: string | null;
  router_name: string | null;
  /** The router's identity as it sent it (or the NAS identifier). */
  hostname: string | null;
  source: NetLogSource | string;
  /** Never null: unclassified lines read `other`. */
  category: string;
  protocol: string | null;
  src_ip: string | null;
  dst_ip: string | null;
  /** null when the line states no outcome -- never a guessed success. */
  status: string | null;
  device_mac: string | null;
  severity: number | null;
  severity_name: string | null;
  /** Short headline, or null: show `message`. */
  summary: string | null;
  message: string;
}

export interface NetLogPage {
  feature_enabled: boolean;
  items: NetLogEvent[];
  /** Pass back as `cursor` for the next (older) page; null = last page. */
  next_cursor: string | null;
  since: string;
  until: string;
}

export interface NetLogTotals {
  events: number;
  errors: number;
  warnings: number;
}

export interface NetLogDay {
  /** Local date in the summary's `timezone`, `YYYY-MM-DD`. */
  day: string;
  total: number;
  errors: number;
  warnings: number;
  by_category: Record<string, number>;
}

export interface NetLogTopRouter {
  router_id: string | null;
  router_name: string | null;
  location_id: string | null;
  location_name: string | null;
  total: number;
  errors: number;
  warnings: number;
}

export interface NetLogSummary {
  feature_enabled: boolean;
  since: string;
  until: string;
  timezone: string;
  totals: NetLogTotals;
  /** Only days with at least one event, ascending. */
  by_day: NetLogDay[];
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  top_routers: NetLogTopRouter[];
}
