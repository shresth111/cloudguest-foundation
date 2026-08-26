/**
 * Remembers, on this real browser/device only (a captive portal has no
 * guest-identity cookie/session that survives across visits -- see
 * src/types/portal-runtime.ts's own note on why RuntimeSession lives in
 * sessionStorage, not something durable), that whoever uses it has
 * already set a real password. Used to pick the sign-in card's *default*
 * tab AND, since this file's own direct feedback pass, to gate whether the
 * OTP/password switcher renders at all -- "OTP once, then phone/email +
 * password from then on" (see `useGuestSignIn`'s `showTabs`) means a
 * device with no password history gets the single OTP form, not a choice
 * that includes an option that can only ever fail for it (the backend's
 * `set_guest_password` accepts only a just-completed, still-active OTP
 * session -- there is no other way for a first-time guest to have a
 * password). Never used to gate or skip an actual auth call: every real
 * login still goes through the real backend regardless of this flag, and
 * an explicit tab click or an incoming `selectedMethod` (e.g. the expired
 * screen's "Use OTP instead") always overrides it.
 *
 * A guest WiFi captive portal is overwhelmingly used from someone's own
 * phone/laptop, not a shared kiosk, so "this browser set a password
 * before" is a reasonable (not perfect) proxy for "this is a returning,
 * already-registered guest" -- and being wrong just means an extra tap
 * to switch tabs, not a wrong sign-in.
 */

const KEY = "cloudguest_portal_has_password";

export function markDeviceHasPassword(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private-browsing/storage-disabled -- fall back to always defaulting
    // to the OTP tab, same as a first-time guest. Not worth surfacing an
    // error for a pure UX nicety.
  }
}

export function deviceHasPassword(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
