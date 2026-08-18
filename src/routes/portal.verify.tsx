import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner, PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { OtpCodeInput } from "@/components/portal-runtime/AuthFields";
import { Checkbox } from "@/components/ui/checkbox";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { friendlyGuestAuthError } from "@/lib/portal-guest-errors";
import { useOtpResendCooldown } from "@/lib/portal-otp-cooldown";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/verify")({
  component: VerifyPage,
});

/**
 * The deep-linkable per-method OTP verify step -- GuestSignInCard's own
 * inline OTP tab is the real path almost every guest takes today (see its
 * own docstring), so this only fires for a bookmarked/direct link into the
 * older per-method flow (portal.auth.$method.tsx's Mobile/Email/WhatsApp
 * forms navigate here after sending a code). Same light shell/card/OTP-
 * slot/button language as the rest of the redesigned flow now -- previously
 * still the old dark shell, the class of leftover page portal.terms.tsx's
 * own comment describes.
 */
function VerifyPage() {
  const {
    t,
    otpTarget,
    selectedMethod,
    organizationId,
    locationId,
    routerId,
    deviceMac,
    deviceIp,
    config,
    setSession,
    termsAccepted,
    setTermsAccepted,
    setGuestIdentifier,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/verify" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // v4 UX §6.4: was a fixed 60-second client-side countdown regardless of
  // server truth -- the same server-driven cooldown GuestSignInCard's own
  // inline OTP flow uses (see this hook's own docstring for the full
  // "why"). Starts at 0 (a guest can resend immediately) exactly like the
  // inline flow, and only gets a real cooldown once the server 429s.
  const { cooldown, applyServerCooldown, resetCooldown } = useOtpResendCooldown();

  const requiresTerms = !!(
    config?.termsAndConditionsText ||
    config?.termsAndConditionsUrl ||
    config?.privacyPolicyText ||
    config?.privacyPolicyUrl
  );

  useEffect(() => {
    if (!otpTarget || !selectedMethod)
      navigate({ to: "/portal/auth", replace: true, search: (prev) => prev });
  }, [otpTarget, selectedMethod, navigate]);

  const login = useMutation({
    mutationFn: (c: string) =>
      portalRuntimeService.loginWithOtp({
        identifier: otpTarget ?? "",
        code: c,
        authMethod: selectedMethod ?? "otp_sms",
        organizationId,
        locationId,
        routerId,
        deviceMac,
        deviceIp,
      }),
    onSuccess: async (session) => {
      setError(null);
      toast.success("Verified");
      setSession(session);
      // See PortalRuntimeState.guestIdentifier's docstring -- the NAS's
      // own RADIUS Authorize checks this exact value, not a hardcoded one.
      setGuestIdentifier(otpTarget?.trim());
      if (requiresTerms && termsAccepted) {
        portalRuntimeService
          .recordConsent({ guestId: session.guestId, captivePortalConfigId: config?.id })
          .catch(() => undefined);
      }
      // First (or any) OTP-verified login by a guest who hasn't set a
      // password yet, on a portal that offers password login at all --
      // offer the skippable "save a password for next time?" prompt before
      // continuing on to the success screen. A password login itself
      // never reaches here (see portal.auth.$method.tsx's own onLoggedIn),
      // so this can only ever fire right after a real OTP verification.
      const offerPasswordSetup = config?.usernamePasswordEnabled && !session.hasPassword;
      navigate({
        to: offerPasswordSetup ? "/portal/set-password" : "/portal/success",
        search: (prev) => prev,
      });
    },
    onError: (e: AppError) => setError(friendlyGuestAuthError(e, "otp_verify")),
  });

  const resend = useMutation({
    mutationFn: () =>
      portalRuntimeService.requestOtp({
        identifier: otpTarget ?? "",
        channel: selectedMethod === "otp_email" ? "email" : "sms",
        organizationId,
        locationId,
      }),
    onSuccess: () => {
      toast.success("New code sent");
      resetCooldown();
    },
    onError: (e: AppError) => {
      applyServerCooldown(e);
      toast.error(friendlyGuestAuthError(e, "otp_request"));
    },
  });

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link
          to="/portal/auth"
          from="/portal/verify"
          search={(prev) => prev}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("changeNumber")}
        </Link>
        <div className="text-center">
          <h1 className="pg-subtitle text-[var(--pg-ink)]">Enter your code</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-slate-800">{otpTarget}</span>
          </p>
        </div>
        <PortalCard className="space-y-4">
          <OtpCodeInput value={code} onChange={setCode} autoFocus />

          {requiresTerms && (
            <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-[13px] leading-snug text-slate-600">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(!!v)}
                className="mt-0.5 border-slate-300 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
              />
              <span>{t("agreeTerms")}</span>
            </label>
          )}

          <AlertBanner message={error} />

          <button
            type="button"
            disabled={code.length !== 6 || login.isPending || (requiresTerms && !termsAccepted)}
            onClick={() => login.mutate(code)}
            className={PG_PRIMARY_BTN}
          >
            {login.isPending ? "Verifying…" : t("verifyOtp")}
          </button>
          <div className="flex items-center justify-center gap-2 text-xs">
            {cooldown > 0 ? (
              <span className="text-slate-400">
                {t("resendAvailableInTemplate").replace("{n}", String(cooldown))}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => resend.mutate()}
                disabled={resend.isPending}
                className="font-medium text-indigo-600 hover:underline"
              >
                {t("resend")}
              </button>
            )}
          </div>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
