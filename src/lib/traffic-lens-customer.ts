/**
 * Traffic Lens on the CUSTOMER dashboard: which screen to show, and its
 * words. Pure, so scripts/test-traffic-flow.mjs can test it.
 *
 * Arithmetic and formatting come from src/lib/traffic-lens-shared.ts, the
 * same functions the Master page uses. This file adds only what differs for
 * a venue owner:
 *
 *  - The screen is decided from three answers the backend gives (the add-on
 *    entitlement, the venue's collection state, the summary), never from
 *    anything the browser guesses.
 *  - No sentence here says how the data is gathered. A venue owner is told
 *    what they can see and who to ask, not how it works. The test script
 *    fails the build if one of the operator words appears in this file.
 *  - Unmeasured is never zero, here as there.
 */
import { TRAFFIC_FLOW_MODULE_NAME, clockLabel, formatAgo, isNum } from "@/lib/traffic-lens-shared";
import type { FlowDeviceMatch, FlowWindow } from "@/types/traffic-flow";
import type { LensCollection, LensDestinations, LensStatus } from "@/types/traffic-lens";

/** The name on the customer nav row and page. Same constant as Master. */
export const TRAFFIC_LENS_NAME = TRAFFIC_FLOW_MODULE_NAME;

/** The fixed line under the title (PRODUCT.md, C1). */
export const LENS_TAGLINE =
  "Shows how much traffic each device used and which outside networks the venue's traffic went to. It does not show which sites a particular guest visited.";

/** Subjects of the two support tickets this page can file. Also how an
 * already-open request is recognised, so each is one constant. */
export const LENS_ENABLE_SUBJECT = `Enable ${TRAFFIC_LENS_NAME} add-on`;
export const LENS_SWITCH_ON_SUBJECT = `Switch on ${TRAFFIC_LENS_NAME} for a venue`;

/** Band colours for the timeline on the customer dashboard, in fixed order:
 * four of its own chart tokens, chosen so neighbours differ in hue (the
 * second teal token sits too close to the first to tell apart). A fifth
 * service folds into "Other" rather than getting an invented colour. */
export const LENS_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--chart-4)",
] as const;

/** The period the page is looking at. One type and one control
 * (`LensRangeControl`) on purpose: a custom start and end is one more
 * `kind` here and one more input there, and every view reads the same
 * bounds from `lensRangeBounds`. */
export type LensRange = { kind: "preset"; window: FlowWindow };

export const LENS_PRESETS: { value: FlowWindow; label: string; ms: number }[] = [
  { value: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { value: "6h", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  // The longest the backend accepts, and the longest it keeps.
  { value: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
];

export const LENS_DEFAULT_RANGE: LensRange = { kind: "preset", window: "1h" };

/** Explicit bounds for a range, ending at `now` for a preset. Every block
 * on the page is requested with these, so they all describe one period. */
export function lensRangeBounds(
  range: LensRange,
  now: number,
): { since: string; until: string; ms: number } {
  const ms = (LENS_PRESETS.find((p) => p.value === range.window) ?? LENS_PRESETS[0]).ms;
  return { since: new Date(now - ms).toISOString(), until: new Date(now).toISOString(), ms };
}

/** The page's views. One today; the tab strip appears by itself once a
 * second entry is added here, and each view gets the same venue and range. */
export const LENS_VIEWS: { id: "overview"; label: string }[] = [
  { id: "overview", label: "Overview" },
];

export type LensRefusal = "locked" | "licence" | "forbidden" | null;

/** Why a request was refused, from its HTTP status and the backend's error
 * code. 402 = the add-on is off (or the whole licence lapsed). 403 and 404
 * both mean "not yours" -- the permission check can answer 403 before the
 * 404 is reached -- so they are one case. Anything else is a real failure
 * and returns null. */
export function lensRefusalFrom(
  status: number | null | undefined,
  errorCode: unknown,
): LensRefusal {
  if (status === 402) return errorCode === "license_not_active" ? "licence" : "locked";
  if (status === 403 || status === 404) return "forbidden";
  return null;
}

/**
 * The page's screens, most-blocking first.
 *
 *  - demo           the demo account: no data exists and none is invented
 *  - locked         add-on not enabled for this customer
 *  - licence        the organisation's licence is not active
 *  - forbidden      this sign-in may not see this venue's traffic
 *  - loading
 *  - failed         the request failed; not an empty venue
 *  - not_available  the venue's equipment cannot report traffic detail
 *  - not_switched_on  can report, nothing has ever arrived
 *  - data           show the summary (with a "No data since" notice when
 *                   `stopped` is set, and "Not measured" inside when the
 *                   chosen period holds nothing)
 */
export type LensScreen =
  | { kind: "demo" }
  | { kind: "locked" }
  | { kind: "licence" }
  | { kind: "forbidden" }
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "not_available" }
  | { kind: "not_switched_on" }
  | { kind: "data"; stopped: boolean };

export function lensScreen(input: {
  demo: boolean;
  /** `/me/entitlements`: true / false, or null while unknown. */
  entitled: boolean | null;
  statusLoading: boolean;
  statusRefusal: LensRefusal;
  statusFailed: boolean;
  status: Pick<LensStatus, "collection" | "latest_data"> | null | undefined;
}): LensScreen {
  if (input.demo) return { kind: "demo" };
  // The backend's refusal is the truth. `/me/entitlements` saying "off" only
  // lets the lock screen show without waiting for a request that will 402;
  // it is never what unlocks the page.
  if (input.statusRefusal === "locked" || input.entitled === false) return { kind: "locked" };
  if (input.statusRefusal === "licence") return { kind: "licence" };
  if (input.statusRefusal === "forbidden") return { kind: "forbidden" };
  if (input.statusFailed) return { kind: "failed" };
  if (input.statusLoading || !input.status) return { kind: "loading" };
  const c: LensCollection | string = input.status.collection;
  if (c === "not_available") return { kind: "not_available" };
  if (c === "collecting") return { kind: "data", stopped: false };
  if (c === "not_collecting_yet")
    return input.status.latest_data ? { kind: "data", stopped: true } : { kind: "not_switched_on" };
  // A state this screen does not know is not dressed up as working.
  return { kind: "failed" };
}

export interface LensNotice {
  title: string;
  body: string;
  /** Offer the "ask Wyfy" support-ticket button. */
  ask: boolean;
}

/** Words for every screen that is not the data view. */
export const LENS_NOTICES: Record<
  "demo" | "licence" | "forbidden" | "failed" | "not_available" | "not_switched_on",
  LensNotice
> = {
  demo: {
    title: `${TRAFFIC_LENS_NAME} is not part of the demo account.`,
    body: "It shows a real venue's traffic, and the demo has none. No sample figures are shown in its place.",
    ask: false,
  },
  licence: {
    title: "Your licence is not active.",
    body: `${TRAFFIC_LENS_NAME} is unavailable until the licence is renewed. Nothing has been deleted.`,
    ask: false,
  },
  forbidden: {
    title: "You do not have access to this venue's traffic.",
    body: `${TRAFFIC_LENS_NAME} is open to the organisation owner only. Nothing is shown, because this is not an empty venue.`,
    ask: false,
  },
  failed: {
    title: `Couldn't load ${TRAFFIC_LENS_NAME}.`,
    body: "The request failed. Nothing is shown, because a failed request is not an empty venue. Try again in a moment.",
    ask: false,
  },
  not_available: {
    title: `${TRAFFIC_LENS_NAME} is not available at this venue.`,
    body: "This venue's WiFi equipment does not report traffic detail.",
    ask: false,
  },
  not_switched_on: {
    title: `${TRAFFIC_LENS_NAME} is not switched on for this venue yet.`,
    body: "Wyfy support switches it on for you. Until then nothing is measured here, which is not the same as no traffic.",
    ask: true,
  },
};

/** "Latest data: 14:05 (5 min ago)". `latest_data` is already the END of the
 * newest period held. Never the word "live". */
export function lensFreshness(latestData: string | null | undefined, now: number): string {
  const at = clockLabel(latestData, now);
  if (!at || !latestData) return "Latest data: none yet.";
  return `Latest data: ${at} (${formatAgo(latestData, now)})`;
}

/** The notice above the data when the venue has stopped reporting. null
 * while data is arriving. */
export function lensStoppedNotice(
  stopped: boolean,
  latestData: string | null | undefined,
  now: number,
): LensNotice | null {
  if (!stopped) return null;
  const since = clockLabel(latestData, now);
  return {
    title: since ? `No data since ${since}.` : "No recent data.",
    body: "Nothing after that time has been measured. Earlier figures are still shown below; a quiet-looking chart after that point is missing data, not an idle venue.",
    ask: true,
  };
}

/** Collecting, but the chosen period holds nothing. Says where data starts
 * when the backend knows. Never a zero, never "no traffic". */
export function lensNotMeasured(dataOldest: string | null | undefined, now: number): LensNotice {
  const starts = clockLabel(dataOldest, now);
  return {
    title: "Not measured for this period.",
    body: starts
      ? `Data starts ${starts}. Nothing was recorded for the period you picked. That is not the same as no traffic.`
      : "Nothing was recorded for the period you picked. That is not the same as no traffic.",
    ask: false,
  };
}

/** Who a device is, in the words Guest Connection Records uses. The API
 * sends no name or number; a guest's details stay on that screen, behind
 * its own permission. */
export function lensDeviceLabel(match: FlowDeviceMatch | string | null | undefined): string {
  if (match === "session") return "Guest login";
  if (match === "ambiguous") return "Could not tell which guest";
  if (match === "none") return "Not a guest login";
  return "Not known";
}

export type LensDestinationsState =
  /** Every period was left out: say why, never "no destinations". */
  | { kind: "all_withheld"; message: string }
  | { kind: "empty"; note: string | null }
  | { kind: "rows"; note: string | null };

/** The small-venue rule, in plain words. A 5-minute period with fewer than
 * `min_devices` devices connected adds nothing to the destinations list, so
 * that the list cannot point at one person. When any period was left out
 * the page says so; it never shows a shorter list silently. */
export function lensDestinationsState(
  destinations: LensDestinations | null | undefined,
  windows: number | null | undefined,
): LensDestinationsState {
  const items = destinations?.items ?? [];
  const withheld = isNum(destinations?.windows_withheld) ? destinations.windows_withheld : 0;
  const min = isNum(destinations?.min_devices) ? destinations.min_devices : null;
  const few = min !== null ? `fewer than ${min} devices` : "only a few devices";
  if (withheld > 0 && isNum(windows) && withheld >= windows)
    return {
      kind: "all_withheld",
      message: `Not shown while ${few} are connected. With so few devices, the venue's destinations would in effect be one person's.`,
    };
  const note =
    withheld > 0
      ? `${withheld}${isNum(windows) ? ` of ${windows}` : ""} five-minute period${withheld === 1 ? "" : "s"} in this range ${withheld === 1 ? "is" : "are"} left out of this list, because ${few} were connected then. Traffic from those periods is still counted in the totals and services above.`
      : null;
  return items.length === 0 ? { kind: "empty", note } : { kind: "rows", note };
}

/** The footnote under a lower-bound list, in a venue owner's words. */
export function lensLowerBoundNote(
  lowerBound: boolean,
  list: "devices" | "destinations",
): string | null {
  if (!lowerBound) return null;
  const what = list === "devices" ? "device" : "address";
  return `These are minimums. Only the busiest ${what === "device" ? "devices" : "addresses"} of each five-minute period are kept, so a ${what} that was just outside them for part of the time used more than is shown. Read every figure as "at least".`;
}

/** What the page does and does not do: the lock screen's three lines. */
export const LENS_LOCKED_POINTS: string[] = [
  "See what your venue's internet traffic is made of: web, video calls, DNS and other services, over the last hour, day or week.",
  "See which devices used the most, and which outside networks the venue's traffic went to.",
  "It does not show which sites a particular guest visited, and it does not look inside any traffic.",
];
