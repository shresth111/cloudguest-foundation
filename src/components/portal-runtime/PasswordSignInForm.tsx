import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { AlertBanner, PG_INPUT, PG_PRIMARY_BTN } from "./PortalGuestUi";
import { PG_FIELD_LABEL } from "./AuthFields";
import type { UseGuestSignInReturn } from "./useGuestSignIn";

/**
 * The password tab's real form -- presentational only, split out of
 * `GuestSignInCard.tsx` per v4 §6 (Component structure). Named
 * `PasswordSignInForm` (not `PasswordForm`) to stay distinct from
 * `AuthMethodForms.tsx`'s own `PasswordForm` (the legacy deep-link
 * page's version) -- the two aren't merged into one component since
 * they're driven differently (this one by `useGuestSignIn()`'s shared
 * state, that one by its own `react-hook-form` instance), but v4 §6.8
 * still wants them rendering the same underlying fields where the fields
 * themselves are shared (see AuthFields.tsx).
 */
export function PasswordSignInForm(sign: UseGuestSignInReturn) {
  const { t } = usePortalRuntime();
  // v7 §7.2: both of these were `<label>` elements with no `htmlFor` and
  // inputs with no `id`, i.e. two more primary-path fields whose only
  // accessible naming was a placeholder. `useId()` keeps the pairing
  // correct even though this form renders inside a card that can appear
  // more than once on a page (the admin Portal Preview mounts a second
  // live copy of the whole shell).
  const id = useId();
  const identifierId = `${id}-identifier`;
  const passwordId = `${id}-password`;
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={identifierId} className={PG_FIELD_LABEL}>
          {t("mobileOrEmailLabel")}
        </Label>
        <Input
          id={identifierId}
          value={sign.identifier}
          onChange={(e) => sign.setIdentifier(e.target.value)}
          autoComplete="username"
          placeholder="you@example.com or +1 555 010 2200"
          className={`${PG_INPUT} mt-1`}
        />
      </div>
      <div>
        <Label htmlFor={passwordId} className={PG_FIELD_LABEL}>
          {t("password")}
        </Label>
        <Input
          id={passwordId}
          value={sign.password}
          onChange={(e) => sign.setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          className={`${PG_INPUT} mt-1`}
        />
      </div>
      <AlertBanner message={sign.passwordError} />
      <button
        type="button"
        onClick={sign.onSignInPassword}
        disabled={sign.loginPasswordPending}
        className={PG_PRIMARY_BTN}
      >
        {sign.loginPasswordPending ? t("signingInLabel") : t("signInConnect")}
      </button>
      {/* Consent is now implied by continuing -- no checkbox, matching the
       * reference design's "By clicking Continue, you agree to..."
       * pattern. Same legal text/link as before (reused verbatim), now
       * below the button rather than an opt-in row above it. See OtpForm's
       * identical TermsNotice for the same reasoning. */}
      <p className="text-center text-[13px] leading-snug text-[var(--pg-ink-muted)]">
        {t("agreeToThe")}{" "}
        {sign.requiresTermsLink ? (
          <Link
            to="/portal/terms"
            search={sign.portalSearch}
            className="font-medium text-[var(--pr-primary,#6366f1)] underline underline-offset-2 hover:opacity-80"
          >
            {t("termsAcceptableUsePolicy")}
          </Link>
        ) : (
          <span className="font-medium text-[var(--pg-ink)]">{t("termsAcceptableUsePolicy")}</span>
        )}
      </p>
      {sign.hasOtp && (
        <button
          type="button"
          onClick={() => sign.setTab("otp")}
          className="block w-full text-center text-xs font-medium text-[var(--pg-ink-muted)] hover:text-[var(--pr-primary,#6366f1)] hover:underline"
        >
          {t("forgotUseOtp")}
        </button>
      )}
    </div>
  );
}
