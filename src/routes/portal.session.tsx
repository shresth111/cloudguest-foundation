import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Laptop, LogOut, KeyRound, Users2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import {
  AlertBanner,
  PG_PRIMARY_BTN,
  PG_SECONDARY_BTN,
} from "@/components/portal-runtime/PortalGuestUi";
import {
  CampaignOverlay,
  campaignHasRenderableContent,
} from "@/components/portal-runtime/CampaignOverlay";
import { GuestProfileNudge } from "@/components/portal-runtime/GuestProfileNudge";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { campaignPortalService } from "@/services/campaign-portal.service";
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

/** Precomputed arc length ((pi/2)*r, a 90-degree arc) for each signal-fan
 * path below -- `stroke-dasharray`/`stroke-dashoffset` (the `pg-draw`
 * utility, styles.css) needs each path's own real length to draw itself
 * in correctly; unlike framer-motion's `pathLength` (0-1, resolution-
 * independent), the CSS mechanism operates in the path's own user-space
 * units, so this is computed once here rather than guessed. */
const SIGNAL_ARC_LENGTHS: Record<number, number> = { 20: 31.42, 34: 53.41, 48: 75.4 };

/**
 * "You're online" hero illustration for the session status page --
 * a guest device picking up the venue's access point signal, with a
 * verified/connected badge, built from the same filled-flat-shape
 * primitives (rounded rects/circles, thin strokes) as this codebase's
 * other illustrations (see `WanSetupIllustration` in
 * customer.$locationId.dashboard.tsx, whose access-point body/dashed
 * uplink-line technique this deliberately reuses -- that component
 * already proved this exact palette reads well on a light card
 * background, which is what this page now uses too). Deliberately not a
 * stock wifi-bars icon: the point is a specific device + a specific
 * access point + a real "verified" badge, not a generic signal glyph.
 *
 * v4 §5: the draw-in/pulse motion here used to run on `framer-motion`
 * (`pathLength`, opacity/scale loops) -- PR #77 explicitly deferred this
 * one file as "out of scope" (a one-time celebratory SVG animation, seen
 * once, on one screen, doesn't justify a shared-chunk dependency paid by
 * every guest on every `portal.*` route). Ported to the CSS-only
 * `pg-draw`/`pg-flow-dash`/`pg-badge-pulse`/`pg-dot-pulse` utilities
 * (styles.css) -- `stroke-dasharray`/`stroke-dashoffset` is the same
 * mechanism `pathLength` animates under the hood -- closing the last real
 * `framer-motion` usage on this surface (`CampaignOverlay.tsx` is the
 * other, dropped rather than ported). All four already respect
 * `prefers-reduced-motion` via their own `@media` guard, same as every
 * other `pg-*` motion utility on this surface -- no per-consumer
 * `useReducedMotion()` check needed here anymore.
 */
function ConnectedIllustration({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 140" className={className} fill="none">
      <ellipse cx="110" cy="120" rx="72" ry="6" fill="#4338ca" opacity="0.06" />

      {/* Faint coverage ring behind the access point -- static, purely
          decorative context, not worth an animation loop. */}
      <circle
        cx="46"
        cy="74"
        r="34"
        stroke="#a78bfa"
        strokeWidth="1.4"
        strokeDasharray="4 5"
        opacity="0.35"
      />

      {/* Access point */}
      <rect x="18" y="86" width="56" height="28" rx="8" fill="#4338ca" />
      <rect x="18" y="86" width="56" height="28" rx="8" fill="#7c3aed" opacity="0.15" />
      <rect x="27" y="78" width="4" height="10" rx="2" fill="#4338ca" />
      <rect x="59" y="78" width="4" height="10" rx="2" fill="#4338ca" />
      <circle cx="30" cy="100" r="2.6" fill="white" opacity="0.55" />
      <circle cx="46" cy="100" r="2.6" fill="#22d3ee" className="pg-dot-pulse" />
      <circle cx="62" cy="100" r="2.6" fill="white" opacity="0.35" />

      {/* Signal fanning up-right from the access point's antennae */}
      {[20, 34, 48].map((r, i) => (
        <path
          key={r}
          d={`M46 ${74 - r} A${r} ${r} 0 0 1 ${46 + r} 74`}
          stroke={["#a5b4fc", "#818cf8", "#6366f1"][i]}
          strokeOpacity={0.75 - i * 0.12}
          strokeWidth="2"
          strokeLinecap="round"
          className="pg-draw"
          style={
            {
              "--pg-draw-length": SIGNAL_ARC_LENGTHS[r],
              "--pg-draw-delay": `${0.15 * i}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Live data flowing from the access point to the guest's device */}
      <path
        d="M64 70C90 42 108 40 130 52"
        stroke="#a78bfa"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeDasharray="1 7"
        strokeLinecap="round"
        className="pg-flow-dash"
      />

      {/* Guest's device */}
      <rect
        x="132"
        y="18"
        width="42"
        height="64"
        rx="10"
        fill="white"
        stroke="#a78bfa"
        strokeWidth="1.8"
      />
      <rect x="138" y="26" width="30" height="48" rx="4" fill="#eef2ff" />
      <rect x="148" y="76" width="12" height="2.4" rx="1.2" fill="#a78bfa" opacity="0.5" />
      <rect x="144" y="52" width="4" height="8" rx="1.5" fill="#4338ca" opacity="0.35" />
      <rect x="151" y="46" width="4" height="14" rx="1.5" fill="#4338ca" opacity="0.6" />
      <rect x="158" y="40" width="4" height="20" rx="1.5" fill="#4338ca" />

      {/* Verified/connected badge */}
      <g className="pg-badge-pulse" style={{ transformOrigin: "170px 74px" }}>
        <circle cx="170" cy="74" r="13" fill="#10b981" stroke="white" strokeWidth="3" />
        <path
          d="M164 74l4 4l8-9"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

/** One visual family for the session page's tappable nudge rows (device
 * card stays a plain PortalCard; these are the two *links*). Hand-written
 * PortalCard-equivalent surface (same 20px radius, border, resting shadow,
 * and the `pg-surface-card` marker the scrim polarity flip keys off)
 * rather than `<PortalCard className="p-0">` around the anchor, because
 * hover border/tint and the focus-visible ring belong on the interactive
 * element itself -- an anchor inside a styled box can be focused while the
 * box shows nothing. */
const NUDGE_ROW_CLASS =
  "pg-surface-card flex items-center gap-3 rounded-[20px] border border-[var(--pg-border)] bg-[var(--pg-surface)] p-3.5 shadow-[0_1px_2px_rgba(30,27,75,0.06),0_8px_24px_-12px_rgba(30,27,75,0.18)] transition-[border-color,background-color] duration-200 hover:border-[var(--pr-primary,#6366f1)]/30 hover:bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_5%,var(--pg-surface,#fff))] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15";

/** Icon chip inside a nudge row -- venue-primary at an 8% tint, same
 * recipe as the redesigned retry pills (spec §1.4 icon-disc family). */
const NUDGE_CHIP_CLASS =
  "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]";

/** The two stat rows share one real progressbar (role + aria-value*), one
 * track/fill recipe: flat venue-primary fill on a 15% tint track -- the
 * indigo gradient is retired for the same reason PG_PRIMARY_BTN went
 * flat. Deduplicated as a component so the long color-mix class string
 * exists once in the chunk. */
function UsageBar({ label, pct, className }: { label: string; pct: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_15%,var(--pg-surface,#fff))]",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-[var(--pr-primary,#6366f1)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * "Already connected" status page -- reached from `/portal/` when a
 * device has (or is found to still have) an active session, from the
 * MikroTik hotspot's own status.html/alogin.html redirect (see
 * `RouterDetailTabs.tsx`'s PORTAL_OVERRIDE_FILES), and now also as the
 * real `dst` landing target of `portal.success.tsx`'s hotspot-login POST
 * -- i.e. this is now the ONE real "you're connected" resting page a
 * guest ever lands on and stays on, per the founder's own "login page,
 * then session page, that's it" requirement. Everything that used to be
 * split across a redundant second copy on `portal.success.tsx` --
 * the set-password nudge, the "Have a team code?" nudge, and a real,
 * currently-eligible Campaign -- now lives here instead, since this is
 * the page a guest actually spends real time on (success.tsx is a
 * transitional loader that navigates away within a few hundred ms, no
 * place for content that needs a guest's attention or interaction).
 */
function SessionPage() {
  const {
    t,
    config,
    session,
    setSession,
    setGuestIdentifier,
    organizationId,
    locationId,
    routerId,
    destinationUrl,
    deviceMac,
  } = usePortalRuntime();

  // The NAS redirects here as a BRAND-NEW document once it has authorised
  // the guest. `session` comes from storage -- and inside iOS's captive
  // sheet, Web Storage throws, so nothing was ever persisted. Without this
  // lookup a guest who has just signed in successfully, and whose internet
  // is working, gets told "your session has expired".
  //
  // This is the same live-session query portal.index.tsx already runs; it
  // recovers IN PLACE rather than navigating, because bouncing would loop
  // on exactly the browsers this exists for -- the recovered session
  // cannot be persisted either.
  const { data: liveSession, isFetched: liveChecked } = useQuery({
    queryKey: ["portal-active-session", routerId, deviceMac],
    queryFn: () => portalRuntimeService.checkActiveSession({ routerId, deviceMac: deviceMac! }),
    enabled: !session && !!deviceMac,
    staleTime: 0,
  });

  useEffect(() => {
    if (!liveSession) return;
    setSession(liveSession);
    // Both, not just the session: portal.success.tsx's hotspot POST is
    // gated on `guestIdentifier` too, and setting only one of them is the
    // bug that once silently no-op'd for an entire class of guest.
    setGuestIdentifier(liveSession.identifier);
  }, [liveSession, setSession, setGuestIdentifier]);
  const navigate = useNavigate({ from: "/portal/session" });
  const portalSearch = { organizationId, locationId, routerId };
  const continueUrl = destinationUrl || config?.redirectUrl;
  const [now, setNow] = useState(0);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Real guest-facing Campaigns integration (app.domains.campaigns) --
  // moved here from portal.success.tsx (see that file's own note): a
  // campaign that needs a guest's attention/interaction (a survey, a
  // sponsored banner) can't reliably show on a page that's about to
  // navigate away on its own within a few hundred ms. This page is the
  // one guests actually stay on, so a real, currently-eligible campaign
  // shows here instead, once, right on arrival -- `getNextCampaign`
  // together with `recordImpression` (fired by `CampaignOverlay` itself
  // once the guest is done) is what keeps this from re-showing on every
  // later visit to this same page.
  const { data: nextCampaign } = useQuery({
    queryKey: ["next-campaign", session?.sessionId],
    queryFn: () => campaignPortalService.getNextCampaign(session!.sessionId),
    enabled: !!session?.sessionId,
    staleTime: Infinity,
    retry: false,
  });
  const [campaignDismissed, setCampaignDismissed] = useState(false);

  // Same eligibility rule portal.success.tsx used to gate its own
  // set-password nudge with -- relocated here, not re-derived.
  const showPasswordNudge = !!(config?.usernamePasswordEnabled && session && !session.hasPassword);

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
    // Don't declare the session dead while the lookup above is still in
    // flight -- that race is what produces the false "expired" screen.
    if (!session) {
      if (deviceMac && !liveChecked) return;
      navigate({ to: "/portal/expired", replace: true, search: (prev) => prev });
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session, navigate, deviceMac, liveChecked]);

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
    if (!hasExpiry) return t("noExpiryLabel");
    const h = Math.floor(remainingMs / 3_600_000);
    const m = Math.floor((remainingMs % 3_600_000) / 60_000);
    const s = Math.floor((remainingMs % 60_000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [hasExpiry, remainingMs, t]);

  if (!session || now === 0) return null;

  // See this component's own comment on the `nextCampaign` query above --
  // `campaignHasRenderableContent` is the same "an admin created a SURVEY
  // with zero questions / a BANNER with no asset" guard `CampaignOverlay`
  // itself relies on, checked here too so this never mounts that component
  // for genuinely empty content.
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
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1). The plate is
         * `PortalTextPlate` -- the one seam that owns "is there a photo",
         * the bounded `w-fit` sizing that is deliberately NOT a wash over
         * the whole content column (§0.1 item 1's twice-shipped mistake),
         * and §1.4 C5's refusal rule. Its own doc comment carries the
         * reasoning this used to copy per route.
         *
         * The wrapper `<div>` is this route's layout box, not the plate,
         * and has to stay: with no photo the plate renders its children
         * bare, so without this box they would drop straight into the
         * column's `gap-5` and lose `text-center`. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            <ConnectedIllustration className="mx-auto h-28 w-auto sm:h-32" />
            <h1 className="pg-title mt-3 text-[var(--pg-ink)]">{t("connectedTitle")}</h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">{t("connectedSubtitle")}</p>
          </PortalTextPlate>
        </div>

        {/* Stats card. Label row: pg-micro/ink-faint (hierarchy below
         * muted comes from size, not lightness -- the old slate-400
         * uppercase label measured 2.56:1, the exact failure v7 retired).
         * Value: 28px (nearest ramp-consistent size to the old off-ramp
         * text-3xl), scale-aware. */}
        <PortalCard className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="pg-micro uppercase tracking-[0.08em] text-[var(--pg-ink-faint)]">
                {t("sessionRemaining")}
              </span>
              <span className="text-[length:calc(1.75rem*var(--pg-type-scale,1))] font-bold tabular-nums text-[var(--pg-ink)]">
                {remainingLabel}
              </span>
            </div>
            {hasExpiry && (
              <UsageBar label={t("sessionRemaining")} pct={timePct} className="mt-2.5" />
            )}
          </div>

          <div className="h-px bg-[var(--pg-border)]" />

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="pg-meta text-[var(--pg-ink-muted)]">{t("dataUsage")}</span>
              <span className="pg-meta font-semibold text-[var(--pg-ink)]">
                {formatBytes(bytesUsed)}
                {bytesLimit > 0 ? ` / ${formatBytes(bytesLimit)}` : ""}
              </span>
            </div>
            {bytesLimit > 0 && (
              <UsageBar label={t("dataUsage")} pct={Math.min(100, usagePct)} className="mt-2" />
            )}
          </div>
        </PortalCard>

        <PortalCard className="p-3.5">
          <div className="flex items-center gap-3">
            <div className={NUDGE_CHIP_CLASS}>
              <Laptop className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="pg-body font-semibold text-[var(--pg-ink)]">
                {session.deviceName ?? t("device")}
              </p>
              <p className="truncate pg-meta font-normal text-[var(--pg-ink-muted)]">
                {session.ipAddress ?? t("ipUnknownLabel")}
                {session.deviceMacAddress ? ` · ${session.deviceMacAddress}` : ""}
              </p>
            </div>
          </div>
        </PortalCard>

        {showPasswordNudge && (
          <Link to="/portal/set-password" search={portalSearch} className={NUDGE_ROW_CLASS}>
            <div className={NUDGE_CHIP_CLASS}>
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="pg-body font-semibold text-[var(--pg-ink)]">
                {t("nudgeSetPasswordTitle")}
              </p>
              <p className="truncate pg-meta font-normal text-[var(--pg-ink-muted)]">
                {t("nudgeSetPasswordSubtitle")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--pg-ink-faint)]" />
          </Link>
        )}

        {/* v4 UX §6.5: the post-OTP "tell us about yourself" prompt,
            relocated out of the login funnel onto this page -- see
            GuestProfileNudge's own docstring for the full eligibility
            gating. Self-gating (returns null when not eligible/already
            handled), so always rendered unconditionally here, same as
            the team-join card below. */}
        <GuestProfileNudge session={session} />

        {/* Real "Guest Teams" feature (app.domains.guest_teams) -- an
            admin-created shared-code group a guest can optionally join
            once already connected (see src/routes/portal.team.tsx's own
            docstring for the full "additional step, not a login method or
            a RADIUS bypass" reasoning). Always offered, not gated by any
            captive-portal-config flag: a guest with no code just ignores
            this card, and one with a wrong/unrelated code gets a real,
            honest 404 from the join call itself. */}
        <Link to="/portal/team" search={portalSearch} className={NUDGE_ROW_CLASS}>
          <div className={NUDGE_CHIP_CLASS}>
            <Users2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="pg-body font-semibold text-[var(--pg-ink)]">{t("nudgeTeamTitle")}</p>
            <p className="truncate pg-meta font-normal text-[var(--pg-ink-muted)]">
              {t("nudgeTeamSubtitle")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--pg-ink-faint)]" />
        </Link>

        {continueUrl && (
          <button
            type="button"
            onClick={() => navigate({ to: "/portal/redirect", search: (prev) => prev })}
            className={PG_PRIMARY_BTN}
          >
            {t("continue")}
          </button>
        )}

        <AlertBanner message={disconnectError} />

        {/* PG_SECONDARY_BTN with a destructive hover -- cn() so
         * tailwind-merge resolves the hover:border/bg/text overrides
         * against the recipe's own instead of leaving stylesheet order to
         * pick a winner. */}
        <button
          type="button"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
          className={cn(
            PG_SECONDARY_BTN,
            "flex items-center justify-center gap-2 hover:border-[var(--pg-danger-border,#FECACA)] hover:bg-[var(--pg-danger-bg,#FEF2F2)] hover:text-[var(--pg-danger,#DC2626)]",
          )}
        >
          <LogOut className="h-4 w-4" />{" "}
          {disconnect.isPending ? t("disconnectingLabel") : t("logout")}
        </button>
      </div>
    </PortalShell>
  );
}
