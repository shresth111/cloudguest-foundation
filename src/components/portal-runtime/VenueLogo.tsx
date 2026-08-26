/**
 * The real, uploaded-venue-logo half of the three call sites that used to
 * hand-roll this `<img>` block (GuestSignInCard, portal.auth.$method,
 * portal.index) -- each at its own size scale, all with the identical
 * height-constrained/width-free reasoning copy-pasted alongside it. Not a
 * do-everything logo component: each call site's *fallback* (what renders
 * when there is no `logoUrl`) is a deliberately different design --
 * `PortalDefaultBrandBadge` on the sign-in surfaces, a large venue-primary-
 * color Wi-Fi badge on the `/portal/` hero -- so unifying the fallback too
 * would force a false consistency neither design actually wants. Callers
 * keep their own `config?.logoUrl ? <VenueLogo .../> : <Fallback/>` branch;
 * this only removes the duplicated `<img>` markup and its rationale.
 */
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  // GuestSignInCard's scale (v5 §3.3: logo shouldn't out-size its heading).
  sm: "h-12 w-auto max-w-[176px] drop-shadow sm:h-14 sm:max-w-[200px] md:h-16 md:max-w-[224px]",
  // portal.auth.$method's scale -- a standalone method page, more room.
  md: "h-16 w-auto max-w-[200px] drop-shadow sm:h-20 sm:max-w-[240px] md:h-24 md:max-w-[280px]",
  // portal.index's scale -- the very first screen most guests see. Its own
  // stronger `drop-shadow-lg` (not the plain `drop-shadow` the other two
  // use) -- a deliberate, existing difference, not something to flatten.
  lg: "h-24 w-auto max-w-[280px] drop-shadow-lg sm:h-32 sm:max-w-[320px] md:h-36 md:max-w-[360px]",
} as const;

// Mirrors each size's own SIZE_CLASSES breakpoint progression above (same
// heights, just square instead of width-free) so the framed plate scales
// at the identical steps the bare image would have.
const PLATE_SIZE_CLASSES = {
  sm: "h-12 w-12 p-2 sm:h-14 sm:w-14 sm:p-2.5 md:h-16 md:w-16 md:p-3",
  md: "h-16 w-16 p-2.5 sm:h-20 sm:w-20 sm:p-3 md:h-24 md:w-24 md:p-3.5",
  lg: "h-24 w-24 p-3.5 sm:h-32 sm:w-32 sm:p-4.5 md:h-36 md:w-36 md:p-5",
} as const;

export function VenueLogo({
  logoUrl,
  alt = "",
  size = "sm",
  className,
  framed = false,
}: {
  logoUrl: string;
  alt?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** Every venue's own upload is a genuinely different shape -- a square
   * mark, a wide horizontal lockup, a tall vertical one, white-on-
   * transparent art meant for a dark background, dark-on-transparent for
   * a light one. The bare, height-constrained `<img>` below handles the
   * WIDE case fine (object-contain shrinks it to fit) but not the other
   * two: a tall/narrow upload collapses to a near-invisible sliver at a
   * fixed height, and either light-on-transparent or dark-on-transparent
   * art can lose all contrast against whatever happens to sit behind it
   * -- our new violet-tinted header wash included.
   *
   * `framed` swaps the bare image for a white plate in the same material
   * as `PortalDefaultBrandBadge`'s NO-logo case (soft radial highlight,
   * 1px ring, matching shadow) -- rounded-square rather than that badge's
   * own circle, see the render branch's own comment for why a true
   * circle is unsafe for an arbitrary externally-uploaded shape. Every
   * venue's own upload, whatever its shape or palette, sits on a
   * fixed-size, guaranteed-light-neutral surface instead of floating
   * directly on the zone behind it. `object-contain` inside that fixed
   * box is what turns "constrain height, let width run away" into
   * "always fit, never smear, never disappear" for every aspect ratio at
   * once -- a square mark centers with even padding, a wide lockup
   * shrinks to the plate's width, a tall one shrinks to its height, and
   * a light-on-transparent upload gets the same white backing the
   * dark-on-transparent case never needed but is never hurt by either.
   *
   * Opt-in, not the default: the other two call sites (`portal.auth.
   * $method`, `portal.index`) render on their own already-legible
   * surfaces (a photo behind `PortalTextPlate`, or the flat canvas) where
   * this framing was never the reported problem, and forcing every
   * venue's lockup into a circle there is a bigger visual change than
   * either screen asked for. */
  framed?: boolean;
}) {
  if (framed) {
    return (
      // `rounded-2xl` (this card family's own `rounded-[20px]` radius),
      // NOT `rounded-full`: a true circle clips content in the box's
      // corners, and `object-contain` only guarantees the image fits the
      // SQUARE box, not the circle inscribed inside it. A wide lockup
      // scales to a full-width band centered vertically -- at the box's
      // left/right edges that band touches the circle's boundary at
      // exactly one point (dead center) and is outside it everywhere
      // else, so the logo's own left/right extremities were being cut off
      // by the mask despite "fitting" -- the exact failure mode `framed`
      // exists to prevent, just moved from the layout math to the mask
      // shape. A rounded square only clips a small radius at each corner,
      // which a wide/tall band never reaches at all (it isn't near any
      // corner) and a near-square mark loses at most a few pixels off
      // each corner -- the same trade-off every rounded app-icon frame
      // makes, and never a cut into the logo's actual width or height.
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e0e7ff] shadow-sm",
          "bg-[radial-gradient(circle_at_35%_30%,#ffffff_0%,#eef2ff_100%)]",
          PLATE_SIZE_CLASSES[size],
          className,
        )}
      >
        <img src={logoUrl} alt={alt} className="h-full w-full object-contain" />
      </span>
    );
  }
  return (
    <img
      src={logoUrl}
      alt={alt}
      // Height-constrained, width free: `object-contain` inside a fixed
      // WIDTH box (what this was before) preserves aspect ratio by
      // shrinking a horizontal lockup, not by widening its box -- measured
      // live, a 480x96 (5:1) hotel/cafe logo lockup rendered as a ~10px-tall
      // smear in a `w-12` box. Constraining height and letting width follow
      // fixes that; `max-w` still caps a pathological banner from spanning
      // the column and out-shouting the venue's own name below it.
      className={cn("object-contain", SIZE_CLASSES[size], className)}
    />
  );
}
