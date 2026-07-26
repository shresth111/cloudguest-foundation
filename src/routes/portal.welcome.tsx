import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { primaryAuthMethod } from "@/lib/portal-auth-methods";

export const Route = createFileRoute("/portal/welcome")({
  component: WelcomePage,
});

function WelcomePage() {
  const { config, t, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/welcome" });

  // Industry-standard pattern (Cisco Meraki/Aruba ClearPass/Purple WiFi,
  // and most modern consumer sign-in flows): "Connect" goes straight to
  // the single highest-priority *enabled* method's own entry field --
  // SMS OTP's phone-number field by default, since that's this config's
  // actual primary method the overwhelming majority of the time -- never
  // a method-picker menu first. The picker
  // (src/routes/portal.auth.index.tsx) is still there and reachable from
  // that form's own fallback links, for a guest who wants a different
  // enabled method instead. Only when nothing is enabled at all does this
  // fall through to the picker, which then shows its own "contact
  // reception" state.
  const handleConnect = () => {
    const method = config ? primaryAuthMethod(config) : null;
    if (method) {
      setSelectedMethod(method);
      navigate({
        to: "/portal/auth/$method",
        params: { method },
        search: (prev) => prev,
      });
      return;
    }
    navigate({ to: "/portal/auth", search: (prev) => prev });
  };

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            {config?.splashHeadline ?? "Welcome"}
          </h1>
          <p className="mt-3 text-sm text-white/70 sm:text-base">{config?.splashWelcomeMessage}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="h-12 w-full text-base font-semibold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
            onClick={handleConnect}
          >
            {t("connect")} <ArrowRight className="ms-2 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full text-white/80 hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link to="/portal/terms" from="/portal/welcome" search={(prev) => prev}>
              {t("learnMore")}
            </Link>
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}
