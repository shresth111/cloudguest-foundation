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

/** captive-portal-v6-design-spec.md §3.2 -- the curated, backend-validated
 * heading-font allowlist. Deliberately a closed enum, never free text (see
 * §1.3's real bug: the old admin font `<Select>` let an admin "choose" any
 * of 8 font names with zero backend field or asset behind any of them).
 * `system` (default) is `PG_FONT_STACK`, unchanged -- zero bytes, zero
 * requests, see `toGuestFontChoice` below and `src/lib/portal-guest-fonts.ts`
 * for the other three's real asset/metric specs. */
export const GUEST_FONT_CHOICES = [
  "system",
  "modern-sans",
  "editorial-serif",
  "bold-display",
] as const;
export type GuestFontChoice = (typeof GUEST_FONT_CHOICES)[number];

/** Validates a raw (possibly absent, possibly stale/invalid) backend value
 * against the real allowlist, falling back to `"system"` -- the same
 * fail-safe-to-the-zero-cost-default shape `toRuntimeLanguage` already uses
 * for `RuntimeLanguage`. Also the safety net for §7's "BE hasn't shipped
 * yet" case: an absent field resolves here exactly the same as an invalid
 * one, both to `"system"`, so this repo's change is safe to land ahead of
 * the backend one with zero behavior change for any venue. */
export function toGuestFontChoice(v: string | null | undefined): GuestFontChoice {
  return v && (GUEST_FONT_CHOICES as readonly string[]).includes(v)
    ? (v as GuestFontChoice)
    : "system";
}

/** captive-portal-v6-design-spec.md §4.2 -- integer 0-100, default 55 (the
 * value that reproduces today's hardcoded scrim exactly, see
 * `buildGuestBackdropScrim` in PortalShell.tsx). Clamped here defensively
 * (an absent/out-of-range/non-numeric backend value all resolve the same
 * way a missing field does pre-BE-landing, §7) -- the `[15, 85]` *render*
 * guardrail is separate and lives in `buildGuestBackdropScrim` itself
 * (§4.3: the stored value stays the admin's literal choice, only the
 * rendered opacity is guardrailed). */
export function clampBackgroundOverlayStrength(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : 55;
}

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
  /** captive-portal-v6-design-spec.md §3 -- heading-layer-only font choice
   * (`pg-display`/`pg-title`/`pg-subtitle`, never body/UI text). Default
   * `"system"` for every venue until an admin explicitly picks otherwise. */
  guestFontChoice: GuestFontChoice;
  /** captive-portal-v6-design-spec.md §4 -- 0-100, default 55. See
   * `buildGuestBackdropScrim` (PortalShell.tsx) for how this maps to the
   * actual rendered scrim gradient. */
  backgroundOverlayStrength: number;
}

/** The real `GuestSessionResponse` (plus a couple of login-response-only
 * fields) -- returned once, at login. There is no guest-facing endpoint to
 * refresh this later, so it's persisted client-side (sessionStorage) rather
 * than re-fetched. */
export interface RuntimeSession {
  guestId: string;
  /** The phone/email this guest verified via OTP/password/voucher, or (see
   * portal.index.tsx's live-session check) that a matching ACTIVE
   * GuestSession was already found under. Needed downstream by
   * portal.success.tsx's hotspot-login POST, which is keyed on this exact
   * value -- RadiusService.authorize looks up sessions by identifier, not
   * by guestId. */
  identifier: string;
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
