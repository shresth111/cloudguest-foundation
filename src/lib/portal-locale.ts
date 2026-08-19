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
