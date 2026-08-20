import { cn } from "@/lib/utils";

/**
 * The v5 answer to a real gap found while auditing the no-photo state live
 * (org "WYFY-GUEST" itself, on `app.wyfyguest.com/guest-portal`, has no
 * background image configured -- its own Live Preview renders the sign-in
 * flow on a completely bare `#FAFAF8` field today). `PortalShell`'s own
 * comment at that call site is explicit that this was a deliberate choice,
 * not an oversight: the previous two blurred, colored "AmbientGlow" blobs
 * were dropped entirely because they cost paint for no real payoff on an
 * already-flat background. That reasoning is still correct -- this
 * component is not a reintroduction of that mistake under a new name.
 *
 * The difference that makes this additive rather than a repeat: AmbientGlow
 * was two large, saturated, blurred color blobs competing for attention in
 * open space. This is the opposite shape of thing -- a flat, hairline,
 * mostly-white texture at 4-10% opacity, built entirely from the same
 * "dot, then concentric arcs opening outward" signal motif already
 * established on the marketing site (see
 * `wyfy-guest-website/src/components/illustrations/AccessPointConnectionIllustration.astro`
 * and `PriceTagSignalIllustration.astro`) rather than an invented shape.
 * It reads as "this surface has a considered branded texture" at a glance
 * and disappears the moment a guest's eye lands on the actual card --
 * nothing here should still be visible in a screenshot cropped tightly to
 * the sign-in card itself.
 *
 * Two layers, both pure geometry (no blur filters, no gradients, no
 * saturated color -- stroke/fill is the single existing `--pr-primary`
 * fallback indigo #6366f1 at low opacity throughout, so an organization's
 * real brand color can eventually drive this too rather than it being a
 * fixed decoration):
 *  1. A repeating tile of small "access point" glyphs (dot + two opening
 *     arcs, half the size of the marketing site's smallest instance) --
 *     texture, not a scene. Reads as a quiet dot-grid at arm's length.
 *  2. One large, quiet version of the same glyph anchored top-center,
 *     arcs opening downward toward the content below -- a single
 *     deliberate "signal source" watermark, echoing the same emission
 *     point language `AccessPointConnectionIllustration` uses for the
 *     access point above the laptop, and BrandPanel/GuestSignInCard's own
 *     logo mark sitting at the top of this same layout.
 *
 * Purely decorative -- `aria-hidden`, no text, no interactive content.
 * Caller is responsible for only rendering this in the no-background-image
 * branch (see PortalShell's "light" variant) and for `pointer-events-none`
 * positioning; this component only owns the artwork.
 */
export function PortalNoPhotoPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("h-full w-full", className)}
      viewBox="0 0 1200 1200"
      preserveAspectRatio="xMidYMin slice"
    >
      <defs>
        <pattern id="pgNoPhotoMesh" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="70" r="1.6" fill="#6366f1" opacity="0.5" />
          <path
            d="M10 70a15 15 0 0 1 15-15"
            stroke="#6366f1"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.35"
          />
          <path
            d="M10 70a29 29 0 0 1 29-29"
            stroke="#6366f1"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.2"
          />
        </pattern>
      </defs>

      {/* Layer 1: quiet repeating texture across the whole shell.
       *
       * captive-portal-v7-design-spec.md Part 3, and a measured AA failure
       * rather than a taste change. This `opacity` was 0.55, which multiplies
       * with the mesh dot's own 0.5 to an effective alpha of ~0.275 -- so
       * over `--pg-canvas` #FAFAF8 a dot composites to about rgb(209,209,246),
       * and a run of overlapping dot-plus-arc peaks darker still. This
       * component's own doc comment above describes the texture as
       * "4-10%-opacity geometry"; it was not.
       *
       * That matters because in the no-photo case the footer deliberately
       * gets no plate -- there is no photo to protect it from -- so
       * "Powered by Wyfy Guest" stands directly on this artwork.
       * `scripts/measure-portal-contrast.mjs` catches it at 390x844 with
       * `--pg-type-scale: 1.25`, where the scaled-up footer lands on a dot
       * cluster at **rgb(190,191,245)** and `--pg-ink-faint` #505E73
       * measures **3.75:1**. AA needs 4.5:1. Nothing in the v7 token pass
       * could have found this: both colours involved are ours, both were
       * individually signed off, and the failure is positional.
       *
       * Solving for the alpha at which #505E73 still clears 4.5:1 over this
       * canvas gives a ceiling near 0.21 effective. 0.35 here takes the dot
       * to 0.175 and the two arcs to 0.1225 and 0.07 -- inside the ceiling
       * with margin, and finally inside the range this component's own
       * comment claims. Dialing the artwork back is the right lever rather
       * than darkening the type: the texture is decorative and `aria-hidden`,
       * and decoration does not get to outrank the one line of text this
       * whole part exists to make legible. */}
      <rect width="1200" height="1200" fill="url(#pgNoPhotoMesh)" opacity="0.35" />

      {/* Layer 2: one large watermark-scale signal source, top-center,
          arcs opening downward -- same directional convention as
          AccessPointConnectionIllustration's access point above the
          laptop, oriented here toward the content that actually sits
          below it on this page. */}
      <g stroke="#6366f1" fill="none" strokeLinecap="round">
        <circle cx="600" cy="40" r="6" fill="#6366f1" opacity="0.22" />
        <path d="M600 40a130 130 0 0 1 130 130" strokeWidth="2.5" opacity="0.16" />
        <path d="M600 40a230 230 0 0 1 230 230" strokeWidth="2.5" opacity="0.1" />
        <path d="M600 40a330 330 0 0 1 330 330" strokeWidth="2.5" opacity="0.06" />
        <path d="M600 40a130 130 0 0 0 -130 130" strokeWidth="2.5" opacity="0.16" />
        <path d="M600 40a230 230 0 0 0 -230 230" strokeWidth="2.5" opacity="0.1" />
        <path d="M600 40a330 330 0 0 0 -330 330" strokeWidth="2.5" opacity="0.06" />
      </g>
    </svg>
  );
}
