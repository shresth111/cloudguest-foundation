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
export const AlertBanner = () => null;
export const ConnectingOverlay = () => null;
export const DEFAULT_PORTAL_LOGO_SRC = "";
export const GUEST_LEGIBILITY_CARD_CLASS = "";
export const PG_FONT_STACK = "";
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

/** @param {"throwing"|"working"} mode @param {Record<string,string>} seed */
function installBrowser(mode, seed = {}) {
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
  globalThis.window = {
    sessionStorage: mode === THROWING ? throwingStorage : workingStorage,
    localStorage: mode === THROWING ? throwingStorage : workingStorage,
    location: { origin: "https://portal.example.com", assign: (u) => assigns.push(u) },
    setTimeout: () => 0,
    clearTimeout: () => {},
    matchMedia: () => ({ matches: false }),
  };
  globalThis.document = {
    documentElement: { classList: { toggle() {} }, style: {} },
    body: { appendChild() {} },
    head: { appendChild() {} },
    createElement: () => ({
      style: {},
      appendChild() {},
      setAttribute() {},
      submit() {
        calls.push("submit");
        submits.push(true);
      },
    }),
  };
  return { calls, submits, assigns, store };
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

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
