import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Wifi } from "lucide-react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";

export const Route = createFileRoute("/portal/")({
  component: PortalLoading,
});

function PortalLoading() {
  const { isLoading, config, error, t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/" });

  useEffect(() => {
    if (!isLoading && config) {
      const to = setTimeout(
        () => navigate({ to: "/portal/welcome", replace: true, search: (prev) => prev }),
        900,
      );
      return () => clearTimeout(to);
    }
  }, [isLoading, config, navigate]);

  if (!isLoading && error) {
    return (
      <PortalShell showHeader={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-semibold">This venue's guest WiFi isn't set up yet</p>
          <p className="max-w-sm text-sm text-white/60">
            No active sign-in configuration was found for this location. Please ask venue staff for
            assistance.
          </p>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell showHeader={false}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="grid h-20 w-20 place-items-center rounded-3xl text-3xl font-bold text-white shadow-2xl"
          style={{
            background: `linear-gradient(135deg, var(--pr-primary,#0EA5E9), var(--pr-accent,#6366F1))`,
          }}
        >
          {config?.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={config.name}
              className="h-10 w-10 rounded-lg object-contain"
            />
          ) : (
            <Wifi className="h-8 w-8" />
          )}
        </motion.div>
        <div>
          <p className="text-lg font-semibold">{config?.name ?? "CloudGuest"}</p>
          <p className="mt-1 text-sm text-white/60">{t("loading")}</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-white/70"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
