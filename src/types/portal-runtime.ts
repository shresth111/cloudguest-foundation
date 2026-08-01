export type RuntimeAuthMethod =
  | "otp_sms"
  | "otp_email"
  | "otp_whatsapp"
  | "username_password"
  | "voucher";

/** Every real value ``GuestSession.auth_method`` can come back as --
 * ``RuntimeAuthMethod`` above only lists the four a guest actually
 * *picks* on the sign-in card (see src/lib/portal-auth-methods.ts, whose
 * exhaustive per-method switch deliberately never has a "mac_whitelist"
 * case to handle, since it's never a selectable tab). ``mac_whitelist``
 * is real (``GuestService.login_via_mac_whitelist``) but only ever
 * *arrives* as a finished session's own auth method, never chosen by a
 * guest through this card. */
export type RuntimeSessionAuthMethod = RuntimeAuthMethod | "mac_whitelist";

/** The frontend's own client-side i18n dictionary only has these 5 -- a
 * real config's `default_language`/`supported_languages` are free text and
 * get validated against this set with an "en" fallback. */
export type RuntimeLanguage = "en" | "hi" | "ar" | "fr" | "es";

export interface RuntimePortalConfig {
  id: string;
  name: string;
  theme: "light" | "dark" | "custom";
  logoUrl: string | null;
  backgroundImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  defaultLanguage: RuntimeLanguage;
  supportedLanguages: RuntimeLanguage[];
  advertisementBannerUrl: string | null;
  advertisementBannerLink: string | null;
  termsAndConditionsText: string | null;
  termsAndConditionsUrl: string | null;
  privacyPolicyText: string | null;
  privacyPolicyUrl: string | null;
  splashHeadline: string | null;
  splashWelcomeMessage: string | null;
  redirectUrl: string | null;
  otpSmsEnabled: boolean;
  otpEmailEnabled: boolean;
  otpWhatsappEnabled: boolean;
  usernamePasswordEnabled: boolean;
  voucherEnabled: boolean;
  resolvedViaLocationOverride: boolean;
  /** Computed live, every resolve -- see the backend's validators
   * .is_open_now. Always true when business hours enforcement is off. */
  isOpenNow: boolean;
  businessHoursClosedMessage: string | null;
}

/** The real `GuestSessionResponse` (plus a couple of login-response-only
 * fields) -- returned once, at login. There is no guest-facing endpoint to
 * refresh this later, so it's persisted client-side (sessionStorage) rather
 * than re-fetched. */
export interface RuntimeSession {
  guestId: string;
  sessionId: string;
  deviceId: string | null;
  routerId: string;
  locationId: string;
  organizationId: string;
  authMethod: RuntimeSessionAuthMethod;
  status: string;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  ipAddress: string | null;
  bytesUploaded: number;
  bytesDownloaded: number;
  dataLimitMb: number | null;
  sessionTimeoutMinutes: number | null;
  isNewGuest: boolean;
  deviceMacAddress: string | null;
  deviceName: string | null;
  // Whether this guest already has a password set -- lets the "set a
  // password for next time?" prompt (shown right after an OTP login) know
  // whether to offer itself at all. Always true for a session that was
  // itself created via a password login (see
  // ``portalRuntimeService.loginWithPassword``, which only ever succeeds
  // for a guest that already has one).
  hasPassword: boolean;
}
