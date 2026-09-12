import { createFileRoute, Outlet, SearchParamError } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

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
// `portalSearchSchema`'s own comments in src/lib/portal-search.ts on
// why validation intentionally doesn't throw for this route).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function looksLikeRealId(v: string | undefined): v is string {
  return !!v && UUID_RE.test(v);
}
import {
  PortalRuntimeProvider,
  loadPersistedRuntimeIds,
  loadPersistedOmadaContext,
  persistOmadaContext,
  persistRuntimeIds,
} from "@/context/PortalRuntimeContext";
import { PortalCard, PG_FONT_STACK } from "@/components/portal-runtime/PortalShell";
import { PortalDefaultBrandBadge } from "@/components/portal-runtime/PortalDefaultBrandBadge";
import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { portalSearchSchema, portalSearchMiddlewares } from "@/lib/portal-search";

/**
 * A real NAS/router redirect always supplies all three search params (see
 * `portalSearchSchema` in src/lib/portal-search.ts) -- but this URL can also reach a browser with one
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
// v3 polish pass: this used to be its own one-off gradient-wash page
// (`linear-gradient(160deg, #eef2ff...)`) around a heavy glass-card
// (`rounded-[24px]`, a `0 24px 60px -20px rgba(79,70,229,.28)` glow
// shadow, a gradient icon badge) in the "Manrope" webfont -- exactly the
// "glassy SaaS" recipe the rest of this guest flow's redesign already
// moved away from (see PortalCard's own "light" variant comment) and the
// exact webfont this surface deliberately dropped (see PG_FONT_STACK's
// doc comment in PortalShell.tsx). This renders before/without a real
// PortalRuntimeProvider (a required search param is missing, so there's
// no venue config yet to theme against), so it can't reuse PortalShell
// itself -- but PortalCard has no such dependency, and reusing it here
// keeps this screen's "flat card on a flat neutral canvas" look
// identical to every other light-flow screen instead of a visually
// orphaned one-off.
function IncompletePortalLinkError() {
  // Renders with NO PortalRuntimeProvider and no `.portal-runtime`
  // ancestor of its own, so the `--pg-*` tokens would be undefined here --
  // `portal-runtime pg-shell` on this root brings styles.css's token block
  // (plain CSS, not provider-injected -- verified) into scope with zero
  // JS, letting the same ramp/token classes as every other screen work.
  // Still SSR-safe and provider-free: no hooks, no storage, no window.
  // Strings stay English by the same standing rationale (no config, no
  // language context exists yet at this point).
  return (
    <div
      className="portal-runtime pg-shell flex min-h-dvh w-full items-center justify-center px-4"
      style={{ fontFamily: PG_FONT_STACK, background: "var(--pg-canvas, #F8F8FC)" }}
    >
      <PortalCard className="pg-enter w-full max-w-[400px] text-center">
        {/* The product's own mark (pure inline SVG -- SSR/CNA-safe): this
         * screen is the one moment there is no venue identity at all to
         * show, which is exactly when Wyfy's own should appear -- not a
         * generic lucide QrCode on a hardcoded indigo tile. */}
        <PortalDefaultBrandBadge size={64} className="mx-auto h-14 w-14" />
        <h1 className="mt-4 pg-subtitle text-[var(--pg-ink)]">This WiFi link looks incomplete</h1>
        <p className="mt-2 pg-meta font-normal text-[var(--pg-ink-muted)]">
          Please scan the venue's QR code or connect through its guest WiFi network again to get a
          fresh sign-in link.
        </p>
      </PortalCard>
    </div>
  );
}

export const Route = createFileRoute("/portal")({
  // Was `ssr: false` from this route's very first commit (7c09a9c) --
  // there is no comment or blocker recorded for it, and nothing under
  // /portal needs a browser present merely to *evaluate*: the browser-only
  // work is confined to effects and event handlers, not module scope or a
  // render body.
  //
  // An earlier version of this comment went further and claimed every
  // window/document/localStorage/sessionStorage access under /portal was
  // "already guarded" on the strength of its `typeof window === "undefined"`
  // check. That was wrong, and it is why a real production sign-in bug went
  // unnoticed: `typeof window` is an SSR guard. It answers "is there a
  // window", which says nothing at all about whether that window's
  // `localStorage`/`sessionStorage` *works*. Apple's Captive Network
  // Assistant -- the websheet iOS opens for a WiFi login, i.e. the single
  // most common environment this portal actually runs in -- behaves like
  // private browsing and makes Web Storage access *throw*. A pile of
  // `typeof window` -guarded but un-try/catch'd storage calls on the
  // mandatory guest path therefore broke sign-in on every iPhone while
  // reading as audited-safe. The real guard is a try/catch around each
  // access (see `PortalRuntimeContext`'s safeGet/safeSet/safeRemove and
  // `src/lib/portal-returning-guest.ts`); if you are adding storage access
  // anywhere under /portal, use one of those, and do not read a `typeof
  // window` check as protection. With
  // `ssr: false`, a guest's very first response for this page was an empty
  // `<body>` (just the app-wide `InitialLoader` spinner) until the full JS
  // bundle downloaded, parsed, executed, and hydrated -- on the weak/
  // cellular connection a guest is often still on mid-handoff, that is
  // exactly the "noticeably long blank screen" the founder saw live.
  // Enabling SSR lets the server send real, branded markup (this route's
  // actual loading/welcome screen) in the first response instead.
  validateSearch: portalSearchSchema,
  // The one thing that makes every `/portal/*` navigation carry the NAS's
  // `mac`/`ip`/`dst`/`link-login-only` whether or not its author
  // remembered to. TanStack Router collects search middlewares from the
  // DESTINATION's matched route chain, so declaring it here covers every
  // route under `/portal`, from every caller. Six hand-built
  // `{ organizationId, locationId, routerId }` search objects had already
  // silently dropped the MAC in production -- see
  // `src/lib/portal-search.ts`'s docstring for the incident, and
  // `scripts/test-portal-search-retention.mjs` for the regression test.
  search: { middlewares: portalSearchMiddlewares },
  head: () => ({
    meta: [
      { title: "WyFy" },
      { name: "description", content: "Connect to complimentary guest WiFi." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1E1B4B" },
      // The guest URL carries the NAS's link-login-only target and the
      // device MAC; venue-owned assets (logo, background) are often
      // third-party hosted, and a Referer leaking that URL to their CDN
      // is exactly the class of disclosure PostLoginHtmlFrame already
      // blocks with its own no-referrer. Page-level policy covers the
      // CSS-background request (no per-request attribute exists for it).
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PortalRuntimeLayout,
  // Fallback only now -- see IncompletePortalLinkError's own doc comment.
  // A wrong-*type* param (organizationId passed as an array, say) still
  // throws a real SearchParamError zod can't coerce around, and still
  // deserves this same honest treatment rather than the generic root
  // error boundary.
  //
  // The non-SearchParamError branch used to be `__root.tsx`'s
  // `ErrorComponent` -- the customer dashboard's error screen, shown to a
  // guest. It is `PortalErrorScreen` now, for the reasons in that
  // component's own docstring. Note this boundary covers `/portal` ONLY:
  // TanStack Router does not inherit `errorComponent` to child routes, so
  // each `/portal/*` route sets it too. Adding a route under /portal means
  // adding that line -- scripts/test-portal-error-boundary.mjs fails if one
  // is missed.
  errorComponent: (props) =>
    props.error instanceof SearchParamError ? (
      <IncompletePortalLinkError />
    ) : (
      <PortalErrorScreen {...props} />
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
    clientIp,
    clientMac,
    site,
    apMac,
    ssidName,
    radioId,
    gatewayMac,
    vid,
    t,
    redirectUrl,
    netProvider: urlNetProvider,
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

  // The rest of Omada's portal redirect, exactly as the controller sent it
  // (TP-Link doc 132060, *External Portal Server, Omada Controller v6.2.10
  // or Above*), which says in as many words: "Your External Portal Server
  // must preserve and return these parameters when interacting with the
  // Omada Controller." Preserving them starts here and finishes at the
  // authorize call; `OMADA_REDIRECT_FIELD_MAP` in
  // src/lib/portal-authorize-body.ts is where each one gets the backend's
  // spelling. Nothing is derived, defaulted, coerced or renamed on the way
  // through -- an absent parameter stays absent, and a value TanStack's
  // search parser handed over as a number stays a number until the one
  // module that knows what its backend field takes.
  //
  // Memoized on the nine values rather than rebuilt inline, because
  // `PortalRuntimeProvider`'s context value is a `useMemo` over its props:
  // a fresh object identity every render would invalidate it every render
  // and re-render every portal screen with it.
  const urlOmadaRedirect = useMemo(
    () => ({ clientMac, site, apMac, ssidName, radioId, gatewayMac, vid, t, redirectUrl }),
    [clientMac, site, apMac, ssidName, radioId, gatewayMac, vid, t, redirectUrl],
  );

  // THE SECOND CHANNEL, for the same reason the three runtime IDs have one.
  //
  // `retainSearchParams` is a router middleware and covers client-side
  // navigations only. This flow performs three full document loads that
  // leave the router entirely (`portal.index.tsx`'s
  // `window.location.assign`, `portal.success.tsx`'s hotspot form POST,
  // `PortalErrorScreen`'s anchor), and an OS captive-portal re-probe can
  // reopen the portal on a bare URL in a fresh tab at any time. Each is a
  // place the controller's own parameters can fall off -- and unlike the
  // three IDs there is no `looksLikeRealId` recovery for them, because
  // only the controller ever knew what they were.
  //
  // Read once, at mount, exactly as `persistedIds` is: a value that changed
  // mid-render would make the merged object below unstable and re-render
  // every portal screen through the provider's `useMemo`.
  const [persistedOmada] = useState(() => loadPersistedOmadaContext());

  const organizationId = urlOrganizationId ?? persistedIds?.organizationId;
  const locationId = urlLocationId ?? persistedIds?.locationId;
  const routerId = urlRouterId ?? persistedIds?.routerId;

  // THE URL WINS, PER KEY. The mirror only fills a gap it left.
  //
  // Not "use the mirror when the URL looks empty" -- per key, because the
  // two redirect shapes are partial by nature (an EAP redirect carries no
  // `gatewayMac`/`vid`, a gateway redirect no `apMac`/`ssidName`/
  // `radioId`) and a whole-object fallback would restore a previous
  // association's parameters alongside this one's.
  //
  // And never the other way around. A mirror that could override a live
  // redirect would send the controller this device's PREVIOUS association
  // -- a different AP, a different radio, possibly a `clientIp` that has
  // since changed lease -- as though it were the current one. That is the
  // "a guess that happens to name a real device on that LAN" failure
  // src/lib/portal-authorize-body.ts refuses by name, and it is worse than
  // an absent value because the controller would accept it.
  const netProvider = urlNetProvider ?? persistedOmada?.netProvider;
  const effectiveClientIp = clientIp ?? persistedOmada?.clientIp;
  const omadaRedirect = useMemo(() => {
    const mirrored = persistedOmada?.redirect;
    if (!mirrored) return urlOmadaRedirect;
    const merged = { ...urlOmadaRedirect };
    for (const [key, value] of Object.entries(mirrored)) {
      if (merged[key as keyof typeof merged] === undefined && value !== undefined) {
        merged[key as keyof typeof merged] = value as string | number;
      }
    }
    return merged;
  }, [urlOmadaRedirect, persistedOmada]);

  // Persist a genuinely-complete URL's three IDs so the fallback above has
  // something real to fall back to on a later load. Only ever writes what
  // the URL itself just supplied -- never the merged/fallback values above
  // -- so a stale persisted ID can't perpetuate itself once a fresh, real
  // link (a different router, say) provides a new one.
  useEffect(() => {
    if (
      looksLikeRealId(urlOrganizationId) &&
      looksLikeRealId(urlLocationId) &&
      looksLikeRealId(urlRouterId)
    ) {
      persistRuntimeIds({
        organizationId: urlOrganizationId,
        locationId: urlLocationId,
        routerId: urlRouterId,
      });
    }
  }, [urlOrganizationId, urlLocationId, urlRouterId]);

  // Mirror the controller's context, and ONLY what this URL itself just
  // supplied -- never the merged values above, so a mirrored parameter
  // cannot perpetuate itself across a fresh redirect that dropped it.
  //
  // Gated on `urlNetProvider`, which is present only because the backend
  // baked it into the External Portal Server URL the venue's operator
  // pasted into their controller (`validators.build_external_portal_url`).
  // That is what keeps a MikroTik venue from ever writing this key, and
  // what makes "there is a mirror" and "this guest came through an Omada
  // controller" the same statement.
  //
  // It used to say "`/omada/$token`'s loader stamps it". That route was
  // designed and then deliberately not built: the path-token entry hop
  // existed only to work around a misreading of doc 132060's redirect
  // TEMPLATE, which was taken as evidence that a controller might join its
  // parameters to a configured query string with a second `?`. Hardware
  // said otherwise -- it joins with `&` -- so Omada guests land on this
  // same `/portal` route as MikroTik guests, with no second entry point.
  // There is no `/omada/$token` route, no loader and no backend half; see
  // ~/wyfy-omada/GUEST-BRIDGE-CONTRACT.md §1.
  useEffect(() => {
    if (!urlNetProvider) return;
    persistOmadaContext({
      netProvider: urlNetProvider,
      clientIp,
      redirect: urlOmadaRedirect,
    });
  }, [urlNetProvider, clientIp, urlOmadaRedirect]);

  if (
    !looksLikeRealId(organizationId) ||
    !looksLikeRealId(locationId) ||
    !looksLikeRealId(routerId)
  ) {
    return <IncompletePortalLinkError />;
  }

  return (
    <PortalRuntimeProvider
      organizationId={organizationId}
      locationId={locationId}
      routerId={routerId}
      deviceMac={mac}
      deviceIp={ip}
      // Omada's `clientIp`, straight off the controller's own redirect and
      // deliberately a separate prop from `deviceIp` (RouterOS's `$(ip)`)
      // -- see `portalSearchShape.clientIp` in src/lib/portal-search.ts for
      // why the two vendors' addresses are never substituted for one
      // another. Passed through untouched: this route captures, it does not
      // derive.
      clientIp={effectiveClientIp}
      // The other nine, grouped -- see the `omadaRedirect` memo above, and
      // `PortalRuntimeState.omadaRedirect` for why this one is an object
      // where `clientIp` is a flat prop (doc 132060's `t` collides with the
      // context's own i18n `t`).
      omadaRedirect={omadaRedirect}
      // Which vendor's gate `/portal/success` has to open. Baked into the
      // configured portal URL by the backend, which read the provider off
      // the integration row, mirrored alongside the controller's own
      // parameters, and never inferred here from which of them survived.
      netProvider={netProvider}
      destinationUrl={dst}
      hotspotLoginUrl={linkLoginOnly}
    >
      <Outlet />
    </PortalRuntimeProvider>
  );
}
