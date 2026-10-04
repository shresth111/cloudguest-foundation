/**
 * Access Rules -> Access Tiers at an Aruba Instant On (NAS-only) venue: the
 * pure half. Copy, form validation and the "where is this tier used" summary.
 * Pure so `scripts/test-access-tiers-aruba.mjs` can bundle and exercise it.
 *
 * SCOPE: Aruba Instant On venues only. Every caller gates on
 * `isNasOnlyVendor(vendor)`, so the Access Tiers tab at a MikroTik or Omada
 * venue renders and saves exactly as it did before (owner instruction,
 * 2026-10-04: leave MikroTik and Omada as they are).
 *
 * WHAT IS TRUE AT AN INSTANT ON VENUE (~/wyfy-ops/aruba-ap21/ACCESS_RULES.md
 * for the measured AP behaviour; ~/wyfy-ops/ACCESS_TIERS.md for the tier
 * contract -- cloud-guest `feat/access-tiers-enforced`):
 *  - The tier's own BANDWIDTH rules are the source of truth. The backend
 *    overlays `session_timeout_minutes`, `idle_timeout_minutes`,
 *    `devices_per_user`, `daily_limit_minutes`, `data_limit` and
 *    `login_hours` onto every sign-in / RADIUS / sweep resolution for a guest
 *    MAPPED INTO the tier (a guest-targeted assignment). No paired FUP policy:
 *    its untargeted location mirror would replace the venue's own Guest WiFi
 *    Limits caps for every guest there.
 *  - Speed per guest: NOT applied. The AP ignores the bandwidth attributes
 *    Wyfy sends (MEASURED 2026-10-03). One speed per WiFi network, set in
 *    Instant On; a tier can be the pass that lets its guests join a faster
 *    network (Speed tiers by WiFi network, #350), or a Wyfy MikroTik gateway
 *    applies it per guest (#351, the `perGuestSpeed` read).
 *  - Data limit: usage IS counted (interims MEASURED); a guest over the cap is
 *    refused at the next sign-in. Nothing ends the live session early through
 *    RADIUS; a mid-session cut needs Instant On cloud control.
 *  - Max daily session and login hours: the remaining allowance / the window
 *    end cap the Session-Timeout, which the AP obeys (V1 MEASURED), and a
 *    sign-in outside them is refused.
 */
import { NAS_ONLY_DAILY_LIMIT } from "@/lib/nas-only-access-rules";
import type { ControlVerdict } from "@/lib/omada-client-controls";

export type ArubaTierControl =
  | "tier-speed"
  | "tier-data-limit"
  | "tier-daily-limit"
  | "tier-login-hours";
export type ArubaTierVerdict = ControlVerdict<ArubaTierControl>;

/** Speed, no gateway. Points at the one speed control the venue has. */
export const ARUBA_TIER_SPEED =
  "Aruba Instant On can't give one guest a different speed from another on the same WiFi " +
  "network, so this tier's speed isn't applied here. To give this tier's guests faster WiFi, " +
  "add a paid network under Speed tiers by WiFi network and let this tier join it.";

/** Data limit. Next sign-in is the enforced half; the live session runs on. */
export const ARUBA_TIER_DATA_LIMIT =
  "Usage is counted. When a guest in this tier uses up their allowance, Wyfy can't " +
  "disconnect a device from Aruba Instant On access points, so they stay online until " +
  "their session ends. A daily, weekly or monthly limit also stops them signing in again " +
  "until it resets. Cutting them off mid-session needs Instant On cloud control.";

/** Max daily session: the measured, shared sentence. */
export const ARUBA_TIER_DAILY_LIMIT = NAS_ONLY_DAILY_LIMIT;

/** Login hours, per the tier contract (ACCESS_TIERS.md §0 b): sign-in refused
 * outside the window, Session-Timeout capped at the window end. */
export const ARUBA_TIER_LOGIN_HOURS =
  "Guests in this tier can't sign in outside these hours, and Aruba Instant On access " +
  "points end their session when the window closes. A window can run past midnight " +
  "(for example 22:00 to 06:00).";

/** What every tier limit at an Instant On venue applies to. */
export const ARUBA_TIER_APPLIES_TO =
  "At this venue a tier's limits apply to the guests you map into it (Map users), from " +
  "their next sign-in.";

// ---------------------------------------------------------------------------
// Precedence (ACCESS_TIERS.md §2): a tier field left unset (null) means "the
// venue's own limit applies"; "no limit" has to be an explicit value so a
// tier can LIFT a venue cap. So at an Aruba venue the daily-limit picker has
// both answers, and "Unlimited" devices is written as the 9999 sentinel.
// ---------------------------------------------------------------------------

/** The daily-limit choice that writes null: the venue's own limit applies. */
export const ARUBA_DAILY_VENUE_DEFAULT = "Same as Guest WiFi Limits";
/** "No Limit" writes 0, which lifts the venue's daily cap for this tier. */
export const ARUBA_DAILY_NO_LIMIT_MINUTES = 0;
export const ARUBA_UNLIMITED_DEVICES = 9999;

/** Tier `daily_limit_minutes` for a picker label at an Aruba venue. */
export function arubaDailyLimitMinutes(
  label: string,
  table: Record<string, number | null>,
): number | null {
  if (label === ARUBA_DAILY_VENUE_DEFAULT) return null;
  if (label === "No Limit") return ARUBA_DAILY_NO_LIMIT_MINUTES;
  return table[label] ?? null;
}

/** The picker label for a stored tier `daily_limit_minutes` at an Aruba venue. */
export function arubaDailyLimitLabel(
  minutes: number | null | undefined,
  table: Record<string, number | null>,
): string {
  if (minutes == null) return ARUBA_DAILY_VENUE_DEFAULT;
  if (minutes === ARUBA_DAILY_NO_LIMIT_MINUTES) return "No Limit";
  const found = Object.entries(table).find(([, v]) => v === minutes);
  return found?.[0] ?? `${minutes} min`;
}

/** Shown under the data-limit toggle at an Aruba venue. */
export const ARUBA_DATA_LIMIT_OFF =
  "Off means this tier's guests get the data limit set in Guest WiFi Limits.";

/** Shown after a save at an Aruba venue. */
export const ARUBA_TIER_SAVED =
  "Saved. Changes reach each guest in this tier the next time they sign in.";

export const ARUBA_TIER_RENAME_LOCKED =
  "A tier's name can't be changed after it's created. Clone it to make a renamed copy.";

/** The four tier verdicts at an Instant On venue. `perGuestSpeed` is the
 * hybrid-gateway read: only `true` makes the speed live. */
export function arubaTierVerdict(
  control: ArubaTierControl,
  perGuestSpeed: boolean | null | undefined,
): ArubaTierVerdict {
  switch (control) {
    case "tier-speed":
      return perGuestSpeed === true
        ? {
            control,
            availability: "qualified",
            reason:
              "Applied to each guest in this tier by your venue's Wyfy gateway router (a " +
              "MikroTik in front of your Aruba access points) when they come online. This is " +
              "the most a guest's device can use, not a guaranteed speed.",
          }
        : { control, availability: "unavailable", reason: ARUBA_TIER_SPEED };
    case "tier-data-limit":
      return { control, availability: "qualified", reason: ARUBA_TIER_DATA_LIMIT };
    case "tier-daily-limit":
      return { control, availability: "qualified", reason: ARUBA_TIER_DAILY_LIMIT };
    case "tier-login-hours":
      return { control, availability: "qualified", reason: ARUBA_TIER_LOGIN_HOURS };
  }
}

// ---------------------------------------------------------------------------
// Validation, computed from the current values every render -- so a message
// disappears the moment the value it complains about is fixed, including the
// ones (login days, end time, quota, idle-vs-session) that were only ever
// cleared by the next submit.
// ---------------------------------------------------------------------------

export interface ArubaTierFormInput {
  name: string;
  /** Lower-cased names of the OTHER tiers in the account. */
  otherNames: string[];
  sessionTimeout: string;
  idleTimeout: string;
  devicesPerUser: string;
  dataLimitOn: boolean;
  dataQuota: string;
  loginHoursOn?: boolean;
  loginDays?: string[];
  loginFrom?: string;
  loginTo?: string;
}

/** "30 min" -> 30, "2 hr" -> 120, anything else -> null. */
export function minutesFromLabel(label: string): number | null {
  const m = /^(\d+)\s*(min|hr)$/i.exec(label.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return m[2].toLowerCase() === "hr" ? n * 60 : n;
}

export function arubaTierFormErrors(f: ArubaTierFormInput): Record<string, string> {
  const e: Record<string, string> = {};
  const name = f.name.trim();
  if (!name) e.name = "Required.";
  else if (f.otherNames.includes(name.toLowerCase()))
    e.name = "A tier with this name already exists.";
  if (!f.sessionTimeout) e.st = "Required.";
  if (!f.idleTimeout) e.it = "Required.";
  if (!f.devicesPerUser) e.dp = "Required.";
  const st = minutesFromLabel(f.sessionTimeout);
  const it = minutesFromLabel(f.idleTimeout);
  if (st !== null && it !== null && it > st)
    e.it = "Idle timeout can't be longer than the session timeout.";
  if (f.dataLimitOn) {
    const q = Number(f.dataQuota);
    if (!f.dataQuota.trim() || !Number.isFinite(q) || q <= 0) e.dlQuota = "Must be greater than 0.";
  }
  if (f.loginHoursOn) {
    if (!f.loginDays?.length) e.loginDays = "Select at least one day.";
    // Overnight (start after end) is valid, and start == end means all day
    // (ACCESS_TIERS.md §2.8); only a missing time is an error.
    if (!f.loginFrom || !f.loginTo) e.loginTo = "Choose a start and an end.";
  }
  return e;
}

// ---------------------------------------------------------------------------
// Where a tier is used. Read from the tier's own assignments (one request per
// tier, already made to list its locations) and this venue's SSID rows.
// Voucher plans carry no tier link on the backend (a plan's speed is its
// queue profile), so there is nothing to count there.
// ---------------------------------------------------------------------------

export interface TierAssignmentLike {
  is_active: boolean;
  scope_type: string;
  scope_id: string | null;
  target_type: string;
  target_id: string | null;
}

export interface TierUsage {
  locationIds: string[];
  guestCount: number;
  ssids: string[];
}

export function tierUsage(
  assignments: TierAssignmentLike[],
  ssidRows: { ssid: string; paidOnly: boolean; policyId: string | null }[],
  tierId: string,
): TierUsage {
  const live = assignments.filter((a) => a.is_active && a.scope_type === "location" && a.scope_id);
  const locationIds = [
    ...new Set(live.filter((a) => a.target_type === "none").map((a) => a.scope_id as string)),
  ];
  const guests = new Set(
    live.filter((a) => a.target_type === "guest" && a.target_id).map((a) => a.target_id as string),
  );
  const ssids = ssidRows.filter((r) => r.paidOnly && r.policyId === tierId).map((r) => r.ssid);
  return { locationIds, guestCount: guests.size, ssids };
}

/** "3 guests · joins WYFY_PREMIUM", "No guests mapped". */
export function formatTierUsage(u: Pick<TierUsage, "guestCount" | "ssids">): string {
  const parts: string[] = [];
  parts.push(
    u.guestCount === 0
      ? "No guests mapped"
      : `${u.guestCount} guest${u.guestCount === 1 ? "" : "s"}`,
  );
  if (u.ssids.length) parts.push(`joins ${u.ssids.join(", ")}`);
  return parts.join(" · ");
}
