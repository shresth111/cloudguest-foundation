import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Link as LinkIcon } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { enabledAuthMethods, primaryAuthMethod } from "@/lib/portal-auth-methods";
import {
  METHOD_META,
  MobileForm,
  EmailForm,
  PasswordForm,
  VoucherForm,
} from "@/components/portal-runtime/AuthMethodForms";
import type { RuntimeAuthMethod, RuntimeSession } from "@/types/portal-runtime";

export const Route = createFileRoute("/portal/welcome")({
  component: WelcomePage,
});

/**
 * The guest's real landing screen (see src/routes/portal.index.tsx --
 * `/portal/` auto-redirects here once config resolves). Branding +
 * sign-in form on ONE page: a guest sees the actual phone/email/password/
 * voucher field the instant this loads, picks a different enabled method
 * with the small tab row if more than one is on, and submits -- no
 * separate "Connect" button gating a picker screen gating a form screen
 * (that three-hop chain -- src/routes/portal.auth.index.tsx's method
 * picker, then src/routes/portal.auth.$method.tsx's form -- is what a
 * real guest actually complained about: an unnecessary "Next" before ever
 * seeing a field to fill in). Those two routes are kept only as
 * deep-linkable fallbacks (a bookmarked/shared method-specific URL still
 * resolves) -- this page no longer sends anyone through them.
 *
 * OTP's own two-step shape (request a code, then enter the code that
 * arrives by SMS/email on src/routes/portal.verify.tsx) is real and kept
 * as-is: the code doesn't exist until requested, so there's no page to
 * collapse it into -- that is not the redundant "Next" being removed
 * here.
 */
function WelcomePage() {
  const {
    config,
    isLoading,
    t,
    organizationId,
    locationId,
    routerId,
    setOtpTarget,
    setSelectedMethod,
    setSession,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/welcome" });

  const methods: RuntimeAuthMethod[] = config ? enabledAuthMethods(config) : [];
  const [activeMethod, setActiveMethod] = useState<RuntimeAuthMethod | null>(null);
  // Falls back to the config's own priority-ordered primary method until a
  // guest explicitly taps a different tab -- same "land directly on the
  // most likely method" behavior this page always had, just without the
  // extra click to get there.
  const method = activeMethod ?? (config ? primaryAuthMethod(config) : null);

  const onOtpSent = (target: string, authMethod: RuntimeAuthMethod) => {
    setOtpTarget(target);
    setSelectedMethod(authMethod);
    navigate({ to: "/portal/verify", search: (prev) => prev });
  };

  const onPasswordLoggedIn = (session: RuntimeSession) => {
    setSelectedMethod("username_password");
    setSession(session);
    toast.success("Signed in");
    navigate({
      to: config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success",
      search: (prev) => prev,
    });
  };

  const onVoucherLoggedIn = (session: RuntimeSession) => {
    setSelectedMethod("voucher");
    setSession(session);
    toast.success("Connected");
    navigate({
      to: config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success",
      search: (prev) => prev,
    });
  };

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            {config?.splashHeadline ?? "Welcome"}
          </h1>
          <p className="mt-2 text-sm text-white/70">{config?.splashWelcomeMessage}</p>
        </div>

        {isLoading ? (
          <PortalCard>
            <div className="space-y-3">
              <Skeleton className="h-4 w-24 bg-white/10" />
              <Skeleton className="h-10 w-full bg-white/10" />
              <Skeleton className="h-10 w-full bg-white/10" />
            </div>
          </PortalCard>
        ) : methods.length === 0 ? (
          <PortalCard className="text-center text-sm text-white/70">
            No sign-in methods are available. Please contact reception.
          </PortalCard>
        ) : (
          <PortalCard>
            {methods.length > 1 && (
              <div
                role="tablist"
                aria-label={t("chooseMethod")}
                className="mb-4 flex gap-1 rounded-xl bg-white/[0.06] p-1"
              >
                {methods.map((m) => {
                  const meta = METHOD_META[m];
                  const Icon = meta.icon;
                  const active = m === method;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveMethod(m)}
                      className={
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition " +
                        (active
                          ? "bg-white/15 text-white shadow-sm"
                          : "text-white/55 hover:text-white/85")
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t(meta.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {method === "otp_sms" && (
              <MobileForm
                organizationId={organizationId}
                locationId={locationId}
                onSent={(target) => onOtpSent(target, "otp_sms")}
              />
            )}
            {method === "otp_email" && (
              <EmailForm
                organizationId={organizationId}
                locationId={locationId}
                onSent={(target) => onOtpSent(target, "otp_email")}
              />
            )}
            {method === "username_password" && (
              <PasswordForm
                organizationId={organizationId}
                locationId={locationId}
                routerId={routerId}
                onLoggedIn={onPasswordLoggedIn}
              />
            )}
            {method === "voucher" && (
              <VoucherForm
                organizationId={organizationId}
                locationId={locationId}
                routerId={routerId}
                onLoggedIn={onVoucherLoggedIn}
              />
            )}
          </PortalCard>
        )}

        <button
          type="button"
          onClick={() => navigate({ to: "/portal/terms", search: (prev) => prev })}
          className="mx-auto flex items-center gap-1.5 text-xs text-white/60 hover:text-white hover:underline"
        >
          <LinkIcon className="h-3 w-3" /> {t("learnMore")}
        </button>
      </div>
    </PortalShell>
  );
}
