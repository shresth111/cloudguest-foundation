import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { scriptClassOf } from "@/lib/portal-script";
import { PortalTextPlate, PortalCard } from "@/components/portal-runtime/PortalShell";
import { ConnectingOverlay, DEFAULT_PORTAL_LOGO_SRC } from "./PortalGuestUi";
import { PortalDefaultBrandBadge } from "./PortalDefaultBrandBadge";
import { VenueLogo } from "./VenueLogo";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { useGuestSignIn } from "./useGuestSignIn";
import { AuthTabSwitcher, AuthMoreOptions } from "./AuthTabSwitcher";
import { OtpForm } from "./OtpForm";
import { PasswordSignInForm } from "./PasswordSignInForm";

/**
 * The guest sign-in card: centered logo mark, "Welcome to [venue]"
 * heading, a pill two-tab toggle (plain, action-first labels -- "Text me
 * a code" / "I have a password") and each tab's real, already-working
 * backend call.
 *
 * v4 §6 (Component structure): this used to be a 765-line monolith fusing
 * the visual shell with three independent auth state machines (OTP
 * send/verify + profile capture, password login, resend cooldown). All
 * mutation/state-machine logic now lives in `useGuestSignIn()` (zero
 * JSX); this component is purely composition -- `<AuthTabSwitcher>`
 * (tiers 1-2), `<OtpForm>`/`<PasswordSignInForm>` (the active tab's real
 * fields), `<AuthMoreOptions>` (tier 3 + voucher fallback). That split is
 * also the direct prerequisite for two UX v4 asks a visual-only pass
 * would otherwise have had to route around: §6.5 (the post-OTP profile
 * prompt moved to `/portal/session`, see GuestProfileNudge.tsx) and §6.8
 * (the legacy `/portal/auth/$method`+`/portal/verify` forms sharing the
 * same field pieces, see AuthFields.tsx).
 *
 * captive-portal-v5-design-spec.md §3.1/§5.1: the header (logo/heading/
 * subtext) used to wrap in its own `GUEST_LEGIBILITY_CARD_CLASS` panel,
 * separate from `PortalCard`'s form panel below it -- confirmed live as
 * one of three simultaneously-visible opaque panels, with a sliver of raw
 * photo showing between this header and the form card that read as a
 * rendering gap, not a deliberate reveal. The header now renders *inside*
 * the same `<PortalCard>` as the tab switcher and fields -- one card, one
 * border, one shadow, matching Purple's "the form is the central, most
 * visually prominent element" guidance (§0) instead of two stacked
 * components that happen to share a class name.
 */
export function GuestSignInCard() {
  const { config, t } = usePortalRuntime();
  const sign = useGuestSignIn();

  return (
    <div className="flex flex-1 flex-col gap-3">
      <PortalCard className="relative">
        <ConnectingOverlay
          active={sign.isSigningIn}
          label={sign.verifyOtpPending ? t("verifyingCode") : t("signingIn")}
        />

        {/* A distinct logo "header zone" -- its own vertical rhythm and a
         * full-bleed hairline separating it from the form below, rather
         * than the mark sharing the same flow/padding as the heading and
         * fields. Negative margins cancel PortalCard's own `p-4` for just
         * this zone so the divider spans the card's true edge-to-edge
         * width, then restore comparable side padding so the logo itself
         * isn't flush against the corners.
         *
         * `flex justify-center`, not `text-center`: Tailwind's preflight
         * sets `img`/`svg` to `display: block`, and `text-align` only ever
         * centers inline content -- a block-level element with no auto
         * margins just sits flush left regardless of the wrapper's
         * `text-align`. That left every uploaded venue logo (a plain
         * `<img>`) pinned to the left edge of this zone instead of
         * centered under the hairline. A tinted violet wash (the site's
         * own `--pg-brand-accent`, at a wash-level opacity so an arbitrary
         * logo still reads clearly on top of it) replaces the previously
         * flat white zone, matching wyfyguest.com's own violet identity. */}
        <div className="-mx-4 -mt-4 mb-4 flex justify-center border-b border-[var(--pg-border)] bg-gradient-to-b from-[var(--pg-brand-accent)]/[0.07] to-transparent px-4 pb-4 pt-5">
          {/* Real per-location logo always wins when configured --
           * `framed`, per `VenueLogo`'s own doc comment: this zone's
           * violet wash sits behind whichever logo a venue uploaded, and
           * an arbitrary upload can be any aspect ratio (a tall/narrow
           * mark used to collapse to a sliver here) or palette (light-on-
           * transparent art could lose all contrast on the wash) -- the
           * same circular white plate `PortalDefaultBrandBadge` already
           * gives the no-logo case now backs every real upload too, so
           * both cases read as one consistent treatment regardless of
           * what a given venue actually provided. captive-portal-v5-
           * design-spec.md §3.3: logo scale 64/80/96px -> 48/56/64px --
           * the mark doesn't need to out-size the heading it sits above;
           * this alone removes ~30-40px of vertical space at every
           * breakpoint. */}
          {config?.logoUrl ? (
            <VenueLogo logoUrl={config.logoUrl} size="sm" framed />
          ) : (
            <PortalDefaultBrandBadge
              size={64}
              className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16"
            />
          )}
        </div>
        <div className="flex flex-col items-center text-center">
          {/* v7 Part 2. The courtesy line, demoted out of the headline --
           * see `useGuestSignIn`'s own comment for the two variants this
           * slot carries and why `splashHeadline` no longer deletes the
           * venue's name.
           *
           * `pg-meta` (13px), not `pg-micro` (11px): this is a hierarchy
           * step below the name, not a footnote. It also matters that
           * `pg-meta` is one of the three utilities that deliberately do
           * NOT bind `--pg-display-font-family` -- so when a venue picks
           * one of the curated heading faces, that face is spent on the
           * venue's own name and our chrome stays on the system stack.
           *
           * THE TWO VARIANTS ARE STYLED DIFFERENTLY, AND THAT IS THE POINT.
           *
           * The greeting variant ("Welcome to") is *our* label, so it takes
           * wyfyguest.com's own `.eyebrow` treatment verbatim -- 12px, 600,
           * +0.14em, uppercase, violet-700 -- read off that site's
           * `global.css` and confirmed against its live computed styles.
           * That kicker is the marketing site's most repeated typographic
           * signature, it appears above every section heading there, and
           * reproducing it here costs nothing and is the clearest
           * zero-byte statement that these two surfaces are one product.
           *
           * The identity variant puts a real customer's brand name in this
           * slot, and it gets none of that: no uppercase, because shouting
           * a customer's name ("TAJ PALACE") is a liberty we do not get to
           * take; no violet, because that is our colour and this is their
           * name. Neutral `--pg-ink-faint`, sentence case, normal tracking.
           * One slot, one rule: our chrome may wear our brand, the venue's
           * identity never does.
           *
           * Note `uppercase` is a no-op in Devanagari and every other
           * unicase script, which is correct rather than broken -- the
           * structure (small tracked label above a large name) survives, and
           * only the case change, which those scripts do not have, drops
           * out. The tracking does not: `+0.14em` on Devanagari would break
           * conjuncts apart, so `pg-eyebrow` deliberately does not set it
           * for `data-pg-script="tall"`. See styles.css. */}
          {sign.eyebrow && (
            <span
              data-pg-measure="eyebrow"
              data-pg-script={scriptClassOf(sign.eyebrow)}
              className={cn(
                "mt-3 block",
                sign.eyebrowIsVenueName
                  ? "pg-meta text-[var(--pg-ink-faint)]"
                  : "pg-eyebrow text-[var(--pg-brand-accent)]",
              )}
            >
              {sign.eyebrow}
            </span>
          )}
          {/* `data-pg-script` carries the extra leading Brahmic scripts need
           * -- see src/lib/portal-script.ts for the measured overlap this
           * fixes, and for why it is keyed on the string rather than on
           * `:lang()`. `text-balance` evens the ragged edge of a two-line
           * venue name; `break-words` is the safety net for a single
           * unbreakable 40-character token at 320px, and only engages when
           * a word genuinely cannot fit, so ordinary names are untouched. */}
          <h1
            data-pg-measure="headline"
            data-pg-script={scriptClassOf(sign.heading)}
            className={cn(
              "pg-title text-balance break-words text-[var(--pg-ink)]",
              sign.eyebrow ? "mt-0.5" : "mt-3",
            )}
          >
            {sign.heading}
          </h1>
          {/* captive-portal-v5-design-spec.md §3.2: no fallback filler
           * line when a venue hasn't configured a real welcome message --
           * see useGuestSignIn's `subtext` for why this is `undefined`,
           * not an empty string, when there's nothing real to show.
           *
           * `text-pretty` rather than `text-balance` here on purpose: the
           * venue's message can run to four or five lines, and `balance` is
           * both capped by the UA at a handful of lines and wrong for a
           * paragraph (it equalises line lengths, which reads as a poster).
           * `pretty` only suppresses orphans, which is what a body
           * paragraph actually wants. */}
          {sign.subtext && (
            <p
              data-pg-measure="welcome"
              data-pg-script={scriptClassOf(sign.subtext)}
              className="mt-2.5 pg-body text-pretty text-[var(--pg-ink-muted)]"
            >
              {sign.subtext}
            </p>
          )}
        </div>

        {/* Was `text-sm text-slate-500`. A literal slate utility cannot
         * follow a token retune, and #64748B is exactly the *old*
         * `--pg-ink-muted` that v7 §1.5 retired: it measures 4.76:1 on white,
         * which per Part 9-4 passes only at >=16px, and this renders at 14px.
         * `pg-meta` additionally makes the line respond to `--pg-type-scale`,
         * which a raw Tailwind size does not. */}
        {sign.noMethods ? (
          <p className="py-6 text-center pg-meta text-[var(--pg-ink-muted)]">
            {t("noMethodsAvailable")}
          </p>
        ) : (
          <>
            <div className="mt-3.5">
              <AuthTabSwitcher {...sign} />
            </div>

            {sign.tab === "otp" && sign.hasOtp && <OtpForm {...sign} />}
            {sign.tab === "password" && sign.hasPassword && <PasswordSignInForm {...sign} />}

            <AuthMoreOptions {...sign} />
          </>
        )}
      </PortalCard>

      {/* captive-portal-v7-design-spec.md §1.4 C3 -- the one line on this
       * screen that no token value could ever have fixed.
       *
       * The accessibility workstream flagged it and correctly declined to
       * try. It renders *outside* `PortalCard`, so it stands directly on the
       * venue's photo, and it stands there in the scrim's deliberately
       * transparent 24-78% middle band -- so there is nothing behind it but
       * the photograph. That makes it unsolvable by colour: darkening the
       * text helps over a light photo and hurts over a dark one, lightening
       * it does the exact reverse, and the photo is chosen by the customer,
       * so no single value is right. The only fix is to stop standing on the
       * photo, which is what `PortalTextPlate` does -- a surface bounded
       * to this one line's own content box.
       *
       * This is also the literal reading of "size the scrim from the content
       * box": the sizing happens here, on the text, and not by growing the
       * vignette to reach it. Growing the vignette is §0.1 item 1's
       * forbidden move -- it is how you arrive at PR #81 a third time. The
       * pill covers this line and not one pixel more.
       *
       * `pg-micro` replaces a literal `text-[11px]`, which was a leftover
       * the relative-units pass missed: an absolute px size cannot respond
       * to `--pg-type-scale`, so the portal's own "large text" control (and
       * the platform's) did nothing to the smallest text on the screen --
       * precisely the text that needed it most. `pg-micro` is the same 11px
       * at the default scale, so this is not a visual change. */}
      {sign.tab === "password" && (
        <PortalTextPlate shape="pill">
          <p className="flex items-center justify-center gap-1.5 text-center pg-micro text-[var(--pg-ink-faint)]">
            <KeyRound className="h-3 w-3 shrink-0" /> {t("savedPasswordsNote")}
          </p>
        </PortalTextPlate>
      )}
    </div>
  );
}
