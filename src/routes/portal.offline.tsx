import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/offline")({
  component: OfflinePage,
});

function OfflinePage() {
  const { t } = usePortalRuntime();
  const navigate = useNavigate();
  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10 text-white/80">
            <WifiOff className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t("offlineTitle")}</h1>
          <p className="mt-1 text-sm text-white/60">{t("offlineSubtitle")}</p>
        </div>
        <PortalCard className="text-sm text-white/70">
          Make sure you're connected to the venue's guest network, then retry.
        </PortalCard>
        <Button
          className="h-11 w-full font-semibold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
          onClick={() => navigate({ to: "/portal", replace: true })}
        >
          {t("retry")}
        </Button>
      </div>
    </PortalShell>
  );
}
