import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";
import { RefreshCw, Wifi } from "lucide-react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { portalRuntimeService } from "@/services/portal-runtime.service";

export const Route = createFileRoute("/portal/")({
  component: PortalLoading,
});

function PortalLoading() {
  const {
    isLoading,
    config,
    error,
    t,
    routerId,
    deviceMac,
    session,
    setSession,
    organizationId,
    locationId,
  } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/" });
  const queryClient = useQueryClient();

  // A device that already has a locally-persisted session (rehydrated
  // from sessionStorage -- see PortalRuntimeContext) never needs a live
  // check; a device with none but a real `deviceMac` (RouterOS's own
  // trustworthy `$(mac)`) might still have a live RADIUS-authorized
  // session the browser just doesn't know about yet -- a fresh tab, a
  // re-scanned QR code, a re-opened captive-portal redirect. Only that
  // second case hits the backend.
  const {
    data: liveSession,
    isFetched: liveSessionChecked,
    refetch: refetchLiveSession,
  } = useQuery({
    queryKey: ["portal-active-session", routerId, deviceMac],
    queryFn: () => portalRuntimeService.checkActiveSession({ routerId, deviceMac: deviceMac! }),
    enabled: !session && !!deviceMac,
    staleTime: 0,
  });

  useEffect(() => {
    if (liveSession) setSession(liveSession);
  }, [liveSession, setSession]);

  // A first-time guest device is, by definition, on a fresh, sometimes-flaky
  // pre-auth network path -- these two calls (the config resolve above, via
  // PortalRuntimeProvider, and the live-session check) both now time out at
  // 6s (services/portal-runtime.service.ts) rather than the client's global
  // 20s, specifically so a stuck connection surfaces here quickly. This
  // local timer is the *perceived*-performance half of that fix: rather
  // than making a guest stare at an unchanging spinner for the full 6s with
  // zero feedback, a "still connecting" notice (with a manual retry) shows
  // after 3s -- well before the request itself would time out, so a slow
  // but working connection gets a reassuring status update instead of
  // silence, and a genuinely stuck one gets an actionable retry sooner than
  // waiting for the hard timeout to reach the error branch below.
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowSlowNotice(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSlowNotice(true), 3000);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  function retry() {
    setShowSlowNotice(false);
    queryClient.invalidateQueries({ queryKey: ["portal-runtime-config", organizationId, locationId] });
    if (!session && deviceMac) refetchLiveSession();
  }

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
  // An existing session always wins over business hours -- someone
  // already connected mid-visit shouldn't suddenly get bounced to
  // "closed" just because the clock crossed the schedule boundary; the
  // closed screen only gates a *new* sign-in.
  // Navigates the instant the real decision is known -- no artificial
  // minimum wait. The founder wanted the login page to appear
  // immediately on connect; the old `setTimeout(..., 900)` here fired
  // *after* `target` was already fully resolved, so it was pure
  // decorative pacing bolted onto an already-finished decision, not real
  // async work. The two guard clauses above are the genuine async
  // gating (captive-portal config still loading, or a live-session check
  // still in flight) -- both must still resolve before this can navigate
  // anywhere, since navigating early risks sending an already-connected
  // guest back through sign-in.
  useEffect(() => {
    if (isLoading || !config) return;
    if (!session && deviceMac && !liveSessionChecked) return;
    const hasSession = !!(session || liveSession);
    const target = hasSession
      ? "/portal/session"
      : config.isOpenNow === false
        ? "/portal/closed"
        : "/portal/welcome";
    navigate({ to: target, replace: true, search: (prev) => prev });
  }, [isLoading, config, session, deviceMac, liveSession, liveSessionChecked, navigate]);

  if (!isLoading && error) {
    // A real response (404/400/etc) means the server looked this location
    // up and genuinely found no active config -- a real setup problem, not
    // something a retry fixes. No response at all (timeout, DNS hiccup,
    // dropped connection) is exactly the "fresh guest device on a flaky
    // pre-auth path" case this whole retry flow exists for -- most of these
    // resolve themselves on a second try a few seconds later.
    const isConfigMissing = isAxiosError(error) && !!error.response;
    return (
      <PortalShell variant="light" showHeader={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          {isConfigMissing ? (
            <>
              <p className="text-lg font-semibold text-slate-900">
                This venue's guest WiFi isn't set up yet
              </p>
              <p className="max-w-sm text-sm text-slate-500">
                No active sign-in configuration was found for this location. Please ask venue
                staff for assistance.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-slate-900">Having trouble connecting</p>
              <p className="max-w-sm text-sm text-slate-500">
                This can happen right after joining the WiFi. Check your connection and try
                again.
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-2 flex items-center gap-2 rounded-full bg-indigo-50 px-5 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </>
          )}
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell variant="light" showHeader={false}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {config?.logoUrl ? (
          <motion.img
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            src={config.logoUrl}
            alt={config.name}
            className="h-24 w-24 object-contain drop-shadow-lg sm:h-32 sm:w-32 md:h-36 md:w-36"
          />
        ) : (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid h-20 w-20 place-items-center rounded-3xl text-3xl font-bold text-white shadow-xl shadow-indigo-500/25 sm:h-28 sm:w-28 md:h-32 md:w-32"
            style={{
              background: `linear-gradient(135deg, var(--pr-primary,#6366f1), var(--pr-accent,#4f46e5))`,
            }}
          >
            <Wifi className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12" />
          </motion.div>
        )}
        <div>
          <p className="font-display text-lg font-semibold text-slate-900">
            {config?.name ?? "Wyfy Guest"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {showSlowNotice ? "Still connecting..." : t("loading")}
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-[var(--pr-primary,#6366f1)]"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        {showSlowNotice && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            type="button"
            onClick={retry}
            className="flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Taking a while -- retry
          </motion.button>
        )}
      </div>
    </PortalShell>
  );
}
