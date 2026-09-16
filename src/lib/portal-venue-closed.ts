import type { AppError } from "@/services/api";

/**
 * "Was this 403 the venue being closed, or something else?"
 *
 * Open Hours is enforced on the backend at the login chokepoint
 * (`GuestService._require_venue_open` -> `VenueClosedError`, reached from
 * every authenticated login method and from the MAC-whitelist/RADIUS
 * authorize path), so a guest submitting the sign-in card outside the
 * venue's own schedule is refused there rather than signed in.
 *
 * The refusal is a plain 403, and `toAppError` collapses every 403 to
 * `code: "forbidden"`, so without a discriminator the portal can only show
 * it as a red line under the field -- which is not what "outside those
 * hours, guests see a 'we're closed' message instead of a working login
 * screen" promises, and leaves the guest staring at a form that cannot
 * work. Founder QA: "after complete login should show mentioned message".
 *
 * So this routes that refusal to `/portal/closed`, which renders the venue's
 * own `businessHoursClosedMessage` -- the same screen the portal already
 * shows when the venue is closed at page load.
 *
 * ## Two ways to recognise it, in this order
 *
 * 1. `data.code === "venue_closed"`. `VenueClosedError` carries this
 *    explicitly (the same contract `WhitelistOnlyAccessDeniedError` keeps
 *    for its own refusal). This is the real answer and is checked first.
 * 2. The message string, matched against the two values it can provably
 *    be: the venue's own `business_hours_closed_message`, which this portal
 *    already holds from `GET /captive-portal/resolve`, or the backend's
 *    fixed default. The exception's constructor is literally
 *    `closed_message or "<default>"`, so an exact match identifies it
 *    precisely.
 *
 * The string half exists only so a portal released between the backend
 * change and this one still behaves, and it degrades to the generic auth
 * error rather than to a wrong screen -- never to a leak: `/portal/closed`
 * renders the venue message it resolved itself, never `AppError.message`.
 */

/** Mirrors `VenueClosedError`'s default in the backend's
 * `app/domains/guest/exceptions.py`, byte for byte. Copied rather than
 * imported because the two live in different repositories. */
export const BACKEND_DEFAULT_VENUE_CLOSED_MESSAGE = "This WiFi network is closed right now.";

const VENUE_CLOSED_CODES = new Set(["venue_closed", "venueclosederror"]);

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function codeOf(e: AppError): string | undefined {
  const raw = e.data?.["code"] ?? e.data?.["error_code"];
  return typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
}

/**
 * True when `e` is the backend refusing this guest because the venue's Open
 * Hours say it is closed right now.
 *
 * @param venueClosedMessage the venue's own `businessHoursClosedMessage`
 *   from the resolved portal config, when it has set one. Passing it lets a
 *   customised refusal be recognised as precisely as the default one;
 *   omitting it only narrows the match, never widens it.
 */
export function isVenueClosedRefusal(e: AppError, venueClosedMessage?: string | null): boolean {
  // An authorization decision on a well-formed request, so always a 403 --
  // checked first so a venue that (perversely) set its closed message to the
  // text of some unrelated 400/500 error cannot be mistaken for one.
  if (e.status !== 403) return false;

  const code = codeOf(e);
  if (code !== undefined && VENUE_CLOSED_CODES.has(code)) return true;

  const message = normalize(e.message ?? "");
  if (!message) return false;

  if (message === normalize(BACKEND_DEFAULT_VENUE_CLOSED_MESSAGE)) return true;

  const venue = venueClosedMessage?.trim();
  if (venue && message === normalize(venue)) return true;

  return false;
}
