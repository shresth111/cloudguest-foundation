import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/expired")({
  component: ExpiredPage,
});

function ExpiredPage() {
  const { t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/expired" });

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-amber-500/20 text-amber-300">
            <Clock className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t("sessionExpired")}</h1>
          <p className="mt-1 text-sm text-white/60">You've been disconnected from the network.</p>
        </div>
        <PortalCard className="text-sm text-white/70 text-center">
          Sign in again to continue using guest WiFi.
        </PortalCard>
        <div className="flex flex-col gap-2">
          <Button
            className="h-11 w-full font-semibold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
            onClick={() => navigate({ to: "/portal/welcome", search: (prev) => prev })}
          >
            {t("reconnect")}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}
