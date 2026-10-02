/**
 * The customer's Aruba Instant On venue card, the pure half: what it says and
 * how it turns the dashboard read into numbers. Pure so
 * `scripts/test-aruba-instant-on.mjs` can exercise it. See
 * `src/components/customer/ArubaInstantOnVenueCard.tsx`.
 */

/** What Wyfy does at this venue, and what lives in the Instant On app. The
 * second list is PM_SPEC §3's UNSUPPORTED rows, in the owner's words. */
export const ARUBA_VENUE_IN_WYFY: readonly string[] = [
  "Your sign-in page, sign-in methods and offers",
  "Who signed in, when, and on which device",
  "Vouchers, and stopping someone signing in again",
];
export const ARUBA_VENUE_IN_INSTANT_ON: readonly string[] = [
  "WiFi name, password and guest network",
  "Speed limits for guests",
  "Websites guests can open before signing in (Allowed domains)",
  "Access point status, firmware and connected devices",
];

/** "No sign-ins in the last 24 hours" is a fact the read established; "—" is
 * for when it did not. Exported for the test suite. */
export function arubaVenueStats(
  data:
    | {
        kpis: { onlineUsers: number; todayGuests: number; sessionsReadFailed?: boolean };
        recentUsers: { time: string }[];
      }
    | undefined,
  failed: boolean,
): { online: string; today: string; lastSignIn: string } {
  if (!data || failed || data.kpis.sessionsReadFailed) {
    return { online: "—", today: "—", lastSignIn: "—" };
  }
  return {
    online: String(data.kpis.onlineUsers),
    today: String(data.kpis.todayGuests),
    lastSignIn: data.recentUsers[0]?.time ?? "None in the last 24 hours",
  };
}
