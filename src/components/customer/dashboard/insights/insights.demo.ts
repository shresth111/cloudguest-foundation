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
import type {
  GuestMixData,
  LocationComparisonData,
  LoginFunnelData,
  PeakHoursData,
} from "./insights.types";
import {
  DEMO_HISTORY_DAYS,
  DEMO_ORG,
  DEMO_VENUES,
  demoGuestCounts,
  demoMethodOf,
  demoNow,
  demoRoster,
  demoRouterIsLive,
  demoSessionsIn,
} from "@/lib/demo-world";

/*
 * Every number here is COUNTED from the venue's demo roster in
 * `@/lib/demo-world` -- the same list behind the dashboard's guest tiles
 * and the Guests page -- so a card cannot disagree with those screens, and
 * each venue has its own figures (they used to be one set of constants,
 * identical at every venue).
 */

const DAY = 86_400_000;

function windowOf(days: number) {
  const end = demoNow();
  return { start: end - days * DAY, end };
}

/** ISO weekday, 1 = Monday ... 7 = Sunday. */
const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

export function demoPeakHours(locationId: string, days: number): PeakHoursData {
  const { start, end } = windowOf(days);
  const roster = demoRoster(locationId, end);
  const [a, b] = demoSessionsIn(roster, start, end);
  const cell = new Map<string, { sessions: number; guests: Set<number> }>();
  for (let i = a; i < b; i++) {
    const d = new Date(roster.start[i]);
    const key = `${isoWeekday(d)}:${d.getHours()}`;
    const c = cell.get(key) ?? { sessions: 0, guests: new Set<number>() };
    c.sessions += 1;
    c.guests.add(roster.guest[i]);
    cell.set(key, c);
  }
  const cells: PeakHoursData["cells"] = [...cell.entries()].map(([k, c]) => {
    const [weekday, hour] = k.split(":").map(Number);
    return { weekday, hour, sessions: c.sessions, guests: c.guests.size };
  });
  return {
    location_id: locationId,
    timezone: "Asia/Kolkata",
    window_start: new Date(start).toISOString(),
    window_end: new Date(end).toISOString(),
    total_sessions: b - a,
    cells,
  };
}

export function demoGuestMix(locationId: string, days: number): GuestMixData {
  const { start, end } = windowOf(days);
  const roster = demoRoster(locationId, end);
  const [a, b] = demoSessionsIn(roster, start, end);
  const visits = new Map<number, number>();
  for (let i = a; i < b; i++) visits.set(roster.guest[i], (visits.get(roster.guest[i]) ?? 0) + 1);
  let fresh = 0;
  let multi = 0;
  for (const [g, n] of visits) {
    if (roster.firstSeen[g] >= start) fresh += 1;
    if (n > 1) multi += 1;
  }
  const unique = visits.size;
  const historyStart = end - DEMO_HISTORY_DAYS * DAY;
  return {
    location_id: locationId,
    timezone: "Asia/Kolkata",
    window_start: new Date(start).toISOString(),
    window_end: new Date(end).toISOString(),
    unique_guests: unique,
    new_guests: fresh,
    returning_guests: unique - fresh,
    sessions: b - a,
    multi_visit_guests: multi,
    repeat_visit_rate_percent: unique ? Math.round((multi / unique) * 1000) / 10 : null,
    history_starts_at: new Date(historyStart).toISOString(),
    has_prior_history: start > historyStart,
  };
}

export function demoLoginFunnel(locationId: string, days: number): LoginFunnelData {
  const { start, end } = windowOf(days);
  const roster = demoRoster(locationId, end);
  const [a, b] = demoSessionsIn(roster, start, end);
  const byMethod = new Map<string, { logins: number; guests: Set<number> }>();
  const otpGuests = new Set<number>();
  for (let i = a; i < b; i++) {
    const m = demoMethodOf(roster, i);
    const e = byMethod.get(m) ?? { logins: 0, guests: new Set<number>() };
    e.logins += 1;
    e.guests.add(roster.guest[i]);
    byMethod.set(m, e);
    if (m === "otp_sms" || m === "otp_whatsapp") otpGuests.add(roster.guest[i]);
  }
  const signedIn = otpGuests.size;
  const otpLogins =
    (byMethod.get("otp_sms")?.logins ?? 0) + (byMethod.get("otp_whatsapp")?.logins ?? 0);
  // A few guests ask for a code and never use it; a few mistype it once.
  const requested = signedIn + Math.round(signedIn * 0.07);
  const sessions = b - a;
  const failedOf = (m: string, n: number) =>
    m === "mac_whitelist" ? 0 : Math.round(n * (m === "voucher" ? 0.06 : 0.04));
  return {
    location_id: locationId,
    window_start: new Date(start).toISOString(),
    window_end: new Date(end).toISOString(),
    otp_codes_sent: otpLogins + Math.round(otpLogins * 0.12),
    otp_requested_guests: requested,
    otp_verified_guests: signedIn,
    otp_signed_in_guests: signedIn,
    portal_opened: {
      available: true,
      count: Math.round(sessions * 1.18),
      devices: Math.round(sessions * 0.92),
      tracked_since: new Date(end - 120 * DAY).toISOString(),
    },
    internet_confirmed: {
      available: true,
      count: Math.round(sessions * 0.97),
      otp_guests: Math.round(signedIn * 0.97),
      sessions: Math.round(sessions * 0.97),
      tracked_since: new Date(end - 120 * DAY).toISOString(),
      note: null,
    },
    methods: (["otp_sms", "otp_whatsapp", "voucher", "mac_whitelist"] as const)
      .filter((m) => byMethod.has(m))
      .map((m) => {
        const e = byMethod.get(m)!;
        return {
          auth_method: m,
          successful_logins: e.logins,
          failed_logins: failedOf(m, e.logins),
          guests: e.guests.size,
        };
      }),
  };
}

/** Every demo venue side by side, for the venue comparison card. Same
 * roster counts and the same router check-ins as every other screen. */
export function demoLocationComparison(days: number): LocationComparisonData {
  const { start, end } = windowOf(days);
  return {
    organization_id: DEMO_ORG.id,
    window_start: new Date(start).toISOString(),
    window_end: new Date(end).toISOString(),
    liveness_note: "Router status is right now; guests and connections cover the whole period.",
    locations: DEMO_VENUES.map((v) => {
      const c = demoGuestCounts(v.id, start, end, end);
      const last = v.routers.length
        ? Math.min(...v.routers.map((r) => r.lastSeenMinutesAgo))
        : null;
      return {
        location_id: v.id,
        location_name: v.name,
        guests: c.guests,
        sessions: c.sessions,
        routers_total: v.routers.length,
        routers_online: v.routers.filter(demoRouterIsLive).length,
        last_router_seen_at: last === null ? null : new Date(end - last * 60_000).toISOString(),
      };
    }),
  };
}
