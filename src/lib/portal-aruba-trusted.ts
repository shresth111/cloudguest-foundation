/**
 * Trusted Devices at an Aruba Instant On venue.
 *
 * Instant On has no MAC authentication on a guest network, so a trusted
 * device still lands on this portal. `/portal/` asks the backend whether the
 * device is trusted and, if so, posts the AP login straight away instead of
 * showing a sign-in form. The AP then asks our RADIUS, which admits the
 * device on the MAC the AP itself reports -- never on anything this page
 * sends.
 *
 * The one thing this file adds is the loop guard. If the AP refuses that
 * login (the venue is closed, the device's allowance is used up, an Access
 * Rule refuses it) it redirects the browser back here with `errmsg`, and a
 * second automatic attempt would send the guest round the same loop for
 * ever. So an attempt is made at most once per device per cooldown, and
 * never on a redirect that carries the AP's error: the guest gets the
 * ordinary sign-in page, where any refusal is explained properly.
 */

export const ARUBA_TRUSTED_ATTEMPT_COOLDOWN_MS = 120_000;

const STORAGE_KEY = "wyfy.portal.arubaTrustedAttempt";

/** Instant On's own refusal marker on the redirect back to the portal
 * (measured: `errmsg=Login error. Please retry.`). */
export function arubaRedirectCarriesError(search: string): boolean {
  try {
    return new URLSearchParams(search).has("errmsg");
  } catch {
    return false;
  }
}

/** Has this device had an automatic attempt within the cooldown? Storage that
 * throws (iOS's Captive Network Assistant) reads as "no" -- the `errmsg`
 * check still stops a refused attempt from repeating there. */
export function arubaTrustedAttemptIsRecent(deviceMac: string, now = Date.now()): boolean {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const last = JSON.parse(raw) as { mac?: unknown; at?: unknown };
    return (
      typeof last.at === "number" &&
      String(last.mac).toLowerCase() === deviceMac.toLowerCase() &&
      now - last.at < ARUBA_TRUSTED_ATTEMPT_COOLDOWN_MS
    );
  } catch {
    return false;
  }
}

export function recordArubaTrustedAttempt(deviceMac: string, now = Date.now()): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ mac: deviceMac, at: now }));
  } catch {
    // Storage can throw inside the CNA; the `errmsg` guard still holds.
  }
}

/** Should `/portal/` try the automatic login for this device on this load? */
export function shouldTryArubaTrustedLogin(deviceMac: string, search: string): boolean {
  return !arubaRedirectCarriesError(search) && !arubaTrustedAttemptIsRecent(deviceMac);
}
