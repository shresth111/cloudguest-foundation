export type RuntimeAuthMethod = "otp_sms" | "otp_email" | "username_password" | "voucher";

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
  usernamePasswordEnabled: boolean;
  voucherEnabled: boolean;
  resolvedViaLocationOverride: boolean;
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
  authMethod: RuntimeAuthMethod;
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
