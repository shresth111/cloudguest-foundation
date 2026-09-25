/** Dependency-free so scripts/test-marketing-ui.mjs can execute it. */

/**
 * `/marketing/status` reports the EFFECTIVE wording: the venue's custom text,
 * or the default sentence filled in with the venue name when none is set
 * (backend `_consent_view`). That default shape is recognised here.
 */
const DEFAULT_CONSENT_RE =
  /^Send me offers and updates from .+ by SMS, WhatsApp and email\. I can unsubscribe any time\.$/;

export function isDefaultConsentText(text: string | null | undefined): boolean {
  return !text || DEFAULT_CONSENT_RE.test(text.trim());
}

/**
 * The `text` to send with an on/off toggle so the wording does NOT change.
 *
 * Omitting `text` made the backend null a custom wording and bump the
 * version, so every guest holding the old version got 409
 * `stale_consent_text`. Sending the effective text back verbatim would make
 * the opposite mistake for a venue on the default: the filled-in default
 * would be stored as a "custom" wording, which is also a change and also a
 * new version. So: the custom text as-is, and `null` (= "the default") when
 * the current wording is the default. Either way the stored value is what
 * it already was, under any reading of an omitted field.
 */
export function consentTextForToggle(effectiveText: string | null | undefined): string | null {
  return isDefaultConsentText(effectiveText) ? null : (effectiveText ?? "").trim();
}
