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

export const AUTH_METHOD_LABEL_KEY: Record<RuntimeAuthMethod, string> = {
  otp_sms: "mobileOtp",
  otp_email: "emailOtp",
  otp_whatsapp: "whatsappOtp",
  username_password: "passwordLogin",
  voucher: "voucherCode",
};

/** What a landed-on method's own form offers as a fallback link to each
 * *other* enabled method -- shared verbatim by the real guest flow
 * (src/routes/portal.auth.$method.tsx) and its admin preview
 * (src/routes/preview.portal.$locationId.tsx) so the two
 * never show different fallback copy for the same config. */
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
      return config.usernamePasswordEnabled;
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
