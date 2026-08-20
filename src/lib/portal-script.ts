/**
 * Which writing system a venue-supplied string is set in -- and specifically,
 * whether it is one whose glyphs need more vertical room than the Latin type
 * scale allocates.
 *
 * WHY THIS IS NOT `:lang()`
 * -------------------------
 * `PortalRuntimeContext` already sets `document.documentElement.lang` to the
 * guest's chosen UI language, so a `:lang(hi)` rule would work -- for Hindi,
 * and only when the guest happens to be reading the portal in Hindi. That is
 * the wrong key for this problem twice over:
 *
 *  - The venue's NAME is not translated. A hotel called
 *    "ஸ்ரீ மகாராஜா அரண்மனை" renders its Tamil name inside an English UI on
 *    `lang="en"`, and gets no help at all.
 *  - Conversely an English-named venue read in Hindi would get extra leading
 *    on a Latin headline, loosening type that was fine.
 *
 * The property that actually matters is a property of the *string being
 * painted*, so it is measured on the string.
 *
 * WHAT THE DEFECT IS
 * ------------------
 * `pg-title` sets `line-height: 1.15`, tuned for Latin. Brahmic scripts hang
 * from a head-stroke (the *shirorekha* in Devanagari) with matras stacking
 * both above and below it, so the inked vertical envelope at a given
 * font-size is much taller than Latin's. Measured in a real browser at
 * 390x844, `--pg-type-scale: 1.25` (32.5px), a 40-character Devanagari venue
 * name on the shipped system stack: each line's client rect is **42px tall
 * inside a 37.375px line box**, and successive line tops are 37.3px apart --
 * a **4.7px overlap between every pair of lines**, scaling to 3.7px at the
 * default type scale. Line 2's upper matras collide with line 1's
 * descenders. It is a rendering fault, not a matter of taste, and it is
 * invisible to anyone testing in English.
 *
 * Published metrics put Noto Sans Devanagari -- the Android/Linux fallback
 * named in `PG_FONT_STACK`, i.e. the majority case for this product -- at an
 * ink box of roughly 1.36em, worse than the face this was measured on.
 *
 * Deliberately a coarse Brahmic/Indic test rather than per-script tuning:
 * one extra leading value that clears the worst of them is honest, and a
 * per-script table would be nine numbers nobody re-measures when a font
 * updates.
 */

/**
 * Unicode blocks whose default typographic envelope exceeds Latin's at the
 * same font-size, because marks stack above *and* below the base line.
 *
 * One contiguous span, U+0900-U+0EFF, which is exactly:
 *
 *   U+0900-U+097F  Devanagari        U+0980-U+09FF  Bengali/Assamese
 *   U+0A00-U+0A7F  Gurmukhi          U+0A80-U+0AFF  Gujarati
 *   U+0B00-U+0B7F  Odia              U+0B80-U+0BFF  Tamil
 *   U+0C00-U+0C7F  Telugu            U+0C80-U+0CFF  Kannada
 *   U+0D00-U+0D7F  Malayalam         U+0D80-U+0DFF  Sinhala
 *   U+0E00-U+0E7F  Thai              U+0E80-U+0EFF  Lao
 *
 * The two supplementary blocks that also belong to this family --
 * U+1CD0-U+1CFF (Vedic Extensions) and U+A8E0-U+A8FF (Devanagari Extended)
 * -- are deliberately NOT listed. Both consist entirely of combining marks,
 * so eslint's `no-misleading-character-class` rightly objects to matching
 * them in isolation, and they would never change an answer anyway: a string
 * containing one always contains a Devanagari base character from
 * U+0900-U+097F, which is already inside the span.
 *
 * Written as an explicit range list rather than a `\p{Script=...}` property
 * escape: the escape form needs the `u` flag plus Unicode property support,
 * which is fine in every browser this ships to but is exactly the kind of
 * thing that fails silently in a stripped captive-portal WebView. This form
 * has no such dependency.
 *
 * Written with `\u` escapes rather than literal characters, and not only for
 * readability: several of these block boundaries are combining marks, and a
 * literal `[क-ෟ]` reads to both a human and to eslint's
 * `no-misleading-character-class` as a range between *grapheme clusters*
 * rather than between code points. The escaped form says exactly what it
 * means.
 */
const TALL_SCRIPT_RE = /[\u0900-\u0EFF]/;

/** `"tall"` when the string contains any codepoint from a script whose ink
 * box exceeds the Latin type scale's line box; `undefined` otherwise, so it
 * can be spread straight onto a `data-` attribute and simply not appear for
 * the overwhelmingly common Latin case. */
export function scriptClassOf(text: string | null | undefined): "tall" | undefined {
  return text && TALL_SCRIPT_RE.test(text) ? "tall" : undefined;
}
