import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { AlertBanner, PG_PRIMARY_BTN } from "./PortalGuestUi";
import { PhoneNumberFields, EmailField, OtpCodeInput } from "./AuthFields";
import type { UseGuestSignInReturn } from "./useGuestSignIn";

/**
 * The OTP tab's two real screens (phone/email entry -> 6-digit code) --
 * presentational only, all state/mutations come from `useGuestSignIn()`.
 * Split out of `GuestSignInCard.tsx` per v4 §6 (Component structure).
 *
 * v4 UX §6.2: the terms checkbox now lives on *this* first screen (same
 * as the password tab always had it), not the code-entry screen -- a
 * guest never discovers a blocking requirement only after already
 * waiting for and typing a code.
 */
export function OtpForm(sign: UseGuestSignInReturn) {
  const { t } = usePortalRuntime();

  const TermsCheckbox = (
    <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-600">
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
  );

  if (sign.phase === "phone") {
    return (
      <div className="space-y-3.5">
        <label className="text-xs font-semibold text-slate-500">
          {sign.otpChannel === "email"
            ? t("emailAddress")
            : sign.otpChannel === "whatsapp"
              ? t("whatsappNumberLabel")
              : t("mobileNumber")}
        </label>
        {sign.otpChannel !== "email" ? (
          <PhoneNumberFields
            countryCode={sign.countryCode}
            onCountryCodeChange={sign.setCountryCode}
            phone={sign.phone}
            onPhoneChange={sign.setPhone}
          />
        ) : (
          <EmailField email={sign.email} onEmailChange={sign.setEmail} />
        )}
        {TermsCheckbox}
        <AlertBanner message={sign.otpError} />
        <button
          type="button"
          onClick={sign.onSendOtp}
          disabled={sign.sendOtpPending}
          className={PG_PRIMARY_BTN}
        >
          {sign.sendOtpPending ? t("sendingLabel") : t("sendOtp")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <p className="text-center text-sm text-slate-500">
        {t("sentCodeToPrefix")} <span className="font-semibold text-slate-800">{sign.target}</span>
      </p>
      <OtpCodeInput value={sign.code} onChange={sign.setCode} autoFocus />
      <AlertBanner message={sign.otpError} />
      <button
        type="button"
        onClick={sign.onVerifyOtp}
        disabled={sign.code.length !== 6 || sign.verifyOtpPending}
        className={PG_PRIMARY_BTN}
      >
        {sign.verifyOtpPending ? t("verifyingLabel") : t("verifyOtpConnect")}
      </button>
      <div className="flex items-center justify-center gap-3 pt-0.5 text-xs">
        {sign.resendCooldown > 0 ? (
          <span className="text-slate-400">
            {t("resendAvailableInTemplate").replace("{n}", String(sign.resendCooldown))}
          </span>
        ) : (
          <button
            type="button"
            onClick={sign.onResendOtp}
            disabled={sign.sendOtpPending}
            className="font-medium text-indigo-600 hover:underline"
          >
            {t("resend")}
          </button>
        )}
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={sign.onChangeNumber}
          className="font-medium text-slate-500 hover:text-slate-700 hover:underline"
        >
          {t("changeNumberLabel")}
        </button>
      </div>
    </div>
  );
}
