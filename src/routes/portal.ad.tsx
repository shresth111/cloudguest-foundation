import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";

export const Route = createFileRoute("/portal/ad")({
  component: AdPage,
});

function AdPage() {
  const { config, t } = usePortalRuntime();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(config?.adSkipSeconds ?? 5);
  const { data: ads, isLoading } = useQuery({
    queryKey: ["portal-runtime-ads"],
    queryFn: () => portalRuntimeService.getAds(),
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const canSkip = remaining <= 0;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">While you wait…</h1>
          <Button
            variant="ghost"
            disabled={!canSkip}
            onClick={() => navigate({ to: "/portal/success" })}
            className="text-white/80 hover:bg-white/10 hover:text-white"
          >
            {canSkip ? t("skipAd") : `${t("skipAd")} (${remaining})`}
          </Button>
        </div>
        <PortalCard className="p-0 overflow-hidden">
          <div
            className="flex aspect-video items-end p-5"
            style={{ background: ads?.[0]?.imageColor ?? "linear-gradient(135deg,#0EA5E9,#6366F1)" }}
          >
            <div>
              <p className="text-xs uppercase tracking-wider text-white/70">Featured</p>
              <p className="mt-1 text-xl font-bold">{ads?.[0]?.title ?? "Promotional offer"}</p>
            </div>
          </div>
        </PortalCard>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-white/10" />)
            : ads?.slice(1).map((ad) => (
                <motion.div
                  key={ad.id}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl"
                >
                  <p className="text-sm font-semibold">{ad.title}</p>
                  <p className="mt-1 text-xs text-white/60">{ad.description}</p>
                  <button className="mt-3 text-xs font-semibold text-white/90 underline-offset-4 hover:underline">
                    {ad.cta} →
                  </button>
                </motion.div>
              ))}
        </div>
      </div>
    </PortalShell>
  );
}
