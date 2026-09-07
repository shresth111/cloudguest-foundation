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
