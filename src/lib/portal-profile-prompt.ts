/**
 * v4 UX §6.5: the post-OTP "tell us about yourself" prompt used to sit
 * *inside* the login funnel, between OTP verification and `afterLogin()`
 * -- one more screen before a guest who just proved their identity
 * actually got online, breaking the "extras happen after connect"
 * pattern set-password/team-join already established. It's now a
 * dismissible nudge card on `/portal/session` instead (see
 * GuestProfileNudge.tsx), gated the same way `showPasswordNudge` already
 * is.
 *
 * Unlike `showPasswordNudge` (which reads a real, backend-known
 * `session.hasPassword` bit), there is no equivalent "has this guest
 * already given a name/email" field on `RuntimeSession` -- profile
 * capture is optional/best-effort by design (see
 * `portalRuntimeService.updateGuestProfile`), not a tracked account
 * property. This mirrors `portal-returning-guest.ts`'s own
 * device-local-flag pattern: not a perfect record of every device a
 * guest might use, but a reasonable, honest proxy for "don't nag the
 * same browser again" once they've filled it in or explicitly dismissed
 * it -- the guest can always fill it in again later if they want to
 * (nothing here blocks or gates network access either way).
 */
const KEY = "cloudguest_portal_profile_prompt_done";

export function markProfilePromptDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private-browsing/storage-disabled -- worst case the nudge reappears
    // on a later visit, never worth surfacing an error for a pure
    // courtesy prompt.
  }
}

export function deviceProfilePromptDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
