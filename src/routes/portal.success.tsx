import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { PortalConnectingState } from "@/components/portal-runtime/PortalGuestUi";
import {
  usePortalRuntime,
  loadPersistedHotspotSubmit,
  persistHotspotSubmit,
} from "@/context/PortalRuntimeContext";

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
 */
function SuccessPage() {
  const { session, organizationId, locationId, routerId, hotspotLoginUrl, guestIdentifier } =
    usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/success" });

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
  }, [session, hotspotLoginUrl, guestIdentifier, organizationId, locationId, routerId, navigate]);

  useEffect(() => {
    if (!session) navigate({ to: "/portal/expired", replace: true, search: (prev) => prev });
  }, [session, navigate]);

  if (!session) return null;

  return (
    <PortalShell variant="light" showHeader={false}>
      <PortalConnectingState />
    </PortalShell>
  );
}
