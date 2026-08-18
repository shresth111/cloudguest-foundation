import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUEST_LEGIBILITY_CARD_CLASS, PortalCard } from "@/components/portal-runtime/PortalShell";
import { ConnectingOverlay, DEFAULT_PORTAL_LOGO_SRC } from "./PortalGuestUi";
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
 */
export function GuestSignInCard() {
  const { config, t } = usePortalRuntime();
  const sign = useGuestSignIn();
  const hasBackgroundImage = !!config?.backgroundImageUrl;

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Own bounded legibility card again when a real background photo is
       * configured -- mirrors BrandPanel's identical treatment. v4 (#81)
       * briefly delegated this to `<GuestBackdrop>` wrapping the entire
       * content column in one page-wide opaque panel instead; that
       * over-corrected into washing out the photo itself (see
       * GuestBackdrop's own comment in PortalShell.tsx), so this header is
       * back to owning its own scoped backing via the same shared
       * `GUEST_LEGIBILITY_CARD_CLASS` BrandPanel and the footer use. */}
      <div
        className={cn(
          "flex flex-col items-center text-center",
          hasBackgroundImage && cn("p-6", GUEST_LEGIBILITY_CARD_CLASS),
        )}
      >
        {/* Real per-location logo always wins when configured; otherwise
            fall back to the actual Wyfy Guest brand mark (not a generic
            placeholder icon) so an un-customized location's guests still
            see real branding. */}
        <img
          src={config?.logoUrl || DEFAULT_PORTAL_LOGO_SRC}
          alt=""
          className="h-16 w-16 object-contain drop-shadow sm:h-20 sm:w-20 md:h-24 md:w-24"
        />
        <h1 className="pg-title mt-4 text-[var(--pg-ink)]">{sign.heading}</h1>
        <p className="mt-1.5 pg-body text-[var(--pg-ink-muted)]">{sign.subtext}</p>
      </div>

      <PortalCard className="relative">
        <ConnectingOverlay
          active={sign.isSigningIn}
          label={sign.verifyOtpPending ? t("verifyingCode") : t("signingIn")}
        />

        {sign.noMethods ? (
          <p className="py-6 text-center text-sm text-slate-500">{t("noMethodsAvailable")}</p>
        ) : (
          <>
            <AuthTabSwitcher {...sign} />

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
