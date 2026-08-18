import { createFileRoute, Outlet, SearchParamError } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

// Real incident: a now-removed admin "Open live guest flow" preview button
// (see src/routes/preview.portal.$locationId.tsx's own history) used to
// build exactly this route with a fake, non-UUID `routerId=preview` --
// every real caller of organizationId/locationId/routerId sends them
// straight to the backend as literal UUIDs (OTP verify, password, voucher
// login -- see src/services/portal-runtime.service.ts), so a non-UUID
// value was never going to complete a real sign-in anyway, it would just
// reach a guest's browser looking like a working link and then fail
// further downstream with a raw backend error instead of this route's own
// honest, friendly IncompletePortalLinkError. That button is gone, but a
// stale bookmark/copied link built before this fix can still exist and
// get hit directly -- checked here the same way a *missing* value already
// is (as a normal, expected case, not a schema-level throw -- see
// searchSchema's own comment above on why validation intentionally
// doesn't throw for this route).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function looksLikeRealId(v: string | undefined): v is string {
  return !!v && UUID_RE.test(v);
}
import {
  PortalRuntimeProvider,
  loadPersistedRuntimeIds,
  persistRuntimeIds,
} from "@/context/PortalRuntimeContext";
import { ErrorComponent as RootErrorComponent } from "./__root";

// A real captive-portal redirect from a NAS/router would encode equivalent
// identity (MAC/AP/NAS-ID query params in a vendor-specific format) -- there
// is no live NAS in this environment to generate one, so these three are
// taken as explicit, required search params instead.
//
// There used to be a fourth, optional `mac` param here, read by
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
// backend). A whitelisted device is granted access before it ever reaches
// this captive portal at all -- there is nothing left for this frontend to
// do for that case.
const searchSchema = z.object({
  // Optional here (not .min(1) required, as this used to be) -- a missing
  // one is an expected, real-world case (see IncompletePortalLinkError's
  // own doc comment: a stale bookmark, a hand-typed URL, a cropped QR
  // code), not a validation failure. Making validateSearch throw for it
  // meant this route's SSR response came back as a real HTTP 500 even
  // though the errorComponent below was already rendering the correct,
  // friendly, fully-intentional UI for it -- a monitoring/crawler-visible
  // "server error" for a page that was working exactly as designed.
  // PortalRuntimeLayout now checks presence itself and renders
  // IncompletePortalLinkError directly as a normal successful render
  // (200) when any are missing, instead of relying on this schema to
  // throw and the router's error-boundary machinery to catch it.
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
});

/**
 * A real NAS/router redirect always supplies all three search params (see
 * `searchSchema` above) -- but this URL can also reach a browser with one
 * missing any other way a link can go wrong: a bookmark saved before a
 * redirect finished building its query string, a hand-typed URL, a QR code
 * that got cropped/mistyped when printed, a plain reload/OS captive-portal
 * re-probe/back-forward navigation landing on a bare URL after the guest
 * is already connected (see `PortalRuntimeLayout`'s own
 * `loadPersistedRuntimeIds` fallback, which resolves most of that last
 * category before ever reaching this component at all). This is a real,
 * expected, honest case, not a validation failure -- the app-wide root error boundary's
 * generic "This page didn't load / Something went wrong on our end" reads
 * like a server bug to a guest, giving them no idea this is about the link
 * itself or what to actually do about it, so `PortalRuntimeLayout` checks
 * for the three required params itself and renders this directly as a
 * plain, honest explanation with a real next step -- a normal successful
 * render (HTTP 200), not a thrown/caught error. (This route's schema used
 * to mark these fields required and let `validateSearch` throw, caught by
 * this route's own `errorComponent` -- functionally the same UI, but the
 * framework still marked the whole SSR response as a 500 regardless of the
 * errorComponent successfully recovering, a real server-error status for
 * a page working exactly as designed. `errorComponent` below is now purely
 * a fallback for a genuine bug/network failure/wrong-type param -- it
 * falls through to the same root error boundary every other route in the
 * app uses.)
 */
function IncompletePortalLinkError() {
  return (
    <div
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4"
      style={{
        fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",
        background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)",
      }}
    >
      <div
        className="relative z-10 w-full max-w-[400px] rounded-[24px] border border-indigo-100/80 bg-white p-7 text-center"
        style={{
          boxShadow: "0 24px 60px -20px rgba(79,70,229,0.28), 0 8px 24px -10px rgba(15,23,42,0.12)",
        }}
      >
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl shadow-lg shadow-indigo-500/25"
          style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
        >
          <QrCode className="h-7 w-7 text-white" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">This WiFi link looks incomplete</h1>
        <p className="mt-2 text-sm text-slate-500">
          Please scan the venue's QR code or connect through its guest WiFi network again to get a
          fresh sign-in link.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/portal")({
  // Was `ssr: false` from this route's very first commit (7c09a9c) --
  // there is no comment or blocker recorded for it, and an audit of every
  // window/document/localStorage/sessionStorage access anywhere under
  // /portal (this file, PortalRuntimeContext, GuestSignInCard, PortalShell,
  // portal.success/redirect/team/etc.) shows every single one is already
  // guarded (`typeof window === "undefined"`) or confined to an effect/
  // event handler -- never at module scope or in a render body -- so there
  // is nothing here that actually requires a browser to evaluate. With
  // `ssr: false`, a guest's very first response for this page was an empty
  // `<body>` (just the app-wide `InitialLoader` spinner) until the full JS
  // bundle downloaded, parsed, executed, and hydrated -- on the weak/
  // cellular connection a guest is often still on mid-handoff, that is
  // exactly the "noticeably long blank screen" the founder saw live.
  // Enabling SSR lets the server send real, branded markup (this route's
  // actual loading/welcome screen) in the first response instead.
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "WyFy" },
      { name: "description", content: "Connect to complimentary guest WiFi." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0F172A" },
    ],
  }),
  component: PortalRuntimeLayout,
  // Fallback only now -- see IncompletePortalLinkError's own doc comment.
  // A wrong-*type* param (organizationId passed as an array, say) still
  // throws a real SearchParamError zod can't coerce around, and still
  // deserves this same honest treatment rather than the generic root
  // error boundary.
  errorComponent: (props) =>
    props.error instanceof SearchParamError ? (
      <IncompletePortalLinkError />
    ) : (
      <RootErrorComponent {...props} />
    ),
});

function PortalRuntimeLayout() {
  const search = Route.useSearch();
  const {
    organizationId: urlOrganizationId,
    locationId: urlLocationId,
    routerId: urlRouterId,
    mac,
    ip,
    dst,
  } = search;
  const linkLoginOnly = search["link-login-only"];

  // Fallback only -- read once per mount, same lazy-initializer idiom
  // PortalRuntimeContext's own `session`/`guestIdentifier` persistence
  // uses. A real NAS/QR-code/bookmark link always supplies all three IDs
  // on the URL itself; this is only ever consulted when one is missing
  // from a *later* load (see `loadPersistedRuntimeIds`'s own doc comment
  // in PortalRuntimeContext.tsx for the concrete, confirmed-live ways that
  // happens even after a guest is already connected).
  const [persistedIds] = useState(() => loadPersistedRuntimeIds());

  const organizationId = urlOrganizationId ?? persistedIds?.organizationId;
  const locationId = urlLocationId ?? persistedIds?.locationId;
  const routerId = urlRouterId ?? persistedIds?.routerId;

  // Persist a genuinely-complete URL's three IDs so the fallback above has
  // something real to fall back to on a later load. Only ever writes what
  // the URL itself just supplied -- never the merged/fallback values above
  // -- so a stale persisted ID can't perpetuate itself once a fresh, real
  // link (a different router, say) provides a new one.
  useEffect(() => {
    if (looksLikeRealId(urlOrganizationId) && looksLikeRealId(urlLocationId) && looksLikeRealId(urlRouterId)) {
      persistRuntimeIds({
        organizationId: urlOrganizationId,
        locationId: urlLocationId,
        routerId: urlRouterId,
      });
    }
  }, [urlOrganizationId, urlLocationId, urlRouterId]);

  if (!looksLikeRealId(organizationId) || !looksLikeRealId(locationId) || !looksLikeRealId(routerId)) {
    return <IncompletePortalLinkError />;
  }

  return (
    <PortalRuntimeProvider
      organizationId={organizationId}
      locationId={locationId}
      routerId={routerId}
      deviceMac={mac}
      deviceIp={ip}
      destinationUrl={dst}
      hotspotLoginUrl={linkLoginOnly}
    >
      <Outlet />
    </PortalRuntimeProvider>
  );
}
