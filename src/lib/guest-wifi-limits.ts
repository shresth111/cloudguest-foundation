/**
 * Guest WiFi Limits -- the choices the form offers, and how a venue's saved
 * limits become what the form and the table show.
 *
 * WHY THIS LEFT THE SCREEN
 * ------------------------
 * `LocationPolicies.tsx` held all of it inline, where nothing could call it.
 * That is how the form came to open on "Choose bandwidth", "Choose devices
 * per user" and "Choose session timeout" for a venue that had all three saved:
 * the saved values were mapped into the table rows inside an effect, the form
 * was only ever filled by the pencil button, and no test could load a policy
 * and ask what the five controls would show. The two that looked right --
 * Idle Timeout "30 min", Daily Limit "No Limit" -- were the blank form's own
 * defaults, coincidentally equal to what that venue had saved.
 *
 * `scripts/test-venue-speed-cap.mjs` now bundles this module and runs it on a
 * policy shaped exactly like the one that was live when that was reported.
 *
 * Kept free of React and of the HTTP client on purpose: a test that needs a
 * browser or a fake server to ask "what does the form show" does not get
 * written.
 */
import { VENUE_SPEED_NO_LIMIT, venueSpeedLabel, type VenueRates } from "@/lib/venue-speed-cap";

// DevicePolicyRules.max_devices_per_guest (backend) is a required int >= 1
// -- there's no real "unlimited" value in that schema today, so "Unlimited"
// here is represented as this large practical ceiling rather than left
// unenforced (an unassigned location falls back to the platform default of
// 3, which would silently contradict what "Unlimited" promises).
export const UNLIMITED_DEVICES_SENTINEL = 9999;

export const BANDWIDTH_KBPS: Record<string, number> = {
  "10 Mbps": 10240,
  "20 Mbps": 20480,
  "30 Mbps": 30720,
  "40 Mbps": 40960,
  "50 Mbps": 51200,
  "60 Mbps": 61440,
  "70 Mbps": 71680,
  "80 Mbps": 81920,
};
export function kbpsToLabel(kbps: number): string {
  const found = Object.entries(BANDWIDTH_KBPS).find(([, v]) => v === kbps);
  return found?.[0] ?? (kbps > 0 ? `${kbps} Kbps` : "Unlimited");
}

// Session/Idle/Daily Timeout are real BandwidthPolicyRules fields (see
// bandwidth-policy.service.ts's toRules) that this form was never actually
// sending -- same class of bug CreateGroup.tsx already hit and fixed for
// its own edit form (see BandwidthPolicy's own doc comment: "edit kaam
// nahi karta" once required fields always read back blank). Mirroring that
// exact fix here instead of reinventing it.
export const SESSION_TIMEOUT_MINUTES: Record<string, number> = {
  "30 min": 30,
  "1 hr": 60,
  "2 hr": 120,
  "4 hr": 240,
  "8 hr": 480,
  "24 hr": 1440,
};
// "No Limit" is deliberately NOT an option here, and its absence is the
// honest half of making this control real.
//
// An idle timeout is the only thing on this fleet that reaps an abandoned
// session promptly. The routers run `keepalive-timeout=none` -- a fix for a
// confirmed incident where phones locking their screens were hard-logged-out
// at RouterOS's factory two-minute keepalive -- so with the idle timeout also
// off, nothing closes a session a guest walked away from: slots stay held
// against `shared-users`, device counts only ever rise, and RADIUS never
// receives an Accounting-Stop. That is the incident the 30-minute default
// exists to close (see HOTSPOT_IDLE_TIMEOUT in RouterDetailTabs.tsx and
// DEFAULT_IDLE_TIMEOUT_MINUTES in the backend's guest/constants.py).
//
// So "No Limit" could not be honoured without re-opening that. And offering
// it while quietly applying 30 minutes is precisely what this screen was
// already doing: the option existed, was the value an unconfigured location
// read back as, and the router idled those guests out at 30 minutes anyway.
// Removing it is what makes every value left on this list true.
export const IDLE_TIMEOUT_MINUTES: Record<string, number> = {
  "5 min": 5,
  "10 min": 10,
  "15 min": 15,
  "30 min": 30,
  "1 hr": 60,
};

// What a location with no SESSION policy of its own is actually doing.
// Mirrors the backend's DEFAULT_IDLE_TIMEOUT_MINUTES, which in turn mirrors
// what the router setup script writes onto the device -- so the form opens
// showing the real current behaviour rather than a blank.
export const DEFAULT_IDLE_TIMEOUT_LABEL = "30 min";

export const DAILY_LIMIT_MINUTES: Record<string, number | null> = {
  "No Limit": null,
  "1 hr": 60,
  "2 hr": 120,
  "4 hr": 240,
  "8 hr": 480,
};

export function labelFromMinutes(
  minutes: number | null | undefined,
  table: Record<string, number | null>,
  fallback: string,
): string {
  const found = Object.entries(table).find(([, v]) => v === (minutes ?? null));
  return found?.[0] ?? fallback;
}

// ── the dropdowns' choices ──────────────────────────────────────
export const BANDWIDTH = [
  "Unlimited",
  "10 Mbps",
  "20 Mbps",
  "30 Mbps",
  "40 Mbps",
  "50 Mbps",
  "60 Mbps",
  "70 Mbps",
  "80 Mbps",
];
export const SESSION_TIMEOUT = ["30 min", "1 hr", "2 hr", "4 hr", "8 hr", "24 hr"];
export const DAILY_LIMIT = ["No Limit", "1 hr", "2 hr", "4 hr", "8 hr"];
export const IDLE_TIMEOUT = ["5 min", "10 min", "15 min", "30 min", "1 hr"];
export const DEVICES = ["Unlimited", "1", "2", "3", "4", "5"];

// ── what a venue's saved limits look like on screen ──────────────

export interface DataLimit {
  quota: number;
  unit: string;
  resets: string;
}

/** One row of "Current Guest WiFi Limits", and -- minus the id -- the form. */
export interface GuestWifiLimitsRow {
  id: string;
  businessUnit: string;
  bandwidth: string;
  /** Total venue speed, as `venueSpeedLabel` shows it. */
  venueSpeed: string;
  sessionTimeout: string;
  dailyLimit: string;
  idleTimeout: string;
  devicesPerUser: string;
  dataLimit: DataLimit | null;
}
export type GuestWifiLimitsForm = Omit<GuestWifiLimitsRow, "id">;

/** The form before anybody has chosen anything. `location` is carried through
 * because clearing the settings must not also un-pick the venue. */
export function blankLimitsForm(location = ""): GuestWifiLimitsForm {
  return {
    businessUnit: location,
    bandwidth: "",
    venueSpeed: VENUE_SPEED_NO_LIMIT,
    sessionTimeout: "",
    dailyLimit: "No Limit",
    idleTimeout: DEFAULT_IDLE_TIMEOUT_LABEL,
    devicesPerUser: "",
    dataLimit: null,
  };
}

export function devicesLabel(maxDevices: number | null | undefined): string {
  if (maxDevices == null) return "";
  return maxDevices >= UNLIMITED_DEVICES_SENTINEL ? "Unlimited" : String(maxDevices);
}

/**
 * A venue's saved limits as one table row.
 *
 * Every argument is already the value the ENFORCING policy holds -- the
 * screen decides which policy that is (SESSION for the two timeouts, FUP for
 * the daily limit and the data cap, DEVICE for the device count) and passes
 * the answer in. This function only turns numbers into the labels the
 * dropdowns use, so the row and the form can never disagree about them.
 */
export function limitsRowFromSaved(saved: {
  id: string;
  name: string;
  downloadRateKbps: number;
  venue: VenueRates | null | undefined;
  sessionTimeoutMinutes: number | null | undefined;
  idleTimeoutMinutes: number | null | undefined;
  dailyLimitMinutes: number | null | undefined;
  maxDevices: number | null | undefined;
  dataLimit: DataLimit | null;
}): GuestWifiLimitsRow {
  return {
    id: saved.id,
    businessUnit: saved.name,
    bandwidth: kbpsToLabel(saved.downloadRateKbps),
    venueSpeed: venueSpeedLabel(saved.venue),
    sessionTimeout: labelFromMinutes(saved.sessionTimeoutMinutes, SESSION_TIMEOUT_MINUTES, ""),
    dailyLimit: labelFromMinutes(saved.dailyLimitMinutes, DAILY_LIMIT_MINUTES, "No Limit"),
    // The fallback is the platform default rather than a blank: a location
    // with no SESSION policy is not "unset", it is running the 30 minutes its
    // router already applies, and an empty box would misdescribe that.
    idleTimeout: labelFromMinutes(
      saved.idleTimeoutMinutes,
      IDLE_TIMEOUT_MINUTES,
      DEFAULT_IDLE_TIMEOUT_LABEL,
    ),
    devicesPerUser: devicesLabel(saved.maxDevices),
    dataLimit: saved.dataLimit,
  };
}

export function limitsFormFromRow(row: GuestWifiLimitsRow): GuestWifiLimitsForm {
  return {
    businessUnit: row.businessUnit,
    bandwidth: row.bandwidth,
    venueSpeed: row.venueSpeed,
    sessionTimeout: row.sessionTimeout,
    dailyLimit: row.dailyLimit,
    idleTimeout: row.idleTimeout,
    devicesPerUser: row.devicesPerUser,
    dataLimit: row.dataLimit,
  };
}

/**
 * A dropdown's choices, plus the value it is holding when that value is not
 * one of them. A `<select>` given a value it does not list renders BLANK, so
 * a venue saved at a rate outside the presets would open on an empty required
 * field -- and the only way past it would be to pick a different speed.
 */
export function optionsWithCurrent(options: readonly string[], current: string): string[] {
  return !current || options.includes(current) ? [...options] : [...options, current];
}

/**
 * The per-guest rates a Bandwidth choice stands for.
 *
 * The dropdown shows the download rate (`kbpsToLabel(downloadRateKbps)`) and a
 * new choice sets both directions. A save that leaves the dropdown where it
 * was writes the stored pair back as held, so an upload rate that differs from
 * the download one -- or a rate that is not a preset, which `BANDWIDTH_KBPS`
 * cannot look up and used to turn into 0, i.e. unlimited -- survives a save
 * that was about something else.
 */
export function bandwidthRatesForChoice(
  choice: string,
  held: { down: number; up: number } | undefined,
): { down: number; up: number } {
  const preset = BANDWIDTH_KBPS[choice];
  if (held && held.down > 0 && kbpsToLabel(held.down) === choice) return { ...held };
  const kbps = preset ?? 0;
  return { down: kbps, up: kbps };
}

// ── which venue's values the form is showing ─────────────────────

export type PrefillDecision =
  /** Leave the form exactly as it is. */
  | { kind: "keep" }
  /** Show this venue's saved limits. `key` is what to remember as shown. */
  | { kind: "fill"; row: GuestWifiLimitsRow; key: string }
  /** The form is showing some OTHER venue's saved limits; blank the settings. */
  | { kind: "clear" };

export function prefillKey(row: GuestWifiLimitsRow): string {
  return `${row.businessUnit}\u0000${row.id}`;
}

/**
 * What the form should do when the chosen venue, or the list of saved limits,
 * changes.
 *
 * THE FORM OPENS ON THE VENUE'S CURRENT VALUES. It used to open blank and wait
 * for the pencil button, which had two costs. Three required fields read as
 * unset on a venue that had them set. And an owner who simply filled those
 * three back in and pressed Update would also have written the two fields that
 * LOOKED filled -- the form's defaults, not the venue's values -- and, because
 * the data-limit panel starts closed, would have removed the venue's data cap
 * without ever seeing that it had one.
 *
 * `shownFor` is the key of the row the form is already mirroring, or null when
 * its contents are the owner's own typing. It is what stops this from
 * re-filling over an edit in progress every time the list re-renders.
 */
export function prefillDecision(args: {
  location: string;
  rows: readonly GuestWifiLimitsRow[];
  shownFor: string | null;
}): PrefillDecision {
  const row = args.location ? args.rows.find((r) => r.businessUnit === args.location) : undefined;
  if (row) {
    const key = prefillKey(row);
    return key === args.shownFor ? { kind: "keep" } : { kind: "fill", row, key };
  }
  // No saved limits for this venue (or no venue chosen). Values the owner
  // typed themselves stay; values that belong to another venue do not carry
  // over to this one as if they had been chosen for it.
  return args.shownFor === null ? { kind: "keep" } : { kind: "clear" };
}
