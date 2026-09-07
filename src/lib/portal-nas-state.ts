/**
 * WHICH OF ROUTEROS'S OWN HOTSPOT PAGES SENT THIS BROWSER HERE -- and the
 * one thing only that page knows: whether the NAS gate is already open for
 * this client.
 *
 * ## THE DEFECT THIS EXISTS TO FIX
 *
 * Founder's QA pass, on the live Haldwani router: opening the gateway
 * address `10.5.50.1` from an already-connected iPhone ended on a bare
 * white page reading, in full, the single word `Success`. Two reports
 * ("10.5.50.1 redirecting to captive.apple.com" and "login redirect is
 * just a message 'success'") are the same chain, seen from two ends.
 *
 * That page is not ours. It is Apple's own captive-detection endpoint,
 * `http://captive.apple.com/hotspot-detect.html`, whose entire body is
 * `<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>`.
 * `portal.success.tsx` navigates there deliberately: inside iOS's Captive
 * Network Assistant that body is what makes the sheet mark the network
 * online and dismiss itself, which is the whole reason the redirect exists
 * (see `APPLE_CAPTIVE_SUCCESS_URL`'s own docstring, and the confirmed-live
 * incident behind it -- it must NOT simply be deleted).
 *
 * The bug is not the redirect. It is that the redirect was chosen by
 * `isAppleCaptiveClient()`, a USER-AGENT test. A user agent answers "is
 * this an Apple touch device". It cannot answer "is this the CNA websheet
 * or is it ordinary Safari", and those two need opposite treatment:
 *
 *   - CNA websheet   -> Apple's URL is right. The sheet dismisses and the
 *                       guest goes on with their own browser. They never
 *                       see the page at all.
 *   - ordinary Safari -> Apple's URL is a dead end. The guest is dropped
 *                       on a diagnostic page with no venue branding, no
 *                       session countdown, no disconnect button, and no
 *                       way back. This is the founder's screenshot.
 *
 * ## THE SIGNAL THAT DOES ANSWER IT
 *
 * Not the browser -- the router. RouterOS serves a DIFFERENT stock page
 * depending on whether the requesting client is already through its
 * hotspot gate, and this platform overrides all five of them
 * (`PORTAL_OVERRIDE_FILES` in cloudguest-foundation's
 * `RouterDetailTabs.tsx`) with a redirect into this SPA:
 *
 *   login.html / rlogin.html  -> served ONLY to an unauthenticated client.
 *                                Gate shut. A hotspot-login POST is
 *                                required, and on iOS the CNA websheet is
 *                                the thing looking at this page.
 *   alogin.html / status.html -> served ONLY to a client the hotspot has
 *                                ALREADY authorized. Gate open. There is
 *                                nothing to POST -- and the CNA, if there
 *                                ever was one, dismissed itself when the
 *                                gate opened, so whatever is looking at
 *                                this page is a real browser.
 *   logout.html               -> served right after a real logout, so the
 *                                client is unauthenticated again.
 *
 * The router is the only party that knows this, it knows it for certain,
 * and it already tells us which page it served -- as soon as that page
 * says so. `buildPortalUrl` now stamps `hspage=<basename>` onto the portal
 * URL each override page redirects to.
 *
 * ## WHY THIS FILE IS PURE, AND WHY IT DEGRADES TO TODAY'S BEHAVIOUR
 *
 * Pure so `scripts/test-portal-cna-storage-safety.mjs` can bundle the real
 * `portal.success.tsx` and drive the real decision, the same property
 * `portal-post-connect.ts` documents at length for its own rules.
 *
 * Degrading matters more. Every router already in the field was set up by
 * a generator that did not emit `hspage`, and this repo cannot deploy to
 * one -- the pages live in the device's own `flash/hotspot/` directory.
 * So the answer here is deliberately three-valued: `true`, `false`, and
 * `undefined` for "the router did not say". `undefined` must never be
 * read as `false`; every caller keeps its existing behaviour until a
 * router is re-provisioned, and gains the fix the moment one is.
 */

/** The search-param name. Declared in `portal-search.ts`'s schema too, so
 * `retainSearchParams` carries it across every client-side hop between the
 * NAS's document load and `/portal/success` (welcome -> auth -> verify ->
 * success). Without that it would survive the first navigation and no
 * more -- the exact failure `portal-search.ts`'s own docstring records for
 * `mac`/`link-login-only`. */
export const NAS_PAGE_PARAM = "hspage";

/** RouterOS's five stock hotspot pages, by basename minus `.html` --
 * exactly the set `PORTAL_OVERRIDE_FILES` overrides, and the only values
 * this platform ever stamps. */
export type NasPage = "login" | "rlogin" | "alogin" | "status" | "logout";

const NAS_PAGES: readonly string[] = ["login", "rlogin", "alogin", "status", "logout"];

/** The two pages RouterOS serves ONLY to a client its hotspot has already
 * authorized. `logout` is deliberately NOT here: it is served after a real
 * `$(link-logout)`, at which point the client is unauthenticated again. */
const AUTHORIZED_PAGES: readonly string[] = ["alogin", "status"];

/** Validates an untrusted query value against the closed set above.
 * Anything else -- a stale link, a hand-typed URL, a guest editing the
 * address bar -- is `undefined`, i.e. "the router did not say", never a
 * guess. */
export function parseNasPage(raw: string | null | undefined): NasPage | undefined {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  return NAS_PAGES.includes(value) ? (value as NasPage) : undefined;
}

/**
 * Has the NAS already authorized this client?
 *
 * `true`  -- certain, asserted by the router itself.
 * `false` -- certain, likewise.
 * `undefined` -- the router did not say (a device provisioned before
 *                `hspage` existed). Callers must fall back to whatever
 *                they did before, NOT to `false`.
 */
export function nasAuthorizedFromPage(raw: string | null | undefined): boolean | undefined {
  const page = parseNasPage(raw);
  if (page === undefined) return undefined;
  return AUTHORIZED_PAGES.includes(page);
}

/**
 * The same answer, read straight off a location search string.
 *
 * Takes the raw string rather than reading `window` itself so it stays
 * pure and testable -- and because the one caller that matters
 * (`portal.success.tsx`'s `attemptSubmit`) runs inside an effect, where
 * `window.location.search` is the honest source: this page can be reached
 * either by a client-side hop carrying the param through
 * `retainSearchParams`, or as a brand-new document the NAS itself
 * navigated to, and only the live URL covers both.
 */
export function nasAuthorizedFromSearch(search: string): boolean | undefined {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return undefined;
  }
  return nasAuthorizedFromPage(params.get(NAS_PAGE_PARAM));
}
