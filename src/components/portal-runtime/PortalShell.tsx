import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { A11yMenu } from "./A11yMenu";
import { DEFAULT_PORTAL_LOGO_SRC } from "./PortalGuestUi";
import { PortalNoPhotoPattern } from "./PortalNoPhotoPattern";

// System-font stack for the guest flow -- see captive-portal-v4-design-
// spec.md §4: the guest path only ever used one of the app's four
// Google-Fonts families (Manrope, hardcoded here), and dropping webfonts
// from this path entirely both removes a network dependency a captive-
// portal guest may not even be able to reach pre-auth and is itself part
// of not repeating the previous "generic friendly SaaS" visual recipe
// (Manrope is a very recognizable instance of that). Carried by
// weight/tracking/size choices, not a custom face. "Noto Sans Devanagari"
// covers Hindi -- none of the system-font stack below does, so Hindi text
// used to fall through to whatever Devanagari font (if any) the guest's
// OS happened to have, with visibly inconsistent weight/line-height
// versus the rest of this UI. Loaded best-effort, non-blocking alongside
// the rest of this app's fonts -- see __root.tsx's LOAD_FONTS_SCRIPT
// comment for why a captive-portal page can never afford a render-
// blocking font request.
// Exported (not just module-local) so every other guest-flow surface --
// e.g. portal.tsx's IncompletePortalLinkError, which renders standalone,
// before/without a PortalRuntimeProvider mounting this shell at all --
// stays on the exact same system-font stack instead of a second hardcoded
// copy (or worse, a stray webfont) drifting in independently over time.
// v4 §4/§8: this is now the ONLY font stack on every portal.* route --
// `font-display` (Space Grotesk) has been removed from the 12 screens
// that still reached for it; every heading is weight/size/tracking on
// this same stack, the technique this card's own <h1> already proved
// works.
export const PG_FONT_STACK =
  '-apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif';

// Bounded, opaque-enough legibility backing for a single text/logo zone
// sitting directly on a venue's uploaded photo -- white/80-90 +
// backdrop-blur-md, the exact pattern BrandPanel's Aug 5 fix (ab5226f)
// and GuestSignInCard header's PR #80 fix independently arrived at.
// Shared here (not three copies) so the *styling* stays structural
// without making the *coverage area* structural -- see GuestBackdrop's
// own comment for why those are two different things and conflating them
// was the actual v4 regression.
// captive-portal-v5-design-spec.md §3.1/§3.3: `rounded-3xl` (this card)
// and `rounded-2xl` (PortalCard, the form) used to be two different
// radii glued together -- part of why the composition read as
// "assembled," not designed. One shared value, `rounded-[20px]`, now
// applies everywhere this card family (and PortalCard below) appears.
export const GUEST_LEGIBILITY_CARD_CLASS =
  "rounded-[20px] border border-white/60 bg-[var(--pg-surface)]/85 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md";

/** The lg:+ (laptop-width) left-hand context panel -- fills the space
 * that used to be empty gradient next to a small floating card. Copy is
 * deliberately generic (real venue name, phrased so it never repeats the
 * exact headline sentence the sign-in card on the right already shows)
 * rather than fabricated marketing claims (speed, encryption, session
 * length) this codebase has no real config field for -- see this
 * session's own audit call-out on not inventing guest-facing copy that
 * isn't backed by real data.
 *
 * Owns its own `hasBackgroundImage` legibility backing again (previously
 * this delegated to `<GuestBackdrop>`'s v4 full-column panel -- see that
 * component's own comment for why that delegation was reverted: it
 * legibility-backed this text by washing out the photo behind everything
 * else too). */
function BrandPanel({
  venueName,
  hasBackgroundImage,
}: {
  venueName?: string;
  hasBackgroundImage?: boolean;
}) {
  const { t } = usePortalRuntime();
  // {venue} substitution done here rather than inside translate() itself --
  // see courtesyOfTemplate's own doc comment in portal-i18n.ts for why the
  // word order needs to flip per language ("courtesy of X" vs "X की ओर से").
  const courtesySuffix = venueName ? t("courtesyOfTemplate").replace("{venue}", venueName) : "";
  const content = (
    <>
      {/* Solid chip, not a glassy `bg-white/70 backdrop-blur` badge -- the
       * "quiet, confident, venue signage" direction deliberately drops the
       * glass-panel vocabulary of the previous pass; a flat neutral
       * background no longer needs a blur to stay legible underneath
       * this. */}
      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pg-border)] bg-[var(--pg-surface)] px-3.5 py-1.5 pg-micro uppercase text-[var(--pr-primary,#6366f1)]">
        <Wifi className="h-3.5 w-3.5" /> {t("guestNetwork")}
      </span>
      <h2 className="pg-display mt-6 text-[var(--pg-ink)]">
        {t("brandHeadlineBase")}
        {courtesySuffix}.
      </h2>
      {/* No "it takes about fifteen seconds" -- that was a fabricated
       * timing claim this codebase has no real config field to back; the
       * rest of the sentence already tells a guest exactly what to do
       * next without inventing a number. */}
      <p className="mt-5 max-w-md pg-body text-[var(--pg-ink-muted)]">{t("verifyDeviceCta")}</p>
    </>
  );
  // The page-level scrim (`GuestBackdrop`) is a top/bottom vignette --
  // fully transparent through the vertical middle, exactly where this
  // panel sits once vertically centered. Fine against the plain
  // gradient/flat-canvas background (no photo, no contrast problem), but
  // a real customer photo can be any tone at all, so this needs its own
  // guaranteed-legible backing rather than trusting whatever's directly
  // behind it.
  if (hasBackgroundImage) {
    // captive-portal-v5-design-spec.md §3.1: brought in line with the
    // merged sign-in card's own `p-5` so the two read as one visual
    // family instead of two independently-tuned components.
    return <div className={cn("max-w-lg p-5", GUEST_LEGIBILITY_CARD_CLASS)}>{content}</div>;
  }
  return <div className="max-w-lg">{content}</div>;
}

// The top/bottom vignette scrim protects any edge-of-page content (the
// logo/heading zone, the footer) that sits directly on the photo with no
// bounded card of its own behind it -- fully transparent through the
// vertical middle, where the actual sign-in card already carries its own
// opaque background. Defense-in-depth alongside the per-zone
// GUEST_LEGIBILITY_CARD_CLASS cards below, not a replacement for them.
// captive-portal-v5-design-spec.md §3.4: peak top opacity 0.8 -> 0.55 and
// the fully-transparent middle band widened 34-72% -> 24-78% -- a direct,
// proportionate response to the merged/shorter card from §3.1-3.3 needing
// less protected space, not an independent aesthetic call. The strongest
// part of a typical venue photo (its actual subject) sat directly under
// the heaviest, near-opaque part of the old scrim; this lightens that
// without widening the scrim's own coverage, which is the opposite
// direction from round 2's regression (see GuestBackdrop's own comment).
const GUEST_BACKDROP_SCRIM =
  "linear-gradient(to bottom, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.28) 14%, rgba(255,255,255,0) 24%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.65) 100%)";

/**
 * Renders the venue's uploaded background photo at full clarity, plus the
 * top/bottom vignette scrim -- nothing more. Does NOT wrap `children` in
 * any opaque panel; legibility for the actual text/logo content is each
 * zone's own job (`GUEST_LEGIBILITY_CARD_CLASS`, applied by `BrandPanel`,
 * `GuestSignInCard`'s header, and this shell's footer).
 *
 * v4 (#81) first shipped this as one continuous `--pg-surface/92` panel
 * wrapping the *entire* content column -- logo, heading, sign-in card,
 * footer, min-h-dvh tall -- on the reasoning that a single structural
 * guarantee beats three independently-drifting per-block fixes. Correct
 * problem, wrong mechanism: on a real venue photo that panel covered
 * essentially the whole viewport at ~90% white, which is indistinguishable
 * from "the photo doesn't render" -- confirmed live on production
 * (/portal/welcome), the venue's real background photo was reduced to a
 * barely-visible ghost. That traded genuine illegibility for genuine
 * invisibility; neither is acceptable, and the photo is the actual point
 * of this feature (a venue's own branding asset).
 *
 * This reverts to bounded, per-zone cards -- same visual recipe
 * (white/80-90 + backdrop-blur-md) v4 already used, just scoped to the
 * text-bearing zones instead of the whole page -- while keeping the one
 * genuinely structural win v4 introduced: a single shared class
 * (`GUEST_LEGIBILITY_CARD_CLASS`) instead of three independently-typed
 * copies of the same Tailwind string. That's the part of "don't repeat
 * yourself three times" worth keeping; "cover the whole page" was never
 * the part that needed fixing.
 */
function GuestBackdrop({
  backgroundImageUrl,
  children,
}: {
  backgroundImageUrl?: string | null;
  children: ReactNode;
}) {
  if (!backgroundImageUrl) {
    // captive-portal-v5-design-spec.md, Visual Assets §2b: the no-photo
    // case used to render nothing at all here (confirmed live -- a real
    // org with no background image configured shows a completely bare
    // `--pg-canvas` field). `PortalNoPhotoPattern` is deliberately not a
    // reintroduction of the old blurred-glow "AmbientGlow" mistake --
    // it's flat, hairline, ~4-10%-opacity geometry built from the
    // marketing site's own signal-arc motif, not a colored glow -- see
    // that component's own doc comment. `pointer-events-none`/absolute so
    // it never intercepts input or affects layout.
    return (
      <>
        <PortalNoPhotoPattern className="pointer-events-none absolute inset-0" />
        {children}
      </>
    );
  }
  return (
    <>
      {/* Shown at full clarity, not faded -- a customer's own uploaded
       * photo/artwork should actually be visible, not washed out to
       * near-invisibility. On viewports much wider than the uploaded
       * image's own resolution this can look soft/stretched -- that's an
       * "upload a higher-resolution image" problem for the customer to
       * fix, not something to paper over with an artificial blur here.
       * captive-portal-v5-design-spec.md §3.4: `background-position:
       * center 25%` (was dead-center) -- on a typical portrait-oriented
       * venue photo (a building, signage, an entrance), dead-center
       * cropping tends to center empty sky/foreground and cut the actual
       * subject at the frame edges; anchoring a quarter of the way down
       * keeps a typical architectural subject's upper two-thirds in frame
       * at wide/short viewport ratios. A default, not a fix for every
       * possible photo -- a per-location focal-point picker is a real
       * follow-up candidate, flagged as out of scope in the same spec
       * section (no backing `RuntimePortalConfig` field exists today). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover"
        style={{ backgroundImage: `url(${backgroundImageUrl})`, backgroundPosition: "center 25%" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: GUEST_BACKDROP_SCRIM }}
      />
      {children}
    </>
  );
}

interface Props {
  children: ReactNode;
  contentClassName?: string;
  /** When true, sizes to 100% of its parent container (`h-full`) instead
   * of the full viewport (`min-h-dvh`) -- used by the admin Portal
   * Preview (src/routes/preview.portal.$locationId.tsx), which renders
   * this exact component inside a fixed-size phone-bezel mockup rather
   * than a real full-page /portal/* route. */
  constrained?: boolean;
  /** Default true. `BrandPanel`'s copy ("Verify your device on the
   * right...") is sign-in-oriented -- right context for `/portal/welcome`,
   * wrong context for the shared `PortalConnectingState` screen, which has
   * nothing left to verify (a login already happened; this is either the
   * pass-through `/portal/` render or `/portal/success`'s real hotspot-
   * login POST in flight). Both of those callers pass `false`, and only
   * together -- v4 §5's non-negotiable #3 requires `/portal/` and
   * `/portal/success` to render the pixel-identical connecting visual, so
   * this can never be set on just one of the two without silently
   * reintroducing the exact "two different-looking connecting screens"
   * flash that invariant exists to prevent. */
  showBrandPanel?: boolean;
}

/**
 * v4 §6.1/§8: the old "dark" (glass-on-navy) visual language and its
 * `variant` prop are gone -- confirmed all 17 real `portal.*` routes
 * always passed `variant="light"`, so the dark branch was ~150 lines of
 * dead code nobody had actually chosen in over a redesign cycle. This is
 * now one visual language, no branch: the "quiet, confident, venue
 * signage" flat-neutral `--pg-canvas` background, thin-bordered white
 * card, flat single-color CTA fill, system-font stack.
 */
export function PortalShell({
  children,
  contentClassName,
  constrained = false,
  showBrandPanel = true,
}: Props) {
  const { config, highContrast, largeText, organizationId, locationId, routerId, t } =
    usePortalRuntime();
  // Every portal.* route requires these three as real, required search
  // params (see src/routes/portal.tsx's own searchSchema) -- built
  // explicitly from the real runtime context here (rather than
  // `search={(prev) => prev}`) because PortalShell itself is shared
  // across routes with different search shapes, so there's no single
  // `from` route TanStack Router could type that callback against.
  const portalSearch = { organizationId, locationId, routerId };
  // `min-h-full`, not `h-full` -- the sole `constrained` caller (the Portal
  // Preview's laptop mockup) used to pair `h-full` with a fixed-height
  // parent box, which clipped (or forced an internal scrollbar on) any
  // guest-flow state taller than that box. `min-h-full` only sets a
  // floor, so this shell (and its fixed-height-turned-min-height parent)
  // can grow to fit whatever the real content needs instead of ever
  // clipping or needing to scroll.
  const heightCls = constrained ? "min-h-full" : "min-h-dvh";
  const hasBackgroundImage = !!config?.backgroundImageUrl;

  return (
    <div
      className={cn(
        // "portal-runtime" is the selector PortalRuntimeContext's own
        // injected <style> scopes --pr-primary/--pr-accent/--pr-primary-
        // foreground and the v4 --pg-* token block to.
        "portal-runtime pg-shell relative w-full overflow-hidden",
        // The two-column desktop composition below is driven by Tailwind's
        // `lg:` *viewport*-width media query, not this element's own
        // (container) width -- fine for the real full-page guest route,
        // where the two always match, but not for the Portal Preview's
        // `constrained` mockup, which renders this same component inside
        // a much narrower fixed-width "laptop bezel" box while the
        // browser window itself can still be arbitrarily wide. Skipping
        // the whole `lg:` two-column treatment when constrained keeps
        // this to the single-column composition that already renders
        // correctly below that breakpoint, regardless of the real
        // window's width.
        !constrained && "lg:flex lg:items-center lg:justify-center",
        heightCls,
        highContrast && "contrast-125 saturate-150",
        largeText && "text-[17px]",
      )}
      style={{
        fontFamily: PG_FONT_STACK,
        background: "var(--pg-canvas, #FAFAF8)",
      }}
    >
      <GuestBackdrop backgroundImageUrl={config?.backgroundImageUrl}>
        {/* Below lg:, this fills the viewport edge-to-edge like every
         * phone/tablet captive-portal page should (single column, the
         * `lg:grid` below is a no-op until that breakpoint). At lg:
         * (laptop+) it becomes two columns -- a left context panel plus
         * the actual sign-in content on the right, vertically centered by
         * the parent's `lg:flex lg:items-center lg:justify-center` above
         * -- so a laptop-width viewport gets a considered composition
         * instead of a small card adrift in open gradient space. */}
        <div
          className={cn(
            // captive-portal-v5-design-spec.md §3.5: mobile gets the
            // primary layout pass, not desktop -- 80%+ of guest-WiFi
            // traffic is mobile (§0's external research). `pt-6` (24px)
            // used to start the card almost immediately at the top of the
            // viewport, leaving no room for the photo to read as a photo
            // before content starts. `pt-[12vh]` gives a deliberate
            // uncovered band of photo up top before the merged, shorter
            // card (§3.1-3.3) begins -- closer to "hero photo, then one
            // anchored card" than "card starting at the very top edge."
            "relative z-10 mx-auto flex w-full max-w-[420px] flex-col px-4 pb-8 pt-[12vh] sm:max-w-[460px] md:max-w-[520px]",
            // See this component's own top-level comment on `constrained` --
            // these `lg:` classes assume this element's width tracks the
            // real browser viewport, which isn't true inside the Portal
            // Preview's narrower fixed-width mockup. No BrandPanel column
            // (`showBrandPanel={false}`, the shared connecting-state
            // callers) means there's nothing to grid against -- stays a
            // single centered column at every width instead of leaving a
            // blank first grid cell.
            // §3.3: sign-in column max-width 480px -> 440px -- gives the
            // photo back real width in the two-column composition without
            // meaningfully cramping the form.
            !constrained &&
              (showBrandPanel
                ? "lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16 lg:px-12 lg:py-10 xl:gap-24"
                : "lg:max-w-[440px]"),
            heightCls,
          )}
        >
          {!constrained && showBrandPanel && (
            <div className="hidden lg:block">
              <BrandPanel venueName={config?.name} hasBackgroundImage={hasBackgroundImage} />
            </div>
          )}
          <div
            className={cn(
              "flex w-full flex-col",
              !constrained && "lg:mx-auto lg:w-full lg:max-w-[440px]",
            )}
          >
            <div className="mb-2 flex items-center justify-end gap-1.5">
              <LanguageSwitcher tone="light" />
              <A11yMenu tone="light" />
            </div>
            {/* CSS-only mount fade-in (`pg-enter`, defined in styles.css)
             * -- a single 150-200ms ease-out fade/translate on mount
             * doesn't need a JS animation library. */}
            <main className={cn("pg-enter flex flex-1 flex-col", contentClassName)}>
              {children}
            </main>
            <footer
              className={cn(
                "mt-8 flex items-center justify-center gap-2.5 text-center pg-micro",
                // Same bounded legibility card as BrandPanel/GuestSignInCard's
                // header -- the footer sits directly on the photo with no
                // other opaque backing (the vignette scrim below is
                // deliberately transparent through the middle and only
                // partial at this bottom edge), so without its own card
                // this text is exactly the same "washed to ghost text"
                // failure mode a busy photo can otherwise cause.
                hasBackgroundImage && cn("rounded-full px-4 py-2", GUEST_LEGIBILITY_CARD_CLASS),
              )}
            >
              {/* One link, not two -- /portal/terms already covers both
               * Terms of service and Privacy policy as separate sections.
               * "Support" has no real guest-facing contact field wired
               * through /captive-portal/resolve today, so it stays plain
               * text rather than a fabricated mailto/tel link -- visually
               * set apart (no separator, dimmer, non-interactive) so it
               * doesn't read as a third, silently-broken link next to a
               * real one. */}
              <Link
                to="/portal/terms"
                search={portalSearch}
                className="text-[var(--pg-ink-faint)] hover:text-[var(--pg-ink-muted)] hover:underline"
              >
                {t("termsTitle")}
              </Link>
              {/* `--pg-ink-faint` (slate-400), never lighter -- see this
               * token's own doc comment in styles.css for the real,
               * confirmed-live illegibility incident that set this
               * floor. */}
              <span className="text-[var(--pg-ink-faint)]">·</span>
              <span className="text-[var(--pg-ink-faint)]">{t("supportAskStaff")}</span>
              <span className="text-[var(--pg-ink-faint)]">·</span>
              <span className="text-[var(--pg-ink-faint)]">{t("poweredByWyfy")}</span>
            </footer>
          </div>
        </div>
      </GuestBackdrop>
    </div>
  );
}

export function PortalCard({ children, className }: { children: ReactNode; className?: string }) {
  // Flattened: a thin 1px border + a small, tight shadow, not a heavy
  // glass-card blur/spread -- see this component's own history.
  // captive-portal-v5-design-spec.md §3.1/§3.3: radius unified to
  // `rounded-[20px]` (matches GUEST_LEGIBILITY_CARD_CLASS -- one shared
  // value across this card family, not two independently-tuned ones) and
  // padding trimmed `p-6` (24px) -> `p-5` (20px), still comfortably above
  // Purple's 44px touch-target floor (fields, not padding, need the room).
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--pg-border)] bg-[var(--pg-surface)] p-5",
        className,
      )}
      style={{
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 20px -12px rgba(15,23,42,0.12)",
      }}
    >
      {children}
    </div>
  );
}
