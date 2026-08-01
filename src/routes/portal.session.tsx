import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Laptop, LogOut } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner } from "@/components/portal-runtime/PortalGuestUi";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/session")({
  component: SessionPage,
});

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * "You're online" hero illustration for the session status page --
 * a guest device picking up the venue's access point signal, with a
 * verified/connected badge, built from the same filled-flat-shape
 * primitives (rounded rects/circles, thin strokes, restrained
 * `framer-motion` draw-ins gated by `useReducedMotion`) as this
 * codebase's other illustrations (see `WanSetupIllustration` in
 * customer.$locationId.dashboard.tsx, whose access-point body/dashed
 * uplink-line technique this deliberately reuses -- that component
 * already proved this exact palette reads well on a light card
 * background, which is what this page now uses too). Deliberately not a
 * stock wifi-bars icon: the point is a specific device + a specific
 * access point + a real "verified" badge, not a generic signal glyph.
 */
function ConnectedIllustration({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 220 140" className={className} fill="none">
      <ellipse cx="110" cy="120" rx="72" ry="6" fill="#4338ca" opacity="0.06" />

      {/* Faint coverage ring behind the access point -- static, purely
          decorative context, not worth an animation loop. */}
      <circle cx="46" cy="74" r="34" stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="4 5" opacity="0.35" />

      {/* Access point */}
      <rect x="18" y="86" width="56" height="28" rx="8" fill="#4338ca" />
      <rect x="18" y="86" width="56" height="28" rx="8" fill="#7c3aed" opacity="0.15" />
      <rect x="27" y="78" width="4" height="10" rx="2" fill="#4338ca" />
      <rect x="59" y="78" width="4" height="10" rx="2" fill="#4338ca" />
      <circle cx="30" cy="100" r="2.6" fill="white" opacity="0.55" />
      <motion.circle
        cx="46"
        cy="100"
        r="2.6"
        fill="#22d3ee"
        animate={shouldReduceMotion ? { opacity: 0.85 } : { opacity: [0.35, 1, 0.35] }}
        transition={shouldReduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx="62" cy="100" r="2.6" fill="white" opacity="0.35" />

      {/* Signal fanning up-right from the access point's antennae */}
      {[20, 34, 48].map((r, i) => (
        <motion.path
          key={r}
          d={`M46 ${74 - r} A${r} ${r} 0 0 1 ${46 + r} 74`}
          stroke={["#a5b4fc", "#818cf8", "#6366f1"][i]}
          strokeOpacity={0.75 - i * 0.12}
          strokeWidth="2"
          strokeLinecap="round"
          initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 * i, ease: "easeOut" }}
        />
      ))}

      {/* Live data flowing from the access point to the guest's device */}
      <motion.path
        d="M64 70C90 42 108 40 130 52"
        stroke="#a78bfa"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeDasharray="1 7"
        strokeLinecap="round"
        animate={shouldReduceMotion ? undefined : { strokeDashoffset: [0, -16] }}
        transition={shouldReduceMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: "linear" }}
      />

      {/* Guest's device */}
      <rect x="132" y="18" width="42" height="64" rx="10" fill="white" stroke="#a78bfa" strokeWidth="1.8" />
      <rect x="138" y="26" width="30" height="48" rx="4" fill="#eef2ff" />
      <rect x="148" y="76" width="12" height="2.4" rx="1.2" fill="#a78bfa" opacity="0.5" />
      <rect x="144" y="52" width="4" height="8" rx="1.5" fill="#4338ca" opacity="0.35" />
      <rect x="151" y="46" width="4" height="14" rx="1.5" fill="#4338ca" opacity="0.6" />
      <rect x="158" y="40" width="4" height="20" rx="1.5" fill="#4338ca" />

      {/* Verified/connected badge */}
      <motion.g
        animate={shouldReduceMotion ? { opacity: 0.95 } : { scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "170px 74px" }}
      >
        <circle cx="170" cy="74" r="13" fill="#10b981" stroke="white" strokeWidth="3" />
        <path d="M164 74l4 4l8-9" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>
    </svg>
  );
}

/**
 * "Already connected" status page -- reached from `/portal/` when a
 * device has (or is found to still have) an active session, and from the
 * MikroTik hotspot's own status.html/alogin.html redirect (see
 * `RouterDetailTabs.tsx`'s PORTAL_OVERRIDE_FILES). Visually brought up to
 * the same "light" guest-portal treatment and polish level as
 * `portal.success.tsx` (which a guest lands on moments earlier, right
 * after actually signing in) -- these two screens show almost the same
 * real data, so they should look like the same product, not two
 * different design eras. All data below is the same real
 * `RuntimeSession` this page always rendered; only the layout/visual
 * treatment changed.
 */
function SessionPage() {
  const { t, session, setSession } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/session" });
  const [now, setNow] = useState(0);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Previously this button only cleared local app state (setSession) and
  // navigated away -- the real GuestSession on the backend (and the
  // router's own RADIUS-authorized hotspot session) stayed ACTIVE, since
  // nothing ever told the server. A guest tapping "Log out" here looked
  // logged out in this app while still actually connected -- confirmed
  // live via the "disconnect wala page kaam nahi karta" report. Mirrors
  // portal.success.tsx's own disconnect mutation exactly, since guests
  // now reach this same "already connected" page from the hotspot's own
  // status.html/alogin.html redirect (see RouterDetailTabs.tsx's
  // PORTAL_OVERRIDE_FILES), not just success.tsx.
  const disconnect = useMutation({
    mutationFn: () =>
      portalRuntimeService.disconnectSession({
        guestId: session?.guestId ?? "",
        sessionId: session?.sessionId ?? "",
        reason: "guest tapped disconnect",
      }),
    onSuccess: () => {
      setSession(undefined);
      navigate({ to: "/portal/expired", search: (prev) => prev });
    },
    onError: (e: AppError) => setDisconnectError(e.message),
  });

  useEffect(() => {
    if (!session) {
      navigate({ to: "/portal/expired", replace: true, search: (prev) => prev });
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session, navigate]);

  const timeoutMinutes = session?.sessionTimeoutMinutes ?? 0;
  const startedAtMs = session ? new Date(session.startedAt).getTime() : 0;
  const expiresAtMs = timeoutMinutes > 0 ? startedAtMs + timeoutMinutes * 60_000 : 0;
  const remainingMs = expiresAtMs > 0 ? Math.max(0, expiresAtMs - now) : 0;
  const hasExpiry = timeoutMinutes > 0;
  const bytesUsed = (session?.bytesUploaded ?? 0) + (session?.bytesDownloaded ?? 0);
  const bytesLimit = (session?.dataLimitMb ?? 0) * 1024 * 1024;
  const usagePct = bytesLimit > 0 ? (bytesUsed / bytesLimit) * 100 : 0;
  const timePct = hasExpiry
    ? Math.min(100, Math.max(0, (remainingMs / (timeoutMinutes * 60_000)) * 100))
    : 100;

  const remainingLabel = useMemo(() => {
    if (!hasExpiry) return "No expiry set";
    const h = Math.floor(remainingMs / 3_600_000);
    const m = Math.floor((remainingMs % 3_600_000) / 60_000);
    const s = Math.floor((remainingMs % 60_000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [hasExpiry, remainingMs]);

  if (!session || now === 0) return null;

  return (
    <PortalShell variant="light" showHeader={false}>
      <div className="flex flex-1 flex-col gap-5">
        <div className="text-center">
          <ConnectedIllustration className="mx-auto h-28 w-auto sm:h-32" />
          <h1
            className="mt-3 text-2xl font-bold text-slate-900"
            style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
          >
            {t("connectedTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("connectedSubtitle")}</p>
        </div>

        <PortalCard variant="light" className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("sessionRemaining")}
              </span>
              <span className="text-3xl font-bold tabular-nums text-slate-900">{remainingLabel}</span>
            </div>
            {hasExpiry && (
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5]"
                  style={{ width: `${timePct}%` }}
                />
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{t("dataUsage")}</span>
              <span className="font-semibold text-slate-900">
                {formatBytes(bytesUsed)}
                {bytesLimit > 0 ? ` / ${formatBytes(bytesLimit)}` : ""}
              </span>
            </div>
            {bytesLimit > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5]"
                  style={{ width: `${Math.min(100, usagePct)}%` }}
                />
              </div>
            )}
          </div>
        </PortalCard>

        <PortalCard variant="light">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Laptop className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">
                {session.deviceName ?? t("device")}
              </p>
              <p className="truncate text-xs text-slate-500">
                {session.ipAddress ?? "IP unknown"}
                {session.deviceMacAddress ? ` · ${session.deviceMacAddress}` : ""}
              </p>
            </div>
          </div>
        </PortalCard>

        <AlertBanner message={disconnectError} />

        <button
          type="button"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" /> {disconnect.isPending ? "Disconnecting…" : t("logout")}
        </button>
      </div>
    </PortalShell>
  );
}
