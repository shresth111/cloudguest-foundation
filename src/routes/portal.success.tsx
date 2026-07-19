import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, LogOut, Timer } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/success")({
  component: SuccessPage,
});

function SuccessPage() {
  const { t, session, config, setSession } = usePortalRuntime();
  const navigate = useNavigate();
  const remaining = session ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 60000)) : config?.sessionMinutes ?? 0;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/20 text-emerald-300"
          >
            <CheckCircle2 className="h-10 w-10" />
          </motion.div>
          <h1 className="mt-5 text-2xl font-bold">{t("connectedTitle")}</h1>
          <p className="mt-1 text-sm text-white/60">{t("connectedSubtitle")}</p>
        </div>
        <PortalCard className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-white/70"><Timer className="h-4 w-4" /> {t("sessionRemaining")}</span>
            <span className="font-semibold">{remaining} min</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (remaining / (config?.sessionMinutes ?? 120)) * 100)}%`,
                background: `linear-gradient(90deg, var(--pr-primary), var(--pr-accent))`,
              }}
            />
          </div>
        </PortalCard>
        <div className="flex flex-col gap-2">
          <Button
            className="h-11 w-full font-semibold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
            onClick={() => navigate({ to: "/portal/redirect" })}
          >
            {t("continue")}
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => { setSession(undefined); navigate({ to: "/portal/expired" }); }}
          >
            <LogOut className="me-2 h-4 w-4" /> {t("logout")}
          </Button>
          <Button
            variant="link"
            className="text-white/60 hover:text-white"
            onClick={() => navigate({ to: "/portal/session" })}
          >
            View session details
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}
