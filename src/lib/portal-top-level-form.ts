/**
 * The full-page form POST that opens a venue's gate (RouterOS's
 * `link-login-only`, Aruba Instant On's login host), shared by
 * `/portal/success` and -- for an Aruba trusted device -- `/portal/`.
 */

// Real incident #2, found live at Haldwani: a hardcoded shared
// "guest"/"welcome123" here only ever worked for a hotspot profile with
// `use-radius=no` (RouterOS checks its own local `/ip hotspot user`
// list). Every `use-radius=yes` profile (the real, RADIUS-integrated
// setup this whole platform is built around -- GuestSession, RadiusNasClient,
// etc.) forwards the login to `RadiusService.authorize`, which checks
// whether *this exact username* has a currently-ACTIVE GuestSession --
// never checks the password at all (RADIUS has no "why", only
// accept/reject, and this backend's Authorize phase is purely a
// username-to-session lookup). A hardcoded "guest" username has no
// session of its own, so it was rejected on every single attempt,
// silently -- "redirect karne ke baad nahi chal raha hai internet" even
// after confirming the login succeeded, the router was online, and (a
// dead end) resetting the local hotspot user's password. The real fix is
// `guestIdentifier` -- see PortalRuntimeState's own docstring -- the
// actual phone/email this guest just verified via OTP/password/voucher,
// which *does* have an active session under that exact identifier.
export const HOTSPOT_FALLBACK_PASSWORD = "welcome123";

/** A hidden, full-page form POST -- see `submitHotspotLogin` in src/routes/portal.success.tsx for why it is a
 * top-level navigation and never an iframe or a `fetch`. Shared by the
 * RouterOS and Aruba Instant On gates; only the action and field names
 * differ. */
export function submitTopLevelForm(action: string, fields: Array<[string, string]>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";
  for (const [name, value] of fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
