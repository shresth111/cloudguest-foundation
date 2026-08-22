/**
 * Devanagari coverage for the Guided Setup surface, self-hosted.
 *
 * WHAT WAS ALREADY THERE, AND WHY IT WAS NOT ENOUGH.
 *
 * `--font-sans` in `src/styles.css` already lists "Noto Sans Devanagari"
 * and "Nirmala UI" -- but only as SYSTEM font NAMES, i.e. zero bytes and
 * whatever the machine happens to have. And `__root.tsx` does fetch
 * `Noto+Sans+Devanagari` from fonts.googleapis.com after first paint.
 * Neither is a dependency this surface can take:
 *
 *   - Guided Setup is used standing at a rack, on whatever laptop or
 *     phone is to hand, on a link that is frequently the venue's own
 *     half-provisioned WiFi. A Google Fonts CDN fetch is exactly the
 *     request that fails there, and its failure mode is silent: the
 *     operator gets the OS's Devanagari face at a different weight and
 *     line height, or on a machine without one, tofu -- in a step whose
 *     entire job is "read this and compare it to what the router said".
 *   - It is a third-party origin on an operator console. Self-hosting is
 *     one same-origin request to a host he is already authenticated
 *     against and already loading the app from.
 *
 * WHY A <style> TAG AND NOT `src/styles.css`.
 *
 * `styles.css` is global -- it reaches the guest captive portal, whose
 * "zero font bytes" rule is a hard, mechanically-enforced invariant (see
 * `scripts/check-a11y-invariants.mjs` section 5: Android's captive-portal
 * WebView clears its cache on every activity creation, so a webfont there
 * is re-downloaded forever and never amortises). An `@font-face` cannot be
 * scoped by a selector, so declaring it there would put a face in reach of
 * that surface. Rendering it from this component instead means the rule
 * exists only while a Guided Setup screen is mounted, and the file itself
 * is fetched only when a Devanagari codepoint is actually painted.
 *
 * WHY THE FAMILY IS FIRST IN THE STACK, WHICH LOOKS LIKE THE BUG THE
 * CODEBASE WARNS ABOUT.
 *
 * `--font-sans` and `PG_FONT_STACK` both put their Indic families LAST,
 * because those entries name a family and "Noto Sans Devanagari" carries a
 * complete Latin set -- ahead of the generics it silently restyles the
 * entire English UI on any machine where it resolves. That hazard is a
 * property of naming a family, not of Devanagari. This @font-face declares
 * `unicode-range` covering the Devanagari blocks only, so the browser will
 * not even consider it for a Latin codepoint: it cannot capture English,
 * and putting it first is what guarantees that Devanagari gets OUR face
 * rather than a system one. The system names are kept behind it as the
 * fallback for the window before the file arrives.
 */

/** One variable woff2 (wght 400-700), Devanagari subset only, ~118 KB.
 * Taken from Google's own `Noto+Sans+Devanagari` v30 devanagari subset and
 * committed under `public/fonts/master/` -- see the LICENSE file beside
 * it (SIL Open Font License 1.1). */
const FONT_CSS = `
@font-face {
  font-family: "Wyfy Devanagari";
  src: url("/fonts/master/noto-sans-devanagari-v30-devanagari.woff2") format("woff2");
  font-weight: 400 700;
  font-style: normal;
  font-stretch: 100%;
  font-display: swap;
  unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF;
}
.guided-setup-surface,
/* Sonner renders into a portal at <body>, outside .guided-setup-surface --
   and several of this module's toasts are translated ("Copy ho gaya",
   "Progress reset ho gaya"). Scoped to the toaster rather than :root so
   the rule still cannot reach any other surface. */
[data-sonner-toaster] {
  font-family: "Wyfy Devanagari", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", Roboto, "Noto Sans Devanagari", "Nirmala UI", sans-serif;
}
`;

/**
 * Mounted once, above every Guided Setup branch (including the demo,
 * loading and not-found screens, which are translated too). Rendering the
 * same <style> text more than once would be harmless, but once is enough.
 */
export function GuidedDevanagariFont() {
  return <style>{FONT_CSS}</style>;
}
