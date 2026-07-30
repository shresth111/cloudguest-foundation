import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Wifi } from "lucide-react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { portalRuntimeService } from "@/services/portal-runtime.service";

export const Route = createFileRoute("/portal/")({
  component: PortalLoading,
});

function PortalLoading() {
  const { isLoading, config, error, t, routerId, deviceMac, session, setSession } =
    usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/" });

  // A device that already has a locally-persisted session (rehydrated
  // from sessionStorage -- see PortalRuntimeContext) never needs a live
  // check; a device with none but a real `deviceMac` (RouterOS's own
  // trustworthy `$(mac)`) might still have a live RADIUS-authorized
  // session the browser just doesn't know about yet -- a fresh tab, a
  // re-scanned QR code, a re-opened captive-portal redirect. Only that
  // second case hits the backend.
  const { data: liveSession, isFetched: liveSessionChecked } = useQuery({
    queryKey: ["portal-active-session", routerId, deviceMac],
    queryFn: () => portalRuntimeService.checkActiveSession({ routerId, deviceMac: deviceMac! }),
    enabled: !session && !!deviceMac,
    staleTime: 0,
  });

  useEffect(() => {
    if (liveSession) setSession(liveSession);
  }, [liveSession, setSession]);

  // There used to be a client-side "MAC-whitelist bypass" attempt here,
  // triggered by an optional `mac` search param and POSTed straight to the
  // backend's (now-removed) `/guest/login/mac`. That was a real
  // authentication bypass -- see src/routes/portal.tsx's search-schema
  // docstring for the full write-up. A pre-whitelisted device is now
  // granted access transparently at the network layer (RADIUS Authorize,
  // bound to the NAS's own asserted Calling-Station-Id) before it ever
  // reaches this captive portal.
  //
  // What IS still this screen's job: a device that already has an active
  // session -- found locally or via the live check above -- goes straight
  // to /portal/session ("you're connected"), never back through sign-in.
  useEffect(() => {
    if (isLoading || !config) return;
    if (!session && deviceMac && !liveSessionChecked) return;
    const target = session || liveSession ? "/portal/session" : "/portal/welcome";
    const to = setTimeout(
      () => navigate({ to: target, replace: true, search: (prev) => prev }),
      900,
    );
    return () => clearTimeout(to);
  }, [isLoading, config, session, deviceMac, liveSession, liveSessionChecked, navigate]);

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
          <p className="text-lg font-semibold">{config?.name ?? "ZIP WiFi"}</p>
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
