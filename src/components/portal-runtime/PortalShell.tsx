import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { A11yMenu } from "./A11yMenu";
import { DEFAULT_PORTAL_LOGO_SRC } from "./PortalGuestUi";

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

/** The lg:+ (laptop-width) left-hand context panel -- fills the space
 * that used to be empty gradient next to a small floating card. Copy is
 * deliberately generic (real venue name, phrased so it never repeats the
 * exact headline sentence the sign-in card on the right already shows)
 * rather than fabricated marketing claims (speed, encryption, session
 * length) this codebase has no real config field for -- see this
 * session's own audit call-out on not inventing guest-facing copy that
 * isn't backed by real data.
 *
 * v4 §6.3/§3: no longer owns its own `hasBackgroundImage` legibility
 * treatment -- that's now `<GuestBackdrop>`'s job, structurally, for
 * every child of this shell at once. This component is back to being a
 * pure content component with nothing to keep in sync with the shell's
 * own background-image logic. */
function BrandPanel({ venueName }: { venueName?: string }) {
  const { t } = usePortalRuntime();
  // {venue} substitution done here rather than inside translate() itself --
  // see courtesyOfTemplate's own doc comment in portal-i18n.ts for why the
  // word order needs to flip per language ("courtesy of X" vs "X की ओर से").
  const courtesySuffix = venueName ? t("courtesyOfTemplate").replace("{venue}", venueName) : "";
  return (
    <div className="max-w-lg">
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
    </div>
  );
}

// The top/bottom vignette scrim protects the logo and the Terms/Privacy
// footer whenever there's no opaque panel behind them -- fully
// transparent through the vertical middle, exactly where <GuestBackdrop>'s
// own panel sits once vertically centered. Kept as defense-in-depth
// underneath that panel (belt-and-suspenders, not either/or) for the
// sliver of photo still visible around the panel's edges.
const GUEST_BACKDROP_SCRIM =
  "linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 16%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.65) 100%)";

/**
 * Owns the guest-portal legibility guarantee against a venue-uploaded
 * background photo -- v4 §3, the structural fix for the bug class that
 * had been patched twice, independently (`BrandPanel` Aug 5, then
 * `GuestSignInCard`'s own header PR #80, four days apart, because nobody
 * had connected the two as the same underlying gap).
 *
 * Current mechanism before this component existed: the shell rendered the
 * photo, then a scrim that's deliberately transparent through the middle,
 * on the assumption that whatever content sits in that band supplies its
 * own opaque backing -- an opt-in each content block had to remember, not
 * a guarantee. The footer never got that memo at all and had no backing.
 *
 * v4 fix: invert who's responsible. One continuous `--pg-surface` panel
 * (not per-block cards) contains the *entire* content column -- logo,
 * heading, sign-in card, footer, and at lg:+ both the BrandPanel column
 * and the sign-in column -- as one visual object sitting on the photo,
 * not text floating over a photo hoping each piece remembered its own
 * backing. Any content added to this shell's children next month
 * inherits legibility automatically, because it's inside a layout-level
 * guarantee, not because someone remembered to write a fourth
 * `hasBackgroundImage &&` conditional.
 *
 * No `backgroundImageUrl`: unchanged from before -- content sits directly
 * on `--pg-canvas`, no panel, no scrim, no photo. Same conditional that
 * existed before, just resolved once here instead of three times
 * (this shell's scrim, BrandPanel's own check, GuestSignInCard header's
 * own check).
 */
function GuestBackdrop({
  backgroundImageUrl,
  children,
}: {
  backgroundImageUrl?: string | null;
  children: ReactNode;
}) {
  if (!backgroundImageUrl) return <>{children}</>;
  return (
    <>
      {/* Shown at full clarity, not faded -- a customer's own uploaded
       * photo/artwork should actually be visible, not washed out to
       * near-invisibility. On viewports much wider than the uploaded
       * image's own resolution this can look soft/stretched -- that's an
       * "upload a higher-resolution image" problem for the customer to
       * fix, not something to paper over with an artificial blur here. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImageUrl})` }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: GUEST_BACKDROP_SCRIM }}
      />
      {/* The one continuous legibility panel -- full-bleed to the
       * viewport edges below sm: (matches how the content column it wraps
       * already behaves at that width), inset with rounded corners and a
       * hairline border + soft shadow above it, so the panel reads as a
       * distinct object via its own edge even in the pathological case of
       * a photo whose luminance happens to be close to the panel's own. */}
      <div className="relative z-10 w-full overflow-hidden bg-[var(--pg-surface)]/92 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md sm:my-6 sm:rounded-[28px] sm:border sm:border-white/70">
        {children}
      </div>
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
            "relative z-10 mx-auto flex w-full max-w-[420px] flex-col px-4 pb-8 pt-6 sm:max-w-[460px] md:max-w-[520px]",
            // See this component's own top-level comment on `constrained` --
            // these `lg:` classes assume this element's width tracks the
            // real browser viewport, which isn't true inside the Portal
            // Preview's narrower fixed-width mockup. No BrandPanel column
            // (`showBrandPanel={false}`, the shared connecting-state
            // callers) means there's nothing to grid against -- stays a
            // single centered column at every width instead of leaving a
            // blank first grid cell.
            !constrained &&
              (showBrandPanel
                ? "lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center lg:gap-16 lg:px-12 lg:py-10 xl:gap-24"
                : "lg:max-w-[480px]"),
            heightCls,
          )}
        >
          {!constrained && showBrandPanel && (
            <div className="hidden lg:block">
              <BrandPanel venueName={config?.name} />
            </div>
          )}
          <div
            className={cn(
              "flex w-full flex-col",
              !constrained && "lg:mx-auto lg:w-full lg:max-w-[480px]",
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
            <footer className="mt-8 flex items-center justify-center gap-2.5 text-center pg-micro">
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
            </footer>
          </div>
        </div>
      </GuestBackdrop>
    </div>
  );
}

export function PortalCard({ children, className }: { children: ReactNode; className?: string }) {
  // Flattened: a thin 1px border + a small, tight shadow, not a heavy
  // glass-card blur/spread -- see this component's own history. Radius
  // `rounded-2xl` (16px) -- still soft, less "bubble."
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--pg-border)] bg-[var(--pg-surface)] p-6",
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
