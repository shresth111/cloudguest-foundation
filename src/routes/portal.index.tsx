import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Wifi } from "lucide-react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { portalRuntimeService } from "@/services/portal-runtime.service";

export const Route = createFileRoute("/portal/")({
  component: PortalLoading,
});

function PortalLoading() {
  const { isLoading, config, error, t, mac, organizationId, locationId, routerId, setSession } =
    usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/" });

  // Real MAC-whitelist bypass attempt (see src/services/portal-runtime
  // .service.ts's loginWithMac docstring) -- only ever runs when a real
  // NAS redirect actually supplied a `mac` search param; every other real
  // captive-portal URL (including every one this session's own test
  // locations use) has none, so this is simply skipped and the guest
  // lands on the normal sign-in card exactly as before.
  const macLogin = useMutation({
    mutationFn: (macAddress: string) =>
      portalRuntimeService.loginWithMac({
        macAddress,
        organizationId,
        locationId,
        routerId,
      }),
    onSuccess: (session) => {
      setSession(session);
      navigate({
        to: config?.advertisementBannerUrl ? "/portal/ad" : "/portal/success",
        replace: true,
        search: (prev) => prev,
      });
    },
    // A rejection here (not whitelisted, or no MAC Authorization
    // integration wired at all) is completely ordinary -- fall through
    // to the real sign-in card below, never surface a guest-facing error
    // for it.
  });

  useEffect(() => {
    if (isLoading || !config) return;
    if (mac && !macLogin.isPending && !macLogin.isSuccess) {
      macLogin.mutate(mac);
      return;
    }
    if (macLogin.isPending) return;
    const to = setTimeout(
      () => navigate({ to: "/portal/welcome", replace: true, search: (prev) => prev }),
      900,
    );
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, config, mac, macLogin.isPending, macLogin.isSuccess, navigate]);

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
