import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/welcome")({
  component: WelcomePage,
});

function WelcomePage() {
  const { config, t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/welcome" });

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
