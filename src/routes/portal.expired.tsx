import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalShell,
  PortalCard,
  GUEST_LEGIBILITY_CARD_CLASS,
} from "@/components/portal-runtime/PortalShell";
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
  const hasPhoto = !!config?.backgroundImageUrl;

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
        {/* captive-portal-v7-design-spec.md §1.1 (L1): this heading block
         * used to render straight onto the venue's photo, inside the
         * page scrim's deliberately fully-transparent 24-78% band, so
         * `--pg-ink` had no guaranteed contrast ratio against it at all.
         * It now carries the same bounded `GUEST_LEGIBILITY_CARD_CLASS`
         * plate `BrandPanel` and the shell footer already use, sized to
         * its own text (`w-fit` only reaches full column width when the
         * text genuinely fills it) -- deliberately NOT a wash over the
         * whole content column, which is §0.1 item 1's twice-shipped
         * mistake. Photo-only: on the flat `--pg-canvas` there is no
         * contrast problem to solve and no plate is drawn. */}
        <div
          className={cn(
            "mx-auto w-fit max-w-full text-center",
            hasPhoto && cn("p-5", GUEST_LEGIBILITY_CARD_CLASS),
          )}
        >
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-50 text-amber-500">
            <Clock className="h-10 w-10" />
          </div>
          <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("sessionExpired")}</h1>
          {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
           * §1.5 retuned that token #64748B -> #475569, and a slate class does
           * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
           * composite (`--pg-surface` at 85% over a near-black photo region);
           * full derivation in styles.css's own `--pg-ink-muted` note. Backing
           * the block and leaving its subtitle at 3.36:1 would only have half-
           * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
          <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">
            You've been disconnected from the network.
          </p>
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
