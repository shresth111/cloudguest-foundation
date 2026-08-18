import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { enabledAuthMethods } from "@/lib/portal-auth-methods";

export const Route = createFileRoute("/portal/expired")({
  component: ExpiredPage,
});

/**
 * Reached either by a real guest-initiated disconnect (success screen's
 * Disconnect button) or by the real, honest client-side expiry check on
 * the success screen (its own real `session_timeout_minutes` countdown
 * hitting zero -- see src/routes/portal.success.tsx). "Sign in again"
 * defaults to the password tab, "Use OTP instead" switches to the OTP
 * tab -- both by setting the same real `selectedMethod` context field
 * GuestSignInCard already reads to pick its initial tab, then navigating
 * back to the one real sign-in card (no separate expired-specific form).
 */
function ExpiredPage() {
  const { t, config, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/expired" });

  const methods = config ? enabledAuthMethods(config) : [];
  const hasPassword = methods.includes("username_password");
  const hasOtp = methods.includes("otp_sms") || methods.includes("otp_email");
  const preferredOtp = methods.includes("otp_sms") ? "otp_sms" : "otp_email";

  const goSignIn = (method: "username_password" | "otp_sms" | "otp_email") => {
    setSelectedMethod(method);
    navigate({ to: "/portal/welcome", search: (prev) => prev });
  };

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-50 text-amber-500">
            <Clock className="h-10 w-10" />
          </div>
          <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("sessionExpired")}</h1>
          <p className="mt-1 text-sm text-slate-500">You've been disconnected from the network.</p>
        </div>
        <PortalCard className="text-center text-sm text-slate-500">
          Sign in again to continue using guest WiFi.
        </PortalCard>
        <div className="flex flex-col gap-2.5">
          {hasPassword && (
            <button
              type="button"
              onClick={() => goSignIn("username_password")}
              className="h-12 w-full rounded-[14px] bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105"
            >
              Sign in again
            </button>
          )}
          {hasOtp && (
            <button
              type="button"
              onClick={() => goSignIn(preferredOtp)}
              className={
                hasPassword
                  ? "h-12 w-full rounded-[14px] border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50"
                  : "h-12 w-full rounded-[14px] bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105"
              }
            >
              Use OTP instead
            </button>
          )}
          {!hasPassword && !hasOtp && (
            <button
              type="button"
              onClick={() => navigate({ to: "/portal/welcome", search: (prev) => prev })}
              className="h-12 w-full rounded-[14px] bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105"
            >
              {t("reconnect")}
            </button>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
