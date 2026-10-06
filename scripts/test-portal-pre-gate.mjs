/**
 * THE PRE-GATE PHASE: arrival content (offer/survey, profile ask) runs
 * BEFORE the NAS gate opens, because both phones' captive sign-in sheets
 * close themselves the moment it does.
 *
 * QA 2026-10-06, Aruba Instant On venue: "Auto closing login screen in
 * android just after login, not showing the offer/survey or anything."
 * AOSP `CaptivePortalLoginActivity` re-probes on every page start/finish
 * and calls `done(Result.DISMISSED)` the instant the network validates, so
 * the gate's own navigation to `/portal/session` is what closes the sheet.
 * See src/lib/portal-pre-gate.ts for the full account and sources.
 *
 * What this locks down, against the REAL code (bundled with esbuild, the
 * framework edges stubbed -- the same approach as
 * test-portal-cna-storage-safety.mjs, but with a stateful hook harness so
 * a state change can be followed through to the gate):
 *
 *   A. the pure rules in portal-pre-gate.ts (skip reasons, step order,
 *      bounded waits, the session-scoped URL marker);
 *   B. Android sheet detection in portal-cna.ts against real UAs;
 *   C. buildSessionUrl carries the marker only when asked;
 *   D. /portal/success opens NO gate (MikroTik, Aruba, Omada) while the
 *      phase is pending or showing, opens it after, and carries the marker
 *      / the tapped offer link into the gate's destination correctly;
 *   E. the phase's own plan + sequencing (usePreGatePlan / PreGatePhase);
 *   F. source-level wiring the render stubs cannot see.
 *
 * Run: node scripts/test-portal-pre-gate.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "pre-gate-test-"));

let failures = 0;
let passed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const stub = (name, contents) => {
  const file = join(work, name);
  writeFileSync(file, contents);
  return file;
};

async function bundle(name, entrySource, alias) {
  const entry = join(work, `${name}-entry.js`);
  writeFileSync(entry, entrySource);
  const outfile = join(work, `${name}.mjs`);
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "neutral",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
    alias: { ...alias, "@": SRC },
  });
  return import(outfile);
}

// --- A stateful hook harness ------------------------------------------
// Hooks are slots indexed by call order (React's own rule). setState marks
// the tree dirty; `render` re-runs the component until it settles, running
// effects whose deps changed after each pass, like React would.
const REACT_STUB = `
const H = () => globalThis.__H;
export function useState(init) {
  const h = H(); const i = h.idx++;
  if (!(i in h.slots)) h.slots[i] = typeof init === "function" ? init() : init;
  return [h.slots[i], (v) => {
    const next = typeof v === "function" ? v(h.slots[i]) : v;
    if (!Object.is(next, h.slots[i])) { h.slots[i] = next; h.dirty = true; }
  }];
}
export function useRef(v) {
  const h = H(); const i = h.idx++;
  if (!(i in h.slots)) h.slots[i] = { current: v };
  return h.slots[i];
}
export function useEffect(fn, deps) {
  const h = H(); const i = h.idx++;
  const prev = h.slots[i];
  const changed = !prev || !deps || deps.length !== prev.length || deps.some((d, k) => !Object.is(d, prev[k]));
  if (changed) { h.slots[i] = deps ?? []; h.pending.push(fn); }
}
export function useMemo(fn) { return fn(); }
export function useCallback(fn) { return fn; }
export function useContext() { return H().runtime; }
export function createContext() { return { Provider: () => null }; }
export default { useState, useRef, useEffect, useMemo, useCallback, useContext, createContext };
`;
const JSX_STUB = `
export function jsx(type, props) { return { type, props }; }
export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = "Fragment";
`;
const ROUTER_STUB = `
export function createFileRoute() { return (opts) => opts; }
export function useNavigate() { return (...args) => globalThis.__H.navigateCalls.push(args); }
export function Link() { return null; }
export function useRouter() { return { invalidate() {} }; }
`;
const QUERY_STUB = `
export function useQuery(opts) {
  globalThis.__H.queryOpts = opts;
  return globalThis.__H.query ?? { data: undefined, isFetched: false };
}
export function useQueryClient() { return { invalidateQueries() {} }; }
export function useMutation() { return { mutate() {}, isPending: false }; }
`;
const NOOP_COMPONENT_STUB = `
export const PortalShell = function PortalShell() { return null; };
export const PortalCard = () => null;
export const PortalTextPlate = () => null;
export const PortalConnectingState = function PortalConnectingState() { return null; };
export const GUEST_LEGIBILITY_CARD_CLASS = "x";
export const PG_FONT_STACK = "sans-serif";
export const DEFAULT_PORTAL_LOGO_SRC = "/x.svg";
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
};`;
const NI_SERVICE_STUB = `export const guestPortalIntegrationService = {
  resolvePortalVenue: async () => undefined,
  authorizePortal: async (body) => { globalThis.__H.omadaCalls.push(body); return { authorized: false }; },
  authorizeRadiusPortal: async () => ({ authorized: false, failure: null }),
};`;
const PRE_GATE_PHASE_STUB = `
export function PreGatePhase() { return null; }
globalThis.__PreGateType = PreGatePhase;
export function usePreGatePlan(session, skip) {
  globalThis.__H.planSkip = skip;
  return skip ? { ready: true, steps: [], campaign: null } : globalThis.__H.plan;
}`;
const CAMPAIGN_OVERLAY_STUB = `
export function CampaignOverlay(props) { return null; }
globalThis.__CampaignOverlayType = CampaignOverlay;
export function campaignHasRenderableContent(c) {
  return c.campaignType === "survey" ? c.questions.length > 0 : !!(c.asset && (c.asset.imageUrl || c.asset.headline));
}`;
const PROFILE_NUDGE_STUB = `
export function GuestProfileNudge(props) { return null; }
globalThis.__ProfileNudgeType = GuestProfileNudge;`;
const CAMPAIGN_SERVICE_STUB = `export const campaignPortalService = {
  getNextCampaign: async () => null,
  recordImpression: async () => undefined,
};`;

const COMMON_ALIAS = {
  react: stub("react-stub.js", REACT_STUB),
  "react/jsx-runtime": stub("jsx-stub.js", JSX_STUB),
  "@tanstack/react-router": stub("router-stub.js", ROUTER_STUB),
  "@tanstack/react-query": stub("query-stub.js", QUERY_STUB),
  "lucide-react": stub("icons-stub.js", ICONS_STUB),
  "@/components/portal-runtime/PortalShell": stub("shell-stub.js", NOOP_COMPONENT_STUB),
  "@/components/portal-runtime/PortalGuestUi": stub("ui-stub.js", NOOP_COMPONENT_STUB),
  "@/services/portal-runtime.service": stub("service-stub.js", SERVICE_STUB),
  "@/services/network-integration.service": stub("ni-stub.js", NI_SERVICE_STUB),
  "@/services/ssid-tiers.service": stub(
    "ssid-stub.js",
    "export const fetchGuestSsidAccess = async () => null;\nexport const ssidTiersService = {};\n",
  ),
};

/** Render `component(props)` and settle it, React-style. */
function render(component, props, h) {
  globalThis.__H = h;
  let out;
  for (let pass = 0; pass < 20; pass++) {
    h.idx = 0;
    h.pending = [];
    h.dirty = false;
    out = component(props);
    for (const fn of h.pending) fn();
    if (!h.dirty) break;
  }
  return out;
}

function freshHarness(runtime, extra = {}) {
  return {
    slots: {},
    idx: 0,
    pending: [],
    dirty: false,
    navigateCalls: [],
    omadaCalls: [],
    runtime,
    ...extra,
  };
}

// --- fake browser --------------------------------------------------------
function installBrowser({ seed = {}, search = "", userAgent = "" } = {}) {
  const store = new Map(Object.entries(seed));
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const posted = [];
  const assigns = [];
  const timers = [];
  globalThis.window = {
    sessionStorage: storage,
    localStorage: storage,
    location: { origin: "https://staging.wyfyguest.com", search, assign: (u) => assigns.push(u) },
    setTimeout: (fn, ms) => {
      timers.push(ms);
      return timers.length;
    },
    clearTimeout: () => {},
    matchMedia: () => ({ matches: false }),
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent, maxTouchPoints: 5 },
    configurable: true,
    writable: true,
  });
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
          posted.push({ action: el.action, ...el.fields });
        },
      };
      return el;
    },
  };
  return { posted, assigns, timers, store };
}

const ANDROID_SHEET_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/128.0.0.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const SAMSUNG_INTERNET_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";

console.log("portal pre-gate phase");

// =====================================================================
// A. The pure rules.
// =====================================================================
const PG = await bundle(
  "pure",
  `export * from ${JSON.stringify(join(SRC, "lib/portal-pre-gate.ts"))};
   export { isAndroidCaptivePortalWebView, isCaptiveSheet } from ${JSON.stringify(join(SRC, "lib/portal-cna.ts"))};
   export { buildSessionUrl } from ${JSON.stringify(join(SRC, "lib/portal-session-url.ts"))};`,
  {},
);
{
  const base = {
    hasSession: true,
    simulated: false,
    nasAlreadyAuthorized: false,
    recentlySubmitted: false,
    alreadyDone: false,
  };
  check("a fresh sign-in runs the phase", PG.preGateSkipReason(base) === null);
  check(
    "no session -> skipped",
    PG.preGateSkipReason({ ...base, hasSession: false }) === "no-session",
  );
  check(
    "preview/demo -> skipped",
    PG.preGateSkipReason({ ...base, simulated: true }) === "simulated",
  );
  check(
    "router says already authorized (hspage) -> skipped, the sheet is closing already",
    PG.preGateSkipReason({ ...base, nasAlreadyAuthorized: true }) === "nas-already-authorized",
  );
  check(
    "OS remount bounce right after a gate submit -> skipped",
    PG.preGateSkipReason({ ...base, recentlySubmitted: true }) === "recent-gate-submit",
  );
  check(
    "re-entry after the phase already ran for this session -> skipped",
    PG.preGateSkipReason({ ...base, alreadyDone: true }) === "already-done",
  );

  const steps = (c, p) =>
    JSON.stringify(PG.resolvePreGateSteps({ campaignRenderable: c, profileEligible: p }));
  check("offer first, then the profile ask", steps(true, true) === '["campaign","profile"]');
  check("only an offer", steps(true, false) === '["campaign"]');
  check("only the profile ask", steps(false, true) === '["profile"]');
  check("nothing to show -> no steps (gate opens at once)", steps(false, false) === "[]");

  check(
    "the offer lookup is bounded at <= 3s (it sits between sign-in and internet)",
    PG.PRE_GATE_FETCH_TIMEOUT_MS > 0 && PG.PRE_GATE_FETCH_TIMEOUT_MS <= 3_000,
  );
  check(
    "the whole phase is capped well inside the backend's 10-minute presence grace",
    PG.PRE_GATE_MAX_MS > 30_000 && PG.PRE_GATE_MAX_MS <= 5 * 60_000,
    String(PG.PRE_GATE_MAX_MS),
  );
  check(
    "a pre-gate impression write may hold the gate for <= 2s",
    PG.PRE_GATE_IMPRESSION_TIMEOUT_MS > 0 && PG.PRE_GATE_IMPRESSION_TIMEOUT_MS <= 2_000,
  );

  const never = new Promise(() => {});
  const t0 = Date.now();
  const timedOut = await PG.withTimeout(never, 30, "fallback");
  check(
    "withTimeout: a hung lookup resolves to the fallback",
    timedOut === "fallback" && Date.now() - t0 < 1_000,
  );
  check(
    "withTimeout: a rejected lookup resolves to the fallback, never throws",
    (await PG.withTimeout(Promise.reject(new Error("503")), 1_000, "fallback")) === "fallback",
  );
  check(
    "withTimeout: a fast answer is passed through",
    (await PG.withTimeout(Promise.resolve("offer"), 1_000, "fallback")) === "offer",
  );

  check(
    "marker matches only this session id",
    PG.preGateMarkerMatches("?a=1&pregate=s-1", "s-1") &&
      !PG.preGateMarkerMatches("?pregate=s-OLD", "s-1") &&
      !PG.preGateMarkerMatches("?pregate=s-1", undefined) &&
      !PG.preGateMarkerMatches("", "s-1"),
  );
  check(
    "the marker param name is the literal portal-session-url.ts writes",
    PG.PRE_GATE_SESSION_PARAM === "pregate",
  );
}

// =====================================================================
// B. Android sheet detection.
// =====================================================================
{
  check(
    "AOSP CaptivePortalLogin WebView UA (`; wv)`) is detected",
    PG.isAndroidCaptivePortalWebView(ANDROID_SHEET_UA),
  );
  check("Chrome on Android is not a sheet", !PG.isAndroidCaptivePortalWebView(ANDROID_CHROME_UA));
  check("Samsung Internet is not a sheet", !PG.isAndroidCaptivePortalWebView(SAMSUNG_INTERNET_UA));
  check("iPhone is not an Android sheet", !PG.isAndroidCaptivePortalWebView(IPHONE_UA));
  check("desktop Chrome is not a sheet", !PG.isAndroidCaptivePortalWebView(DESKTOP_UA));

  installBrowser({ userAgent: ANDROID_SHEET_UA });
  check(
    "isCaptiveSheet(): Android sheet with WORKING storage is still a sheet (the storage probe alone misses it)",
    PG.isCaptiveSheet(),
  );
  installBrowser({ userAgent: ANDROID_CHROME_UA });
  check("isCaptiveSheet(): Android Chrome with working storage is not", !PG.isCaptiveSheet());
}

// =====================================================================
// C. buildSessionUrl.
// =====================================================================
{
  installBrowser();
  const plain = new URL(PG.buildSessionUrl("org-1", "loc-1", "rtr-1", "hi", "AA:BB"));
  check("no marker unless asked", !plain.searchParams.has("pregate"));
  const marked = new URL(PG.buildSessionUrl("org-1", "loc-1", "rtr-1", "hi", "AA:BB", "s-1"));
  check(
    "marker carries the session id, alongside lang and mac",
    marked.searchParams.get("pregate") === "s-1" &&
      marked.searchParams.get("lang") === "hi" &&
      marked.searchParams.get("mac") === "AA:BB",
  );
}

// =====================================================================
// D. /portal/success holds every gate until the phase is done.
// =====================================================================
const { Route } = await bundle(
  "success",
  `export { Route } from ${JSON.stringify(join(SRC, "routes/portal.success.tsx"))};`,
  {
    ...COMMON_ALIAS,
    "@/components/portal-runtime/PreGatePhase": stub("pre-gate-stub.js", PRE_GATE_PHASE_STUB),
  },
);
const SuccessPage = Route.component;

const SESSION = { sessionId: "s-1", guestId: "g-1", identifier: "+919876543210" };
const MIKROTIK = {
  session: SESSION,
  organizationId: "org-1",
  locationId: "loc-1",
  routerId: "rtr-1",
  hotspotLoginUrl: "http://10.5.50.1/login",
  guestIdentifier: "+919876543210",
  previewMode: false,
  demoMode: false,
  t: (k) => k,
};
const ARUBA = {
  ...MIKROTIK,
  hotspotLoginUrl: undefined,
  netProvider: "aruba_instant_on",
  arubaRedirect: { switchip: "captive-2022.aio.cloudauth.net" },
};
const OMADA = { ...MIKROTIK, hotspotLoginUrl: undefined, netProvider: "omada" };
const NOT_READY = { ready: false, steps: [], campaign: null };
const OFFER = { campaignId: "c-1", campaignType: "banner", asset: { headline: "10% off" } };
const SHOWING = { ready: true, steps: ["campaign"], campaign: OFFER };
const NOTHING = { ready: true, steps: [], campaign: null };

const isPreGate = (out) => out && out.type === globalThis.__PreGateType;

for (const [label, runtime, gateFired] of [
  ["MikroTik", MIKROTIK, (b) => b.posted.length > 0],
  ["Aruba", ARUBA, (b) => b.posted.length > 0],
  ["Omada", OMADA, (b, h) => h.omadaCalls.length > 0],
]) {
  // D1. Lookup still in flight.
  {
    const b = installBrowser({ userAgent: ANDROID_SHEET_UA });
    const h = freshHarness(runtime, { plan: NOT_READY });
    const out = render(SuccessPage, {}, h);
    check(`${label}: no gate request while the offer lookup is in flight`, !gateFired(b, h));
    check(`${label}: the lookup shows the connecting visual, not the phase`, !isPreGate(out));
    check(
      `${label}: the slow/stuck clock does not run while waiting on the phase`,
      !b.timers.includes(4_000),
      JSON.stringify(b.timers),
    );
  }
  // D2. An offer is showing.
  {
    const b = installBrowser({ userAgent: ANDROID_SHEET_UA });
    const h = freshHarness(runtime, { plan: SHOWING });
    const out = render(SuccessPage, {}, h);
    check(`${label}: an offer renders the pre-gate phase`, isPreGate(out));
    check(`${label}: no gate request while the guest is on the offer`, !gateFired(b, h));
    check(`${label}: the phase is asked to run (not skipped)`, h.planSkip === false);

    // ...and the guest finishes it.
    out.props.onFinished({ shown: true });
    render(SuccessPage, {}, h);
    check(`${label}: the gate opens once the phase is done`, gateFired(b, h));
    check(
      `${label}: the phase is recorded for this session (re-entry skips it)`,
      b.store.get("cloudguest_portal_pre_gate_done") === "s-1",
    );
  }
  // D3. Nothing to show: the gate opens at once, unchanged.
  {
    const b = installBrowser();
    const h = freshHarness(runtime, { plan: NOTHING });
    const out = render(SuccessPage, {}, h);
    check(`${label}: nothing to show -> gate opens immediately`, gateFired(b, h));
    check(`${label}: nothing to show -> the phase never renders`, !isPreGate(out));
  }
}

// D4. MikroTik dst: marker when something was shown; tapped offer link in a
//     real browser; the session page (never the link) inside a sheet.
{
  const finishWith = (result, userAgent) => {
    const b = installBrowser({ userAgent });
    const h = freshHarness(MIKROTIK, { plan: SHOWING });
    render(SuccessPage, {}, h).props.onFinished(result);
    render(SuccessPage, {}, h);
    return b.posted[0]?.dst ?? "";
  };
  const shownDst = finishWith({ shown: true }, ANDROID_SHEET_UA);
  check(
    "dst lands on /portal/session with pregate=<sessionId> after the phase showed something",
    shownDst.startsWith("https://staging.wyfyguest.com/portal/session?") &&
      new URL(shownDst).searchParams.get("pregate") === "s-1",
    shownDst,
  );
  const tapped = "https://offers.example.com/deal";
  check(
    "a tapped offer link becomes the destination in a real browser",
    finishWith({ shown: true, clickUrl: tapped }, DESKTOP_UA) === tapped,
  );
  check(
    "a tapped offer link is NOT the destination inside the Android sheet (it would only close it)",
    finishWith({ shown: true, clickUrl: tapped }, ANDROID_SHEET_UA).includes("/portal/session?"),
  );
  check(
    "a javascript: link is never a destination",
    !finishWith({ shown: true, clickUrl: "javascript:alert(1)" }, DESKTOP_UA).startsWith(
      "javascript:",
    ),
  );
  const b = installBrowser();
  const h = freshHarness(MIKROTIK, { plan: NOTHING });
  render(SuccessPage, {}, h);
  check(
    "no marker when the phase showed nothing",
    !(b.posted[0]?.dst ?? "").includes("pregate="),
    b.posted[0]?.dst,
  );
}

// D5. Aruba carries the marker in its `url` field too.
{
  const b = installBrowser({ userAgent: ANDROID_SHEET_UA });
  const h = freshHarness(ARUBA, { plan: SHOWING });
  render(SuccessPage, {}, h).props.onFinished({ shown: true });
  render(SuccessPage, {}, h);
  const fields = b.posted[0] ?? {};
  check(
    "Aruba: the AP login POST goes to the AP's own host",
    String(fields.action ?? "").includes("captive-2022.aio.cloudauth.net"),
    JSON.stringify(fields),
  );
  check(
    "Aruba: the post-login `url` carries pregate=<sessionId>",
    Object.values(fields).some((v) => typeof v === "string" && v.includes("pregate=s-1")),
    JSON.stringify(fields),
  );
}

// D6. Skips.
{
  installBrowser({ search: "?hspage=alogin" });
  let h = freshHarness(MIKROTIK, { plan: SHOWING });
  render(SuccessPage, {}, h);
  check("hspage=alogin skips the phase (router says the gate is open)", h.planSkip === true);

  installBrowser({
    seed: {
      cloudguest_portal_hotspot_submit: JSON.stringify({
        identifier: MIKROTIK.guestIdentifier,
        at: Date.now(),
      }),
    },
  });
  h = freshHarness(MIKROTIK, { plan: SHOWING });
  render(SuccessPage, {}, h);
  check("a remount bounce right after a submit skips the phase", h.planSkip === true);

  const b = installBrowser({ seed: { cloudguest_portal_pre_gate_done: "s-1" } });
  h = freshHarness(MIKROTIK, { plan: SHOWING });
  const out = render(SuccessPage, {}, h);
  check(
    "re-entry for the same session skips the phase and opens the gate",
    h.planSkip === true && !isPreGate(out) && b.posted.length === 1,
  );

  installBrowser({ seed: { cloudguest_portal_pre_gate_done: "s-OLD" } });
  h = freshHarness(MIKROTIK, { plan: SHOWING });
  render(SuccessPage, {}, h);
  check("a record for an EARLIER session does not skip a new one", h.planSkip === false);

  installBrowser();
  h = freshHarness({ ...MIKROTIK, previewMode: true }, { plan: SHOWING });
  render(SuccessPage, {}, h);
  check("Portal Preview skips the phase", h.planSkip === true);
}

// =====================================================================
// E. The phase itself: plan + sequencing.
// =====================================================================
const Phase = await bundle(
  "phase",
  `export * from ${JSON.stringify(join(SRC, "components/portal-runtime/PreGatePhase.tsx"))};`,
  {
    ...COMMON_ALIAS,
    "@/components/portal-runtime/CampaignOverlay": stub("co-stub.js", CAMPAIGN_OVERLAY_STUB),
    "@/components/portal-runtime/GuestProfileNudge": stub("gpn-stub.js", PROFILE_NUDGE_STUB),
    "@/services/campaign-portal.service": stub("cps-stub.js", CAMPAIGN_SERVICE_STUB),
  },
);
{
  installBrowser();
  const CONFIG = {
    collectGuestName: true,
    collectGuestEmail: false,
    reviewUrl: null,
    reviewCardEnabled: false,
    guestFeedbackEnabled: true,
    feedbackDwellMinutes: 25,
  };
  const SESS = { ...SESSION, startedAt: new Date().toISOString(), hasProfile: false };
  const plan = (query, { session = SESS, skip = false, config = CONFIG } = {}) => {
    const h = freshHarness({ config, t: (k) => k }, { query });
    const out = render((p) => Phase.usePreGatePlan(p.session, p.skip), { session, skip }, h);
    return { out, h };
  };

  let r = plan({ data: undefined, isFetched: false });
  check("plan is NOT ready while the lookup is in flight", r.out.ready === false);
  check(
    "the lookup is bounded (queryFn races the timeout) and never retried",
    r.h.queryOpts.retry === false && r.h.queryOpts.enabled === true,
  );

  r = plan({ data: OFFER, isFetched: true });
  check(
    "an offer + an unanswered profile ask -> both, offer first",
    r.out.ready && JSON.stringify(r.out.steps) === '["campaign","profile"]',
  );

  const STAR = {
    campaignId: "c-star",
    campaignType: "survey",
    questions: [{ id: "q", answerType: "rating_5" }],
  };
  r = plan({ data: STAR, isFetched: true });
  check(
    "the dwell-gated star prompt stays AFTER the gate (not a pre-gate step)",
    !r.out.steps.includes("campaign") && r.out.campaign === null,
  );

  const SURVEY = {
    campaignId: "c-s",
    campaignType: "survey",
    questions: [
      { id: "q1", answerType: "single_choice" },
      { id: "q2", answerType: "free_text" },
    ],
  };
  r = plan({ data: SURVEY, isFetched: true });
  check("a real multi-question survey IS a pre-gate step", r.out.steps[0] === "campaign");

  r = plan({ data: { campaignId: "c-e", campaignType: "survey", questions: [] }, isFetched: true });
  check("an empty survey is not shown", !r.out.steps.includes("campaign"));

  r = plan({ data: null, isFetched: true }, { session: { ...SESS, hasProfile: true } });
  check(
    "no offer + profile already answered -> nothing, ready",
    r.out.ready && r.out.steps.length === 0,
  );

  r = plan({ data: OFFER, isFetched: true }, { skip: true });
  check(
    "skip -> ready, empty, and nothing is fetched",
    r.out.ready && r.out.steps.length === 0 && r.h.queryOpts.enabled === false,
  );

  // Sequencing.
  const timers = installBrowser().timers;
  let result = null;
  const h = freshHarness({ config: CONFIG, t: (k) => k });
  const props = {
    steps: ["campaign", "profile"],
    campaign: OFFER,
    session: SESS,
    onFinished: (res) => {
      result = res;
    },
  };
  let out = render(Phase.PreGatePhase, props, h);
  check(
    "step 1 renders the offer in pre-gate mode",
    out.type === globalThis.__CampaignOverlayType && out.props.preGate === true,
  );
  check("the phase arms its hard ceiling", timers.includes(180_000), JSON.stringify(timers));
  out.props.onDone({ clickUrl: "https://offers.example.com/deal" });
  out = render(Phase.PreGatePhase, props, h);
  const findNudge = (node) => {
    if (!node || typeof node !== "object") return null;
    if (node.type === globalThis.__ProfileNudgeType) return node;
    const kids = node.props?.children;
    for (const k of Array.isArray(kids) ? kids : [kids]) {
      const f = findNudge(k);
      if (f) return f;
    }
    return null;
  };
  const nudge = findNudge(out);
  check("step 2 renders the profile ask", !!nudge && result === null);
  // Answering flips hasProfile on the live session; the frozen plan must
  // not lose the step from under the guest.
  render(Phase.PreGatePhase, { ...props, steps: ["campaign"] }, h);
  check("the plan is frozen at mount (a shrinking prop does not skip ahead)", result === null);
  nudge.props.onResolved();
  render(Phase.PreGatePhase, props, h);
  check(
    "finishing reports shown + the tapped link, exactly once",
    result && result.shown === true && result.clickUrl === "https://offers.example.com/deal",
    JSON.stringify(result),
  );
}

// =====================================================================
// F. Source-level wiring the render stubs cannot see.
// =====================================================================
{
  const overlay = readFileSync(join(SRC, "components/portal-runtime/CampaignOverlay.tsx"), "utf8");
  const openBanner = overlay.split("const openBanner")[1] ?? "";
  check(
    "CampaignOverlay: a pre-gate banner tap returns before window.open",
    openBanner.indexOf("if (preGate)") > -1 &&
      openBanner.indexOf("if (preGate)") < openBanner.indexOf("window.open(safeClickUrl"),
  );
  check(
    "CampaignOverlay: a pre-gate impression is awaited (bounded) before onDone",
    /withTimeout\(write, PRE_GATE_IMPRESSION_TIMEOUT_MS/.test(overlay),
  );
  check(
    "CampaignOverlay: an image that cannot load pre-auth hides itself",
    /onError=\{\(\) => setImageFailed\(true\)\}/.test(overlay),
  );

  const session = readFileSync(join(SRC, "routes/portal.session.tsx"), "utf8");
  check(
    "session page: no second offer takeover after the pre-gate phase",
    /!preGateShown &&/.test(session),
  );
  check(
    "session page: no second arrival ask after the pre-gate phase",
    /arrivalAskSettled: arrivalAskSettled \|\| preGateShown/.test(session),
  );
  check(
    "session page: never auto-redirects inside EITHER OS's sheet",
    /const inCna = isCaptiveSheet\(\)/.test(session),
  );

  const success = readFileSync(join(SRC, "routes/portal.success.tsx"), "utf8");
  check(
    "success page: the gate effect is held on gateReady",
    /if \(!gateReady\) return;\s*attemptSubmit\(\);/.test(success),
  );
  check(
    "success page: no direct isCaptiveNetworkAssistant() call left (sheet = iOS OR Android)",
    !/isCaptiveNetworkAssistant\(\)/.test(success),
  );

  const index = readFileSync(join(SRC, "routes/portal.index.tsx"), "utf8");
  check(
    "trusted-device auto-login (portal.index.tsx) is untouched by the phase",
    !/PreGate|pre-gate/i.test(index),
  );
}

console.log(
  failures === 0
    ? `\nportal pre-gate: all ${passed} checks passed`
    : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
