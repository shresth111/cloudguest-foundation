import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/welcome")({
  component: WelcomePage,
});

function WelcomePage() {
  const { config, t, setSelectedMethod } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/welcome" });

  // Industry-standard pattern (Cisco Meraki/Aruba ClearPass/Purple WiFi,
  // and most modern consumer sign-in flows): a returning guest goes
  // straight to their identifier + password, no method-picker menu in the
  // way -- the picker (src/routes/portal.auth.index.tsx) is still there
  // and reachable via that form's own "Back" link, for a guest who wants
  // OTP instead (new here, or never set a password). Only relevant when
  // password login is actually enabled for this portal; every other case
  // still lands on the picker exactly as before.
  const handleConnect = () => {
    if (config?.usernamePasswordEnabled) {
      setSelectedMethod("username_password");
      navigate({
        to: "/portal/auth/$method",
        params: { method: "username_password" },
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
            onClick={() => navigate({ to: "/portal/auth", search: (prev) => prev })}
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
