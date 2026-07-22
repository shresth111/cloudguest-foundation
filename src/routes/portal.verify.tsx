import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/verify")({
  component: VerifyPage,
});

function VerifyPage() {
  const {
    t,
    otpTarget,
    selectedMethod,
    organizationId,
    locationId,
    routerId,
    config,
    setSession,
    termsAccepted,
    setTermsAccepted,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/verify" });
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(60);

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

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const login = useMutation({
    mutationFn: (c: string) =>
      portalRuntimeService.loginWithOtp({
        identifier: otpTarget ?? "",
        code: c,
        authMethod: selectedMethod ?? "otp_sms",
        organizationId,
        locationId,
        routerId,
      }),
    onSuccess: async (session) => {
      toast.success("Verified");
      setSession(session);
      if (requiresTerms && termsAccepted) {
        portalRuntimeService
          .recordConsent({ guestId: session.guestId, captivePortalConfigId: config?.id })
          .catch(() => undefined);
      }
      navigate({
        to: config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success",
        search: (prev) => prev,
      });
    },
    onError: (e: AppError) => toast.error(e.message),
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
      setCountdown(60);
    },
    onError: (e: AppError) => toast.error(e.message),
  });

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link
          to="/portal/auth"
          from="/portal/verify"
          search={(prev) => prev}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("changeNumber")}
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Enter your code</h1>
          <p className="mt-1 text-sm text-white/60">
            We sent a 6-digit code to <span className="font-medium text-white">{otpTarget}</span>
          </p>
        </div>
        <PortalCard className="space-y-5">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              autoFocus
              containerClassName="gap-2"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-10 rounded-xl border-white/20 bg-white/10 text-lg font-semibold text-white"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {requiresTerms && (
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(!!v)}
                className="mt-0.5 border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-slate-900"
              />
              <span className="text-white/80">{t("agreeTerms")}</span>
            </label>
          )}

          <Button
            disabled={code.length !== 6 || login.isPending || (requiresTerms && !termsAccepted)}
            onClick={() => login.mutate(code)}
            className="h-11 w-full font-semibold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
          >
            {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("verifyOtp")}
          </Button>
          <div className="flex items-center justify-center gap-2 text-xs">
            {countdown > 0 ? (
              <span className="text-white/50">Resend in {countdown}s</span>
            ) : (
              <button
                type="button"
                onClick={() => resend.mutate()}
                className="text-white underline-offset-4 hover:underline"
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
