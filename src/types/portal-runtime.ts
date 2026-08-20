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

/** The languages the guest portal genuinely ships, matched deliberately to
 * the marketing site's own set (`wyfy-guest-website/src/i18n/ui/*.ts`), so a
 * guest who read wyfyguest.com in Tamil and then meets the portal in a lobby
 * hears one voice rather than two.
 *
 * WHAT CHANGED, AND WHY IT IS SAFE. This used to read
 * `"en" | "hi" | "ar" | "fr" | "es"`, which was a promise the code did not
 * keep: `portal-i18n.ts` gave `EN` and `HI` a full dictionary each while
 * `AR`, `FR` and `ES` defined six keys apiece and spread `...EN` for the
 * remaining 127. Ticking "العربية" for a venue therefore produced an English
 * portal with an Arabic Connect button and the entire layout mirrored to
 * RTL -- strictly worse for a guest than not offering the language at all.
 * Verified against production before removal: across all 12
 * `captive_portal_configs` rows, `supported_languages` is only `["en"]`
 * (11 venues) or `["en","hi"]` (1). No venue had ever selected `ar`, `fr`
 * or `es`, so nothing regressed for anyone.
 *
 * The eight added alongside `hi` are full 133-key dictionaries, not spreads.
 *
 * Order is deliberate and is the order the guest language switcher renders
 * in: English, then Hindi, then the other eight by speaker count.
 *
 * `default_language`/`supported_languages` remain free text on the backend
 * (no migration -- see `toRuntimeLanguage` and `resolveLanguageSelection`
 * below for how a stale stored value from before this change is handled). */
export const RUNTIME_LANGUAGES = [
  "en",
  "hi",
  "bn",
  "mr",
  "te",
  "ta",
  "gu",
  "kn",
  "ml",
  "pa",
] as const;

export type RuntimeLanguage = (typeof RUNTIME_LANGUAGES)[number];

/** Each language's name IN THAT LANGUAGE -- never the English exonym. A guest
 * scanning the switcher for their own language is looking for the word they
 * would recognize, and by definition they may not read the one it is listed
 * under otherwise. Same set and same spellings the marketing site's own
 * picker uses, so the two never disagree in front of the same person.
 *
 * Single source of truth on purpose: `portal.ts`'s `LANGUAGES` (the admin
 * multi-language picker) and `portal-i18n.ts`'s `LANGUAGE_LABEL` (the guest
 * switcher) used to be two hand-maintained copies of the identical map, one
 * of which had to be updated by hand every time the other was. Both now read
 * this. It lives here rather than in `portal-i18n.ts` because this module has
 * no imports at all -- the admin dashboard can render the picker without
 * pulling ten guest dictionaries into its bundle. */
export const RUNTIME_LANGUAGE_LABEL: Record<RuntimeLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  mr: "मराठी",
  te: "తెలుగు",
  ta: "தமிழ்",
  gu: "ગુજરાતી",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  pa: "ਪੰਜਾਬੀ",
};

/** Validates one raw (possibly absent, possibly stale) backend language code
 * against the real allowlist. Returns `undefined` -- NOT `"en"` -- for an
 * unrecognized code, which is the whole point: the old version of this
 * coerced every unknown value to `"en"`, and because it was mapped over the
 * whole `supported_languages` array, a venue whose stored config still said
 * `["en","ar","fr"]` rendered THREE switcher entries all labelled "English",
 * all sharing the React key `"en"`. Callers that need a concrete language
 * use `resolveLanguageSelection` below, which decides the fallback once, at
 * the level where it is actually meaningful. */
export function toRuntimeLanguage(v: string | null | undefined): RuntimeLanguage | undefined {
  return v && (RUNTIME_LANGUAGES as readonly string[]).includes(v)
    ? (v as RuntimeLanguage)
    : undefined;
}

/** Turns a config's raw `default_language` + `supported_languages` into a
 * pair this app can render without any further defensive checks.
 *
 * Guarantees, in order:
 *   1. Unknown codes are DROPPED, never coerced. A venue still storing the
 *      removed `"ar"`/`"fr"`/`"es"` (or a typo, or a future code this build
 *      doesn't know yet) simply doesn't get that entry -- it does not become
 *      a duplicate "English".
 *   2. The result is de-duplicated, preserving first-seen order, so the
 *      switcher can key on the language code safely.
 *   3. The result is never empty. A config whose every stored language was
 *      unrecognized degrades to `["en"]` -- the portal still renders, in
 *      English, with a single correct switcher entry.
 *   4. `defaultLanguage` is always a member of `supportedLanguages`. Both
 *      the admin UI (see `PortalLanguagesPanel`) and stale stored data could
 *      previously produce `defaultLanguage: "hi"` alongside
 *      `languages: ["en"]`, at which point the portal booted into a language
 *      the guest's switcher never offered and so could not switch out of.
 *
 * Deliberately lives here, next to the type, rather than in either consumer:
 * `portal-runtime.service.ts` (the real backend response) and
 * `PortalPage.tsx` (the admin's live preview of an unsaved config) each had
 * their own copy of the coercion, and the two had already drifted. This
 * module imports nothing, so both can share it with no bundle cost -- the
 * same reason `toGuestFontChoice` lives here too. */
export function resolveLanguageSelection(
  rawDefault: string | null | undefined,
  rawSupported: readonly string[] | null | undefined,
): { defaultLanguage: RuntimeLanguage; supportedLanguages: RuntimeLanguage[] } {
  const seen = new Set<RuntimeLanguage>();
  for (const raw of rawSupported ?? []) {
    const lang = toRuntimeLanguage(raw);
    if (lang) seen.add(lang);
  }
  const fallbackDefault = toRuntimeLanguage(rawDefault);
  if (!seen.size && fallbackDefault) seen.add(fallbackDefault);
  if (!seen.size) seen.add("en");

  const supportedLanguages = [...seen];
  const defaultLanguage =
    fallbackDefault && supportedLanguages.includes(fallbackDefault)
      ? fallbackDefault
      : supportedLanguages[0];

  return { defaultLanguage, supportedLanguages };
}

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

/** captive-portal-v7-design-spec.md §1.4 C4 -- integer percentages of the
 * background image's own width/height, defaulting to 50/25. Those two
 * numbers are not a taste judgement: together they are precisely the
 * frontend's previous hardcoded `background-position: center 25%`, so a
 * venue that has never touched the (not-yet-built) focal-point picker
 * renders exactly as it did before. Same defensive clamp shape as
 * `clampBackgroundOverlayStrength` above -- absent, out-of-range and
 * non-numeric all resolve to the default. */
export function clampBackgroundFocal(v: number | null | undefined, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : fallback;
}

/** captive-portal-v7-design-spec.md §1.4 C3/C5 -- one of the three 0-100
 * `brandings` measurements the v7 upload pipeline computes once per image.
 *
 * **`null` is a first-class value here and means "never measured", not
 * "measured 0".** Backend migration 0089 makes these three columns nullable
 * for exactly this reason, and spells it out: 0 is a legitimate reading (a
 * genuinely black photo), so a NOT NULL DEFAULT 0 would have made "we have
 * not looked at this image" indistinguishable from "we looked, and it is
 * black". The frontend needs to tell those apart -- with a measurement it
 * may use *less* scrim than it otherwise would, and without one it falls
 * back to the unconditional §1.3 floor, which is AA-compliant over any
 * image whatsoever. So this deliberately does not coerce to a number.
 *
 * The value is also legitimately absent for a config that carries its own
 * typed-in `background_image_url` (nothing measured it), and for any image
 * uploaded before the v7 pipeline existed and not yet backfilled. */
export function toBackgroundMetric(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : null;
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
   * `buildGuestBackdropScrim` (src/lib/portal-backdrop.ts) for how this maps
   * to the actual rendered scrim gradient, and for why 55 is not an
   * arbitrary default: it is already above the §1.3 light-polarity floor of
   * 0.501, which is why today's shipped render is compliant. */
  backgroundOverlayStrength: number;
  /** captive-portal-v7-design-spec.md §1.4 C4 -- per-venue background focal
   * point, 0-100 percentages, defaulting to 50/25. Per-venue on
   * `captive_portal_configs` rather than org-level on `brandings` on
   * purpose: the *same* shared organization photo should crop differently at
   * different venues. Note that on phones only `backgroundFocalX` has any
   * effect -- `cover` overflows horizontally for every plausible upload on a
   * portrait viewport, so `backgroundFocalY` is real only on wide/short
   * viewports and on desktop for portrait uploads. Measured matrix in
   * `resolveFocalPosition`. */
  backgroundFocalX: number;
  backgroundFocalY: number;
  /** captive-portal-v7-design-spec.md §1.4 C3 -- mean luma (0-100) of the
   * resolved background image, or `null` when nothing has measured it.
   * Sourced from the organization's `brandings` row, so it is present only
   * when the background actually came from that upload. See
   * `toBackgroundMetric` for why `null` and `0` must never be conflated. */
  backgroundLuminance: number | null;
  /** Mean luma (0-100) of the image's top band -- the zone a headline sits
   * over, and therefore the measurement scrim polarity leads on. Same source
   * and same `null` semantics as `backgroundLuminance`. */
  backgroundTopLuminance: number | null;
  /** Normalized histogram entropy (0-100): how *busy* the image is. Feeds
   * §1.4 C5's refusal rule, because a mathematically compliant contrast
   * ratio still reads badly when glyph edges compete with image edges --
   * the one failure mode no amount of scrim alpha can fix. Same source and
   * same `null` semantics as `backgroundLuminance`. */
  backgroundEntropy: number | null;
  /** Real, functional login method (backend `GuestService.login_via_pin`,
   * `POST /guest/login/pin`), gated per location and defaulting **off**
   * unlike `usernamePasswordEnabled` -- a PIN is a materially weaker secret,
   * so an operator opts in deliberately. Returned by
   * `GET /captive-portal/resolve` since backend 0085 and, until now, dropped
   * on the floor by `toRuntimeConfig`: a venue could switch PIN login on in
   * the admin UI and the guest portal would never offer it. Mapped here so
   * the sign-in surface has a real field to gate a real method on rather
   * than a fabricated control (§0.1 item 6). */
  pinLoginEnabled: boolean;
  /** v7 Part 3 (P4) -- whether the "Powered by Wyfy Guest" mark renders.
   * `true` is the only value a venue can have without the white-label
   * entitlement: the backend (`feat/v7-part23-backend`, same-named branch in
   * `cloud-guest-repo/backend`) adds `powered_by_enabled Boolean NOT NULL
   * DEFAULT true` and 402s any attempt to set it `false` without
   * `white_label.*`. Consumed optimistically here (`?? true` in
   * `toRuntimeConfig`) so this frontend is correct both before and after
   * that PR lands -- absence and `true` render identically, which is
   * today's behaviour byte-for-byte. The mark itself stays deliberately
   * prominent for everyone else: the honest rationale is venue-acquisition
   * brand recall plus anti-spoofing (a consistent operator mark is harder
   * to fake convincingly than a bare venue page), NOT the inverted
   * "guests distrust WiFi" claim -- §8.3's own survey has 67% feeling safe. */
  poweredByEnabled: boolean;
  /** The resolved location's own ISO 3166-1 alpha-2 country (e.g. `"IN"`),
   * **not** a phone dialing code -- the frontend owns that mapping, see
   * `src/lib/portal-locale.ts`. `null` when the config was resolved by
   * `organizationId` alone, with no location context to source a country
   * from. A real admin-entered physical-address field, and strictly more
   * reliable than `defaultLanguage` for defaulting the OTP phone field's
   * country code. */
  locationCountry: string | null;
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
