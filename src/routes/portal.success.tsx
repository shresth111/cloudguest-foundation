import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalShell, GUEST_LEGIBILITY_CARD_CLASS } from "@/components/portal-runtime/PortalShell";
import { PortalConnectingState } from "@/components/portal-runtime/PortalGuestUi";
import {
  usePortalRuntime,
  loadPersistedHotspotSubmit,
  persistHotspotSubmit,
} from "@/context/PortalRuntimeContext";
import { buildSessionUrl } from "@/lib/portal-session-url";
import { nasAuthorizedFromSearch } from "@/lib/portal-nas-state";
import { PORTAL_SLOW_NOTICE_DELAY_MS } from "@/lib/portal-post-connect";
import { usePortalLinkSearch } from "@/components/portal-runtime/usePortalLinkSearch";
import { isCaptiveNetworkAssistant } from "@/lib/portal-cna";
import { resolvePostLoginDestination } from "@/lib/portal-post-login";
import { buildPortalAuthorizeBody, normalizeOmadaText } from "@/lib/portal-authorize-body";
import { buildOmadaRadiusSubmission, submitOmadaRadiusLogin } from "@/lib/portal-radius-submit";
import { guestPortalIntegrationService } from "@/services/network-integration.service";

// v4 §6.1: the same "taking longer than expected" threshold
// portal.index.tsx's own loading screen already uses, for the identical
// reason -- well past the confirmed-live OS-remount-bounce window
// (~600ms for 3 cycles), so the common case (this POST resolving quickly)
// never reaches it, but a genuinely slow/unreachable NAS surfaces an
// actionable notice instead of an indefinite spinner.
// Shared, not re-picked here: the post-connect profile card shows the same
// "still working, your internet is fine" reassurance at the same moment,
// and two screens that can show a guest one should agree about when.
const SLOW_NOTICE_DELAY_MS = PORTAL_SLOW_NOTICE_DELAY_MS;
// A longer bound past which this reads as more than "just slow" -- offers
// a real way back to sign-in rather than leaving a stuck guest with only
// a retry button that's already been sitting there for 11 more seconds.
const ESCAPE_HATCH_DELAY_MS = 15_000;

export const Route = createFileRoute("/portal/success")({
  errorComponent: PortalErrorScreen,
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

// The storage-probe that tells the CNA websheet from ordinary Safari --
// see @/lib/portal-cna. (It used to be defined here together with the
// Apple captive-success URL; portal.session.tsx needs the same probe so it
// never auto-redirects inside the websheet, hence the move. The Apple URL
// itself no longer appears anywhere on this page: see the `dst` comment
// below.)

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
 * the real `/portal/session` URL (see `buildSessionUrl` in
 * src/lib/portal-session-url.ts), so once
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
 * `dst`, see `@/lib/portal-session-url`) -- this page's own job is now
 * only to
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
  const {
    config,
    session,
    organizationId,
    locationId,
    routerId,
    hotspotLoginUrl,
    guestIdentifier,
    // Carried into `dst` so the guest's chosen language survives the
    // full-document POST below -- see `buildSessionUrl`'s own note on why a
    // URL parameter is the only channel that works on iOS's CNA.
    language,
    // Carried into `dst` for the same reason as `language`: it is the one
    // identifier `/portal/session` can use to re-find this guest's session
    // when it lands as a new document on a browser whose storage throws.
    deviceMac,
    // The guest's original pre-hotspot destination (RouterOS's `$(link-orig)`
    // on this portal's own URL) -- the "send them back where they were
    // going" half of the redirect-mode decision in @/lib/portal-post-login.
    destinationUrl,
    // WHICH GATE THIS PAGE HAS TO OPEN. `"omada"` when the venue's own
    // External Portal Server URL said so, undefined at every MikroTik
    // venue. Read, never inferred -- see `PortalRuntimeState.netProvider`.
    netProvider,
    // WHICH OF OMADA'S TWO GATES. `"radius"` when the venue is on
    // `authType 2` + External Web Portal, where this platform is not in
    // the authorization path at all. Read, never inferred -- see
    // `PortalRuntimeState.portalMode`.
    portalMode,
    // What the Omada controller told us about this association, carried
    // from its redirect. Only the controller could have known any of it.
    omadaRedirect,
    clientIp,
    t,
  } = usePortalRuntime();
  // The controller's own landing page (doc 132060's `LANDING_PAGE`), fed
  // through the SAME decision RouterOS's `dst` goes through rather than
  // used raw. That is not treating the two as the same fact -- they answer
  // different questions and come from different vendors -- it is reusing
  // the two guards that apply to any post-login navigation sink whatever
  // produced it: `isSafeRedirectTarget` (an admin- or NAS-supplied
  // `javascript:` URL runs script in this origin) and `isCaptiveProbeUrl`
  // (iOS's own captive probe must never become a guest's destination, or a
  // freshly-connected iPhone lands on Apple's one-word "Success" page --
  // the founder's own QA report). A venue is behind one vendor or the
  // other, so exactly one of these two is ever defined.
  const omadaLandingUrl = normalizeOmadaText(omadaRedirect?.redirectUrl) ?? undefined;
  // Single post-login destination decision -- see @/lib/portal-post-login.
  // This page applies it to the NAS `dst`; /portal/session applies it to
  // rendering. html -> session page (it renders the venue's page); redirect
  // -> the URL itself (no intermediate portal page); default -> session
  // page (unchanged).
  const destination = resolvePostLoginDestination(config, destinationUrl ?? omadaLandingUrl);
  const sessionTarget = () =>
    buildSessionUrl(organizationId, locationId, routerId, language, deviceMac);
  // The destination for the two assign branches that don't build a NAS
  // POST (already-authorized, and no login URL at all): a redirect-mode
  // venue's guest goes STRAIGHT to the URL on a real document load (the
  // single-page rule), anyone else goes to /portal/session -- which then
  // renders html-mode pages or the default connected page. The CNA check
  // is the same storage probe the POST branch below uses: inside the
  // websheet an arbitrary assign is meaningless, so the session page is
  // the honest resting place there too -- this page never points any
  // client at captive.apple.com (see the `dst` comment on the POST
  // branch).
  const directTarget = () =>
    !isCaptiveNetworkAssistant() && destination.mode === "redirect" && destination.url
      ? destination.url
      : sessionTarget();
  // captive-portal-v7-design-spec.md §1.1 (L1). This route is NOT in the
  // spec's own L1 route list, and that list is wrong: the slow/stuck
  // notice below renders past SLOW_NOTICE_DELAY_MS as plain text directly
  // on the venue photo, outside `PortalConnectingState`'s card and in the
  // scrim's fully-transparent 24-78% band -- the identical defect, on the
  // one screen a guest only ever sees when something has already gone
  // wrong. Same bounded plate as the other portal.* routes; the retry
  // control beside it already carries its own opaque `bg-indigo-50` fill.
  const hasPhoto = !!config?.backgroundImageUrl;
  const navigate = useNavigate({ from: "/portal/success" });
  const portalSearch = usePortalLinkSearch();
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

  /**
   * THE OMADA GATE. The counterpart of `submitHotspotLogin` below, and the
   * step that was missing entirely.
   *
   * At a MikroTik venue this page opens the gate with a full-document form
   * POST to RouterOS's own `link-login-only` URL. An Omada controller has
   * no such URL and no equivalent a browser may call: the credentials that
   * authorize a client belong to a Hotspot Operator account on the
   * controller, and a guest's browser must never hold them. So the request
   * goes to our own backend, which holds the venue's credentials and talks
   * to the controller server-side.
   *
   * `POST /network-integrations/portal/authorize` has existed, tested and
   * correct, since the integration was built -- with no caller anywhere in
   * this repo. This is it.
   *
   * ## What it sends, and what it refuses to invent
   *
   * Every controller-supplied value travels exactly as the controller
   * spelled it, through `buildPortalAuthorizeBody` -- the single module
   * that knows each field's wire name and type. Nothing here defaults,
   * coerces or substitutes: `ssidName` is not the integration's configured
   * SSID, `site` is not our stored site, `t` is not `Date.now()`, and an
   * absent parameter stays absent all the way to the wire. A value we
   * invented that happened to be plausible is the worse of the two
   * failures, because the controller would accept it.
   *
   * ## Why `authorized: false` is not an error, and not a success either
   *
   * The call reaching the controller and the controller saying no are
   * different outcomes from the call failing -- and neither of them is
   * "you're connected". This page has already been through the version of
   * this mistake where it claimed success on evidence it did not have (see
   * `nasAuthorizedFromSearch` below, and the founder's QA report behind
   * it). Both failure shapes land on the same honest state: the guest is
   * NOT navigated anywhere, the submit guard is released so the retry
   * button below can genuinely retry, and the existing slow/stuck notice
   * is what they see.
   */
  async function authorizeOnController() {
    if (!session) return;
    const body = buildPortalAuthorizeBody(
      {
        session_id: session.sessionId,
        // The venue this guest is standing in, off the portal's own
        // runtime -- NOT read back off the session. The backend compares
        // the two and refuses a mismatch, and that comparison is only worth
        // something if these are the ids the portal actually believes in;
        // echoing the session's own values back at it would compare a value
        // to itself. (They agree by construction: the login call that
        // created this session was made with these same three.)
        organization_id: organizationId,
        location_id: locationId,
        provider: "omada",
      },
      omadaRedirect ?? {},
      clientIp,
    );

    try {
      const result = await guestPortalIntegrationService.authorizePortal(body);
      if (!result.authorized) {
        // The controller declined. Say nothing that is not true: no
        // navigation, no "connected" claim, and the retry below is real.
        hotspotLoginSubmitted.current = false;
        return;
      }
      // A real document load, for the same reason every other branch on
      // this page uses one: it is the only thing that actually asks the
      // network. If the controller's authorization somehow has not taken
      // effect, this request is intercepted and the guest comes back
      // through the portal rather than sitting on a page that asserts
      // success from memory.
      window.location.assign(directTarget());
    } catch {
      // Reached nothing, or the backend refused. Every refusal there is
      // one indistinguishable 403, so there is nothing to tell the guest
      // apart -- and nothing to do but let them retry.
      hotspotLoginSubmitted.current = false;
    }
  }

  /**
   * THE OMADA RADIUS GATE (`authType 2`), and it is the MikroTik shape,
   * not the Omada one.
   *
   * On this contract our backend is never called: the guest's browser
   * submits to the venue's controller, the controller sends a RADIUS
   * Access-Request to this platform's FreeRADIUS, and the controller opens
   * the gate on the Access-Accept. So the mechanism here is the same
   * top-level HTML form POST `submitHotspotLogin` uses for RouterOS --
   * a different URL and different field names, the same navigation, for
   * the same reason (an embedded `fetch` hangs iOS's Captive Network
   * Assistant forever, and the controller's XHR endpoint cannot be read
   * cross-origin anyway). The contract itself lives in
   * `@/lib/portal-radius-submit`.
   *
   * ## The identifier is load-bearing here, unlike the other Omada branch
   *
   * `authorizeOnController` above is keyed on the SESSION ID, so a guest
   * whose identifier was lost to a reload can still be authorized. This
   * path cannot: `username` is what our FreeRADIUS looks an ACTIVE
   * `GuestSession` up by (`RadiusService.authorize` is a session lookup,
   * not a password check). Without it there is nothing to submit, so this
   * releases the guard and leaves the guest on the retry screen rather
   * than posting a credential that is certain to be rejected -- and a
   * rejection here is not a styled error, it is a raw JSON blob rendered
   * by the browser (see the module docstring).
   *
   * ## A refusal is a configuration disagreement, and it is not guessed past
   *
   * The venue's stored mode says RADIUS; the redirect says where to
   * submit. If the redirect carries no `target`/`targetPort`/`scheme`,
   * the controller is still configured for the other contract -- or this
   * is a portal URL captured before the venue moved. Only the controller
   * ever knew its own address, so there is nothing to fall back to, and
   * inventing one would post this guest's identifier to whatever we
   * guessed.
   */
  function submitRadiusLogin() {
    if (!guestIdentifier) {
      hotspotLoginSubmitted.current = false;
      return;
    }
    const submission = buildOmadaRadiusSubmission(omadaRedirect ?? {}, {
      identifier: guestIdentifier,
      // The same placeholder the RouterOS branch sends, and for the same
      // reason: no RADIUS path in this product checks it. FreeRADIUS sets
      // `control:Auth-Type` from our own backend's session lookup before
      // `pap`/`chap` ever run, so the credential in the packet is never
      // verified -- in PAP or CHAP mode alike.
      password: HOTSPOT_FALLBACK_PASSWORD,
      // `originUrl` is this contract's `dst`: where the controller sends
      // the browser on its 302 after the Access-Accept. Same decision as
      // every other post-login navigation on this page.
      landingUrl: directTarget(),
    });
    if ("refused" in submission) {
      // Nothing is in flight, so the existing slow/stuck notice and the
      // retry control are the honest state. No navigation, and above all
      // no claim of success.
      hotspotLoginSubmitted.current = false;
      return;
    }
    submitOmadaRadiusLogin(submission);
    persistHotspotSubmit({ identifier: guestIdentifier, at: Date.now() });
  }

  function attemptSubmit() {
    if (!session || hotspotLoginSubmitted.current) return;

    // THE OMADA BRANCH, AND IT IS FIRST.
    //
    // Deliberately above all three RouterOS guards below, because every one
    // of them would swallow an Omada guest:
    //
    //   * `nasAuthorizedFromSearch` reads `hspage`, which only a RouterOS
    //     override page ever stamps -- absent here, and `undefined` must
    //     never be read as an answer;
    //   * the `!guestIdentifier` return exists because RADIUS Authorize
    //     looks a guest up by that exact string. The Omada call is keyed on
    //     the SESSION ID, so a guest whose identifier was lost to a reload
    //     can still be authorized -- returning early would strand them on
    //     the spinner with nothing in flight;
    //   * the `!hotspotLoginUrl` branch sends the guest to the connected
    //     page on the assumption that there is no gate to open. At an Omada
    //     venue there is never a `link-login-only`, and there IS a gate --
    //     so that branch would take every single Omada guest to a page
    //     telling them they are online, before anything had let them on.
    //
    // Mutually exclusive with the RouterOS path, not layered on top of it:
    // a venue is behind one vendor or the other.
    if (netProvider === "omada") {
      hotspotLoginSubmitted.current = true;
      // WHICH OMADA CONTRACT, FROM THE STORED ANSWER. `portalMode` comes
      // off the URL the venue's operator pasted, which the backend built
      // from `network_integrations.portal_mode` -- the one place that
      // knows. It is not sniffed from the redirect's parameters here, and
      // the two branches are mutually exclusive: on `authType 2` our
      // backend is not in the authorization path at all, so calling
      // `authorizeOnController` for a RADIUS venue would ask the
      // controller to do something it is no longer configured to do.
      if (portalMode === "radius") {
        submitRadiusLogin();
        return;
      }
      void authorizeOnController();
      return;
    }

    // THE ROUTER'S OWN ANSWER, AND IT OUTRANKS EVERYTHING BELOW.
    //
    // RouterOS serves `alogin.html`/`status.html` only to a client its
    // hotspot has ALREADY authorized -- so when the page that redirected
    // this browser here was one of those, the gate is open, there is
    // nothing to POST, and the guest belongs on the real connected
    // screen. Nothing else on this page can establish that: an app-level
    // `session` says nothing about the NAS (real incident #4, see
    // portal.index.tsx), and a user agent says nothing about which
    // browser context is looking (that takes the storage probe in
    // `isCaptiveNetworkAssistant`).
    //
    // This is the fix for the founder's QA report. An already-connected
    // iPhone opening the gateway address `10.5.50.1` got `status.html`,
    // came through here with a session and a `link-login-only`, re-fired
    // a login the NAS had already granted, and -- because the UA said
    // "Apple" -- was handed to `captive.apple.com`, ending on a bare page
    // reading only "Success". Every step of that chain is gone: the UA
    // test is replaced by the router's own `hspage` answer, and no client
    // is ever handed to captive.apple.com from this page (see the `dst`
    // comment on the POST branch).
    //
    // Deliberately ABOVE the `hotspotLoginUrl`/`guestIdentifier` guards
    // rather than folded in with them: an authorized client needs neither
    // (there is no POST to build), and a guest whose `guestIdentifier`
    // was lost to a reload used to sit on the spinner here until the 15s
    // escape hatch while their internet already worked perfectly.
    //
    // `undefined` -- a router provisioned before `hspage` existed, which
    // today is the whole fleet -- deliberately falls through to the
    // unchanged behaviour below. See portal-nas-state.ts on why this is
    // three-valued and why `undefined` must never be read as `false`.
    if (nasAuthorizedFromSearch(window.location.search) === true) {
      hotspotLoginSubmitted.current = true;
      // A real document load, for the same reason the cooldown branch
      // below uses one: it is the only thing that actually asks the
      // network. If the gate somehow is not open after all, the NAS
      // intercepts this and reissues a portal URL with a fresh
      // `link-login-only`, which lands back here able to POST. The claim
      // "you're connected" is never made on evidence we do not have.
      window.location.assign(directTarget());
      return;
    }

    // No guestIdentifier means there's no real phone/email this platform
    // ever verified for this browsing session (e.g. a page reload that
    // lost it) -- submitting anything else is guaranteed to be rejected
    // by RadiusService.authorize's username-to-session lookup, so this
    // skips rather than firing a doomed request. This is itself one of
    // the real reasons a guest can land here and never leave without the
    // timeout/retry below: there is nothing in flight at all to wait for.
    if (!guestIdentifier) return;

    // A VALID session + identifier but NO hotspot-login URL (a QR code or
    // bookmark link into the portal, where no RouterOS redirect supplied
    // one): there is no POST to build, but this guest is genuinely
    // authenticated and used to sit on the "Just a moment" spinner with
    // nothing in flight until the 15s escape hatch looped them back into
    // sign-in. Send them to the real resting page on a real document load
    // instead -- the same self-correcting navigation the recently-submitted
    // branch below uses: if the gate is somehow still shut the NAS
    // intercepts and reissues a portal URL with a fresh link-login-only,
    // which comes back through portal.index.tsx and lands here able to
    // POST. Never captive.apple.com here: this page points no client at
    // Apple's diagnostic page (see the `dst` comment on the POST branch).
    if (!hotspotLoginUrl) {
      hotspotLoginSubmitted.current = true;
      window.location.assign(directTarget());
      return;
    }
    hotspotLoginSubmitted.current = true;

    // Where RouterOS sends the browser once its own hotspot-login processing
    // finishes (its `dst` field). This is the ONE moment the redirect can
    // safely fire: the NAS only ever honours `dst` *after* it has authorized
    // the login and opened the gate, so ordering ("gate open before iOS
    // re-probes") is guaranteed by the NAS itself -- not by a fragile
    // client-side delay we'd have to guess at.
    //
    // Every REAL browser gets the destination decision made by
    // @/lib/portal-post-login -- a venue with a redirect URL set gets the
    // guest sent STRAIGHT there by the NAS (no intermediate portal page --
    // the "then a 3-2-1 timer, then the URL" flow the founder asked to
    // remove), while html-mode and default venues land on `/portal/session`
    // (which renders the venue's own page, or the built-in connected page).
    //
    // iOS's Captive Network Assistant websheet is the ONE exception, and it
    // is deliberate: the sheet lands on the real `/portal/session` connected
    // page (Android behaviour) no matter what the venue configured. An
    // external redirect target is meaningless inside the sheet -- it cannot
    // be navigated to an arbitrary page -- and pointing the sheet at the
    // venue URL is exactly how a freshly-logged-in iPhone ended up staring
    // at the venue's redirect target (google.com) instead of the connected
    // page. The sheet used to be pointed at Apple's own captive-detection
    // URL (`captive.apple.com`, whose entire body is the word "Success") so
    // that the sheet would mark the network online and dismiss -- but that
    // redirect is what a guest actually SAW as a bare, unbranded one-word
    // page after login (the founder's "login redirect is just a message
    // 'success'" report), on a device where Android never sees it. Closing
    // the sheet is the OS's own job and does not need this page to navigate
    // there: once the NAS gate is open, iOS's own captive re-probe of
    // `captive.apple.com/hotspot-detect.html` travels through the open gate
    // and returns Apple's Success body by itself, which is what dismisses
    // the sheet. So this page sends the sheet to the connected page, lets
    // it render there, and iOS dismisses it in its own time.
    //
    // Reachable ONLY for a client the NAS has NOT already authorized --
    // the guard at the top of this function returned for the other case.
    const dst = isCaptiveNetworkAssistant()
      ? sessionTarget()
      : destination.mode === "redirect" && destination.url
        ? destination.url
        : sessionTarget();

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
      // A real document load, NOT `navigate()`. A client-side route change
      // repaints "you're connected" without a single byte crossing the
      // network, so it can only ever *assert* that the NAS gate is open --
      // it can never find out. A top-level navigation is the one thing
      // that actually asks: if the gate is open the browser simply loads
      // `/portal/session`; if it is shut (the cooldown fired on a bounce
      // whose earlier POST never landed, a Wi-Fi blip in between) the NAS
      // intercepts this request and redirects to a fresh portal URL
      // carrying a new `link-login-only`, which comes back through
      // `portal.index.tsx` and re-enters this page with a real
      // `hotspotLoginUrl` to submit. Self-correcting either way.
      window.location.assign(dst);
      return;
    }

    // ORDER IS LOAD-BEARING. `submitHotspotLogin` is the only thing on
    // this entire page that opens the NAS gate; `persistHotspotSubmit` is
    // bookkeeping for the flick-flash cooldown above. The persist used to
    // run first, so on iOS's Captive Network Assistant -- where
    // sessionStorage *throws* on access, not merely fails to store -- it
    // pre-empted the POST completely: the guest's OTP verified, the
    // backend really created the session, and the browser sat on "Just a
    // moment" forever, with `retry()` re-entering the same throw.
    // `form.submit()` only *schedules* the navigation, so the statement
    // after it still runs and the cooldown is still recorded in the
    // normal case. Defence in depth on top of PortalRuntimeContext's
    // `safeSet`: even if that guard is ever lost, the worst outcome here
    // is a redundant (harmless) duplicate POST, never a guest with no
    // internet.
    submitHotspotLogin(hotspotLoginUrl, guestIdentifier, dst);
    persistHotspotSubmit({ identifier: guestIdentifier, at: Date.now() });
  }

  useEffect(() => {
    attemptSubmit();
    // Real dependencies only -- `attemptSubmit` itself is intentionally
    // excluded (it's redefined every render but reads current props via
    // closure, same pattern the rest of this hook already relied on
    // before this refactor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session,
    hotspotLoginUrl,
    guestIdentifier,
    organizationId,
    locationId,
    routerId,
    navigate,
    netProvider,
    portalMode,
  ]);

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
          {/* Hand-written, not `PortalTextPlate`: this plate is `px-4 py-3`
           * and the component hardcodes `p-5`. tailwind-merge does not drop
           * an earlier `p-5` for a later `px-*`/`py-*` (verified on these
           * exact strings), so passing the padding through `className` would
           * emit both and leave the winner to stylesheet order rather than
           * intent -- exactly the silent failure mode PortalShell's own
           * class-ordering notes exist to prevent. */}
          <p
            className={cn(
              "pg-meta max-w-full text-[var(--pg-ink-muted)]",
              hasPhoto && cn("px-4 py-3", GUEST_LEGIBILITY_CARD_CLASS),
            )}
          >
            {showEscapeHatch ? t("successStuckNotice") : t("successSlowNotice")}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="flex min-h-6 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] px-4 py-2 pg-meta font-medium text-[var(--pr-primary,#6366f1)] hover:bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_14%,var(--pg-surface,#fff))]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {t("retry")}
            </button>
            {showEscapeHatch && (
              // Hand-written for the same reason as the routes' back links:
              // the pill classes are on the anchor, so its padding is part
              // of the tap target, and `PortalTextPlate` wraps rather than
              // decorates. See portal.verify.tsx's own note.
              <Link
                to="/portal/welcome"
                search={portalSearch}
                className={cn(
                  "pg-meta font-medium text-[var(--pg-ink-muted)] underline-offset-2 hover:text-[var(--pr-primary,#6366f1)] hover:underline",
                  hasPhoto && cn(GUEST_LEGIBILITY_CARD_CLASS, "rounded-full px-4 py-2"),
                )}
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
