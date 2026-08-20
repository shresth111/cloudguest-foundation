import type { RuntimeLanguage } from "@/types/portal-runtime";

/**
 * v4 UX §3.4/§6.3: `countryCode` used to default to a hardcoded `"+1"` in
 * a freeform text input. The incidents on record (Haldwani, "sector 12")
 * point at India-based venues as this platform's real, live deployment
 * base -- a `+1` default is friction for the actual guest base, not a
 * neutral placeholder.
 *
 * **Corrected in v7.** The previous version of this comment said
 * "`RuntimePortalConfig` has no dedicated 'venue country' field (only
 * `defaultLanguage`)" and built a language-based heuristic around that
 * claim. The claim was stale, and had been since backend PR #33 ("Expose
 * resolved location's country on GET /captive-portal/resolve"):
 * `location_country` is a real, admin-entered ISO 3166-1 alpha-2 field on
 * the location's own physical address, it has been on every resolve
 * response for months, and `toRuntimeConfig` was simply dropping it. The
 * backend field's own description says as much -- "strictly more reliable
 * than default_language for defaulting a guest-facing OTP phone field's
 * country-calling-code prefix". So the heuristic was standing in for a fact
 * that was already available.
 *
 * The signals are therefore ordered strongest-first:
 *
 *   1. `locationCountry` -- what an admin actually typed into the venue's
 *      address. `null` only when the config was resolved by organization
 *      alone, with no location context to source a country from.
 *   2. `defaultLanguage === "hi"` -- a venue whose own default language is
 *      Hindi is confidently India-based. Kept as a fallback rather than
 *      deleted, because it still answers the org-level-resolve case.
 *   3. The guest's own browser locale region.
 *   4. The confirmed real deployment base (India), rather than the original
 *      `+1`, which was wrong for most actual venues.
 *
 * Note the backend deliberately returns the raw alpha-2 rather than a
 * pre-computed `"+91"`, so the alpha-2 -> dialing-code mapping below stays a
 * presentation concern owned here. The field stays a plain, editable text
 * input regardless (see GuestSignInCard) -- this only picks a better
 * starting point, never blocks a guest from typing a different one.
 */
const COUNTRY_CODE_BY_REGION: Record<string, string> = {
  IN: "+91",
  US: "+1",
  CA: "+1",
  GB: "+44",
  AE: "+971",
  SA: "+966",
  FR: "+33",
  ES: "+34",
  AU: "+61",
  SG: "+65",
  NP: "+977",
  BD: "+880",
  PK: "+92",
  LK: "+94",
};

/** This platform's confirmed real deployment base (Haldwani, "sector 12")
 * -- the honest fallback when no other signal (venue language, browser
 * locale) is available, rather than the previous `+1`, which this
 * codebase has no real evidence was ever right for a real venue. */
const FALLBACK_COUNTRY_CODE = "+91";

export function defaultCountryCode(
  defaultLanguage?: RuntimeLanguage,
  /** `RuntimePortalConfig.locationCountry` -- ISO 3166-1 alpha-2, e.g.
   * `"IN"`. Optional so that any caller that has no config in hand still
   * compiles and still gets the previous behaviour exactly. Upper-cased
   * defensively: the column is free text at the database level, and a
   * lower-case `"in"` is a plausible thing for an admin to have typed. */
  locationCountry?: string | null,
): string {
  if (locationCountry) {
    const mapped = COUNTRY_CODE_BY_REGION[locationCountry.trim().toUpperCase()];
    // An unrecognized country is not an error and is not a reason to give
    // up -- the table below is a curated list of this platform's real
    // markets, not a complete ISO registry, so an unmapped-but-valid country
    // simply falls through to the next-strongest signal.
    if (mapped) return mapped;
  }
  if (defaultLanguage === "hi") return "+91";
  if (typeof navigator !== "undefined" && navigator.language) {
    try {
      // `Intl.Locale.maximize()` fills in a likely region even for a
      // language-only tag like `"en"` (-> `"en-US"`) -- best-effort, never
      // throws for a well-formed BCP-47 tag, but guarded anyway since this
      // runs on a guest's own possibly-unusual browser/webview locale
      // string pre-auth.
      const region = new Intl.Locale(navigator.language).maximize().region;
      if (region && COUNTRY_CODE_BY_REGION[region]) return COUNTRY_CODE_BY_REGION[region];
    } catch {
      // Fall through to the fixed fallback below.
    }
  }
  return FALLBACK_COUNTRY_CODE;
}

/**
 * captive-portal-v7-design-spec.md §8.1: "`+91` as a fixed non-editable
 * prefix (not a country dropdown -- this is one country), `maxlength="10"`,
 * and strip spaces, dashes, a leading zero and a pasted `+91`."
 *
 * The `+91` in that sentence is the spec writing down the one market this
 * platform actually deploys into. It is *not* hardcoded here, because the
 * real signal already exists and is stronger: `defaultCountryCode()` above
 * derives the dialling code from `location_country`, the venue's own
 * admin-entered address country, which the backend has returned on every
 * `GET /captive-portal/resolve` since PR #33. So an Indian venue gets a
 * fixed `+91` and a UK venue gets a fixed `+44`, from real config, and the
 * guest still never has to think about a country control. Only the length
 * bound below has to know anything country-specific, and only for the two
 * national plans this platform has real venues in.
 */
const NATIONAL_NUMBER_LENGTH: Record<string, number> = {
  // India and NANP are both flat 10-digit national numbers.
  "+91": 10,
  "+1": 10,
};

/** How long the national part of a number may be, given the venue's own
 * dialling code. Falls back to 15 -- E.164's own hard ceiling on the whole
 * number including the country code, so it can never be too short for a
 * real number -- rather than guessing a plan this codebase has no venues
 * in. Used for `maxLength`, which is a typo guard, never validation. */
export function nationalNumberMaxLength(dialCode: string): number {
  return NATIONAL_NUMBER_LENGTH[dialCode] ?? 15;
}

/**
 * Reduce whatever a guest typed or pasted into the phone box to the bare
 * national digits that belong *after* the fixed dialling-code prefix.
 *
 * Handles, in order: separators (spaces including NBSP, dashes, dots,
 * parens, the Unicode dashes an iOS keyboard and a copied contact card
 * both produce), the `00` international prefix, an explicitly-written
 * country code, and a trunk-prefix leading zero.
 *
 * **Deliberately does not strip a bare leading `91`** (no `+`, no `00`).
 * Indian mobile numbers begin with 6-9, so `9198765432` is a perfectly
 * ordinary real 10-digit number, and a "looks like it starts with the
 * country code" heuristic would silently mangle it into an 8-digit number
 * and send the OTP nowhere. Only an *explicit* international form (`+91…`
 * or `0091…`) is unambiguous enough to strip, which is exactly the case
 * §8.1 names -- a guest pasting a number they copied from somewhere else.
 */
export function normalizeNationalPhone(raw: string, dialCode: string): string {
  let v = raw.replace(/[\s().\u2010-\u2015-]/g, "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (v.startsWith("+")) {
    const digits = v.slice(1).replace(/\D/g, "");
    const cc = dialCode.replace(/\D/g, "");
    v = cc && digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  } else {
    v = v.replace(/\D/g, "");
  }
  // The trunk prefix. Every national plan that uses one drops it in
  // international format, which is the only format this number is ever
  // sent in (the fixed prefix is concatenated on submit).
  return v.replace(/^0+/, "");
}
