/**
 * Regression test for the iPhone captive-portal sign-in failure.
 *
 * FAILURE MODE THIS LOCKS DOWN: Apple's Captive Network Assistant (the
 * websheet iOS opens for a WiFi login) treats Web Storage like private
 * browsing -- `sessionStorage`/`localStorage` *throw* on access rather
 * than returning null. `/portal/success` used to call
 * `persistHotspotSubmit(...)` on the line immediately BEFORE
 * `submitHotspotLogin(...)`, so that throw aborted `attemptSubmit` before
 * the form POST that opens the NAS gate ever fired. The guest entered a
 * correct OTP, the backend really created the session, and the portal sat
 * on "Just a moment" forever with no internet -- matching the recurring
 * "OTP verifies but no real internet" support reports.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (no vitest/jest, no
 * `test` script) and `node_modules` is a symlink shared with the main
 * checkout, so adding one for a production hotfix was not on the table.
 * Instead this bundles the real `src/routes/portal.success.tsx` with
 * esbuild (already present transitively via vite), substituting only the
 * framework/UI edges -- React, the router, the query client, the shell
 * components -- and keeps the code under test real: the actual
 * `attemptSubmit`, the actual `submitHotspotLogin`, the actual
 * `PortalRuntimeContext` persistence helpers and the actual
 * `buildSessionUrl`.
 *
 * Run: node scripts/test-portal-cna-storage-safety.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "cna-storage-test-"));

// --- stubs for everything that is not the code under test -------------
// A tiny synchronous React: render the component once, collect its
// effects, then run them by hand. Enough to exercise `attemptSubmit`,
// which is all this test is about.
const REACT_STUB = `
export function useState(init) {
  return [typeof init === "function" ? init() : init, () => {}];
}
export function useRef(v) { return { current: v }; }
export function useEffect(fn) { globalThis.__H.effects.push(fn); }
export function useCallback(fn) { return fn; }
export function useMemo(fn) { return fn(); }
export function useContext() { return globalThis.__H.runtime; }
export function createContext() { return { Provider: () => null }; }
export default { useState, useRef, useEffect, useCallback, useMemo, useContext, createContext };
`;
const JSX_STUB = `
export function jsx() { return null; }
export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = "Fragment";
`;
const ROUTER_STUB = `
export function createFileRoute() { return (opts) => opts; }
export function useNavigate() {
  return (...args) => globalThis.__H.navigateCalls.push(args);
}
export function Link() { return null; }
// portal.success.tsx now sets \`errorComponent: PortalErrorScreen\`, which
// pulls that component into this bundle, and it calls \`useRouter\` for its
// retry. Enumerated here for the reason spelled out below: a named import
// with no matching stub export fails the esbuild BUILD, and this suite then
// asserts nothing at all -- the exact way it broke once already.
export function useRouter() { return { invalidate() {} }; }
`;
const QUERY_STUB = `
export function useQuery() { return { data: undefined, isLoading: false, error: undefined }; }
export function useQueryClient() { return { invalidateQueries() {} }; }
`;
// Named exports have to be enumerated: esbuild resolves ESM named imports
// statically, so a `default` Proxy alone does not satisfy them and the
// whole build fails rather than degrading. This gate was silently
// *erroring out* on `origin/main` -- `portal.success.tsx` grew an import of
// `GUEST_LEGIBILITY_CARD_CLASS` (v7 Part 1's legibility plate) that no stub
// exported, so `npm run test:portal-cna` had stopped testing anything at
// all. It is the regression test for the confirmed-live "OTP verifies but
// no real internet" incident; it must not be allowed to fail open. Add a
// named export here whenever a stubbed module gains one.
const NOOP_COMPONENT_STUB = `
export const PortalShell = () => null;
export const PortalCard = () => null;
export const PortalTextPlate = () => null;
export const PortalConnectingState = () => null;
export const GUEST_LEGIBILITY_CARD_CLASS = "pg-legibility-card-stub";
export const PG_FONT_STACK = "sans-serif";
export const DEFAULT_PORTAL_LOGO_SRC = "/brand/mark-compact-blue.svg";
export const AlertBanner = () => null;
export const ConnectingOverlay = () => null;
export const PG_INPUT = "";
export const PG_PRIMARY_BTN = "";
export default new Proxy({}, { get: () => () => null });
`;
const ICONS_STUB = `export default new Proxy({}, { get: () => () => null });
export const RefreshCw = () => null;
export const Wifi = () => null;
`;
const SERVICE_STUB = `export const portalRuntimeService = {
  resolveConfig: async () => undefined,
  checkActiveSession: async () => undefined,
};
`;

const stub = (name, contents) => {
  const file = join(work, name);
  writeFileSync(file, contents);
  return file;
};

const entry = join(work, "entry.js");
writeFileSync(
  entry,
  `export { Route } from ${JSON.stringify(join(SRC, "routes/portal.success.tsx"))};\n`,
);

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "neutral",
  jsx: "automatic",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: {
    react: stub("react-stub.js", REACT_STUB),
    "react/jsx-runtime": stub("jsx-stub.js", JSX_STUB),
    "@tanstack/react-router": stub("router-stub.js", ROUTER_STUB),
    "@tanstack/react-query": stub("query-stub.js", QUERY_STUB),
    "lucide-react": stub("icons-stub.js", ICONS_STUB),
    "@/components/portal-runtime/PortalShell": stub("shell-stub.js", NOOP_COMPONENT_STUB),
    "@/components/portal-runtime/PortalGuestUi": stub("ui-stub.js", NOOP_COMPONENT_STUB),
    "@/services/portal-runtime.service": stub("service-stub.js", SERVICE_STUB),
    "@": SRC,
  },
});

const { Route } = await import(join(work, "bundle.mjs"));
const SuccessPage = Route.component;

// --- fake browser -----------------------------------------------------
const THROWING = "throwing";

/**
 * Replaces the global `navigator` for the duration of one case.
 *
 * `isAppleCaptiveClient()` reads the BARE global, not `window.navigator`,
 * and on Node `globalThis.navigator` is an accessor -- a plain assignment
 * is silently discarded (verified: it keeps returning `Node.js/26`), which
 * would make every Apple-branch check below pass vacuously against a
 * non-Apple UA. `defineProperty` is what actually replaces it.
 *
 * @param {"apple"|"android"|"none"} kind
 */
function installNavigator(kind) {
  const value =
    kind === "apple"
      ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)", maxTouchPoints: 5 }
      : kind === "android"
        ? { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)", maxTouchPoints: 5 }
        : undefined;
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

/**
 * @param {"throwing"|"working"} mode
 * @param {Record<string,string>} seed
 * @param {string} search location.search for this case -- the NAS page
 *   marker (`hspage`) rides on it, and `attemptSubmit` reads it live
 *   because this page is reachable both as a client-side hop and as a
 *   fresh document the NAS navigated to.
 */
function installBrowser(mode, seed = {}, search = "") {
  const store = new Map(Object.entries(seed));
  const throwingStorage = {
    getItem() {
      throw new DOMExceptionish("SecurityError");
    },
    setItem() {
      throw new DOMExceptionish("SecurityError");
    },
    removeItem() {
      throw new DOMExceptionish("SecurityError");
    },
  };
  const workingStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const calls = [];
  const submits = [];
  const assigns = [];
  // Every field `submitHotspotLogin` builds, so a case can assert on the
  // `dst` the NAS is actually told to redirect to. Without this the stub
  // swallowed the fields and the Apple hand-off -- the whole subject of
  // cases 4-7 below -- was untestable.
  const posted = [];
  globalThis.window = {
    sessionStorage: mode === THROWING ? throwingStorage : workingStorage,
    localStorage: mode === THROWING ? throwingStorage : workingStorage,
    location: {
      origin: "https://portal.example.com",
      search,
      assign: (u) => assigns.push(u),
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    matchMedia: () => ({ matches: false }),
  };
  globalThis.document = {
    documentElement: { classList: { toggle() {} }, style: {} },
    body: { appendChild() {} },
    head: { appendChild() {} },
    createElement: () => {
      const el = {
        style: {},
        fields: {},
        appendChild(child) {
          if (child && typeof child.name === "string") el.fields[child.name] = child.value;
        },
        setAttribute() {},
        submit() {
          calls.push("submit");
          submits.push(true);
          posted.push({ action: el.action, ...el.fields });
        },
      };
      return el;
    },
  };
  return { calls, submits, assigns, posted, store };
}
class DOMExceptionish extends Error {}

/** Renders SuccessPage once and runs its mount effects, like React would. */
function renderAndRunEffects(runtime) {
  globalThis.__H = { effects: [], navigateCalls: [], runtime };
  SuccessPage();
  for (const effect of globalThis.__H.effects) effect();
  return globalThis.__H;
}

const RUNTIME = {
  session: { id: "s-1", identifier: "+919876543210" },
  organizationId: "org-1",
  locationId: "loc-1",
  routerId: "rtr-1",
  hotspotLoginUrl: "http://10.5.50.1/login",
  guestIdentifier: "+919876543210",
  t: (k) => k,
};

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

console.log("portal captive-network-assistant storage safety");

// 1. THE REGRESSION. Storage throws on every access, exactly as it does
//    inside iOS's CNA websheet. The hotspot POST must still happen.
{
  const browser = installBrowser(THROWING);
  let threw = null;
  try {
    renderAndRunEffects(RUNTIME);
  } catch (e) {
    threw = e;
  }
  check("render + mount effects do not throw when storage throws", threw === null, String(threw));
  check(
    "submitHotspotLogin still fires when sessionStorage throws",
    browser.submits.length === 1,
    `form.submit() called ${browser.submits.length}x`,
  );
}

// 2. Ordering: the gate-opening POST must not be behind the bookkeeping
//    write. Proven by the write landing after the submit.
{
  const browser = installBrowser("working");
  renderAndRunEffects(RUNTIME);
  check("submitHotspotLogin fires with working storage", browser.submits.length === 1);
  check(
    "cooldown is still recorded (after the submit, not before)",
    browser.store.has("cloudguest_portal_hotspot_submit"),
  );
}

// 3. Cooldown skip must be a real document load, not client-side routing:
//    a `navigate()` here paints "you're online" without ever asking the
//    network whether the NAS gate is actually open.
{
  const browser = installBrowser("working", {
    cloudguest_portal_hotspot_submit: JSON.stringify({
      identifier: RUNTIME.guestIdentifier,
      at: Date.now(),
    }),
  });
  const h = renderAndRunEffects(RUNTIME);
  check("recent submit suppresses a duplicate POST", browser.submits.length === 0);
  check(
    "cooldown skip is a document load to /portal/session",
    browser.assigns.length === 1 &&
      browser.assigns[0].startsWith("https://portal.example.com/portal/session?"),
    JSON.stringify(browser.assigns),
  );
  check(
    "cooldown skip does not client-side navigate to /portal/session",
    !h.navigateCalls.some((args) => JSON.stringify(args).includes("/portal/session")),
    JSON.stringify(h.navigateCalls),
  );
}

// =====================================================================
// 4-10. THE NAS HAND-OFF: "10.5.50.1 redirecting to captive.apple.com,
//       also only showing success".
//
// Founder's QA pass, live router. Both of those reports are one chain.
// `captive.apple.com/hotspot-detect.html` is Apple's own captive-detection
// endpoint and its entire body is the word `Success` -- so "redirecting to
// captive.apple.com" and "the login redirect is just a message 'success'"
// are the same screen, described from two ends. It is not our page, it
// carries no venue branding, no countdown and no way back.
//
// The redirect itself is deliberate and must NOT be deleted: inside iOS's
// Captive Network Assistant that body is what makes the sheet mark the
// network online and dismiss, and a MacBook was confirmed live reaching
// full internet through it. The defect was that it was chosen by
// `isAppleCaptiveClient()`, a USER-AGENT test, which cannot tell the CNA
// websheet apart from ordinary Safari on the same iPhone -- so an
// already-connected guest who simply opened the gateway address got a
// pointless re-login and then Apple's diagnostic page.
//
// The fix is to ask the router instead: RouterOS serves `alogin.html` /
// `status.html` ONLY to a client its hotspot has already authorized, and
// those pages now stamp `hspage` on the portal URL. These cases drive the
// REAL `attemptSubmit` over both answers and over the third one that
// matters most -- "the router did not say", which is every device in the
// field until it is re-provisioned, and which must behave exactly as it
// does today.
{
  const APPLE = "http://captive.apple.com/hotspot-detect.html";
  const SESSION_PREFIX = "https://portal.example.com/portal/session?";

  // 4 + 5. The router says this client is already through the gate.
  for (const page of ["status", "alogin"]) {
    installNavigator("apple");
    const browser = installBrowser("working", {}, `?hspage=${page}&organizationId=org-1`);
    renderAndRunEffects(RUNTIME);
    check(
      `hspage=${page}: no hotspot POST -- the NAS already authorized this client`,
      browser.submits.length === 0,
      `form.submit() called ${browser.submits.length}x for a client that is already online`,
    );
    check(
      `hspage=${page}: lands on the real /portal/session, not Apple's page`,
      browser.assigns.length === 1 && browser.assigns[0].startsWith(SESSION_PREFIX),
      JSON.stringify(browser.assigns),
    );
    check(
      `hspage=${page}: never navigates an ordinary browser to captive.apple.com`,
      !browser.assigns.some((u) => u.startsWith(APPLE)) &&
        !browser.posted.some((p) => p.dst === APPLE),
      "this is the founder's screenshot: a bare page reading only 'Success'",
    );
  }

  // 6. A FRESH login on the same device. The CNA hand-off is the
  //    confirmed-live fix for the captive sheet and must survive untouched
  //    -- this check exists so nobody "fixes" the above by deleting it.
  //    The discriminator is now Web Storage, not the user agent: the CNA
  //    websheet THROWS on storage access, ordinary Safari on the same
  //    iPhone does not. So this case uses THROWING storage to stand in for
  //    the sheet, and asserts the Apple hand-off fires for exactly that
  //    context (see case 7 for the ordinary-Safari opposite).
  {
    installNavigator("apple");
    const browser = installBrowser(THROWING, {}, "?hspage=login&organizationId=org-1");
    renderAndRunEffects(RUNTIME);
    check(
      "hspage=login: the gate-opening POST still fires",
      browser.submits.length === 1,
      `form.submit() called ${browser.submits.length}x`,
    );
    check(
      "hspage=login in the CNA (throwing storage): handed to captive.apple.com so the sheet closes",
      browser.posted.length === 1 && browser.posted[0].dst === APPLE,
      JSON.stringify(browser.posted),
    );
  }

  // 6b. The SAME fresh login in ORDINARY Safari -- an iPhone whose storage
  //     works. The user agent is identical to the CNA's, but the sheet is
  //     not what is looking: this is a real browser on the same device, and
  //     it must land on the real /portal/session page (Android behaviour),
  //     never on Apple's bare "Success" diagnostic page. This is the
  //     founder's "login redirect is just a message 'success'" report.
  {
    installNavigator("apple");
    const browser = installBrowser("working", {}, "?hspage=login&organizationId=org-1");
    renderAndRunEffects(RUNTIME);
    check(
      "hspage=login in ordinary Safari (working storage): the gate-opening POST still fires",
      browser.submits.length === 1,
      `form.submit() called ${browser.submits.length}x`,
    );
    check(
      "hspage=login in ordinary Safari: dst is the real /portal/session, not Apple's page",
      browser.posted.length === 1 &&
        browser.posted[0].dst.startsWith("https://portal.example.com/portal/session?"),
      JSON.stringify(browser.posted),
    );
  }

  // 7. THE WHOLE FLEET TODAY. No router in the field stamps `hspage` yet
  //    -- those pages live in the device's own flash/hotspot/ directory
  //    and this repo cannot deploy to one. "Absent" must therefore mean
  //    "the router did not say" and degrade to exactly today's behaviour,
  //    never to "not authorized" and never to "authorized".
  {
    installNavigator("apple");
    const browser = installBrowser("working", {}, "?organizationId=org-1");
    renderAndRunEffects(RUNTIME);
    check(
      "no hspage (every router in the field today): behaviour is unchanged -- POST fires",
      browser.submits.length === 1,
      `form.submit() called ${browser.submits.length}x`,
    );
    check(
      "no hspage in ordinary Safari (working storage): the Apple hand-off does NOT fire -- real page instead",
      browser.posted.length === 1 &&
        browser.posted[0].dst.startsWith("https://portal.example.com/portal/session?"),
      JSON.stringify(browser.posted),
    );
    check(
      "no hspage in the CNA (throwing storage): the Apple hand-off still fires",
      (() => {
        const b2 = installBrowser(THROWING, {}, "?organizationId=org-1");
        renderAndRunEffects(RUNTIME);
        return b2.posted.length === 1 && b2.posted[0].dst === APPLE;
      })(),
      "the CNA must still be handed to captive.apple.com to close",
    );
  }

  // 8. A value outside the closed set -- a stale link, a guest editing the
  //    address bar. Must be read as "did not say", never as "authorized":
  //    treating it as authorized would skip the one POST that opens the
  //    gate, on the word of an untrusted query param.
  {
    installNavigator("apple");
    const browser = installBrowser("working", {}, "?hspage=totallybogus&organizationId=org-1");
    renderAndRunEffects(RUNTIME);
    check(
      "an unrecognized hspage never suppresses the gate-opening POST",
      browser.submits.length === 1,
      "an untrusted query value must not be able to leave a guest with no internet",
    );
  }

  // 9. The already-authorized branch must not depend on Web Storage.
  //    Inside the CNA, storage THROWS rather than returning null -- the
  //    original incident this whole suite exists for. The branch runs
  //    before any persistence call for exactly that reason.
  {
    installNavigator("apple");
    const browser = installBrowser(THROWING, {}, "?hspage=status&organizationId=org-1");
    let threw = null;
    try {
      renderAndRunEffects(RUNTIME);
    } catch (e) {
      threw = e;
    }
    check("hspage=status still works when storage throws", threw === null, String(threw));
    check(
      "hspage=status with throwing storage still reaches /portal/session",
      browser.assigns.length === 1 && browser.assigns[0].startsWith(SESSION_PREFIX),
      JSON.stringify(browser.assigns),
    );
  }

  // 10. A guest whose `guestIdentifier` was lost to a reload, on a router
  //     that says the gate is open. This used to sit on the "Just a
  //     moment" spinner until the 15s escape hatch appeared -- there is
  //     nothing to POST, so nothing was ever in flight -- while their
  //     internet already worked perfectly. The router's answer needs no
  //     identifier, which is why the branch sits above that guard.
  {
    installNavigator("apple");
    const browser = installBrowser("working", {}, "?hspage=alogin&organizationId=org-1");
    const { ...runtime } = RUNTIME;
    delete runtime.guestIdentifier;
    renderAndRunEffects(runtime);
    check(
      "hspage=alogin with no guestIdentifier still leaves the spinner",
      browser.assigns.length === 1 && browser.assigns[0].startsWith(SESSION_PREFIX),
      JSON.stringify(browser.assigns),
    );
  }

  installNavigator("none");
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
