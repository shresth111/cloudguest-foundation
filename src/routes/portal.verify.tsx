import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";

export const Route = createFileRoute("/portal/verify")({
  component: VerifyPage,
});

function VerifyPage() {
  const { t, otpTarget, config, setSession } = usePortalRuntime();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!otpTarget) navigate({ to: "/portal/auth", replace: true });
  }, [otpTarget, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const verify = useMutation({
    mutationFn: (c: string) => portalRuntimeService.verifyOtp(c),
    onSuccess: async () => {
      toast.success("Verified");
      const s = await portalRuntimeService.createSession();
      setSession(s);
      navigate({ to: config?.adEnabled ? "/portal/ad" : "/portal/success" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: () => portalRuntimeService.sendOtp(otpTarget ?? ""),
    onSuccess: () => { toast.success("New code sent"); setCountdown(60); },
  });

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <Link to="/portal/auth" className="inline-flex w-fit items-center gap-1.5 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("changeNumber")}
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Enter your code</h1>
          <p className="mt-1 text-sm text-white/60">We sent a 6-digit code to <span className="font-medium text-white">{otpTarget}</span></p>
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
          <Button
            disabled={code.length !== 6 || verify.isPending}
            onClick={() => verify.mutate(code)}
            className="h-11 w-full font-semibold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
          >
            {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("verifyOtp")}
          </Button>
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Try <code className="rounded bg-white/10 px-1">111111</code> to fail · <code className="rounded bg-white/10 px-1">123456</code> to pass</span>
          </div>
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
