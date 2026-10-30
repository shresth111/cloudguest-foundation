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

export interface FunnelStageUnavailable {
  available: false;
  message: string;
}

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
  portal_opened: FunnelStageUnavailable;
  internet_confirmed: FunnelStageUnavailable;
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
