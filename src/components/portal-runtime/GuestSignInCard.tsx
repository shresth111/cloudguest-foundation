import { KeyRound } from "lucide-react";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { ConnectingOverlay, DEFAULT_PORTAL_LOGO_SRC } from "./PortalGuestUi";
import { PortalDefaultBrandBadge } from "./PortalDefaultBrandBadge";
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
    <div className="flex flex-1 flex-col gap-4">
      <PortalCard className="relative">
        <ConnectingOverlay
          active={sign.isSigningIn}
          label={sign.verifyOtpPending ? t("verifyingCode") : t("signingIn")}
        />

        <div className="flex flex-col items-center text-center">
          {/* Real per-location logo always wins when configured -- keeps
           * rendering as a plain `<img>` exactly as before, since an
           * arbitrary uploaded logo has its own aspect ratio/colors that
           * `PortalDefaultBrandBadge`'s circular plate would crop or
           * mismatch. Only the *default* Wyfy Guest mark (no
           * `config.logoUrl` uploaded -- the common case for an
           * un-customized location) gets the refined badge treatment, per
           * the v5 Visual Assets section §2a. captive-portal-v5-design-
           * spec.md §3.3: logo scale 64/80/96px -> 48/56/64px -- the mark
           * doesn't need to out-size the heading it sits above; this alone
           * removes ~30-40px of vertical space at every breakpoint. */}
          {config?.logoUrl ? (
            <img
              src={config.logoUrl}
              alt=""
              className="h-12 w-12 object-contain drop-shadow sm:h-14 sm:w-14 md:h-16 md:w-16"
            />
          ) : (
            <PortalDefaultBrandBadge
              size={64}
              className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16"
            />
          )}
          <h1 className="pg-title mt-3 text-[var(--pg-ink)]">{sign.heading}</h1>
          {/* captive-portal-v5-design-spec.md §3.2: no fallback filler
           * line when a venue hasn't configured a real welcome message --
           * see useGuestSignIn's `subtext` for why this is `undefined`,
           * not an empty string, when there's nothing real to show. */}
          {sign.subtext && (
            <p className="mt-1.5 pg-body text-[var(--pg-ink-muted)]">{sign.subtext}</p>
          )}
        </div>

        {sign.noMethods ? (
          <p className="py-6 text-center text-sm text-slate-500">{t("noMethodsAvailable")}</p>
        ) : (
          <>
            <div className="mt-4">
              <AuthTabSwitcher {...sign} />
            </div>

            {sign.tab === "otp" && sign.hasOtp && <OtpForm {...sign} />}
            {sign.tab === "password" && sign.hasPassword && <PasswordSignInForm {...sign} />}

            <AuthMoreOptions {...sign} />
          </>
        )}
      </PortalCard>

      {sign.tab === "password" && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[var(--pg-ink-faint)]">
          <KeyRound className="h-3 w-3" /> {t("savedPasswordsNote")}
        </p>
      )}
    </div>
  );
}
