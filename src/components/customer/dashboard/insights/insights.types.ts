/**
 * Shapes returned by `GET /analytics/venue-insights/*` (backend:
 * app/domains/analytics/venue_insights.py), already unwrapped from the
 * ApiResponse envelope by the api client. Snake case on purpose: these are
 * the wire types, rendered directly -- no mapping layer to drift.
 */

export interface PeakHourCell {
  /** ISO weekday in the venue's timezone: 1 = Monday ... 7 = Sunday. */
  weekday: number;
  /** 0-23 in the venue's timezone. */
  hour: number;
  sessions: number;
  guests: number;
}

export interface PeakHoursData {
  location_id: string;
  timezone: string;
  window_start: string;
  window_end: string;
  total_sessions: number;
  /** Only non-zero cells. */
  cells: PeakHourCell[];
}

export interface GuestMixData {
  location_id: string;
  timezone: string;
  window_start: string;
  window_end: string;
  unique_guests: number;
  new_guests: number;
  returning_guests: number;
  sessions: number;
  multi_visit_guests: number;
  repeat_visit_rate_percent: number | null;
  history_starts_at: string | null;
  has_prior_history: boolean;
}

/** A stage this venue cannot report; `message` says why (per venue). */
export interface FunnelStageUnavailable {
  available: false;
  message: string;
}

/** `portal_impressions` in the window: page loads, one device's reloads
 * within ten minutes collapsed. `devices` counts only loads that carried a
 * MAC. `tracked_since` is the venue's first recorded load (null = none yet). */
export interface PortalOpenedStage {
  available: true;
  count: number;
  devices: number;
  tracked_since: string | null;
}

/** Sessions the router/controller itself reported as online in the window.
 * `count` = distinct guests (every method); `otp_guests` = distinct guests on
 * an OTP session, the number to compare with `otp_signed_in_guests`. `note`
 * is set when only some of the venue's routers can report this. */
export interface InternetConfirmedStage {
  available: true;
  count: number;
  otp_guests: number;
  sessions: number;
  tracked_since: string | null;
  note?: string | null;
}

export type PortalOpened = PortalOpenedStage | FunnelStageUnavailable;
export type InternetConfirmed = InternetConfirmedStage | FunnelStageUnavailable;

export interface LoginMethodItem {
  auth_method: string;
  successful_logins: number;
  failed_logins: number;
  guests: number;
}

export interface LoginFunnelData {
  location_id: string;
  window_start: string;
  window_end: string;
  otp_codes_sent: number;
  otp_requested_guests: number;
  otp_verified_guests: number;
  otp_signed_in_guests: number;
  portal_opened: PortalOpened;
  internet_confirmed: InternetConfirmed;
  methods: LoginMethodItem[];
}

export interface LocationComparisonItem {
  location_id: string;
  location_name: string;
  guests: number;
  sessions: number;
  routers_total: number;
  routers_online: number;
  last_router_seen_at: string | null;
}

export interface LocationComparisonData {
  organization_id: string;
  window_start: string;
  window_end: string;
  liveness_note: string;
  locations: LocationComparisonItem[];
}

/** Window lengths the widgets accept. The backend caps a window at 92 days. */
export type InsightRangeDays = 7 | 28 | 90;

export const DEFAULT_INSIGHT_RANGE_DAYS: InsightRangeDays = 28;
