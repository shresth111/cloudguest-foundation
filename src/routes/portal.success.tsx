import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2, Wifi, Database, Laptop, Clock, KeyRound, LogOut } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner } from "@/components/portal-runtime/PortalGuestUi";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/success")({
  component: SuccessPage,
});

function formatDataLimit(mb: number | null): string {
  if (mb === null || mb <= 0) return "Unlimited";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function DetailCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wifi;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={value}>
        {value}
      </p>
    </div>
  );
}

/**
 * The real post-login state -- an ACTIVE GuestSession now exists (set by
 * whichever real login call just succeeded: OTP, password, or voucher).
 * Every detail card below shows only data this app can actually fetch
 * client-side today from that same real `RuntimeSession` (see
 * src/types/portal-runtime.ts's own docstring on why it's persisted
 * rather than re-fetched -- there's no guest-facing "refresh my session"
 * endpoint). There is no real per-session bandwidth *rate* (Mbps) exposed
 * to a guest anywhere yet -- only `data_limit_mb`, a real data-cap field
 * that already reaches the guest client -- so that card is honestly
 * labeled "Data allowance", not invented as a bogus speed number.
 */
function SuccessPage() {
  const { t, config, session, setSession, organizationId, locationId, routerId, destinationUrl } =
    usePortalRuntime();
  const continueUrl = destinationUrl || config?.redirectUrl;
  const navigate = useNavigate({ from: "/portal/success" });
  const portalSearch = { organizationId, locationId, routerId };
  const [now, setNow] = useState(() => Date.now());
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      navigate({ to: "/portal/expired", replace: true, search: (prev) => prev });
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session, navigate]);

  const timeoutMinutes = session?.sessionTimeoutMinutes ?? 0;
  const startedAtMs = session ? new Date(session.startedAt).getTime() : 0;
  const expiresAtMs = timeoutMinutes > 0 ? startedAtMs + timeoutMinutes * 60_000 : 0;
  const remainingMs = expiresAtMs > 0 ? Math.max(0, expiresAtMs - now) : 0;
  const hasExpiry = timeoutMinutes > 0;

  // Real, honest session-expiry detection: there is no server push telling
  // this tab a session just expired, so the only truthful signal available
  // client-side is this same real `session_timeout_minutes` +
  // `started_at` the backend already returned at login -- once the real
  // countdown it drives hits zero, treat the session as expired.
  useEffect(() => {
    if (hasExpiry && remainingMs <= 0 && session) {
      setSession(undefined);
      navigate({ to: "/portal/expired", search: (prev) => prev });
    }
  }, [hasExpiry, remainingMs, session, setSession, navigate]);

  const disconnect = useMutation({
    mutationFn: () =>
      portalRuntimeService.disconnectSession({
        guestId: session?.guestId ?? "",
        sessionId: session?.sessionId ?? "",
        reason: "guest tapped disconnect",
      }),
    onSuccess: () => {
      toast.success("Disconnected");
      setSession(undefined);
      navigate({ to: "/portal/expired", search: (prev) => prev });
    },
    onError: (e: AppError) => setDisconnectError(e.message),
  });

  const remainingLabel = useMemo(() => {
    if (!hasExpiry) return "No expiry set";
    const h = Math.floor(remainingMs / 3_600_000);
    const m = Math.floor((remainingMs % 3_600_000) / 60_000);
    const s = Math.floor((remainingMs % 60_000) / 1000);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  }, [hasExpiry, remainingMs]);

  const expiryClock = useMemo(() => {
    if (!hasExpiry) return "No expiry";
    return new Date(expiresAtMs).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }, [hasExpiry, expiresAtMs]);

  const pct = hasExpiry
    ? Math.min(100, Math.max(0, (remainingMs / (timeoutMinutes * 60_000)) * 100))
    : 100;

  // First-time nudge: identical eligibility rule the old forced redirect
  // used (src/routes/portal.verify.tsx's onSuccess) -- surfaced here as a
  // dismissable nudge instead of a forced interrupt, per the redesign
  // spec's own "instead of/in addition to wherever it currently triggers"
  // instruction.
  const showPasswordNudge = !!(config?.usernamePasswordEnabled && session && !session.hasPassword);

  if (!session) return null;

  return (
    <PortalShell variant="light" showHeader={false}>
      <div className="flex flex-1 flex-col gap-5">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-500"
          >
            <CheckCircle2 className="h-11 w-11" />
          </motion.div>
          <h1
            className="mt-4 text-2xl font-bold text-slate-900"
            style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
          >
            {t("connectedTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("connectedSubtitle")}</p>
        </div>

        <PortalCard variant="light" className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Time remaining
            </span>
            <span className="text-lg font-bold tabular-nums text-slate-900">{remainingLabel}</span>
          </div>
          {hasExpiry && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5]"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </PortalCard>

        <div className="grid grid-cols-2 gap-2.5">
          <DetailCard icon={Wifi} label="Network" value={config?.name ?? "This network"} />
          <DetailCard
            icon={Database}
            label="Data allowance"
            value={formatDataLimit(session.dataLimitMb)}
          />
          <DetailCard
            icon={Laptop}
            label="Device"
            value={session.deviceName ?? session.deviceMacAddress ?? "This device"}
          />
          <DetailCard icon={Clock} label="Expires" value={expiryClock} />
        </div>

        {showPasswordNudge && (
          <Link
            to="/portal/set-password"
            search={portalSearch}
            className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3.5 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">Set a password for next time</p>
              <p className="truncate text-xs text-slate-500">Skip the code on your next visit</p>
            </div>
          </Link>
        )}

        {continueUrl && (
          <button
            type="button"
            onClick={() => navigate({ to: "/portal/redirect", search: (prev) => prev })}
            className="h-12 w-full rounded-[14px] bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-105"
          >
            {t("continue")}
          </button>
        )}

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
