import type { GuestFontChoice } from "@/types/portal-runtime";

/** Mirrors `PG_FONT_STACK` (PortalShell.tsx) exactly. This module can't
 * import it directly -- PortalShell.tsx itself imports from
 * PortalRuntimeContext.tsx, the real consumer of this constant, so
 * importing back through PortalShell.tsx here would be a cycle. Same
 * manual-sync tradeoff `styles.css`'s own `.portal-runtime .font-display`
 * override already accepts, for the identical reason (see that rule's own
 * doc comment: "CSS can't import a JS constant, so there's no single
 * source of truth to enforce this automatically"). Keep literally
 * identical to `PG_FONT_STACK` if that stack ever changes. */
export const PG_FALLBACK_FONT_STACK =
  '-apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif';

/** The exact Latin-plus-typographic-punctuation unicode-range every curated
 * face below was subsetted to (§3.3.2/3.4) -- declared on each injected
 * `@font-face` too so a Hindi/Arabic heading's Devanagari/Arabic codepoints
 * (absent from all three subsets, §3.2) never even attempt to resolve
 * against the curated face; the browser's own per-character fallback
 * matching sends them straight to "Noto Sans Devanagari"/the rest of
 * `PG_FALLBACK_FONT_STACK` instead, exactly as today. */
export const GUEST_FONT_UNICODE_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF";

/** captive-portal-v6-design-spec.md §3 -- the curated, self-hosted heading-
 * only font allowlist. Deliberately NOT a free-text/Google-Fonts-catalog
 * picker (see PortalCustomization.tsx's old, silently-fake 8-option
 * `<Select>` this replaces, §1.3 of the spec) -- every option here is a
 * real, same-origin asset this repo ships and controls, individually
 * budgeted below the ≤18KB target (§3.3/3.4).
 *
 * `system` never appears here -- it's the zero-asset default (unset
 * `--pg-display-font-family` resolves to `inherit` -> `PG_FONT_STACK`,
 * see styles.css), not a face with a file.
 *
 * `modern-sans` substitutes Sora for the spec's originally-named "General
 * Sans": General Sans is only distributable from Fontshare under the ITF
 * Free Font License, which explicitly PROHIBITS subsetting/format
 * conversion without written consent ("You may not modify, edit, adapt,
 * translate, reverse engineer, decompile, disassemble or otherwise alter
 * the Font Software... This includes... subsetting, format conversion").
 * Shipping a Latin-subsetted General Sans file would violate that license.
 * Sora (Google Fonts, OFL 1.1 -- explicitly permits embedding/subsetting/
 * modification) is the closest same-register geometric sans substitute and
 * was independently named alongside General Sans in the spec's own §0.2
 * research as a distinctive, non-cliché 2026 display face. Flagged here,
 * not swapped in silently.
 *
 * Metric-match overrides below are computed for real, per file (fontTools,
 * hhea/OS2 tables, not eyeballed), against standard published Arial
 * metrics (unitsPerEm 2048, ascent 1854, descent 434, lineGap 67, xAvgCharWidth
 * 904) as the fallback-metrics baseline -- the real -apple-system/Segoe UI/
 * Roboto chain's exact metrics aren't extractable in this environment (San
 * Francisco/Segoe UI aren't freely distributable font files), and Arial's
 * are a well-published, close-proportioned stand-in for a neutral UI sans.
 * This bounds font-swap layout shift to whatever residual error that
 * approximation carries -- materially better than no metric-matching at
 * all -- rather than claiming pixel-perfect fidelity to a font this build
 * can't inspect directly. Re-derive if a curated face file ever changes.
 */
export interface GuestFontFaceSpec {
  /** Label shown in the admin picker (§3.5). */
  label: string;
  /** One-line character description, admin picker only. */
  description: string;
  /** The real `font-family` name declared in the injected `@font-face`. */
  fontFamily: string;
  /** Same-origin static asset path (§3.3.1) -- never a third-party CDN URL. */
  woff2Path: string;
  /** `ascent-override` / `descent-override` / `line-gap-override` /
   * `size-adjust`, each a CSS percentage string, computed per this file's
   * own top-level doc comment. */
  ascentOverride: string;
  descentOverride: string;
  lineGapOverride: string;
  sizeAdjust: string;
}

export const GUEST_FONT_FACES: Record<Exclude<GuestFontChoice, "system">, GuestFontFaceSpec> = {
  "modern-sans": {
    label: "Modern Sans",
    description: "Distinctive geometric sans -- co-working, tech-forward venues.",
    fontFamily: "PG Guest Modern Sans",
    woff2Path: "/fonts/portal/modern-sans-700.woff2",
    ascentOverride: "72.2%",
    descentOverride: "21.59%",
    lineGapOverride: "0%",
    sizeAdjust: "134.34%",
  },
  "editorial-serif": {
    label: "Editorial Serif",
    description: "Warm, considered, editorial -- boutique hotels, cafés.",
    fontFamily: "PG Guest Editorial Serif",
    woff2Path: "/fonts/portal/editorial-serif-700.woff2",
    ascentOverride: "57.42%",
    descentOverride: "20.7%",
    lineGapOverride: "0%",
    sizeAdjust: "128%",
  },
  "bold-display": {
    label: "Bold Display",
    description: "Expressive, confident -- event spaces, stronger brand voice.",
    fontFamily: "PG Guest Bold Display",
    woff2Path: "/fonts/portal/bold-display-700.woff2",
    ascentOverride: "76.16%",
    descentOverride: "22.11%",
    lineGapOverride: "0%",
    sizeAdjust: "122.11%",
  },
};

/** `system` (the default) never has an asset -- see this module's own
 * top-level comment. Kept as a distinct label/description pair here too so
 * the admin picker (§3.5) can render all four options from one map instead
 * of special-casing the first. */
export const GUEST_FONT_CHOICE_LABEL: Record<GuestFontChoice, string> = {
  system: "System Default",
  "modern-sans": GUEST_FONT_FACES["modern-sans"].label,
  "editorial-serif": GUEST_FONT_FACES["editorial-serif"].label,
  "bold-display": GUEST_FONT_FACES["bold-display"].label,
};

export const GUEST_FONT_CHOICE_DESCRIPTION: Record<GuestFontChoice, string> = {
  system: "Neutral, fast, zero risk -- the safe default for any venue.",
  "modern-sans": GUEST_FONT_FACES["modern-sans"].description,
  "editorial-serif": GUEST_FONT_FACES["editorial-serif"].description,
  "bold-display": GUEST_FONT_FACES["bold-display"].description,
};
