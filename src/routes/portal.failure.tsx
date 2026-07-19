import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { XCircle, RotateCcw, LifeBuoy } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/failure")({
  component: FailurePage,
});

function FailurePage() {
  const { t, config } = usePortalRuntime();
  const navigate = useNavigate();
  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-500/20 text-red-300">
            <XCircle className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t("authFailed")}</h1>
          <p className="mt-1 text-sm text-white/60">Please check your details and try again.</p>
        </div>
        <PortalCard>
          <p className="text-sm text-white/70">
            If the issue continues, please contact our team:
          </p>
          <div className="mt-3 space-y-1 text-sm">
            <p className="text-white/90">{config?.brand.supportEmail}</p>
            <p className="text-white/60">{config?.brand.supportPhone}</p>
          </div>
        </PortalCard>
        <div className="flex flex-col gap-2">
          <Button
            className="h-11 w-full font-semibold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
            onClick={() => navigate({ to: "/portal/auth" })}
          >
            <RotateCcw className="me-2 h-4 w-4" /> {t("retry")}
          </Button>
          <Button variant="ghost" className="h-11 w-full text-white/80 hover:bg-white/10 hover:text-white">
            <LifeBuoy className="me-2 h-4 w-4" /> {t("contactSupport")}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}
