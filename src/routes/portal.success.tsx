import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2, Wifi, Database, Laptop, Clock, KeyRound, LogOut, Users2 } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner } from "@/components/portal-runtime/PortalGuestUi";
import { CampaignOverlay, campaignHasRenderableContent } from "@/components/portal-runtime/CampaignOverlay";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { campaignPortalService } from "@/services/campaign-portal.service";
import type { AppError } from "@/services/api";

export const Route = createFileRoute("/portal/success")({
  component: SuccessPage,
});

// Real incident #2, found live at Haldwani: a hardcoded shared
// "guest"/"welcome123" here only ever worked for a hotspot profile with
// `use-radius=no` (RouterOS checks its own local `/ip hotspot user`
// list). Every `use-radius=yes` profile (the real, RADIUS-integrated
// setup this whole platform is built around -- GuestSession, RadiusNasClient,
// etc.) forwards the login to `RadiusService.authorize`, which checks
// whether *this exact username* has a currently-ACTIVE GuestSession --
// never checks the password at all (RADIUS has no "why", only
// accept/reject, and this backend's Authorize phase is purely a
// username-to-session lookup). A hardcoded "guest" username has no
// session of its own, so it was rejected on every single attempt,
// silently -- "redirect karne ke baad nahi chal raha hai internet" even
// after confirming the login succeeded, the router was online, and (a
// dead end) resetting the local hotspot user's password. The real fix is
// `guestIdentifier` -- see PortalRuntimeState's own docstring -- the
// actual phone/email this guest just verified via OTP/password/voucher,
// which *does* have an active session under that exact identifier.
const HOTSPOT_FALLBACK_PASSWORD = "welcome123";

/** Submits username/password to RouterOS's `$(link-login-only)` URL.
 *
 * Real incident #1: this used to POST via a hidden iframe so the guest
 * never left this success page. That silently failed on real devices --
 * this portal is served over HTTPS, `loginUrl` is always a plain-HTTP
 * address on the venue's own LAN (RouterOS has no TLS cert to offer a
 * guest's browser), and browsers treat a subresource navigation like an
 * iframe's as mixed content: Chrome's mixed-content autoupgrade rewrites
 * the iframe's target to `https://`, that request fails against a NAS
 * with no HTTPS listener, and the POST that would have opened the NAS's
 * gate never happens at all -- with nothing visible telling the guest or
 * us it failed.
 *
 * A real *top-level* navigation isn't subject to that restriction (only
 * embedded subresource loads are), so this now submits a normal,
 * full-page form POST -- the same mechanism RouterOS's own bundled
 * hotspot login page uses. A `dst` field (RouterOS's standard "where to
 * send the browser after a successful hotspot login" field) points back
 * at this exact success-page URL, so once the NAS's gate opens the guest
 * lands right back here -- this page's own state (session, countdown,
 * etc.) survives the round trip via PortalRuntimeContext's persisted
 * session, not a page-memory value that a real navigation would drop. */
function submitHotspotLogin(loginUrl: string, username: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = loginUrl;
  form.style.display = "none";
  const addField = (name: string, value: string) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };
  addField("username", username);
  addField("password", HOTSPOT_FALLBACK_PASSWORD);
  addField("dst", window.location.href);
  document.body.appendChild(form);
  form.submit();
}

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
  const {
    t,
    config,
    session,
    setSession,
    organizationId,
    locationId,
    routerId,
    destinationUrl,
    hotspotLoginUrl,
    guestIdentifier,
  } = usePortalRuntime();
  const continueUrl = destinationUrl || config?.redirectUrl;
  const navigate = useNavigate({ from: "/portal/success" });
  const portalSearch = { organizationId, locationId, routerId };
  const [now, setNow] = useState(() => Date.now());
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Real guest-facing Campaigns integration (app.domains.campaigns) --
  // completely separate from, and never gating, the hotspot-login POST
  // effect right below. This query fires on the exact same render/mount as
  // that effect (both are keyed off the same `session` becoming available),
  // never sequentially before it -- so a guest with no eligible campaign
  // (the common case) reaches their real "connected" screen exactly as fast
  // as before this feature existed; there is no added round trip on that
  // path. When a real, currently-eligible campaign *does* resolve, this
  // page's own JSX (see the `showCampaign` branch below, right after the
  // `!session` guard) swaps to `CampaignOverlay` in its place -- the
  // guest sees the campaign before the connected confirmation, while the
  // hotspot-login POST (and every effect above) keeps running unaffected
  // underneath, since none of that logic is conditioned on this state at
  // all.
  const { data: nextCampaign } = useQuery({
    queryKey: ["next-campaign", session?.sessionId],
    queryFn: () => campaignPortalService.getNextCampaign(session!.sessionId),
    enabled: !!session?.sessionId,
    staleTime: Infinity,
    retry: false,
  });
  const [campaignDismissed, setCampaignDismissed] = useState(false);

  // Our own login (OTP/password/voucher) only just created a session in
  // this platform's own database -- the NAS's own gate is a completely
  // separate thing and stays shut until it sees this POST (confirmed live:
  // a guest could "log in" here and still have zero real internet access).
  // Guarded to fire at most once per mount, not on every re-render.
  const hotspotLoginSubmitted = useRef(false);
  useEffect(() => {
    // No guestIdentifier means there's no real phone/email this platform
    // ever verified for this browsing session (e.g. a page reload that
    // lost it) -- submitting anything else is guaranteed to be rejected
    // by RadiusService.authorize's username-to-session lookup, so this
    // skips rather than firing a doomed request.
    if (!session || !hotspotLoginUrl || !guestIdentifier || hotspotLoginSubmitted.current) return;
    hotspotLoginSubmitted.current = true;
    submitHotspotLogin(hotspotLoginUrl, guestIdentifier);
  }, [session, hotspotLoginUrl, guestIdentifier]);

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

  // See this component's own comment on the `nextCampaign` query above --
  // `campaignHasRenderableContent` is the same "an admin created a SURVEY
  // with zero questions / a BANNER with no asset" guard `CampaignOverlay`
  // itself relies on, checked here too so this never mounts that component
  // for genuinely empty content (confirmed live against the founder's own
  // real "test" campaign, an ACTIVE survey with zero CampaignQuestion rows
  // -- a real data-completeness gap on the admin side, not a bug here).
  if (nextCampaign && campaignHasRenderableContent(nextCampaign) && !campaignDismissed) {
    return (
      <CampaignOverlay
        campaign={nextCampaign}
        sessionId={session.sessionId}
        onDone={() => setCampaignDismissed(true)}
      />
    );
  }

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

        {/* Real "Guest Teams" feature (app.domains.guest_teams) -- an
            admin-created shared-code group a guest can optionally join
            once already connected (see src/routes/portal.team.tsx's own
            docstring for the full "additional step, not a login method or
            a RADIUS bypass" reasoning). Always offered, not gated by any
            captive-portal-config flag: a guest with no code just ignores
            this card, and one with a wrong/unrelated code gets a real,
            honest 404 from the join call itself -- no location-level
            toggle would meaningfully add to that. */}
        <Link
          to="/portal/team"
          search={portalSearch}
          className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3.5 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Have a team code?</p>
            <p className="truncate text-xs text-slate-500">Join your group's shared data and quota</p>
          </div>
        </Link>

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
