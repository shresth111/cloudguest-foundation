import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { RefreshCw, Wifi } from "lucide-react";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { PortalShell, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PortalConnectingState } from "@/components/portal-runtime/PortalGuestUi";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { buildSessionUrl } from "@/lib/portal-session-url";

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
    setGuestIdentifier,
    organizationId,
    locationId,
    hotspotLoginUrl,
    // Same reason as portal.success.tsx: the branch below is a real document
    // navigation, so the language has to travel in the URL.
    language,
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
    if (!liveSession) return;
    setSession(liveSession);
    // Real incident #5: this used to only call setSession, never
    // setGuestIdentifier. portal.success.tsx's hotspot-login POST is
    // gated on `!guestIdentifier` right alongside `!session` and
    // `!hotspotLoginUrl` -- a device found here via the live-session
    // check (a fresh tab, a re-scanned QR code, or -- confirmed live --
    // any WiFi reconnect that lands in a *new* browser/webview context
    // without the previous one's sessionStorage, which is exactly what
    // iOS/macOS's Captive Network Assistant does on every reconnect) had
    // `session` set but `guestIdentifier` permanently undefined, so
    // portal.index.tsx's own #45 fix correctly routed it to
    // /portal/success, but that page's gate silently no-op'd forever --
    // a guest stuck on a spinner with zero evidence the router ever saw
    // a login attempt, because the POST was never actually attempted.
    setGuestIdentifier(liveSession.identifier);
  }, [liveSession, setSession, setGuestIdentifier]);

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
    queryClient.invalidateQueries({
      queryKey: ["portal-runtime-config", organizationId, locationId],
    });
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
    // Real incident #4: an existing app-level session says nothing about
    // whether the NAS's own hotspot gate is *currently* open -- RouterOS
    // ties that state to the live pre-auth network attachment, which does
    // NOT survive a real Wi-Fi disconnect/reconnect (a new DHCP lease means
    // a brand-new, unauthenticated hotspot session on the router), even
    // though this platform's own backend session is deliberately
    // long-lived (hours). Confirmed live: a guest whose Wi-Fi blipped even
    // briefly landed straight on "you're connected" here -- this route's
    // whole point being to never bounce an existing session back through
    // sign-in -- while genuinely having zero real internet, because the
    // one thing that actually reopens the NAS's gate (`/portal/success`'s
    // hotspot-login POST) was skipped entirely. A `hotspotLoginUrl` being
    // present here means the guest arrived via a *fresh* NAS redirect this
    // time (RouterOS reissues one for any currently-unauthenticated
    // client) -- routing through `/portal/success` first re-fires that
    // POST (a genuine no-op if the gate's already open) before landing on
    // this same `/portal/session` destination via its own `dst` handling.
    // No `hotspotLoginUrl` at all means there is no fresh NAS redirect to
    // act on -- but that is emphatically NOT the same as "the gate is
    // open", and the old code here treated it as if it were: it did a
    // client-side `navigate({ to: "/portal/session" })`, which repaints
    // "You're online" without a single byte crossing the network. On the
    // strength of an app-level session alone, for exactly the reason
    // incident #4 above documents. (Until now that path was masked on iOS
    // by the storage throws this same change fixes -- the guest never got
    // this far. Fixing the storage bugs unmasks it, so it has to be fixed
    // in the same pass.)
    //
    // A *document load* to the same URL is the one thing that actually
    // asks the network who is right. Gate open: it just loads
    // `/portal/session`, no visible difference. Gate shut: the NAS
    // intercepts the request and redirects to a fresh portal URL carrying
    // a new `link-login-only`, which lands back here with `hotspotLoginUrl`
    // present and routes through `/portal/success`, whose POST reopens the
    // gate. Self-healing, and it never claims "connected" on evidence it
    // does not have.
    //
    // Chosen over "route through /portal/success unconditionally" because
    // that page's `attemptSubmit` is itself gated on `hotspotLoginUrl`:
    // with none to submit it has nothing to do, and would strand this
    // guest on the "Just a moment" spinner until the 15s escape hatch
    // appeared -- a worse outcome than today for the genuinely-connected
    // case, and it still would not have opened any gate.
    if (hasSession && !hotspotLoginUrl) {
      window.location.assign(buildSessionUrl(organizationId, locationId, routerId, language));
      return;
    }

    const target = hasSession
      ? "/portal/success"
      : config.isOpenNow === false
        ? "/portal/closed"
        : "/portal/welcome";
    navigate({ to: target, replace: true, search: (prev) => prev });
  }, [
    isLoading,
    config,
    session,
    deviceMac,
    liveSession,
    liveSessionChecked,
    hotspotLoginUrl,
    navigate,
    // Read by `buildSessionUrl` on the document-load branch above. Stable
    // for the life of this portal link (they come straight off the URL's
    // search params), so listing them changes nothing at runtime -- it
    // just keeps the dependency list honest.
    organizationId,
    locationId,
    routerId,
    language,
  ]);

  if (!isLoading && error) {
    // A real response (404/400/etc) means the server looked this location
    // up and genuinely found no active config -- a real setup problem, not
    // something a retry fixes. No response at all (timeout, DNS hiccup,
    // dropped connection) is exactly the "fresh guest device on a flaky
    // pre-auth path" case this whole retry flow exists for -- most of these
    // resolve themselves on a second try a few seconds later.
    const isConfigMissing = isAxiosError(error) && !!error.response;
    return (
      <PortalShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          {isConfigMissing ? (
            // captive-portal-v7-design-spec.md §1.1 (L1). This route has
            // no <h1> at all, so the spec's route list describes it only as
            // "unbacked subtitle lines" -- accurate: both of this file's
            // rendered states put plain <p> copy straight onto the venue
            // photo, in the scrim's fully-transparent 24-78% band. Each of
            // those text blocks -- and only the text blocks -- goes on a
            // `PortalTextPlate`. The `space-y-3` box around it is this
            // route's own layout and stays: with no photo the plate renders
            // its children bare, and these two <p> would otherwise inherit
            // the column's `gap-3` instead of their own rhythm.
            <div className="space-y-3">
              <PortalTextPlate className="space-y-3">
                <p className="pg-subtitle text-[var(--pg-ink)]">
                  This venue's guest WiFi isn't set up yet
                </p>
                <p className="max-w-sm text-sm text-[var(--pg-ink-muted)]">
                  No active sign-in configuration was found for this location. Please ask venue
                  staff for assistance.
                </p>
              </PortalTextPlate>
            </div>
          ) : (
            <>
              {/* The retry button below keeps its own opaque `bg-indigo-50`
               * fill and stays outside the plate -- it is already a bounded
               * surface of its own, and pulling it inside would change this
               * screen's `gap-3` rhythm for no legibility gain. */}
              <div className="space-y-3">
                <PortalTextPlate className="space-y-3">
                  <p className="pg-subtitle text-[var(--pg-ink)]">Having trouble connecting</p>
                  <p className="max-w-sm pg-meta font-normal text-[var(--pg-ink-muted)]">
                    This can happen right after joining the WiFi. Check your connection and try
                    again.
                  </p>
                </PortalTextPlate>
              </div>
              <button
                type="button"
                onClick={retry}
                className="mt-2 flex min-h-6 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] px-5 py-2.5 pg-meta font-medium text-[var(--pr-primary,#6366f1)] hover:bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_14%,var(--pg-surface,#fff))]"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </>
          )}
        </div>
      </PortalShell>
    );
  }

  // Real incident, live captive-portal "flick flick" flash: a persisted
  // `session` (rehydrated from sessionStorage, known synchronously from this
  // component's very first render -- see PortalRuntimeContext) means this
  // exact device is already authenticated, and the routing effect above is
  // guaranteed to navigate it on to /portal/success or /portal/session (the
  // `hasSession` branch, never welcome/closed) the instant config/liveSession
  // resolve. A device in that state is never a genuine first-time guest --
  // it's either a normal one-time pass-through, or one of the OS-triggered
  // remount bounces this whole page and portal.success.tsx can get caught in
  // (see PortalRuntimeContext's `loadPersistedHotspotSubmit` docstring).
  // Rendering the exact same steady "Connecting…" visual portal.success.tsx
  // shows -- instead of this page's own branded logo fade-in + pulsing dots
  // -- means a guest bouncing between the two sees one unchanging frame
  // throughout, not two visually distinct screens flashing back and forth.
  //
  // Gated on `!showSlowNotice`: the real, confirmed-live bounce cycle
  // resolves in ~600ms, well under that 3s threshold, so the common case
  // never reaches it. A genuine stall past 3s falls back to the original
  // branded screen with its own "Taking a while -- retry" button instead --
  // an already-authenticated guest stuck on a real stalled connection still
  // needs that escape hatch, not an endless silent spinner.
  if (session && !showSlowNotice) {
    // `showBrandPanel={false}` -- see PortalShell's own doc comment. Set
    // identically on portal.success.tsx's own PortalConnectingState
    // render (never just one of the two): v4 §5's non-negotiable #3
    // requires these to stay the pixel-identical connecting visual, and a
    // BrandPanel next to one but not the other is exactly the kind of
    // divergence that invariant exists to prevent.
    return (
      <PortalShell showBrandPanel={false}>
        <PortalConnectingState />
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      {/* v3 polish pass: this screen's logo/icon used to run its own
       * `framer-motion` scale+fade entrance on top of PortalShell's own
       * CSS-only `pg-enter` fade+rise on the <main> this whole block
       * already sits inside -- the same entrance animated twice via two
       * different mechanisms. `/portal/` is the very first route nearly
       * every real guest device loads (see the routing effect above), so
       * it was also the single most guest-visible instance of pulling
       * `framer-motion` into a portal.* route chunk, exactly the
       * regression this surface's earlier framer-motion removal
       * (styles.css lines 563-570) already fixed elsewhere. `pg-enter`
       * alone already covers the entrance; the three status dots below
       * now pulse via the CSS-only `pg-pulse-dot` utility instead of a
       * per-dot `animate={{opacity:[...]}}` loop. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {config?.logoUrl ? (
          <img
            src={config.logoUrl}
            alt={config.name}
            // Height-constrained, width free -- see GuestSignInCard.tsx's
            // full note. A fixed `w-24` box rendered a 5:1 venue lockup at
            // 96 x 19 CSS px; this is the same one-class fix at the same
            // defect, and it is here rather than only on the sign-in card
            // because a guest sees this screen first.
            className="h-24 w-auto max-w-[280px] object-contain drop-shadow-lg sm:h-32 sm:max-w-[320px] md:h-36 md:max-w-[360px]"
          />
        ) : (
          // Flat single-color fill in the venue's own --pr-primary, not a
          // --pr-primary/--pr-accent gradient -- same reasoning as
          // PG_PRIMARY_BTN (PortalGuestUi.tsx): a gradient across two
          // independently-configured brand colors can go muddy or
          // low-contrast for a venue that never picked them to work
          // together as a gradient. Shadow pulled back from the previous
          // shadow-xl/25 glow to the same small, tight shadow the rest of
          // this flat card system already uses.
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--pr-primary,#6366f1)] text-[color:var(--pr-primary-foreground,#ffffff)] shadow-[0_2px_8px_-2px_rgba(30,27,75,0.18)] sm:h-28 sm:w-28 md:h-32 md:w-32">
            <Wifi className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12" />
          </div>
        )}
        {/* The venue logo above stays on bare photo deliberately: it is a
         * graphic asset with its own `drop-shadow-lg`, rendered at 96-144px,
         * not text -- L1 is a text-contrast defect, and boxing a hero-scale
         * logo would change this screen's character rather than fix a
         * contrast failure. The two text lines are what L1 is about, and
         * they are what gets the plate. */}
        <div>
          <PortalTextPlate>
            <p className="pg-body font-semibold text-[var(--pg-ink)]">
              {config?.name ?? "Wyfy Guest"}
            </p>
            <p className="mt-1 pg-meta font-normal text-[var(--pg-ink-muted)]">
              {showSlowNotice ? "Still connecting..." : t("loading")}
            </p>
          </PortalTextPlate>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="pg-pulse-dot h-2 w-2 rounded-full bg-[var(--pr-primary,#6366f1)]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        {showSlowNotice && (
          <button
            type="button"
            onClick={retry}
            className="pg-enter flex min-h-6 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] px-4 py-2 pg-meta font-medium text-[var(--pr-primary,#6366f1)] hover:bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_14%,var(--pg-surface,#fff))]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Taking a while -- retry
          </button>
        )}
      </div>
    </PortalShell>
  );
}
