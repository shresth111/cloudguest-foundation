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
import { useCallback, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { PortalDefaultBrandBadge } from "./PortalDefaultBrandBadge";
import { isVectorUrl, venueLogoWidthCap } from "@/lib/venue-logo";

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

/**
 * Shape-aware sizing for the sign-in card's logo zone (`adaptive`).
 *
 * The old `framed` plate was a fixed 48px square (56/64 at sm/md) with 8px
 * of padding, so EVERY upload was squeezed into a 30x30 CSS-px box on a
 * phone: a 4:1 wordmark painted at 30x7.5px, a 1:2 crest at 15x30px. That,
 * not the file, is why venue logos looked tiny (the backend stores the
 * upload at full resolution -- see `_process_logo`, which only crops).
 *
 * Now the box follows the logo's own shape, from its natural size:
 *
 *   width = min( base * ratio^0.65,          -- shape curve (below)
 *                maxH * ratio,               -- tall logos: height-bound
 *                70% of the zone,            -- wide banners: width-bound
 *                sharpness cap )             -- never blow up a small file
 *
 * `ratio^0.65` sits between "same height for all" (exponent 0, wide logos
 * become thin strips) and "same area for all" (0.5): a wide wordmark gets
 * noticeably more width, a square/tall mark more height, and they read as
 * the same visual weight. Height follows from the image's own aspect
 * ratio (`height: auto`), so nothing is ever cropped or stretched.
 *
 * Sizes come from CSS variables switched by a CONTAINER query on the zone
 * itself, not a viewport breakpoint: the owner's Portal designer renders
 * this exact component inside a 393px phone frame on a desktop window, and
 * a viewport `sm:`/`md:` there would show the desktop size the guest never
 * sees. A zone narrower than 22rem (every phone) uses the phone size.
 */
const ADAPTIVE_EXPONENT = 0.65;
type Measured = { ratio: number; cap: number | null };

function AdaptiveVenueLogo({
  logoUrl,
  alt,
  className,
  onFail,
}: {
  logoUrl: string;
  alt: string;
  className?: string;
  onFail: () => void;
}) {
  const [measured, setMeasured] = useState<Measured | null>(null);
  const measure = (img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    setMeasured({
      ratio: img.naturalWidth / img.naturalHeight,
      cap: venueLogoWidthCap(img.naturalWidth, window.devicePixelRatio, isVectorUrl(logoUrl)),
    });
  };
  // The portal is server-rendered: a cached logo can finish loading before
  // React hydrates and attaches `onLoad`/`onError`, so neither would ever
  // fire. Check the element's own state once it is mounted.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete) return;
      if (img.naturalWidth) measure(img);
      else if (img.currentSrc || img.src) onFail();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logoUrl],
  );

  const style = measured
    ? ({
        "--venue-logo-k": Math.pow(measured.ratio, ADAPTIVE_EXPONENT),
        "--venue-logo-r": measured.ratio,
        width: `min(${[
          "calc(var(--venue-logo-base) * var(--venue-logo-k))",
          "calc(var(--venue-logo-max-h) * var(--venue-logo-r))",
          "70%",
          ...(measured.cap == null ? [] : [`${measured.cap.toFixed(2)}px`]),
        ].join(", ")})`,
        aspectRatio: String(measured.ratio),
      } as CSSProperties)
    : undefined;

  return (
    // The reserved box: a fixed-height band from first paint, so the
    // heading and form below never move when the logo arrives (or fails).
    <span className={cn("@container flex w-full justify-center", className)}>
      <span
        data-venue-logo-box
        className={cn(
          "relative flex w-full items-center justify-center",
          "[--venue-logo-base:88px] [--venue-logo-max-h:96px]",
          "@min-[22rem]:[--venue-logo-base:100px] @min-[22rem]:[--venue-logo-max-h:112px]",
          "h-[var(--venue-logo-max-h)]",
        )}
      >
        <img
          ref={ref}
          src={logoUrl}
          alt={alt}
          decoding="async"
          onLoad={(e) => measure(e.currentTarget)}
          onError={onFail}
          // See the plain branch below: never leak the portal URL (NAS
          // login target, device MAC) to a third-party logo host.
          referrerPolicy="no-referrer"
          style={style}
          className={cn(
            // Fallback for engines without CSS min(): still bounded.
            "h-auto max-h-[var(--venue-logo-max-h)] max-w-[70%] object-contain",
            // A hairline shadow, not a plate: gives white-on-transparent
            // art an edge on this light card without boxing every logo.
            "drop-shadow-[0_1px_1px_rgba(15,23,42,0.18)]",
            // Hidden (but loading, and taking no space) until measured --
            // no flash of a full-size 1200px image.
            !measured && "invisible absolute h-px w-px",
          )}
        />
      </span>
    </span>
  );
}

export function VenueLogo({
  logoUrl,
  alt = "",
  size = "sm",
  className,
  adaptive = false,
}: {
  logoUrl: string;
  alt?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** Size the logo by its own shape inside a reserved band, capped at
   * what the file's resolution supports -- see `AdaptiveVenueLogo`. The
   * sign-in card uses this. It replaced `framed` (a fixed 48px plate that
   * painted every logo inside a 30x30px box on a phone). */
  adaptive?: boolean;
}) {
  // A broken venue logo (asset deleted after upload, CDN hiccup) must not
  // render the browser's broken-image glyph -- the worst possible first
  // impression of a venue, indistinguishable from "no logo at all". On
  // error we swap to the same default brand badge the no-logo branch
  // renders, so a failed upload degrades exactly like an absent one.
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <PortalDefaultBrandBadge
        size={size === "lg" ? 72 : size === "md" ? 56 : 48}
        className={cn("shrink-0", size === "lg" ? "h-24 w-24 sm:h-32 sm:w-32" : undefined)}
      />
    );
  }
  if (adaptive) {
    return (
      <AdaptiveVenueLogo
        key={logoUrl}
        logoUrl={logoUrl}
        alt={alt}
        className={className}
        onFail={() => setFailed(true)}
      />
    );
  }
  return (
    <img
      src={logoUrl}
      alt={alt}
      onError={() => setFailed(true)}
      // The venue logo is often hosted on a third-party CDN, and the
      // page URL carries the NAS's link-login-only target and the device
      // MAC -- never leak those in the Referer header.
      referrerPolicy="no-referrer"
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
