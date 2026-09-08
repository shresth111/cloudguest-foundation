import type { RuntimeAuthMethod, RuntimePortalConfig } from "@/types/portal-runtime";

/**
 * The single source of truth for "which sign-in methods does this guest
 * actually see" -- shared by the real guest flow
 * (src/routes/portal.welcome.tsx, portal.auth.index.tsx,
 * portal.auth.$method.tsx) and its admin preview
 * (src/routes/preview.portal.$locationId.tsx), so the two
 * can never drift into showing a different method set for the same
 * config.
 *
 * Order is a fixed priority, not just "however the config happens to list
 * them": SMS OTP first -- the industry-default "phone number field" a
 * guest hits the instant they tap Connect on a real hotspot (Meraki/Aruba
 * ClearPass/Purple WiFi all default here), then email OTP, then WhatsApp
 * OTP (a real third channel, but the newest/least commonly enabled today),
 * then password, then voucher last (a real, supported method, but the
 * least common thing to lead with when something more common is also
 * enabled).
 */
export const AUTH_METHOD_PRIORITY: RuntimeAuthMethod[] = [
  "otp_sms",
  "otp_email",
  "otp_whatsapp",
  "username_password",
  "voucher",
];

/**
 * PLATFORM SWITCH FOR PASSWORD SIGN-IN.
 *
 * True = password is offered to exactly the venues whose stored
 * `username_password_enabled` is on (legacy venues that never turned it
 * off keep it; brand-new venues default to off and stay OTP-only unless an
 * admin enables it in the Portal tab). The backend flag is the gate --
 * this constant just stops hiding that already-enforced setting from the
 * guest UI. This is the deliberate opt-in hybrid posture: password login
 * stays available to venues that want it without forcing it on new ones.
 *
 * WHY IT WAS FALSE: a founder-directed retirement of password sign-in.
 * The retirement was reversed after a live-flow review showed the venue
 * owner's own captive-portal flow includes password login ("Existing
 * user -> Password set? -> Password login"), set-password ("SET IT /
 * SKIP"), and reconnect-by-password -- and with the constant false those
 * steps were structurally unreachable for every venue. Re-enabling the
 * constant restores them for venues whose flag is still on, and nothing
 * more: the default-off backend flag keeps new venues OTP-first.
 *
 * WHY A CONSTANT AND NOT DELETION (unchanged): `username_password` is
 * still a real value of `RuntimeAuthMethod`, appears as `auth_method` on
 * live/historical `guest_sessions` rows, and the backend endpoint stays
 * flag-gated either way. Deleting the enum member, its i18n strings or
 * `PasswordSignInForm` would break rendering of data that already exists.
 *
 * Enforced in `isEnabled` below, which is the single place every guest-
 * facing surface and the admin preview both resolve methods through.
 */
export const PASSWORD_SIGN_IN_OFFERED = true;

/**
 * Does this config offer password sign-in to a guest right now?
 *
 * The venue's own flag AND the platform switch above. Exported because two
 * surfaces outside the method list ask the same question and must get the
 * same answer: `portal.verify.tsx`'s "set a password for next time?"
 * hand-off after a successful OTP, and `portal.session.tsx`'s set-password
 * nudge. Both used to read `config.usernamePasswordEnabled` directly,
 * which would have left a guest being invited to create a credential that
 * nothing would ever offer to accept -- a strictly worse outcome than
 * either keeping the feature or removing it.
 */
export function passwordSignInOffered(
  config: Pick<RuntimePortalConfig, "usernamePasswordEnabled"> | null | undefined,
): boolean {
  return PASSWORD_SIGN_IN_OFFERED && !!config?.usernamePasswordEnabled;
}

export const AUTH_METHOD_LABEL_KEY: Record<RuntimeAuthMethod, string> = {
  otp_sms: "mobileOtp",
  otp_email: "emailOtp",
  otp_whatsapp: "whatsappOtp",
  username_password: "passwordLogin",
  voucher: "voucherCode",
};

/** English source copy for the per-method fallback links. No longer
 * rendered directly: portal.auth.$method.tsx now maps each method to its
 * translated dictionary key (OTHER_METHOD_LABEL_KEY -- useMobileInstead /
 * useEmailInstead / useWhatsappInstead / usePasswordInstead /
 * haveVoucherUseInstead), whose EN entries mirror these strings. Kept as
 * the documented EN source of truth for those keys. */
export const AUTH_METHOD_FALLBACK_COPY: Record<RuntimeAuthMethod, string> = {
  otp_sms: "Use a mobile number instead",
  otp_email: "Use an email address instead",
  otp_whatsapp: "Use WhatsApp instead",
  username_password: "Sign in with a saved password instead",
  voucher: "Have a voucher code? Use it instead",
};

function isEnabled(config: RuntimePortalConfig, method: RuntimeAuthMethod): boolean {
  switch (method) {
    case "otp_sms":
      return config.otpSmsEnabled;
    case "otp_email":
      return config.otpEmailEnabled;
    case "otp_whatsapp":
      return config.otpWhatsappEnabled;
    case "username_password":
      // Not `config.usernamePasswordEnabled` -- see
      // `PASSWORD_SIGN_IN_OFFERED`. This is the chokepoint the whole
      // module is built around, so retiring the method here retires it
      // from the sign-in landing form, the "use X instead" fallback
      // links, the full method menu and the admin preview at once.
      return passwordSignInOffered(config);
    case "voucher":
      return config.voucherEnabled;
  }
}

/** Every method actually toggled on for this resolved config, in
 * ``AUTH_METHOD_PRIORITY`` order -- never a method the dashboard hasn't
 * enabled, regardless of what the config record otherwise supports. */
export function enabledAuthMethods(config: RuntimePortalConfig): RuntimeAuthMethod[] {
  return AUTH_METHOD_PRIORITY.filter((m) => isEnabled(config, m));
}

/** The method a guest lands on directly when they tap "Connect" -- the
 * single highest-priority enabled method. ``null`` only when nothing is
 * enabled at all (an unconfigured portal -- shown its own "contact
 * reception" state). Every *other* enabled method stays reachable from
 * that landing form as a compact "use X instead" link (see
 * ``otherAuthMethods``), never as a separate full-page menu by default --
 * a menu is still available (src/routes/portal.auth.index.tsx) for a
 * guest who explicitly wants to see every option. */
export function primaryAuthMethod(config: RuntimePortalConfig): RuntimeAuthMethod | null {
  return enabledAuthMethods(config)[0] ?? null;
}

/** Every enabled method other than ``current`` -- what a method's own form
 * offers as fallback links (e.g. PasswordForm's "New here? Use a one-time
 * code instead"), generalized across all four methods instead of just the
 * one case that used to special-case password. */
export function otherAuthMethods(
  config: RuntimePortalConfig,
  current: RuntimeAuthMethod,
): RuntimeAuthMethod[] {
  return enabledAuthMethods(config).filter((m) => m !== current);
}
