import type { ReactNode } from "react";

/**
 * Wyfy Guest portal glyphs -- the hand-drawn state-screen icon set from the
 * redesign's graphic-design handoff (portal-glyphs.tsx), trimmed to the five
 * glyphs the runtime actually renders. The full 19-glyph set exists in the
 * handoff; import-on-use only, so unused glyphs never cost the guest bundle
 * a byte (auth-method and session-tile glyphs stay in the handoff until a
 * surface needs them).
 *
 * DESIGN DNA (derived from PortalDefaultBrandBadge / PortalFootnoteMark):
 *  - 24x24 viewBox, the mark's own native unit space.
 *  - stroke="currentColor", fill="none", round caps/joins -- currentColor is
 *    the only paint that survives the dark-scrim polarity flip
 *    (`--pg-ink` -> #FFFFFF) and `forced-colors: active`. No hex anywhere.
 *  - strokeWidth 1.8: between the badge mark's 1.7 (96px scale) and the
 *    footnote mark's optically-compensated 2.2 (14px scale); these render at
 *    ~32px inside the state screens' icon discs.
 *  - Solid accents (dots) are tiny filled circles with stroke="none",
 *    echoing the mark's signal dot; no opacity on decorative geometry
 *    (forced-colors hazard, per the footnote mark's own doc comment).
 *  - No gradients (reserved for the brand mark itself), no ids, no external
 *    refs -- CNA-safe inline JSX.
 *  - aria-hidden + focusable=false: decorative reinforcement; the adjacent
 *    text carries the meaning.
 *
 * Brand motif reuse: GlyphOffline redraws the brand's own dot+concentric-arcs
 * signal language (mark arc radii 5/8.6 preserved), cancelled by a slash --
 * "our signal, interrupted" -- rather than a generic lucide WifiOff.
 */

type GlyphProps = {
  className?: string;
  /** Rendered square size in px. Default 24 (1:1 with the unit grid). */
  size?: number;
};

function G({ className, size = 24, children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Closed -- crescent moon: "the venue is asleep", calm rather than alarming. */
export function GlyphClosed(p: GlyphProps) {
  return (
    <G {...p}>
      <path d="M20.2 13.6A8.4 8.4 0 1 1 10.4 3.8a6.6 6.6 0 0 0 9.8 9.8Z" />
    </G>
  );
}

/** Expired -- hourglass, sand at the bottom: time ran out, not an error. */
export function GlyphExpired(p: GlyphProps) {
  return (
    <G {...p}>
      <path d="M6.5 3h11M6.5 21h11" />
      <path d="M8 3v3.3c0 2.1 1.7 3.4 4 5.7 2.3-2.3 4-3.6 4-5.7V3" />
      <path d="M8 21v-3.3c0-2.1 1.7-3.4 4-5.7 2.3 2.3 4 3.6 4 5.7V21" />
      <circle cx="12" cy="17.6" r="1" fill="currentColor" stroke="none" />
    </G>
  );
}

/** Failure -- rounded warning triangle; dot echoes the mark's signal dot. */
export function GlyphFailure(p: GlyphProps) {
  return (
    <G {...p}>
      <path d="M10.5 4.4 2.9 17.5A1.7 1.7 0 0 0 4.4 20h15.2a1.7 1.7 0 0 0 1.5-2.5L13.5 4.4a1.7 1.7 0 0 0-3 0Z" />
      <path d="M12 9.3v4.2" />
      <circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none" />
    </G>
  );
}

/** Offline -- the brand's own dot+arcs signal motif, cancelled by a slash. */
export function GlyphOffline(p: GlyphProps) {
  return (
    <G {...p}>
      <circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <path d="M8.6 14.7a5 5 0 0 1 6.8 0" />
      <path d="M6.3 11.9a8.6 8.6 0 0 1 11.4 0" />
      <path d="M4.2 4.2 19.8 19.8" />
    </G>
  );
}

/** Redirect -- arrow leaving an open frame: "we're sending you onward". */
export function GlyphRedirect(p: GlyphProps) {
  return (
    <G {...p}>
      <path d="M18.2 13.4v5.4a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2V7.8a2 2 0 0 1 2-2h5.4" />
      <path d="M14.6 3.4h6v6" />
      <path d="M20.6 3.4 11.2 12.8" />
    </G>
  );
}
