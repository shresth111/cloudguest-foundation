/**
 * Total venue speed -- the most all guests together can use at one venue.
 *
 * It rides on the venue's own BANDWIDTH policy, beside the per-guest speed,
 * as two rule keys: `venue_download_rate_kbps` and `venue_upload_rate_kbps`.
 * `null` (or the key being absent) means the venue has no total cap.
 *
 * WHY THIS IS A MODULE AND NOT THREE LINES IN THE SCREEN
 * ------------------------------------------------------
 * Guest WiFi Limits has shipped the same bug four times: a control that was
 * accepted, stored, read back, shown as active, and reached nothing -- or
 * that a later save quietly overwrote. Each time the wrong number was
 * computed inline in `handleSave`, where no test could call it. Everything
 * that decides what this control writes lives here so
 * `scripts/test-venue-speed-cap.mjs` can run it with the very objects the
 * screen builds.
 *
 * ONE VALUE FOR BOTH DIRECTIONS, LIKE THE PER-GUEST SPEED ABOVE IT
 * ---------------------------------------------------------------
 * The Bandwidth control on this screen is one dropdown that sets download
 * and upload together, and this one is deliberately the same control with the
 * same choices so the two read as a pair. The wire shape still has two keys,
 * and something other than this screen may have set them apart.
 *
 * The convention for such a pair is the one Bandwidth already has
 * (`kbpsToLabel(p.downloadRateKbps)`): THE DOWNLOAD VALUE IS WHAT IS SHOWN,
 * as its preset label or as "<n> Kbps" when it is not a preset. What this
 * module adds on top is that showing one number must not rewrite the other:
 * a save that leaves the dropdown where it was writes the stored pair back
 * exactly as held, and only a different choice sets both directions.
 */

/** The "no cap" choice, and the default. */
export const VENUE_SPEED_NO_LIMIT = "No limit";

/** The backend's accepted range for either key. */
export const VENUE_SPEED_MIN_KBPS = 1024;
export const VENUE_SPEED_MAX_KBPS = 10_000_000;

/**
 * The first eight are the per-guest Bandwidth presets, value for value
 * (`BANDWIDTH_KBPS` in lib/guest-wifi-limits.ts -- the suite asserts they
 * have not drifted). The rest exist because this is a TOTAL: a venue on a 200 Mbps
 * line could not otherwise set a cap anywhere near its own line, and a total
 * that tops out at one guest's maximum is not a total.
 */
export const VENUE_SPEED_KBPS: Record<string, number> = {
  "10 Mbps": 10240,
  "20 Mbps": 20480,
  "30 Mbps": 30720,
  "40 Mbps": 40960,
  "50 Mbps": 51200,
  "60 Mbps": 61440,
  "70 Mbps": 71680,
  "80 Mbps": 81920,
  "100 Mbps": 102400,
  "150 Mbps": 153600,
  "200 Mbps": 204800,
  "300 Mbps": 307200,
  "500 Mbps": 512000,
  "1 Gbps": 1048576,
};

export const VENUE_SPEED_OPTIONS: readonly string[] = [
  VENUE_SPEED_NO_LIMIT,
  ...Object.keys(VENUE_SPEED_KBPS),
];

/** One venue's total cap. `null` in a direction means no cap that way. */
export interface VenueRates {
  down: number | null;
  up: number | null;
}

export const NO_VENUE_CAP: VenueRates = { down: null, up: null };

/** `null`, absent, zero, negative and non-numbers all mean "no cap". Zero is
 * folded in on purpose: on the per-guest keys 0 means unlimited, and a 0 sent
 * here by habit must not become a cap of nothing for the whole venue. */
function normalize(kbps: number | null | undefined): number | null {
  return typeof kbps === "number" && Number.isFinite(kbps) && kbps > 0 ? kbps : null;
}

export function venueRates(
  down: number | null | undefined,
  up: number | null | undefined,
): VenueRates {
  return { down: normalize(down), up: normalize(up) };
}

function rateLabel(kbps: number): string {
  const found = Object.entries(VENUE_SPEED_KBPS).find(([, v]) => v === kbps);
  return found?.[0] ?? `${kbps} Kbps`;
}

/** What the dropdown and the table say for a stored pair: the DOWNLOAD
 * value, by the per-guest Bandwidth column's own convention. */
export function venueSpeedLabel(rates: VenueRates | null | undefined): string {
  const { down } = venueRates(rates?.down, rates?.up);
  return down === null ? VENUE_SPEED_NO_LIMIT : rateLabel(down);
}

export function venueCapIsSet(rates: VenueRates | null | undefined): boolean {
  return venueSpeedLabel(rates) !== VENUE_SPEED_NO_LIMIT;
}

/**
 * The dropdown's choices for one venue: the presets, plus the venue's own
 * stored value when it is not one of them. Without that extra entry a
 * `<select>` handed a value it does not list renders blank, and the owner
 * would be looking at an empty box over a cap that is in force.
 */
export function venueSpeedOptions(held: VenueRates | null | undefined): string[] {
  const heldLabel = venueSpeedLabel(held);
  return VENUE_SPEED_OPTIONS.includes(heldLabel)
    ? [...VENUE_SPEED_OPTIONS]
    : [...VENUE_SPEED_OPTIONS, heldLabel];
}

/**
 * The pair a dropdown choice stands for.
 *
 *  - "No limit" (or nothing chosen)   -> no cap, both directions `null`.
 *    NEVER 0 (see `normalize`), and never "whatever was held": a venue whose
 *    stored pair caps upload only reads "No limit" here by the download
 *    convention, and preserving that pair would leave a cap in force that no
 *    screen shows and no choice could clear.
 *  - the label the stored pair shows  -> the stored pair, exactly as held.
 *    The owner left the control alone, so nothing about it changes -- this is
 *    what keeps an upload value that differs from the download one, or a
 *    rate that is not a preset, from being rewritten by an unrelated save.
 *  - any other preset                 -> that rate, both directions.
 *  - a label this module cannot read  -> no cap. Unreachable from the
 *    dropdown, whose options are exactly the three cases above.
 */
export function venueRatesForChoice(
  choice: string,
  held: VenueRates | null | undefined,
): VenueRates {
  if (!choice || choice === VENUE_SPEED_NO_LIMIT) return { ...NO_VENUE_CAP };
  if (venueCapIsSet(held) && venueSpeedLabel(held) === choice) {
    return venueRates(held?.down, held?.up);
  }
  const preset = VENUE_SPEED_KBPS[choice];
  return preset === undefined ? { ...NO_VENUE_CAP } : { down: preset, up: preset };
}

export function venueRatesEqual(
  a: VenueRates | null | undefined,
  b: VenueRates | null | undefined,
): boolean {
  const x = venueRates(a?.down, a?.up);
  const y = venueRates(b?.down, b?.up);
  return x.down === y.down && x.up === y.up;
}

/**
 * The check the server makes, made before the click: a venue total below the
 * per-guest speed in the same direction can never be reached by a single
 * guest's own limit, so one of the two numbers is a mistake.
 *
 * A per-guest speed of 0 is "Unlimited" on that key and compares as no
 * constraint -- any total is at least "no per-guest limit".
 */
export type VenueSpeedProblem =
  /** Outside what the server accepts at all. Only a stored, non-preset value
   * can get here; every preset is in range. */
  | { code: "range" }
  /** Below the per-guest speed. `perGuest` is that speed, as the Bandwidth
   * dropdown labels it, for the sentence shown under the field. */
  | { code: "belowPerGuest"; perGuest: string };

export function venueSpeedProblem(
  venue: VenueRates,
  perGuest: { down: number; up: number },
): VenueSpeedProblem | null {
  for (const dir of ["down", "up"] as const) {
    const total = venue[dir];
    if (total === null) continue;
    if (total < VENUE_SPEED_MIN_KBPS || total > VENUE_SPEED_MAX_KBPS) return { code: "range" };
    const each = perGuest[dir];
    if (each > 0 && total < each) return { code: "belowPerGuest", perGuest: rateLabel(each) };
  }
  return null;
}

const VENUE_KEYS = ["venue_download_rate_kbps", "venue_upload_rate_kbps"] as const;

/**
 * The server's own sentence when it refuses the venue total, or `null` when
 * the refusal was about something else.
 *
 * Takes `unknown` and reads it by shape: this is called from a `catch`, the
 * rejection is `api.ts`'s plain `AppError` object, and importing the axios
 * client here to name its type would drag an HTTP layer into a module whose
 * point is that a test can call it without one.
 *
 * Two places a server can put the message, both read: a per-field entry
 * keyed by either rule name, or -- for a rule that compares two fields, which
 * a validator reports against the whole `rules` object -- any message that
 * names the venue.
 */
export function venueSpeedServerError(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { message?: unknown; fieldErrors?: unknown };
  const fields =
    e.fieldErrors && typeof e.fieldErrors === "object"
      ? (e.fieldErrors as Record<string, unknown>)
      : {};
  for (const key of VENUE_KEYS) {
    const msg = fields[key];
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  const mentionsVenue = (s: unknown): s is string =>
    typeof s === "string" && /venue/i.test(s) && s.trim().length > 0;
  for (const msg of Object.values(fields)) {
    if (mentionsVenue(msg)) return msg.trim();
  }
  return mentionsVenue(e.message) ? e.message.trim() : null;
}

/** The one line shown beside the greyed control where it cannot be enforced.
 * English fallback; the screen renders it through `accessRules:venueSpeed.unavailable`. */
export const VENUE_SPEED_UNAVAILABLE = "Not available on this venue's hardware.";
