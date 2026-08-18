import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { PortalConnectingState } from "@/components/portal-runtime/PortalGuestUi";
import {
  usePortalRuntime,
  loadPersistedHotspotSubmit,
  persistHotspotSubmit,
} from "@/context/PortalRuntimeContext";

// v4 §6.1: the same "taking longer than expected" threshold
// portal.index.tsx's own loading screen already uses, for the identical
// reason -- well past the confirmed-live OS-remount-bounce window
// (~600ms for 3 cycles), so the common case (this POST resolving quickly)
// never reaches it, but a genuinely slow/unreachable NAS surfaces an
// actionable notice instead of an indefinite spinner.
const SLOW_NOTICE_DELAY_MS = 4_000;
// A longer bound past which this reads as more than "just slow" -- offers
// a real way back to sign-in rather than leaving a stuck guest with only
// a retry button that's already been sitting there for 11 more seconds.
const ESCAPE_HATCH_DELAY_MS = 15_000;

export const Route = createFileRoute("/portal/success")({
  component: SuccessPage,
});

// See PortalRuntimeContext's `loadPersistedHotspotSubmit` docstring for the
// full "why" -- covers the OS-triggered remount-bounce window (confirmed
// live at ~600ms for 3 cycles) with margin, while staying far short of any
// real WiFi-reconnect timescale that genuinely needs this POST to re-fire.
const HOTSPOT_RESUBMIT_COOLDOWN_MS = 10_000;

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

/** Builds the real `/portal/session` URL -- same organizationId/
 * locationId/routerId this exact guest's portal link always carries (see
 * src/routes/portal.tsx's own search schema) -- for RouterOS's `dst`
 * field to land the guest's browser on once its own hotspot-login
 * processing finishes. `dst` used to point back at this very success
 * page (see `submitHotspotLogin`'s own docstring below); that produced a
 * redundant second "you're connected" screen with its own full copy of
 * the connected-status UI, duplicating `/portal/session` (the real,
 * already-redesigned "you're connected" resting page) -- exactly the
 * extra unwanted page type the founder kept landing on. Landing the
 * guest on `/portal/session` directly instead means this page is now
 * only ever visible for the brief moment between OTP/password/voucher
 * verification and this exact POST actually firing -- a few hundred ms
 * at most, not a second full page the guest has to sit through. */
function buildSessionUrl(organizationId: string, locationId: string, routerId: string): string {
  const url = new URL("/portal/session", window.location.origin);
  url.searchParams.set("organizationId", organizationId);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("routerId", routerId);
  return url.toString();
}

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
 * send the browser after a successful hotspot login" field) points at
 * the real `/portal/session` URL (see `buildSessionUrl` above), so once
 * the NAS's gate opens the guest lands directly on the real, resting
 * "you're connected" page -- that page's own state (session, countdown,
 * etc.) survives the round trip via PortalRuntimeContext's persisted
 * session, not a page-memory value that a real navigation would drop. */
function submitHotspotLogin(loginUrl: string, username: string, dst: string) {
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
  addField("dst", dst);
  document.body.appendChild(form);
  form.submit();
}

/**
 * The brief transitional "connecting" step between a real login
 * (OTP/password/voucher -- reached via GuestSignInCard's `afterLogin` or
 * one of the legacy per-method fallbacks) and the real NAS hotspot gate
 * actually opening. Deliberately NOT a second "you're connected" screen:
 * this used to duplicate `/portal/session`'s full connected-status UI
 * (countdown timer, data-usage card, device card, disconnect button,
 * set-password/team-code nudges, campaign overlay) -- exactly the extra,
 * redundant page type the founder kept landing on instead of the "login
 * page, then session page, that's it" flow they asked for. All of that
 * real functionality now lives on `/portal/session`, the one real
 * resting page this POST is actually navigating the guest towards (via
 * `dst`, see `buildSessionUrl`) -- this page's own job is now only to
 * fire the real hotspot-login POST and show an honest "connecting"
 * state while that's in flight.
 *
 * v4 §6.1 (highest priority in the whole brief): this used to render
 * `PortalConnectingState` with zero timeout, zero retry, zero escape
 * hatch -- if the POST target (a flaky in-venue LAN segment, RouterOS
 * momentarily busy) is slow or unreachable, the guest was stuck on "Just
 * a moment" indefinitely, with no way back. `portal.index.tsx`'s own
 * loading screen already learned this exact lesson (a 3s "still
 * connecting" notice + manual retry); this page now gets the same
 * pattern, plus a longer-bound escape hatch back to sign-in since a real
 * top-level form POST can't be "cancelled and retried" the way a query
 * can -- the retry action re-runs the same `submitHotspotLogin` call
 * instead (safe: RADIUS authorize is a no-op for an already-authorized
 * session, see that function's own docstring).
 */
function SuccessPage() {
  const { session, organizationId, locationId, routerId, hotspotLoginUrl, guestIdentifier, t } =
    usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/success" });
  const portalSearch = { organizationId, locationId, routerId };
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  const [showEscapeHatch, setShowEscapeHatch] = useState(false);
  // Bumped by `retry()` purely to re-run the timeout-timer effect below
  // (a fresh attempt deserves its own fresh 4s/15s clock) -- the actual
  // submit-retry logic lives in `attemptSubmit`, not here.
  const [attempt, setAttempt] = useState(0);

  // Our own login (OTP/password/voucher) only just created a session in
  // this platform's own database -- the NAS's own gate is a completely
  // separate thing and stays shut until it sees this POST (confirmed live:
  // a guest could "log in" here and still have zero real internet access).
  // Guarded to fire at most once per real attempt, not on every re-render
  // -- `retry()` below explicitly clears this to allow a second real one.
  const hotspotLoginSubmitted = useRef(false);

  function attemptSubmit() {
    // No guestIdentifier means there's no real phone/email this platform
    // ever verified for this browsing session (e.g. a page reload that
    // lost it) -- submitting anything else is guaranteed to be rejected
    // by RadiusService.authorize's username-to-session lookup, so this
    // skips rather than firing a doomed request. This is itself one of
    // the real reasons a guest can land here and never leave without the
    // timeout/retry below: there is nothing in flight at all to wait for.
    if (!session || !hotspotLoginUrl || !guestIdentifier || hotspotLoginSubmitted.current) return;
    hotspotLoginSubmitted.current = true;

    // Real incident, live captive-portal "flick flick" flash: a remount
    // landing back here within HOTSPOT_RESUBMIT_COOLDOWN_MS of this exact
    // identifier's last real submit (see PortalRuntimeContext's
    // `loadPersistedHotspotSubmit` docstring) is treated as one of the
    // OS-triggered bounces, not a genuine new attempt -- skip the redundant
    // top-level POST (itself a full navigation away and back, the actual
    // visible flash) and go straight to the real resting page instead,
    // exactly where the previous attempt's own `dst` was already taking
    // this guest.
    const lastSubmit = loadPersistedHotspotSubmit();
    const recentlySubmitted =
      !!lastSubmit &&
      lastSubmit.identifier === guestIdentifier &&
      Date.now() - lastSubmit.at < HOTSPOT_RESUBMIT_COOLDOWN_MS;
    if (recentlySubmitted) {
      navigate({ to: "/portal/session", replace: true, search: (prev) => prev });
      return;
    }

    persistHotspotSubmit({ identifier: guestIdentifier, at: Date.now() });
    submitHotspotLogin(
      hotspotLoginUrl,
      guestIdentifier,
      buildSessionUrl(organizationId, locationId, routerId),
    );
  }

  useEffect(() => {
    attemptSubmit();
    // Real dependencies only -- `attemptSubmit` itself is intentionally
    // excluded (it's redefined every render but reads current props via
    // closure, same pattern the rest of this hook already relied on
    // before this refactor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hotspotLoginUrl, guestIdentifier, organizationId, locationId, routerId, navigate]);

  useEffect(() => {
    if (!session) navigate({ to: "/portal/expired", replace: true, search: (prev) => prev });
  }, [session, navigate]);

  // See this component's own docstring (§6.1) -- a fresh pair of timers
  // per `attempt`, so tapping retry gives the guest a full fresh window
  // rather than the escape hatch appearing instantly because the old
  // timers were still running.
  useEffect(() => {
    setShowSlowNotice(false);
    setShowEscapeHatch(false);
    const slow = window.setTimeout(() => setShowSlowNotice(true), SLOW_NOTICE_DELAY_MS);
    const escape = window.setTimeout(() => setShowEscapeHatch(true), ESCAPE_HATCH_DELAY_MS);
    return () => {
      window.clearTimeout(slow);
      window.clearTimeout(escape);
    };
  }, [attempt]);

  function retry() {
    hotspotLoginSubmitted.current = false;
    setAttempt((a) => a + 1);
    attemptSubmit();
  }

  if (!session) return null;

  // `showBrandPanel={false}`: BrandPanel's copy ("Verify your device on
  // the right...") is sign-in-oriented, wrong context once there's
  // nothing left to verify -- see PortalShell's own doc comment on this
  // prop. Set identically on portal.index.tsx's own PortalConnectingState
  // render (never just one of the two): v4 §5's non-negotiable #3
  // requires these to stay the pixel-identical connecting visual for the
  // real, confirmed-live OS-remount-bounce window (well under
  // SLOW_NOTICE_DELAY_MS) -- everything below only ever appears well
  // past that window, once this is unambiguously a genuine stall on this
  // specific page rather than a bounce between the two.
  return (
    <PortalShell showBrandPanel={false}>
      <PortalConnectingState />
      {showSlowNotice && (
        <div className="pg-enter mt-5 flex flex-col items-center gap-3 text-center">
          <p className="pg-meta text-[var(--pg-ink-muted)]">
            {showEscapeHatch ? t("successStuckNotice") : t("successSlowNotice")}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {t("retry")}
            </button>
            {showEscapeHatch && (
              <Link
                to="/portal/welcome"
                search={portalSearch}
                className="text-xs font-medium text-[var(--pg-ink-muted)] hover:text-indigo-600 hover:underline"
              >
                {t("signInAgainLink")}
              </Link>
            )}
          </div>
        </div>
      )}
    </PortalShell>
  );
}
