import { retainSearchParams } from "@tanstack/react-router";
import { z } from "zod";

/**
 * The guest portal's search-param contract, and the router-level guarantee
 * that it survives every navigation under `/portal`.
 *
 * Lives in `src/lib` rather than in `src/routes/portal.tsx` for the same
 * reason `portal-session-url.ts` does: more than one module needs it (the
 * `/portal` route itself, and `scripts/test-portal-search-retention.mjs`,
 * which drives a real router against the real schema), and importing a
 * non-`Route` export across route files is the exact anti-pattern
 * vite.config.ts's `manualChunks` comment documents at length.
 *
 * ## THE PRODUCTION BUG THIS EXISTS TO PREVENT
 *
 * One real iPhone, 7 Sep 2026, production. The device loaded `/portal`
 * three times with a complete NAS redirect:
 *
 *     /portal?organizationId=..&locationId=..&routerId=..
 *            &mac=FA:42:FE:9E:29:03&ip=10.5.50.251&dst=
 *            &link-login-only=http://wifi.wyfyguest.com/login
 *
 * Its first `POST /api/v1/guest/login/otp` arrived with this `Referer`:
 *
 *     /portal/welcome?organizationId=..&locationId=..&routerId=..
 *
 * `mac`, `ip`, `dst` and `link-login-only` were gone. The guest signed in,
 * the login succeeded, and they were asked to sign in all over again.
 *
 * The cause was NOT a missing `search: (prev) => prev` on some `navigate()`
 * -- every `navigate()` under `/portal` had one. It was six independent
 * copies of this literal, one per file, each feeding a `<Link search={...}>`:
 *
 *     const portalSearch = { organizationId, locationId, routerId };
 *
 * Whole-object `search`, so the router built the destination URL from those
 * three keys and nothing else. A guest who tapped "Terms" from the sign-in
 * card (`OtpForm`, `PasswordSignInForm`, `PortalShell`'s footer) landed on
 * `/portal/terms` with the MAC already stripped; the "Back" link there is a
 * faithful `search={(prev) => prev}`, so it faithfully carried the truncated
 * search back to `/portal/welcome`. That is the exact three-param referer
 * above, and it explains why the failing referer's params were plain while
 * the working one's were percent-encoded: the three survivors are UUIDs,
 * and every param that needs escaping (`mac`'s colons, `link-login-only`'s
 * `://`) is one of the four that were dropped.
 *
 * ## WHY THE MIDDLEWARE, AND NOT SIX MORE CAREFUL CALL SITES
 *
 * `device_mac` is optional on three of the four backend login schemas, so a
 * MAC-less login is accepted and writes a `guest_sessions` row with
 * `device_id = NULL`. Backend PR #179 heals that from RADIUS afterwards, but
 * in the window before Authorize the row is invisible to the portal's own
 * "already connected?" check, to login dedup, and to
 * `GET /agent/authorized-macs` -- so the MAC never reaches the router's
 * bypass list, and the guest is bounced back through sign-in.
 *
 * Patching the six literals would fix today's six hops and nothing else:
 * the seventh hop, added by the next author, forgets again, and nothing in
 * `tsc`, eslint or the build can see it -- an under-specified `search` is
 * not a type error. `retainSearchParams` moves the guarantee off the author
 * and into the route tree: it is a search middleware on `/portal`, and
 * TanStack Router collects middlewares from the DESTINATION's matched route
 * chain (`buildMiddlewareChain` in router-core), so it runs for every
 * navigation into any `/portal/*` route no matter which file, hook or
 * component built it, and no matter whether that caller passed
 * `(prev) => prev`, a partial object, or nothing at all.
 *
 * The retained key list is derived from the schema's own shape rather than
 * hand-listed, so a param added to `portalSearchSchema` below is retained
 * from the moment it exists -- there is no second list to keep in sync.
 *
 * What this does NOT cover, by design: full document loads. `/portal`'s
 * hotspot-login POST, `PortalErrorScreen`'s plain anchor and
 * `portal.index.tsx`'s `window.location.assign` all leave the client-side
 * router entirely. Each of those already carries the URL it needs by hand
 * (`buildSessionUrl`, `window.location.search` verbatim), and a router
 * middleware could never reach them.
 */

// A real captive-portal redirect from a NAS/router would encode equivalent
// identity (MAC/AP/NAS-ID query params in a vendor-specific format) -- there
// is no live NAS in this environment to generate one, so these three are
// taken as explicit search params instead.
//
// There used to be a fourth, differently-shaped `mac` param here, read by
// src/routes/portal.index.tsx to attempt a "MAC-whitelist bypass" login by
// POSTing it straight to the backend's `/guest/login/mac`. That was a real
// authentication bypass: an unauthenticated browser claiming any MAC string
// in a query param got a full guest session for it, with no server-side
// proof the caller was ever near the real device. It has been removed on
// both sides -- the backend endpoint no longer exists at all. A
// pre-whitelisted device's auto-connect is now granted the only place a
// MAC address can genuinely be trusted: RADIUS's own Authorize call, which
// only ever runs behind the NAS's shared secret and carries the NAS's own
// asserted `Calling-Station-Id`, never a browser's claim (see
// `app.domains.guest.service.RadiusService.authorize`'s docstring on the
// backend). The `mac` below is a different thing entirely: it is reported
// to `GET /agent/authorized-macs` so the router can add an already-signed-in
// device to its bypass list, and it is never itself a credential.
/**
 * One Omada redirect parameter, exactly as TP-Link doc 132060 defines it
 * and exactly as TanStack Router hands it over.
 *
 * Two primitives, not one, and a `.catch` on top -- both for reasons the
 * comment block inside `portalSearchShape` spells out in full. The short
 * version: the router's default search parser JSON.parses every raw value,
 * so `radioId=1`/`vid=0`/`t=1757548800000` arrive as NUMBERS and a
 * `z.string()` would reject a genuine controller redirect outright, taking
 * every other parameter down with it; and a value that parses to neither
 * primitive drops that one key rather than throwing a SearchParamError
 * that costs the guest the whole redirect.
 *
 * No coercion here on purpose. This layer captures what the controller
 * said; `src/lib/portal-authorize-body.ts` is the single place that
 * renders each value into the shape its backend field takes.
 */
const omadaRedirectParam = () => z.union([z.string(), z.number()]).optional().catch(undefined);

const portalSearchShape = {
  // Optional here (not .min(1) required, as this used to be) -- a missing
  // one is an expected, real-world case (see `IncompletePortalLinkError`'s
  // own doc comment in portal.tsx: a stale bookmark, a hand-typed URL, a
  // cropped QR code), not a validation failure. Making validateSearch throw
  // for it meant `/portal`'s SSR response came back as a real HTTP 500 even
  // though the errorComponent was already rendering the correct, friendly,
  // fully-intentional UI for it -- a monitoring/crawler-visible "server
  // error" for a page that was working exactly as designed.
  // `PortalRuntimeLayout` now checks presence itself and renders
  // `IncompletePortalLinkError` directly as a normal successful render
  // (200) when any are missing, instead of relying on this schema to throw
  // and the router's error-boundary machinery to catch it.
  organizationId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  routerId: z.string().min(1).optional(),
  // Populated when the hotspot's own login page redirects here with
  // RouterOS's `$(mac)` substitution -- the one place a MAC address is
  // trustworthy without RADIUS (it's what generated this very redirect,
  // not a caller's unverified claim). Optional/additive: every existing
  // portal link without it keeps working exactly as before, just without
  // GET /agent/authorized-macs ever having a MAC to report for that
  // session. See GuestSignInCard's login call for where this is used.
  mac: z.string().optional(),
  // Populated the same way, from RouterOS's `$(ip)` substitution -- the
  // guest's real LAN-side IP as assigned by this router's own DHCP, the
  // only address a `/queue/simple` rule on *this* router can actually
  // match. Without it, the backend falls back to the raw HTTP request's
  // own source address (`guest/router.py`'s `request.client.host`), which
  // behind this deployment's reverse proxy is always the proxy's own
  // internal Docker address, never the guest's -- so every dynamic
  // bandwidth queue this platform ever created targeted an address no
  // guest traffic could match, regardless of the configured Mbps (bug
  // report: "queue sahi se nahi lag rhai, 10 ya 20 mbps koi farak nahi
  // padta"). See GuestSignInCard/AuthMethodForms' login calls for where
  // this threads through as `ip_address`.
  ip: z.string().optional(),
  // Omada's own spelling, verbatim from the controller's portal redirect
  // (`http(s)://PORTAL?clientMac=...&clientIp=CLIENT_IP&apMac=...`, TP-Link
  // doc 132060, *External Portal Server, Omada Controller v6.2.10 or
  // Above*). From v6.2.10 the controller's authorization body "must
  // contain" `clientIp` in BOTH documented shapes -- the EAP/AP one and
  // the gateway one -- so on current shipping firmware an authorize call
  // without it is missing a mandatory field, and the guest may get no
  // internet at all. The older doc 13080 (v5.0.15-v6.2.0) does not contain
  // the string anywhere, which is what makes this a genuine new-firmware
  // requirement rather than an omission we can ignore.
  //
  // NOT the same param as `ip` above, and never a substitute for it: `ip`
  // is RouterOS's `$(ip)` substitution on a MikroTik hotspot redirect and
  // is threaded to this platform's own login calls as `ip_address`;
  // `clientIp` comes from an Omada controller's redirect and is threaded
  // to the controller's own authorize call as `client_ip`. A venue has one
  // vendor or the other, the two redirects never both fire, and conflating
  // them would put one vendor's address into the other vendor's call.
  //
  // CAPTURED, NEVER DERIVED. This is the only place the guest's address
  // can be learned honestly. It must not be inferred from the portal
  // request's own source address: this portal is reached through a reverse
  // proxy, so that address is the proxy's, and authorizing the wrong
  // address either authorizes the wrong device or nobody. If Omada did not
  // send it, the value that travels onward is `null` -- see
  // `src/lib/portal-authorize-body.ts`, which is the only module that
  // spells the wire name, and refuses to invent one.
  //
  // Known and deliberately NOT papered over: this is captured at redirect
  // time, while authorization happens after the guest finishes OTP, which
  // can be minutes later. If the DHCP lease changed in between, the
  // address we send is stale and the controller will reject it. We still
  // send exactly what the redirect said, because the alternative is a
  // guess, and a guess that happens to be a real address on that LAN is
  // the worse failure of the two.
  //
  // AND A SECOND, SHARPER PROBLEM, MEASURED ON HARDWARE 2026-09-11. When
  // the controller is OFF-SITE, this is not the client's address at all --
  // it is the venue's public NAT address, identical for every guest there
  // at once. The controller reports the source address of the HTTP request
  // it received, and with the controller off-premises that is the venue's
  // egress. Captured live: `clientIp=103.84.202.195` while the client was
  // `192.168.1.114`.
  //
  // So on a WyfyGuest-hosted controller this value is a VENUE identifier,
  // not a client identifier, and anything that treats it as the latter is
  // wrong for every guest simultaneously. On a venue-hosted controller it
  // is the real client address and the problem does not arise. CR-004
  // makes it mandatory on v6.2.10+, which means the deployment model has
  // to be settled before that firmware ships -- see the `clientIp`
  // plumbing on `feat/clientip-vendor-sync`, which is where it lands.
  //
  // Being IN this schema is what makes it survive the client-side hops
  // between the controller's document load and the authorize call, exactly
  // as `mac` did not until `retainSearchParams` existed -- see this file's
  // docstring.
  clientIp: z.string().optional(),
  // ------------------------------------------------------------------
  // The rest of Omada's redirect, same source and same rule as `clientIp`
  // above: TP-Link doc 132060, *External Portal Server, Omada Controller
  // v6.2.10 or Above*. The controller 302s the guest's browser to the
  // portal with one of two documented query strings --
  //
  //   EAP/AP:  ?clientMac=..&clientIp=..&apMac=..&ssidName=..&t=..
  //            &radioId=..&site=..&redirectUrl=..
  //   Gateway: ?clientMac=..&clientIp=..&gatewayMac=..&vid=..&t=..
  //            &site=..&redirectUrl=..
  //
  // -- and the same doc states the requirement these entries exist to
  // satisfy: "Your External Portal Server must preserve and return these
  // parameters when interacting with the Omada Controller." Preserving
  // them is what these lines do, and it is design-independent: however the
  // venue itself ends up being identified (still an open question, and
  // deliberately NOT answered here -- organizationId/locationId/routerId
  // are untouched above), these nine values have to survive the trip from
  // the controller's redirect to the authorize callback, because only the
  // controller can tell us what they are.
  //
  // Being IN this schema is the whole mechanism. `PORTAL_SEARCH_KEYS` is
  // derived from this shape and `retainSearchParams` consumes that list,
  // so a param declared here is retained from the moment it exists and a
  // param NOT declared here is stripped twice over: once by `z.object`,
  // which drops every key it does not know, and again at the first
  // `<Link>`. That is exactly how a guest's `mac` disappeared on 7 Sep
  // 2026 -- see this file's docstring.
  //
  // TYPES, AND A TRAP THAT IS EASY TO MISS. These are not all strings by
  // the time zod sees them. TanStack Router's default search parser runs
  // JSON.parse over each raw value and keeps the parsed result when it
  // succeeds, so a real redirect arrives with `radioId` as the NUMBER 1,
  // `vid` as the NUMBER 0 and `t` as the NUMBER 1757548800000 -- and an
  // SSID or site that happens to be spelled "5" arrives as a number too.
  // A `z.string()` here would therefore REJECT the genuine article: the
  // route's errorComponent would render IncompletePortalLinkError and the
  // entire redirect -- every other parameter with it -- would be lost at
  // the venues this work exists to support. Both primitives are accepted;
  // `src/lib/portal-authorize-body.ts` is the single place that renders
  // each one into the form the backend field takes.
  //
  // `.catch(undefined)` for the same reason, one step further out: a value
  // JSON.parse turns into something neither primitive (`?vid=null`,
  // `?t=[]`) drops that ONE key instead of throwing a SearchParamError
  // that would cost the guest the whole redirect. Losing one parameter we
  // could not have used anyway is strictly better than losing the eight
  // beside it.
  //
  // CAPTURED, NEVER DERIVED -- the rule `clientIp` is already documented
  // under. None of these has a local substitute: `ssidName` is not the
  // integration's configured `guestSsidName`, `site` is not the stored
  // site on the integration row, `t` is not `Date.now()`, and `redirectUrl`
  // is not `dst` (see below). Absent stays absent all the way to the wire.
  //
  // Omada's own `clientMac`, which is NOT the `mac` param above. `mac` is
  // RouterOS's `$(mac)` substitution on a MikroTik hotspot redirect and
  // is reported to `GET /agent/authorized-macs`; `clientMac` comes from an
  // Omada controller and is the device the controller's own authorize call
  // names as `client_mac`. A venue is behind one vendor or the other, the
  // two redirects never both fire, and substituting one for the other
  // would authorize a MAC on a controller that never saw it.
  clientMac: omadaRedirectParam(),
  // The controller site the redirect came from. Required by the backend
  // (`PortalAuthorizeRequest.site` has no default), and checked there
  // against the integration's own stored site -- a mismatch means the
  // redirect came from a controller this integration is not configured
  // for. That check is only worth anything if the value is the
  // CONTROLLER's; filling it in from the integration row would make it
  // compare a value to itself.
  site: omadaRedirectParam(),
  // EAP/AP redirect only: the access point the guest associated with, and
  // the SSID and radio they used. Absent on every gateway-mode redirect,
  // which is a real shape and not a fault -- the backend takes all three
  // as optional for exactly that reason.
  apMac: omadaRedirectParam(),
  // The SSID as the CONTROLLER spells it. Deliberately not the
  // integration's configured `guestSsidName` (NetworkIntegrationsPage's
  // own setup step), even though a correctly configured venue has the two
  // agreeing: if they ever disagree, the controller's spelling is the one
  // its authorize call will match, and ours is the one that is wrong.
  ssidName: omadaRedirectParam(),
  radioId: omadaRedirectParam(),
  // Gateway redirect only: the gateway's MAC and the VLAN the client is
  // on. Absent on every EAP/AP redirect.
  gatewayMac: omadaRedirectParam(),
  vid: omadaRedirectParam(),
  // The controller's own timestamp for this redirect, echoed back so the
  // controller can tie the authorization to the interception it issued.
  // Never regenerated locally -- a fresh `Date.now()` would be a
  // well-formed value describing a moment the controller knows nothing
  // about.
  t: omadaRedirectParam(),
  // Where the CONTROLLER says to send the guest once it has authorized
  // them (doc 132060's `LANDING_PAGE`). NOT the same thing as `dst` above:
  // `dst` is RouterOS's `$(link-orig)`, the site this guest was personally
  // trying to reach when the hotspot intercepted them. They answer
  // different questions and come from different vendors; either may be
  // absent while the other is present.
  redirectUrl: omadaRedirectParam(),
  // WHICH VENDOR'S GATE STANDS BETWEEN THIS GUEST AND THE INTERNET.
  //
  // Not a controller parameter -- Omada does not send this. It is part of
  // the URL the venue's operator pasted into the controller's External
  // Portal Server field, put there by the dashboard from the integration
  // row (`validators.build_external_portal_url` on the backend). It is the
  // one thing `/portal/success` needs in order to choose between the two
  // mutually exclusive ways this flow can end:
  //
  //   "omada" -> POST /api/v1/network-integrations/portal/authorize, which
  //              asks the venue's controller to let the device through;
  //   absent  -> the existing RouterOS `link-login-only` form POST.
  //
  // A venue is behind one vendor or the other and never both. Inferring it
  // instead ("`clientMac` is present, so it must be Omada") would put the
  // decision in whichever parameter happened to survive the trip, on the
  // one page where being wrong means the guest completes sign-in and gets
  // no internet -- with the portal claiming success. The dashboard knew the
  // provider for certain when it built the URL (it read it off the
  // integration row); this carries that certainty forward rather than
  // re-deriving a guess from the parameters that happen to be present.
  //
  // Declared here, like every other key, because being in this schema is
  // what makes it survive the ~6 route transitions between the redirect
  // and `/portal/success`. See this file's docstring.
  netProvider: z.string().optional(),
  // WHICH OF OMADA'S TWO CAPTIVE-PORTAL CONTRACTS THIS VENUE IS ON.
  //
  // Also not a controller parameter, and carried for exactly the same
  // reason as `netProvider` above: the backend stamps it into the URL the
  // operator pastes, from `network_integrations.portal_mode`, which is the
  // only place the answer is known for certain.
  //
  //   absent / "external_portal" -> the proven External Portal Server
  //          contract (`authType 4`): our backend calls the controller.
  //   "radius" -> `authType 2` + External Web Portal: the guest's browser
  //          submits to the CONTROLLER, which then asks our FreeRADIUS.
  //
  // The redirect's own shape does distinguish the two -- a RADIUS redirect
  // carries `target`/`targetPort`/`scheme` and carries no `site` and no
  // `t` -- and that shape is used only to REFUSE, never to decide. A venue
  // recorded as RADIUS whose redirect carries no `target` has nowhere to
  // submit, and `portal-radius-submit.ts` refuses rather than guessing the
  // controller's address; a venue recorded as External Portal Server whose
  // redirect carries no `site` is refused by the backend's own
  // configured-site check. Neither case silently switches contract.
  // Sniffing would put the decision in whichever parameter a firmware
  // revision happens to send, on the one page where being wrong means the
  // guest posts their identifier to the wrong place entirely.
  portalMode: z.string().optional(),
  // The RADIUS-mode redirect's own parameters (`authType 2`), captured
  // under the controller's spellings exactly as the `authType 4` ones
  // above are. Same rule: captured, never derived.
  //
  // `target`/`targetPort`/`scheme` are the load-bearing three -- they are
  // the controller telling this page WHERE to submit the guest's
  // identifier, which is the whole architectural difference between the
  // two contracts. Without them there is nothing to submit to, and
  // `portal-radius-submit.ts` refuses rather than guessing an address.
  target: omadaRedirectParam(),
  targetPort: omadaRedirectParam(),
  scheme: omadaRedirectParam(),
  // `authType 2`'s spelling of "where this guest was going". The
  // `authType 4` redirect calls the same idea `redirectUrl` above, and the
  // controller encodes this one only partially (`=` and `&` are
  // percent-encoded, `://` and `?` are not), which a standard query parser
  // recovers intact. Kept separate rather than folded into `redirectUrl`:
  // they come from different contracts and either may be absent while the
  // other is present.
  originUrl: omadaRedirectParam(),
  // Two undocumented parameters this controller adds and TP-Link's own
  // documentation does not mention. Declared so they are captured rather
  // than silently dropped; nothing reads them. `hostname` is the
  // controller's PRIVATE VPC address, which it puts in a URL a guest's
  // browser can see -- recorded, not used.
  hostname: omadaRedirectParam(),
  serverPort: omadaRedirectParam(),
  // The guest's own chosen portal language, put here by `buildSessionUrl`
  // so it survives portal.success.tsx's full-document POST to the NAS --
  // the one boundary on this flow where React state and (on iOS's Captive
  // Network Assistant) localStorage both disappear. Declared on the schema
  // so client-side navigations carry it through too; `PortalRuntimeContext`
  // reads it straight off `window.location`, because it also has to work on
  // the first render of the fresh document the NAS itself navigated to.
  // Free text and never trusted as-is -- `readLanguageFromUrl` validates it
  // against `RUNTIME_LANGUAGES` and ignores anything else.
  lang: z.string().optional(),
  // The site the guest was actually trying to reach before the hotspot
  // intercepted them -- RouterOS's `$(link-orig)` substitution. Used by
  // portal.success.tsx/portal.redirect.tsx as the "Continue browsing"
  // target once real internet access is granted, falling back to the
  // location's own configured redirectUrl (or nothing) when absent --
  // see GuestSignInCard/PortalRuntimeContext for how this threads through.
  dst: z.string().optional(),
  // RouterOS's `$(link-login-only)` substitution -- see
  // PortalRuntimeContext's `hotspotLoginUrl` docstring for why this portal
  // must POST to it once login succeeds here, not just create a session in
  // this platform's own database.
  "link-login-only": z.string().optional(),
  // Which of RouterOS's own five stock hotspot pages redirected this
  // browser here -- and therefore whether the NAS gate is already open for
  // this client, which is the one thing no user-agent test can determine.
  // Not a RouterOS substitution: each override page is generated
  // separately (`PORTAL_OVERRIDE_FILES` in RouterDetailTabs.tsx), so the
  // generator stamps its own basename. Free text, validated against a
  // closed set by `parseNasPage`, never trusted as-is. Absent for every
  // router provisioned before this existed, which is why
  // `nasAuthorizedFromPage` is three-valued -- see
  // src/lib/portal-nas-state.ts for the whole "only showing success"
  // incident this closes.
  //
  // Being IN this schema is what makes it survive the client-side hops
  // between the NAS's document load and /portal/success. That is the
  // entire subject of this file's docstring; a param read off
  // `window.location` but missing here would be dropped at the first
  // `<Link>`, exactly as `mac` was.
  hspage: z.string().optional(),
} as const;

export const portalSearchSchema = z.object(portalSearchShape);

export type PortalSearch = z.infer<typeof portalSearchSchema>;

/**
 * Every key `/portal` accepts, derived from the schema above so the two can
 * never drift. Adding a param to `portalSearchShape` retains it
 * automatically; there is no second list to remember.
 */
export const PORTAL_SEARCH_KEYS = Object.keys(portalSearchShape) as Array<keyof PortalSearch>;

/**
 * Installed as `/portal`'s `search.middlewares` -- see this module's
 * docstring for the incident. Any key the caller did not supply is copied
 * from the current location's search, so a partial `search={{ ... }}` on a
 * `<Link>` narrows what that caller *sets*, never what the URL *carries*.
 */
export const portalSearchMiddlewares = [retainSearchParams<PortalSearch>(PORTAL_SEARCH_KEYS)];
