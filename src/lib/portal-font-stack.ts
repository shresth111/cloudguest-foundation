/**
 * THE guest-portal font stack. One definition, imported by everything on
 * the JS side; mirrored once (not four times) on the CSS side as
 * `--pg-font-stack` in `styles.css`.
 *
 * This module deliberately has ZERO imports. That is what makes it usable
 * as the single source of truth: `PortalShell.tsx` imports from
 * `PortalRuntimeContext.tsx`, which imports `portal-guest-fonts.ts`, so
 * any attempt to hang the constant off one of those three and import it
 * from the others is a cycle. A leaf module with no imports cannot be part
 * of one. `PortalShell.tsx` re-exports `PG_FONT_STACK` and
 * `portal-guest-fonts.ts` re-exports it as `PG_FALLBACK_FONT_STACK`, so
 * every existing import path still resolves -- the two names are now
 * literally the same string object rather than two hand-synced copies that
 * a review has to diff character by character.
 *
 * =====================================================================
 * ZERO FONT BYTES, ON EVERY PLATFORM. Every name below is a font the
 * device already has. No `@font-face`, no self-hosted Latin face, no CDN,
 * no request. That is a hard requirement on this surface, not a
 * preference, and it is worth restating why, because the usual webfont
 * economics ("N KB once, then cached forever") are simply false here:
 *
 *   * Android's `CaptivePortalLoginActivity.initializeWebView()` calls
 *     `webview.clearCache(true)` -- `includeDiskFiles = true`,
 *     application-wide -- as one of its first acts, on EVERY activity
 *     creation. There is no repeat-visit amortisation for any subresource
 *     in this WebView, ever. A daily regular at the same cafe re-downloads
 *     the font every single morning, on the worst connection in the
 *     product, pre-authentication.
 *   * The standard mitigation for the resulting swap -- a metric-override
 *     fallback face (`size-adjust` / `ascent-override`) -- is structurally
 *     unavailable to us. It requires knowing what the fallback font IS,
 *     and ~68% of the Indian market (vivo, Xiaomi, realme, Samsung, OPPO)
 *     runs an OEM UI font -- vivo Sans / MiSans / OPPO Sans / One UI Sans
 *     -- whose metrics are not published and not measurable off-device.
 *
 * So the stack below is the entire typographic budget for this surface,
 * and every entry has to earn its place by being free.
 * =====================================================================
 *
 * Order, and why each entry is where it is:
 *
 *  1. `-apple-system` -- WebKit-only alias for the system font. Wins on
 *     iOS Captive Network Assistant, Safari, and every iOS browser (all
 *     WebKit). Resolves to San Francisco with Apple's own optical sizing
 *     applied automatically. Zero bytes, licence-clean: this is the OS
 *     drawing with its own font, which is a categorically different thing
 *     from redistributing it -- Apple's font licence forbids embedding SF
 *     in any software product, and forbids using it even to mock up a UI
 *     intended for a non-Apple OS, but says nothing about `-apple-system`
 *     at runtime on an Apple device. Locked at position 1.
 *  2. `BlinkMacSystemFont` -- Chrome/Edge on macOS, for versions
 *     predating reliable `system-ui`. Free; an unknown family name
 *     everywhere else, so it is skipped silently off macOS.
 *  3. `"Segoe UI Variable Text"` -- Windows 11's ACTUAL system font, and
 *     the reason it has to be named: Microsoft is explicit that XAML picks
 *     it automatically but "when using HTML ... you will need to specify
 *     the Segoe UI Variable font in CSS". Without this entry a Windows 11
 *     guest gets static Segoe UI rather than the OS's current font. There
 *     is no bare `"Segoe UI Variable"` family -- the registered families
 *     are `Display`, `Text` and `Small`; `Text` is the body-UI cut. Its
 *     `opsz` axis (8-36pt, automatic) gives Windows 11 optical-sizing
 *     behaviour genuinely analogous to SF's, for nothing. Windows 10 does
 *     not have the family, does not resolve the name, and falls to #4 with
 *     no FOUT and no reflow -- exactly the case CSS family fallback exists
 *     for.
 *  4. `"Segoe UI"` -- Windows 10 and older (ships Vista onward), and the
 *     Windows 11 fallback.
 *  5. `Roboto` -- kept deliberately, with eyes open, and probably a no-op.
 *     `Roboto` is NOT a resolvable CSS family name on stock Android: Skia's
 *     `SkFontMgr_android::addFamily()` indexes families exclusively by the
 *     `name=` attributes and `<alias>` elements in `fonts.xml` (the font
 *     file's own internal name table is never used as a lookup key), and
 *     AOSP's `fonts.xml` declares no `roboto` family and no `roboto`
 *     alias -- the Roboto file is the *content* of the family named
 *     `sans-serif`. So this entry costs nothing when it misses, and pulls
 *     a skinned device back toward stock on the minority of devices where
 *     an OEM happens to have added the alias. Placed BEFORE `system-ui`
 *     so cross-device consistency wins over device-nativeness when it is
 *     available for free, and guarded on the left by the Apple and Segoe
 *     entries so a Mac or a Windows box with Roboto installed still gets
 *     its own system font.
 *  6. `system-ui` -- the real Android/Windows/Linux system font, and what
 *     the ~68% of the Indian market on an OEM skin actually renders in.
 *     NOT a synonym for `-apple-system`: that is a WebKit family alias,
 *     this is a spec generic whose resolution is per-platform and, on
 *     Android, deliberately unoverridable (Blink's
 *     `FontCache::SetSystemFontFamily()` is an empty no-op there).
 *  7-15. THE INDIC BLOCK, WHICH MUST STAY BEHIND `system-ui`. See below.
 *  16. `sans-serif` -- terminal generic.
 *
 * DROPPED: `ui-sans-serif`. Per MDN's browser-compat data it is
 * implemented in Safari only (13.1+) -- not Chrome, not Chrome Android,
 * not WebView Android, not Firefox -- and on Safari `-apple-system` has
 * already won at position 1. It has never done anything on any platform on
 * this stack. Pure noise, removed.
 *
 * ---------------------------------------------------------------------
 * WHY THE INDIC FAMILIES ARE AFTER `system-ui`, AND WHY THAT IS A BUG FIX
 * RATHER THAN TIDYING
 *
 * CSS font matching is PER CHARACTER: for every codepoint the engine walks
 * this list left to right and takes the first family that has a glyph for
 * it. `Noto Sans Devanagari` is not a Devanagari-only font -- it carries a
 * COMPLETE LATIN SET. So while these families sat ahead of the generics,
 * on any machine where the family name resolved, the ENTIRE PORTAL
 * INCLUDING ENGLISH rendered in Noto Sans Devanagari's Latin instead of
 * the system UI font.
 *
 * Latent on Android (the name does not resolve) and on stock
 * Windows/macOS (font not installed), but live today on a Linux or
 * ChromeOS laptop guest with `fonts-noto-devanagari` present -- a real
 * co-working-space guest. Measured in Chrome via
 * `CSS.getPlatformFontsForNode` (the engine's own report of what it
 * actually drew with), on the real headline string at 26px/700:
 *
 *     old ordering: "Welcome to The Leela Palace"
 *                   -> Noto Sans Devanagari, 27/27 glyphs, 359.69px
 *     new ordering: "Welcome to The Leela Palace"
 *                   -> system UI font,      27/27 glyphs, 336.80px
 *     control (font-family: system-ui alone)              336.80px
 *
 * i.e. the old ordering silently ran the whole English portal 6.8% wide in
 * the wrong typeface. The new ordering is pixel-identical to the control.
 *
 * `"Nirmala UI"` has to move for the identical reason: it carries Latin
 * too. The previous comment argued it was safe because it sat after
 * `"Segoe UI"` -- true on Windows, where Segoe UI claims Latin first, but
 * that argument does not hold anywhere else, and "it is only wrong off the
 * one platform that has it" is not a property worth relying on.
 *
 * Moving them back costs nothing for the script they exist to serve.
 * Devanagari, Bengali, Gujarati, Gurmukhi, Kannada, Malayalam, Tamil and
 * Telugu codepoints are absent from every Latin entry above, so the walk
 * falls through all six of them and lands on these families exactly as
 * before -- verified in Chrome, including the case that looks riskiest:
 * on macOS `system-ui` (.SF NS) still does not claim a Devanagari
 * codepoint even though the OS has a Devanagari face, because Blink
 * matches against the named family's own cmap and only consults the
 * platform's last-resort cascade after the whole list is exhausted.
 *
 * CONJUNCTS ARE NOT SPLIT BY THIS REORDER. A cluster resolves entirely
 * within one font because the Latin entries cover NONE of U+0900-097F --
 * zero overlap across the whole block, including the dandas U+0964/0965
 * and the Devanagari digits U+0966-096F, the usual culprits for a mid-word
 * run split. The font-run boundary lands exactly on the script boundary.
 * Verified after the reorder, not assumed: "विद्यालय" resolves 6/6 glyphs in
 * one font, "हिन्दी।" 6/6 including the danda, "१२३४५" 5/5.
 *
 * The one case where the reorder does change which font claims a
 * codepoint is ZWNJ (U+200C), which `system-ui` now matches ahead of the
 * Indic families -- and it is harmless, which was worth proving rather
 * than reasoning about, since a joiner anchoring a run split mid-conjunct
 * is precisely how this kind of change goes wrong. `क्ष` vs the
 * ZWNJ-forced half-form `क्‌ष` render at 28.69px and 53.84px respectively,
 * IDENTICAL under the new ordering, the old ordering, and an Indic-only
 * control. Blink keeps the default-ignorable with the surrounding run; the
 * half-form still forms.
 *
 * ---------------------------------------------------------------------
 * The Indic block is load-bearing and it costs nothing. Every name in it
 * is a system font family name. That distinction is the whole reason it is
 * safe to list nine of them: a guest on this page has NOT authenticated
 * yet and therefore cannot reach a font CDN at all, so a webfont for these
 * scripts would be a guaranteed-to-fail request, not a slow one. Naming
 * families the OS already has is the only mechanism available here.
 *
 * The portal ships ten languages (see RuntimeLanguage), nine of them in
 * eight non-Latin scripts, and none of the Latin entries above carries a
 * glyph for any of them -- so without an explicit name the browser falls
 * through to whatever the OS happens to have, or to tofu boxes.
 *
 * Two deliberate omissions, both unchanged:
 *   * No Apple names ("Tamil Sangam MN", "Kohinoor Devanagari", ...). On
 *     iOS/macOS `-apple-system` is a composite font whose CoreText cascade
 *     already resolves Indic codepoints to the platform's own current,
 *     best face. Naming the older Sangam/MT faces explicitly would
 *     override that with a worse one.
 *   * `"Nirmala UI"` is one entry, not nine: it is Windows' single Indic
 *     UI family and covers all eight of these scripts at once. It is in
 *     the Windows base font list, not the Feature-On-Demand packages
 *     (unlike Mangal, Latha, Gautami, Tunga, Shruti, Raavi, Kartika),
 *     which is what makes it the cheapest possible Windows Indic fix. It
 *     stays after the Noto names so it only ever wins for a script no Noto
 *     family is installed for.
 *
 * v4 §4/§8: this is the ONLY font stack on every `portal.*` route --
 * `font-display` (Space Grotesk) was removed from the 12 screens that
 * still reached for it; every heading is weight/size/tracking on this same
 * stack.
 *
 * NOTE FOR ANYONE EDITING THIS STRING: `styles.css` defines
 * `--pg-font-stack` with the identical value, because CSS cannot import a
 * JS constant. `scripts/check-a11y-invariants.mjs` asserts the two are
 * character-for-character equal, so a one-sided edit fails the test rather
 * than drifting silently the way four hand-synced copies did.
 */
export const PG_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", Roboto, system-ui, "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Gujarati", "Noto Sans Gurmukhi", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Tamil", "Noto Sans Telugu", "Nirmala UI", sans-serif';
