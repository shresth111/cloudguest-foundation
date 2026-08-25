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

export function VenueLogo({
  logoUrl,
  alt = "",
  size = "sm",
  className,
}: {
  logoUrl: string;
  alt?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
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
