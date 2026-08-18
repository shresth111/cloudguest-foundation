import type { RuntimeLanguage } from "@/types/portal-runtime";

/**
 * v4 UX §3.4/§6.3: `countryCode` used to default to a hardcoded `"+1"` in
 * a freeform text input. The incidents on record (Haldwani, "sector 12")
 * point at India-based venues as this platform's real, live deployment
 * base -- a `+1` default is friction for the actual guest base, not a
 * neutral placeholder.
 *
 * `RuntimePortalConfig` has no dedicated "venue country" field (only
 * `defaultLanguage`), so this derives a best-effort default rather than
 * inventing a signal that doesn't exist: a venue whose own default
 * language is Hindi is confidently India-based; otherwise this falls back
 * to the guest's own browser locale region, and only when neither gives a
 * real signal does it fall back to the confirmed real deployment base
 * (India) rather than the previous `+1`, which was wrong for most actual
 * venues. The field stays a plain, editable text input regardless (see
 * GuestSignInCard) -- this only picks a better starting point, never
 * blocks a guest from typing a different one.
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

export function defaultCountryCode(defaultLanguage?: RuntimeLanguage): string {
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
