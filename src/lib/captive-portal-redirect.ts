/**
 * A captive-portal redirect must never resolve to a staff sign-in form.
 *
 * ## THE DEFECT THIS EXISTS TO CLOSE
 *
 * Observed in a browser against production, 2026-09-12:
 *
 *     https://auth.wyfyguest.com/?clientMac=02-00-00-DE-AD-01
 *       &clientIp=103.84.202.195&t=1789106825&site=6aa3913c3ee1605f71ac35a1
 *       &redirectUrl=http%3A%2F%2Fneverssl.com%2F&apMac=B8-FB-B3-5D-64-3E
 *       &ssidName=WyfyGuest&radioId=1
 *
 * rendered the OPERATOR sign-in page -- "I'm signing in as Owner / Staff",
 * email + password. One path segment off `/portal` and a guest on the
 * venue's WiFi, who did nothing but join it, is handed a credential form
 * for that venue's own dashboard.
 *
 * That is phishing-shaped in a way no ordinary 404 is. The guest did not
 * type the URL; a captive-portal interception opened it for them, inside
 * the OS's own Captive Network Assistant sheet on iOS and Android, with the
 * venue's branding around it. A sign-in form appearing there teaches guests
 * that joining WiFi is a moment when a password prompt is normal -- and the
 * form on screen is real, so a harvested credential is a real dashboard
 * credential. It is reachable by any wireless client, with no attacker
 * needed at all: an operator who pastes `auth.wyfyguest.com` into the
 * controller instead of `auth.wyfyguest.com/portal?...` produces it for
 * every guest at that venue, permanently, and nothing in either product
 * reports it.
 *
 * ## WHY THE BARE HOST IS A REALISTIC LANDING, NOT A TYPO
 *
 * The External Portal Server setting is two fields -- `serverUrlScheme` and
 * `serverUrl` -- and `serverUrl` is free text the operator types by hand
 * (see `validators.build_external_portal_url` on the backend, and
 * `OmadaPortalSetupSteps`). Omada's own field pattern accepts a bare host
 * with no path. So `auth.wyfyguest.com` is a value the controller will
 * happily store, and the controller then appends its own parameters to it
 * -- producing exactly the URL above. The same is true of a RouterOS
 * override page whose `location.replace()` lost its path.
 *
 * ## THE RULE
 *
 * A request carrying a vendor captive-portal parameter is unambiguously a
 * captive-portal redirect. There is no second reading of `clientMac`,
 * `apMac`, `ssidName` or `link-login-only` on this app: nothing else in
 * this product has ever put one of them on a URL, and no human types them.
 * Such a request is sent to `/portal` with its parameters intact, and never
 * rendered as a sign-in form.
 *
 * Sending it to `/portal` rather than to a 404 is deliberate and is the
 * better half of the fix: `/portal` is where the guest was going. When the
 * redirect carries the three ids (`organizationId`/`locationId`/`routerId`)
 * -- i.e. the operator pasted the full URL but dropped the `/portal` path
 * segment -- the guest simply gets online. When it does not, `/portal`
 * renders `IncompletePortalLinkError`, which is a guest-shaped dead end
 * that tells them to ask venue staff. Either is correct; a staff login is
 * not.
 *
 * ## STRONG AND WEAK MARKERS, AND WHY THE DISTINCTION IS NOT CLEVERNESS
 *
 * A false positive here sends a legitimate operator to `/portal`, which for
 * them is a dead end. So the trigger has to be something an operator's URL
 * cannot accidentally be.
 *
 * STRONG markers are vendor-specific spellings with no other meaning
 * anywhere in this app -- `clientMac`, `apMac`, `gatewayMac`, `ssidName`,
 * `clientIp`, `radioId`, `link-login-only`, `hspage`, `netProvider`. Any
 * ONE of them is enough.
 *
 * WEAK markers are real captive-portal parameters whose names are ordinary
 * words -- `site`, `t`, `vid`, `redirectUrl`, `mac`, `ip`, `dst`. Any TWO
 * of them together are enough; one alone is not, because `?t=...` on its
 * own is as likely to be a tracking parameter as a controller's timestamp.
 *
 * This is not a hedge about what Omada sends. A real Omada redirect always
 * carries `clientMac` -- the controller's own `/portal/entry` returns 400
 * when `cid` is omitted (verified on hardware, 2026-09-12), so the strong
 * set fires on every genuine one. The weak set exists only so that a
 * mangled or truncated redirect, or a vendor shape nobody has seen yet,
 * still fails towards the portal instead of towards a password box.
 */
import { PORTAL_SEARCH_KEYS, type PortalSearch } from "./portal-search";

/**
 * Parameters whose presence, on its own, proves a captive-portal redirect.
 *
 * Every one of these is either a vendor's own spelling (TP-Link doc 132060
 * for the Omada set; RouterOS's `$(link-login-only)` substitution) or this
 * platform's own stamp on the URL an operator pasted (`netProvider`,
 * `hspage`). None is a word a human would put on a URL by hand, and none
 * appears in any other `validateSearch` in this app -- checked, not assumed.
 */
export const STRONG_CAPTIVE_PORTAL_MARKERS = [
  "clientMac",
  "clientIp",
  "apMac",
  "gatewayMac",
  "ssidName",
  "radioId",
  "netProvider",
  "link-login-only",
  "hspage",
] as const;

/**
 * Real captive-portal parameters with ordinary-word names. Two or more
 * together are proof; one alone is not.
 */
export const WEAK_CAPTIVE_PORTAL_MARKERS = [
  "site",
  "t",
  "vid",
  "redirectUrl",
  "mac",
  "ip",
  "dst",
] as const;

/**
 * Does this URL's search belong to a guest a NAS or controller intercepted?
 *
 * Key presence only. Values are never inspected: TanStack Router's default
 * search parser runs `JSON.parse` over every raw value, so `radioId=1`
 * arrives as the NUMBER 1 and `site=5` as a number too (see
 * `portal-search.ts`). Testing a value's type here would reintroduce
 * exactly the trap that file documents at length.
 */
export function isCaptivePortalRedirect(search: Record<string, unknown> | undefined): boolean {
  if (!search) return false;
  const keys = Object.keys(search);
  if (keys.length === 0) return false;
  const present = new Set(keys);
  if (STRONG_CAPTIVE_PORTAL_MARKERS.some((k) => present.has(k))) return true;
  return WEAK_CAPTIVE_PORTAL_MARKERS.filter((k) => present.has(k)).length >= 2;
}

/**
 * The subset of a captured search that `/portal` actually accepts.
 *
 * Derived from `PORTAL_SEARCH_KEYS`, which is itself derived from
 * `portalSearchShape` -- so a parameter added to the portal's schema is
 * carried through this redirect from the moment it exists, and there is no
 * second list to keep in sync. Anything `/portal` does not declare would be
 * dropped by its own `z.object` a moment later anyway; dropping it here
 * keeps the redirect's URL honest about what survived.
 */
export function portalSearchFrom(search: Record<string, unknown>): PortalSearch {
  const out: Record<string, unknown> = {};
  for (const key of PORTAL_SEARCH_KEYS) {
    if (key in search && search[key] !== undefined) out[key] = search[key];
  }
  return out as PortalSearch;
}

/**
 * The `redirect()` argument for a captive-portal redirect that landed on a
 * non-portal route, or `null` when this is an ordinary visitor.
 *
 * Installed as a `beforeLoad` guard on every route that can render a
 * sign-in form -- `/`, `/login`, `/master-login`. `beforeLoad` rather than
 * an effect inside the component is the whole point: these routes are
 * server-rendered, so the guard runs on the server and the guest receives a
 * redirect instead of a document. The staff form is never sent to their
 * device at all, not even for the frame before an effect could navigate
 * away.
 */
export function captivePortalRedirect(
  search: Record<string, unknown> | undefined,
): { to: "/portal"; search: PortalSearch; replace: true } | null {
  if (!isCaptivePortalRedirect(search)) return null;
  return { to: "/portal", search: portalSearchFrom(search ?? {}), replace: true };
}
