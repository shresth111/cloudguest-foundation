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
 * THE SINGLE SWITCH THAT RETIRES PASSWORD SIGN-IN FROM THE GUEST PORTAL.
 * Flip it back to `true` and every venue whose stored
 * `username_password_enabled` is still on gets it back, unchanged. That is
 * the whole reversal; there is nothing else to undo on this side.
 *
 * WHY: asked for twice by the founder. Password sign-in is the
 * returning-guest shortcut -- verify once by OTP, set a password, use
 * phone/email + password from then on. It is real and it works, so
 * removing it has a real cost, stated plainly because it will otherwise be
 * rediscovered in a support ticket: **every returning guest goes back to
 * doing an OTP on every visit.**
 *
 * WHY A CONSTANT AND NOT DELETION. Three reasons, in order of weight.
 *
 *  1. `username_password` is still a real value of `RuntimeAuthMethod` and
 *     still appears as `auth_method` on live and historical
 *     `guest_sessions` rows. The enum member, its label key, its i18n
 *     strings and `PasswordSignInForm` all stay reachable and correct --
 *     deleting them would break rendering of data that already exists.
 *  2. The backend endpoint deliberately stays in place, still gated by the
 *     venue's own flag, so a venue that has it on today keeps working
 *     until someone turns it off. That is the difference between a
 *     rollout and an outage. Hiding the UI is therefore only half the
 *     removal by design, not by oversight -- and because the set-password
 *     prompt goes with it (see `passwordSignInOffered`), the set of guests
 *     who own a usable password can only shrink from here.
 *  3. A constant is one grep away from the thing to change. A deletion
 *     spread across five files is not.
 *
 * Enforced in `isEnabled` below, which is the single place every guest-
 * facing surface and the admin preview both resolve methods through -- so
 * there is no second list that can disagree, which is the property this
 * module's own docstring exists to guarantee.
 */
export const PASSWORD_SIGN_IN_OFFERED = false;

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
