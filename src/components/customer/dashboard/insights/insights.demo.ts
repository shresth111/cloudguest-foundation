/**
 * DEMO WORKSPACE ONLY. Fixture bodies for the three venue-insight cards,
 * returned by `useInsights.ts` exclusively when `useIsDemo()` is true -- the
 * same posture as `getDashboard()` / `useWanSummary` / the device store,
 * which all carry their demo fixtures behind that one check. A real session
 * never reaches this module's values: the hooks only read it on the demo
 * branch, and scripts/test-insights-demo-gate.mjs pins that.
 *
 * Shaped exactly like the real wire bodies (insights.types.ts) so the cards
 * render them through the same code path as real data.
 */
import type { GuestMixData, LoginFunnelData, PeakHoursData } from "./insights.types";

/** Rough café/hotel rhythm: quiet nights, a lunch bump, a long evening,
 * busier weekends. Deterministic, so screenshots are stable. */
function demoCells(): PeakHoursData["cells"] {
  const cells: PeakHoursData["cells"] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const weekend = weekday >= 6;
    for (let hour = 0; hour < 24; hour++) {
      const night = hour < 7 ? 0.05 : 0;
      const morning = hour >= 8 && hour <= 10 ? 0.45 : 0;
      const lunch = hour >= 12 && hour <= 14 ? 0.8 : 0;
      const evening = hour >= 18 && hour <= 22 ? 1 : 0;
      const afternoon = hour >= 15 && hour <= 17 ? 0.5 : 0;
      const base = Math.max(night, morning, lunch, evening, afternoon, hour >= 7 ? 0.2 : 0);
      const wiggle = ((weekday * 7 + hour * 13) % 5) / 20;
      const sessions = Math.round((base + wiggle) * (weekend ? 46 : 32));
      if (sessions > 0) {
        cells.push({ weekday, hour, sessions, guests: Math.max(1, Math.round(sessions * 0.8)) });
      }
    }
  }
  return cells;
}

const DAY = 86_400_000;

export function demoPeakHours(locationId: string, days: number): PeakHoursData {
  const end = new Date();
  const cells = demoCells();
  return {
    location_id: locationId,
    timezone: "Asia/Kolkata",
    window_start: new Date(end.getTime() - days * DAY).toISOString(),
    window_end: end.toISOString(),
    total_sessions: cells.reduce((a, c) => a + c.sessions, 0),
    cells,
  };
}

export function demoGuestMix(locationId: string, days: number): GuestMixData {
  const end = new Date();
  return {
    location_id: locationId,
    timezone: "Asia/Kolkata",
    window_start: new Date(end.getTime() - days * DAY).toISOString(),
    window_end: end.toISOString(),
    unique_guests: 1840,
    new_guests: 1104,
    returning_guests: 736,
    sessions: 3920,
    multi_visit_guests: 612,
    repeat_visit_rate_percent: 33.3,
    history_starts_at: new Date(end.getTime() - 180 * DAY).toISOString(),
    has_prior_history: true,
  };
}

export function demoLoginFunnel(locationId: string, days: number): LoginFunnelData {
  const end = new Date();
  return {
    location_id: locationId,
    window_start: new Date(end.getTime() - days * DAY).toISOString(),
    window_end: end.toISOString(),
    otp_codes_sent: 2310,
    otp_requested_guests: 1760,
    otp_verified_guests: 1612,
    otp_signed_in_guests: 1612,
    portal_opened: {
      available: true,
      count: 2480,
      devices: 2015,
      tracked_since: new Date(end.getTime() - 120 * DAY).toISOString(),
    },
    internet_confirmed: {
      available: true,
      count: 1702,
      otp_guests: 1612,
      sessions: 3610,
      tracked_since: new Date(end.getTime() - 120 * DAY).toISOString(),
      note: null,
    },
    methods: [
      { auth_method: "otp_sms", successful_logins: 2140, failed_logins: 96, guests: 1310 },
      { auth_method: "otp_whatsapp", successful_logins: 612, failed_logins: 18, guests: 264 },
      { auth_method: "voucher", successful_logins: 188, failed_logins: 11, guests: 121 },
      { auth_method: "mac_whitelist", successful_logins: 74, failed_logins: 0, guests: 9 },
    ],
  };
}
