/**
 * Trusted Devices' optional "valid until" -- the pure rules behind the
 * field, kept out of the component so they can be tested without a DOM.
 *
 * One field, not two. The dialog used to ask "Allow access: Always / Until a
 * date" and only then show a date picker, so the expiry existed but read as
 * something the screen did not offer. Now the date is simply optional: left
 * empty the device is trusted until someone removes it, filled in it stops
 * being trusted at that moment.
 *
 * Time zones: `<input type="datetime-local">` yields wall-clock time with no
 * offset, which `new Date(...)` reads in the browser's own zone. It is sent
 * as a UTC ISO instant (`toISOString()`), stored as UTC by the backend
 * (`mac_authorization.schemas`), and displayed back with `toLocaleString()`
 * in whatever zone the viewer is in. Enforcement is server-side: an expired
 * entry is left out of `/agent/authorized-macs` and fails
 * `is_mac_authorized` (`mac_authorization.validators.is_currently_valid`).
 */

export type AuthorizationType = "permanent" | "temporary";

/** Why a typed valid-until cannot be saved, or `null` when it can. An empty
 * value is valid: the field is optional. */
export function validUntilError(localValue: string, nowMs: number): string | null {
  if (!localValue) return null;
  const t = new Date(localValue).getTime();
  if (Number.isNaN(t)) return "That isn't a date and time we can read.";
  if (t <= nowMs) return "That time is in the past — pick a later one, or leave it empty.";
  return null;
}

/** The create payload's type/expiry pair for a typed value. Only call once
 * `validUntilError` returned `null`. */
export function validUntilPayload(localValue: string): {
  authorizationType: AuthorizationType;
  expiresAt: string | null;
} {
  if (!localValue) return { authorizationType: "permanent", expiresAt: null };
  return { authorizationType: "temporary", expiresAt: new Date(localValue).toISOString() };
}

/** Whether an entry's trust has lapsed. `null` never lapses. */
export function isTrustExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return !Number.isNaN(t) && t <= nowMs;
}

/** What the "Valid until" column says. `formatInstant` is injected so the
 * test can pin a zone; the screen passes `toLocaleString`. */
export function validUntilLabel(
  expiresAt: string | null | undefined,
  type: string,
  formatInstant: (d: Date) => string = (d) => d.toLocaleString(),
): string {
  if (expiresAt) {
    const d = new Date(expiresAt);
    return Number.isNaN(d.getTime()) ? "—" : formatInstant(d);
  }
  // A row saved before the dialog collected an expiry can be temporary with
  // no date at all; say so rather than dressing it up as a deliberate
  // "no end".
  return type === "temporary" ? "Not set — never ends" : "No end date";
}

/** `min` for the datetime-local input: now, in the browser's own zone, so
 * the picker itself steers away from a past time. */
export function localDateTimeInputMin(nowMs: number): string {
  const d = new Date(nowMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
