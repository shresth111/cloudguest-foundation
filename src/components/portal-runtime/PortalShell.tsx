import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { A11yMenu } from "./A11yMenu";
import { DEFAULT_PORTAL_LOGO_SRC } from "./PortalGuestUi";

// System-font stack for the redesigned "light" guest flow -- see the
// captive-portal redesign spec's §2/§3: the guest path only ever used one
// of the app's four Google-Fonts families (Manrope, hardcoded here), and
// dropping webfonts from this path entirely both removes a network
// dependency a captive-portal guest may not even be able to reach
// pre-auth and is itself part of not repeating the previous "generic
// friendly SaaS" visual recipe (Manrope is a very recognizable instance
// of that). Carried by weight/tracking/size choices, not a custom face.
// "Noto Sans Devanagari" covers Hindi -- none of the system-font stack
// below does, so Hindi text used to fall through to whatever Devanagari
// font (if any) the guest's OS happened to have, with visibly inconsistent
// weight/line-height versus the rest of this UI. Loaded best-effort,
// non-blocking alongside the rest of this app's fonts -- see __root.tsx's
// LOAD_FONTS_SCRIPT comment for why a captive-portal page can never afford
// a render-blocking font request.
const PG_FONT_STACK =
  '-apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif';

/** The lg:+ (laptop-width) left-hand context panel -- fills the space
 * that used to be empty gradient next to a small floating card. Copy is
 * deliberately generic (real venue name, phrased so it never repeats the
 * exact headline sentence the sign-in card on the right already shows)
 * rather than fabricated marketing claims (speed, encryption, session
 * length) this codebase has no real config field for -- see this
 * session's own audit call-out on not inventing guest-facing copy that
 * isn't backed by real data. */
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
  const courtesySuffix = venueName
    ? t("courtesyOfTemplate").replace("{venue}", venueName)
    : "";
  const content = (
    <>
      {/* Solid chip, not a glassy `bg-white/70 backdrop-blur` badge -- the
       * "quiet, confident, venue signage" direction (redesign spec §2)
       * deliberately drops the glass-panel vocabulary of the previous
       * pass; a flat neutral background no longer needs a blur to stay
       * legible underneath this. */}
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--pr-primary,#6366f1)]">
        <Wifi className="h-3.5 w-3.5" /> {t("guestNetwork")}
      </span>
      <h2 className="mt-6 text-[42px] font-bold leading-[1.08] tracking-[-0.02em] text-slate-900 xl:text-[50px]">
        {t("brandHeadlineBase")}
        {courtesySuffix}.
      </h2>
      {/* No "it takes about fifteen seconds" -- that was a fabricated
       * timing claim this codebase has no real config field to back (see
       * redesign spec §1a.2); the rest of the sentence already tells a
       * guest exactly what to do next without inventing a number. */}
      <p className="mt-5 max-w-md text-[16px] leading-relaxed text-slate-500">
        {t("verifyDeviceCta")}
      </p>
    </>
  );
  // The page-level scrim above this panel is a top/bottom vignette (to
  // protect the logo and the Terms/Privacy footer, which sit directly on
  // the image with nothing behind them) -- it's fully transparent through
  // the vertical middle, exactly where this panel sits once vertically
  // centered. Fine against the plain gradient background (no photo, no
  // contrast problem), but a real customer photo can be any tone at all,
  // so this needs its own guaranteed-legible backing rather than trusting
  // whatever's directly behind it (bug report: a real street-photo
  // background left this text unreadable, "clean design abhi bhi nahi
  // hai" -- illegible text is the opposite of clean).
  if (hasBackgroundImage) {
    return (
      <div className="max-w-lg rounded-3xl border border-white/60 bg-white/80 p-8 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md">
        {content}
      </div>
    );
  }
  return <div className="max-w-lg">{content}</div>;
}

interface Props {
  children: ReactNode;
  showHeader?: boolean;
  contentClassName?: string;
  /** "dark" (default) is the original glass-on-navy look, still used by
   * every portal.* route this visual redesign didn't touch
   * (offline/failure/ad/redirect/terms/auth picker). "light" is
   * the redesign-#2 "quiet, confident, venue signage" look (flat neutral
   * `#FAFAF8` background, thin-bordered 16px-radius white card, flat
   * single-color CTA fill, system-font stack -- see
   * docs/captive-portal-redesign-spec.md §2) used by the redesigned guest
   * sign-in flow itself (welcome, success, session, expired,
   * set-password). */
  variant?: "dark" | "light";
  /** When true, sizes to 100% of its parent container (`h-full`) instead
   * of the full viewport (`min-h-dvh`) -- used by the admin Portal
   * Preview (src/routes/preview.portal.$locationId.tsx), which renders
   * this exact component inside a fixed-size phone-bezel mockup rather
   * than a real full-page /portal/* route. */
  constrained?: boolean;
}

export function PortalShell({
  children,
  showHeader = true,
  contentClassName,
  variant = "dark",
  constrained = false,
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
  // guest-flow state taller than that box: "ye complete page nahi dikha
  // sakte ho... sahi se full page scroll nahi kr paunga". `min-h-full`
  // only sets a floor, so this shell (and its fixed-height-turned-min-height
  // parent) can grow to fit whatever the real content needs instead of
  // ever clipping or needing to scroll.
  const heightCls = constrained ? "min-h-full" : "min-h-dvh";

  if (variant === "light") {
    return (
      <div
        className={cn(
          // "portal-runtime" is the selector PortalRuntimeContext's own
          // injected <style> scopes --pr-primary/--pr-accent to (see that
          // file's own useEffect) -- missing here meant every var(--pr-*)
          // reference in this file (every descendant that reads it, e.g.
          // PortalCard/PG_PRIMARY_BTN) silently fell back to its
          // hardcoded #6366f1/#4f46e5 default forever, regardless of the
          // organization's real brand color. The dark variant below
          // already carries this class; the light variant -- the one
          // actually used by both this Live Preview and the real
          // guest-facing captive portal -- never did.
          "portal-runtime pg-shell relative w-full overflow-hidden",
          // The two-column desktop composition below is driven by Tailwind's
          // `lg:` *viewport*-width media query, not this element's own
          // (container) width -- fine for the real full-page guest route,
          // where the two always match, but not for the Portal Preview's
          // `constrained` mockup, which renders this same component inside
          // a much narrower fixed-width "laptop bezel" box while the
          // browser window itself can still be arbitrarily wide. Confirmed
          // live: on a real >=1024px browser window, `lg:grid-cols-
          // [minmax(0,1fr)_480px]` still activated inside that ~700px box,
          // collapsing the `1fr` BrandPanel column down to a sliver and
          // wrapping its heading to one word per line -- exactly the
          // "broken/garbled" preview the founder reported. Skipping the
          // whole `lg:` two-column treatment when constrained keeps this
          // to the single-column composition that already renders
          // correctly below that breakpoint, regardless of the real
          // window's width.
          !constrained && "lg:flex lg:items-center lg:justify-center",
          heightCls,
          highContrast && "contrast-125 saturate-150",
          largeText && "text-[17px]",
        )}
        style={{
          fontFamily: PG_FONT_STACK,
          // Flat, near-flat neutral -- not a colored gradient wash. The
          // previous indigo-tinted gradient here tinted every venue's page
          // the same color regardless of that venue's own brand, and read
          // as the generic "SaaS onboarding" look this redesign moves away
          // from (spec §2). The venue's real `--pr-primary`/`--pr-accent`
          // now only show up in small, deliberate places (button fill,
          // active tab state, focus ring) instead of the whole background.
          background: "#FAFAF8",
        }}
      >
        {/* Same organization-uploaded background image the "dark" variant
         * below already renders. Shown at full clarity, not faded --
         * a customer's own uploaded photo/artwork should actually be
         * visible, not washed out to near-invisibility. On viewports much
         * wider than the uploaded image's own resolution this can look
         * soft/stretched -- that's a "upload a higher-resolution image"
         * problem for the customer to fix, not something to paper over
         * with an artificial blur here. */}
        {config?.backgroundImageUrl && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
            />
            {/* A legibility scrim, not a fade -- keeps the image crystal
             * clear through the middle (where the sign-in card already
             * has its own opaque white background) while protecting the
             * logo/heading text at top and the Terms/Privacy footer at
             * bottom, which sit directly on the image with no card
             * behind them. Necessary regardless of how busy or plain the
             * uploaded image is -- a customer's background could be
             * anything from a subtle texture to a dense promotional
             * flyer with its own bold text. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 16%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.65) 100%)",
              }}
            />
          </>
        )}
        {/* No decorative wash for the default (no-custom-background) case
         * under the new flat/neutral direction -- the previous two
         * blurred-gradient "AmbientGlow" blobs were dropped entirely
         * (redesign spec §3): they cost two extra blurred paints for no
         * visual payoff once the page itself is already a flat neutral,
         * and a guest's attention belongs on the sign-in card, not a
         * decorative pattern behind it. */}

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
            // Preview's narrower fixed-width mockup.
            !constrained &&
              "lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center lg:gap-16 lg:px-12 lg:py-10 xl:gap-24",
            heightCls,
          )}
        >
          {!constrained && (
            <div className="hidden lg:block">
              <BrandPanel
                venueName={config?.name}
                hasBackgroundImage={!!config?.backgroundImageUrl}
              />
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
             * replaces a `framer-motion` `motion.main` fade -- see the
             * redesign spec's §3: a single 150-200ms ease-out
             * fade/translate on mount doesn't need a JS animation library,
             * and dropping this import (along with GuestSignInCard's tab
             * pill, its other framer-motion usage) is what lets Rollup
             * stop pulling framer-motion into the shared guest-portal
             * entry chunk every portal.* route loads. */}
            <main className={cn("pg-enter flex flex-1 flex-col", contentClassName)}>
              {children}
            </main>
            <footer className="mt-8 flex items-center justify-center gap-2.5 text-center text-[11px]">
              {/* One link, not two -- /portal/terms already covers both
               * Terms of service and Privacy policy as separate sections
               * (config's actual terms_and_conditions_text/url +
               * privacy_policy_text/url, see src/routes/portal.terms.tsx).
               * Two identically-styled links pointing at the exact same
               * page read as a broken/duplicate link, not two real
               * destinations. "Support" has no real guest-facing contact
               * field wired through /captive-portal/resolve today (only
               * an org/location `contactEmail` that's admin-facing, not
               * part of RuntimePortalConfig), so it stays plain text
               * rather than a fabricated mailto/tel link -- visually set
               * apart (no separator, dimmer, non-interactive) so it
               * doesn't read as a third, silently-broken link next to a
               * real one. */}
              <Link
                to="/portal/terms"
                search={portalSearch}
                className="text-slate-400 hover:text-slate-600 hover:underline"
              >
                {t("termsTitle")}
              </Link>
              {/* Real incident, live: text-slate-300 (~#cbd5e1) on this
               * shell's #FAFAF8 background reads as barely-there --
               * confirmed live, a guest couldn't make out this text at
               * all. "Dimmer than the real Terms link" was the right
               * instinct (this isn't a link, it shouldn't invite a tap),
               * but slate-300 overshot into illegible. slate-400 matches
               * Terms & Privacy's own resting (non-hover) shade -- still
               * visually quieter than a guest's eye lands on first, but
               * actually readable at rest, not just on close inspection. */}
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">{t("supportAskStaff")}</span>
            </footer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "portal-runtime relative min-h-dvh w-full overflow-hidden text-white",
        highContrast && "contrast-125 saturate-150",
        largeText && "text-[17px]",
      )}
      style={{
        background: config
          ? `linear-gradient(135deg, var(--pr-bg-from), var(--pr-bg-to))`
          : "linear-gradient(135deg,#0F172A,#1E293B)",
      }}
    >
      {config?.backgroundImageUrl && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
          />
          {/* Same legibility scrim as the "light" variant, dark-tinted to
           * match this variant's navy background/white text instead of
           * fading the image itself -- see that one's own comment. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.35) 16%, rgba(15,23,42,0) 34%, rgba(15,23,42,0) 72%, rgba(15,23,42,0.6) 100%)",
            }}
          />
        </>
      )}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-5 sm:max-w-lg">
        {showHeader && (
          <header className="mb-6 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Real per-location logo always wins when configured;
                  otherwise fall back to the actual Wyfy Guest brand mark
                  (not a generic placeholder icon) -- see GuestSignInCard's
                  identical fallback and DEFAULT_PORTAL_LOGO_SRC's own doc. */}
              <img
                src={config?.logoUrl || DEFAULT_PORTAL_LOGO_SRC}
                alt=""
                className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12 md:h-14 md:w-14"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{config?.name ?? "Wyfy Guest"}</p>
                <p className="truncate text-[11px] text-white/60">
                  {config?.splashHeadline ?? t("guestWifiFallback")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <LanguageSwitcher />
              <A11yMenu />
            </div>
          </header>
        )}
        {/* See the "light" variant's own comment above -- same CSS-only
         * `pg-enter` fade-in, no framer-motion import. */}
        <main className={cn("pg-enter flex flex-1 flex-col", contentClassName)}>{children}</main>
        {/* Same real footer convention as the light variant (Terms/Privacy
         * link to the real /portal/terms page, "Support" left as plain
         * text -- see that footer's own comment for why) -- this variant
         * used to show a "Powered by CloudGuest · v1.0" line instead, an
         * internal engineering name and a raw version string that never
         * belonged in guest-facing copy and didn't match the rest of the
         * flow. */}
        <footer className="mt-8 flex items-center justify-center gap-2.5 text-center text-[11px]">
          {/* See the light variant's own footer comment -- one merged
           * Terms &amp; Privacy link (same destination either way), Support
           * visually set apart as non-interactive. */}
          <Link
            to="/portal/terms"
            search={portalSearch}
            className="text-white/40 hover:text-white/70 hover:underline"
          >
            {t("termsTitle")}
          </Link>
          <span className="text-white/25">·</span>
          <span className="text-white/25">{t("supportAskStaff")}</span>
        </footer>
      </div>
    </div>
  );
}

export function PortalCard({
  children,
  className,
  variant = "dark",
}: {
  children: ReactNode;
  className?: string;
  variant?: "dark" | "light";
}) {
  if (variant === "light") {
    // Flattened per the redesign spec's §2 "Card" direction: a thin 1px
    // border + a small, tight shadow, not the previous `0 24px 60px -20px
    // rgba(79,70,229,.28)` -- that much blur/spread on an already-neutral
    // background was part of the "glassy SaaS" signal this redesign moves
    // away from. Radius pulled back from 24px to 16px (`rounded-2xl`) --
    // still soft, less "bubble."
    return (
      <div
        className={cn("rounded-2xl border border-slate-200 bg-white p-6", className)}
        style={{
          boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 20px -12px rgba(15,23,42,0.12)",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-[var(--pr-radius,18px)] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
