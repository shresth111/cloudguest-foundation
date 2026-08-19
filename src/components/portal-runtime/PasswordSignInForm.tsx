import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { AlertBanner, PG_INPUT, PG_PRIMARY_BTN } from "./PortalGuestUi";
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
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-500">{t("mobileOrEmailLabel")}</label>
        <Input
          value={sign.identifier}
          onChange={(e) => sign.setIdentifier(e.target.value)}
          placeholder="you@example.com or +1 555 010 2200"
          className={`${PG_INPUT} mt-1`}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">{t("password")}</label>
        <Input
          value={sign.password}
          onChange={(e) => sign.setPassword(e.target.value)}
          type="password"
          placeholder="••••••••••••"
          className={`${PG_INPUT} mt-1`}
        />
      </div>
      {/* captive-portal-v5-design-spec.md UX §4b: dropped the `rounded-xl
       * bg-slate-50 p-3` wrapper -- see OtpForm's identical checkbox for
       * the full reasoning; same fix, same legal text, applied here too
       * since both tabs render this row. */}
      <label className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-600">
        <Checkbox
          checked={sign.termsAccepted}
          onCheckedChange={(v) => sign.setTermsAccepted(!!v)}
          className="mt-0.5 border-slate-300 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
        />
        <span>
          {t("agreeToThe")}{" "}
          {sign.requiresTermsLink ? (
            <Link
              to="/portal/terms"
              search={sign.portalSearch}
              className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
            >
              {t("termsAcceptableUsePolicy")}
            </Link>
          ) : (
            <span className="font-medium text-slate-800">{t("termsAcceptableUsePolicy")}</span>
          )}
        </span>
      </label>
      <AlertBanner message={sign.passwordError} />
      <button
        type="button"
        onClick={sign.onSignInPassword}
        disabled={sign.loginPasswordPending}
        className={PG_PRIMARY_BTN}
      >
        {sign.loginPasswordPending ? t("signingInLabel") : t("signInConnect")}
      </button>
      {sign.hasOtp && (
        <button
          type="button"
          onClick={() => sign.setTab("otp")}
          className="block w-full text-center text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
        >
          {t("forgotUseOtp")}
        </button>
      )}
    </div>
  );
}
