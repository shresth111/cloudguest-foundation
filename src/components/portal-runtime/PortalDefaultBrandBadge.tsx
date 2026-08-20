import { cn } from "@/lib/utils";

/**
 * A refined badge treatment for the *default* Wyfy Guest mark specifically
 * -- not a replacement for a customer's own uploaded per-location logo.
 * Today `DEFAULT_PORTAL_LOGO_SRC` (`/brand/mark-compact-blue.svg`) renders
 * as a bare `<img>` with only a CSS `drop-shadow` (see GuestSignInCard's
 * and PortalShell's identical fallback), which is the *correct* asset --
 * confirmed live against the marketing site's own current brand files
 * (`wyfy-guest-website/public/brand/mark-primary-blue.svg` and
 * `lockup-horizontal.svg` use the exact same shield-and-signal mark and
 * gradient, so this isn't a stale/wrong logo) -- it's just presented with
 * no more care than a favicon gets. An un-customized location (no
 * `config.logoUrl` uploaded, the common case for a new venue) is exactly
 * the moment this product's own brand should look most considered, since
 * it's standing in for a real business's branding.
 *
 * This wraps the *exact same* mark artwork (inlined here, not re-fetched
 * as an `<img>`, so it stays crisp at any size and needs no network
 * request) in a soft circular plate: a barely-there radial highlight
 * (white -> a hint of indigo-50, not a saturated fill) and a 1px
 * `indigo-100`-equivalent ring, giving the mark a touch of dimensionality
 * consistent with how `PriceTagSignalIllustration.astro` and the other
 * marketing-site icon-scale glyphs are always given some real ground to
 * sit on rather than floating on raw transparency. Deliberately *not* a
 * saturated color badge or a heavier shadow -- this is a polish pass on
 * an already-correct mark, not new visual weight competing with the
 * sign-in card it sits above.
 *
 * Only intended for the no-custom-logo fallback path. When
 * `config.logoUrl` is set, keep rendering that image directly (an
 * arbitrary customer-uploaded logo has its own aspect ratio and colors --
 * forcing it into this circular plate would crop or mismatch it).
 */
/**
 * The same Wyfy mark at footnote scale, for the "Powered by Wyfy Guest"
 * lockup in `PortalShell`'s footer (v7 Part 3, P5).
 *
 * Three deliberate differences from `PortalDefaultBrandBadge` above, all of
 * them forced by the size and by where this sits:
 *
 *  - **Monochrome `currentColor`, not the indigo gradient.** A two-stop
 *    gradient across 14 CSS px is mud, and `currentColor` is the only fill
 *    that survives both the dark-scrim polarity flip (where `--pg-ink*` goes
 *    to #FFFFFF) and `forced-colors: active` (where the UA replaces `color`
 *    with `CanvasText`). A hardcoded hex would go invisible in the first and
 *    illegal in the second.
 *  - **The signal arcs are knocked OUT of the shield rather than stroked on
 *    top of it.** Painting white strokes over the shield would need to know
 *    the colour behind the mark, which on a translucent plate over an
 *    arbitrary photo is unknowable. A mask makes them genuine holes, so the
 *    mark is one solid silhouette in one colour and composites correctly
 *    over anything.
 *  - **The third, `opacity="0.75"` outer arc is dropped.** It is sub-pixel
 *    at this size, and `opacity` on a decorative glyph is a `forced-colors`
 *    hazard. The two remaining arcs are widened 1.7 -> 2.2 in the 24-unit
 *    space as optical compensation.
 *
 * No new asset, no network request, no icon-library import -- the path data
 * is the same `mark-compact-blue.svg` geometry inlined above.
 */
export function PortalFootnoteMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      viewBox="0 0 24 24"
    >
      {/* A fixed id is safe here: the footer renders once per document, and
          two identical masks would in any case be interchangeable. */}
      <mask id="pgFootnoteMarkCutout">
        <path
          d="M12 1.2 L20.5 4.6 V11 C20.5 16.6 17 20.8 12 22.6 C7 20.8 3.5 16.6 3.5 11 V4.6 Z"
          fill="#fff"
        />
        <circle cx="12" cy="14.9" r="1.7" fill="#000" />
        <path
          d="M8.6 12.1a5 5 0 0 1 6.8 0"
          stroke="#000"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M6.3 9.3a8.6 8.6 0 0 1 11.4 0"
          stroke="#000"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </mask>
      <rect width="24" height="24" fill="currentColor" mask="url(#pgFootnoteMarkCutout)" />
    </svg>
  );
}

export function PortalDefaultBrandBadge({
  size = 96,
  className,
}: {
  /** Pixel size of the square badge (viewBox is 0 0 96 96, scales cleanly). */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      role="img"
      aria-labelledby="pgDefaultBrandBadgeTitle"
      className={cn("shrink-0 drop-shadow-sm", className)}
      width={size}
      height={size}
      viewBox="0 0 96 96"
    >
      <title id="pgDefaultBrandBadgeTitle">Wyfy Guest</title>
      <defs>
        <radialGradient id="pgBadgePlate" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2ff" />
        </radialGradient>
        <linearGradient id="pgBadgeMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <circle cx="48" cy="48" r="47" fill="url(#pgBadgePlate)" stroke="#e0e7ff" strokeWidth="1.5" />

      {/* The real mark, unmodified path data from mark-compact-blue.svg,
          just translated + scaled from its native 24-unit viewBox to sit
          centered in this 96-unit badge. */}
      <g transform="translate(6,6.4) scale(3.5)">
        <path
          d="M12 1.2 L20.5 4.6 V11 C20.5 16.6 17 20.8 12 22.6 C7 20.8 3.5 16.6 3.5 11 V4.6 Z"
          fill="url(#pgBadgeMark)"
        />
        <circle cx="12" cy="14.6" r="1.35" fill="#ffffff" />
        <path
          d="M8.6 12.1a5 5 0 0 1 6.8 0"
          stroke="#ffffff"
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M6.3 9.3a8.6 8.6 0 0 1 11.4 0"
          stroke="#ffffff"
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
      </g>
    </svg>
  );
}
