/**
 * Aruba Instant On: a Wyfy session the AP never confirmed must not stop the
 * guest reaching the AP's login.
 *
 * THE INCIDENT (prod, 2026-11-02). OTP succeeded and created the session, the
 * AP's RADIUS request was then rejected, and the row stayed `active` with 0
 * bytes. When the phone came back the portal called `/guest/session/active`,
 * found that row and document-loaded `/portal/session`. No POST to the AP, no
 * RADIUS request, no internet, until a sweep ended the row 40 minutes later.
 *
 * This runs the REAL `/portal/` component and its routing effect, not a copy
 * of the logic. There is no DOM in this harness: React is replaced by a stub
 * that calls the component once and then runs its effects, which is all a
 * routing decision needs. The real `portal-aruba-*` modules and schema run.
 *
 * Run: node scripts/test-portal-aruba-stale-session.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "portal-aruba-stale-"));

let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const stub = (name, body) => {
  const file = join(work, name);
  writeFileSync(file, body);
  return file;
};

const alias = {
  react: stub(
    "react.mjs",
    `export const useState = (v) => [typeof v === "function" ? v() : v, () => {}];
     export const useRef = (current) => ({ current });
     export const useEffect = (fn) => { globalThis.__h.effects.push(fn); };
     export const useMemo = (fn) => fn();
     export const useCallback = (fn) => fn;
     export default {};`,
  ),
  "react/jsx-runtime": stub(
    "jsx.mjs",
    `export const jsx = () => null; export const jsxs = () => null; export const Fragment = null;`,
  ),
  "@tanstack/react-query": stub(
    "query.mjs",
    `export const useQueryClient = () => ({ invalidateQueries() {} });
     export const useQuery = ({ queryKey, enabled }) => {
       const name = queryKey[0];
       globalThis.__h.queries[name] = !!enabled;
       const answer = enabled ? globalThis.__h.answers[name] : undefined;
       return { data: answer, isFetched: !!enabled, refetch() {} };
     };`,
  ),
  "@tanstack/react-router": stub(
    "router.mjs",
    `export const createFileRoute = () => (options) => ({ options });
     export const useNavigate = () => (to) => { globalThis.__h.navigated.push(to.to); };
     export const retainSearchParams = () => () => {};`,
  ),
  "lucide-react": stub("lucide.mjs", `export const RefreshCw = null; export const Wifi = null;`),
  "@/context/PortalRuntimeContext": stub(
    "runtime.mjs",
    `export const usePortalRuntime = () => globalThis.__h.runtime;`,
  ),
  "@/services/portal-runtime.service": stub(
    "service.mjs",
    `export const portalRuntimeService = {};`,
  ),
  "@/lib/portal-guest-errors": stub(
    "errors.mjs",
    `export const isPortalConfigMissing = () => false;`,
  ),
  "@/lib/portal-top-level-form": stub(
    "form.mjs",
    `export const HOTSPOT_FALLBACK_PASSWORD = "x";
     export const submitTopLevelForm = (url) => { globalThis.__h.posted.push(url); };`,
  ),
  "@/components/portal-runtime/PortalErrorScreen": stub(
    "error-screen.mjs",
    `export const PortalErrorScreen = null;`,
  ),
  "@/components/portal-runtime/PortalShell": stub(
    "shell.mjs",
    `export const PortalShell = null; export const PortalTextPlate = null;`,
  ),
  "@/components/portal-runtime/PortalGuestUi": stub(
    "guest-ui.mjs",
    `export const PortalConnectingState = null;`,
  ),
  "@/components/portal-runtime/VenueLogo": stub("logo.mjs", `export const VenueLogo = null;`),
};

const entry = stub(
  "entry.mjs",
  `export { Route } from "${join(ROOT, "src/routes/portal.index.tsx")}";
   export { arubaRedirectAsksForLogin } from "${join(ROOT, "src/lib/portal-aruba-login.ts")}";
   export { portalSearchSchema } from "${join(ROOT, "src/lib/portal-search.ts")}";`,
);
const outfile = join(work, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias,
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx" },
});
const m = createRequire(import.meta.url)(outfile);

const MAC = "60:f4:45:0b:28:66";
const HOST = "captive-2022.aio.cloudauth.net";
const SESSION = { sessionId: "s-1", identifier: "+919999999999" };
const ARUBA = "aruba_instant_on";
const redirect = (extra = "") =>
  `?netProvider=${ARUBA}&cmd=login&mac=${MAC}&post=${HOST}&network=WYFY${extra}`;

/** Run `/portal/` once for one load and report where the guest was sent. */
function load({ search = "", session, live, ended, netProvider, hotspotLoginUrl, mirror }) {
  const h = {
    effects: [],
    queries: {},
    navigated: [],
    assigned: [],
    posted: [],
    cleared: false,
    answers: {
      "portal-active-session": live ?? null,
      "portal-last-ended-session": ended ?? null,
      "portal-trusted-device": null,
    },
    runtime: {
      isLoading: false,
      config: { isOpenNow: true, name: "Venue" },
      error: undefined,
      t: (k) => k,
      routerId: "r-1",
      deviceMac: MAC,
      session,
      setSession: (v) => {
        if (v === undefined) h.cleared = true;
      },
      setGuestIdentifier: () => {},
      setEndedSession: () => {},
      organizationId: "o-1",
      locationId: "l-1",
      hotspotLoginUrl,
      language: "en",
      netProvider,
      arubaRedirect: mirror,
    },
  };
  globalThis.__h = h;
  globalThis.window = {
    location: {
      search,
      origin: "https://auth.wyfyguest.com",
      assign: (url) => h.assigned.push(url),
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };
  m.Route.options.component();
  for (const effect of h.effects) effect();
  return h;
}
const wentTo = (h) => h.navigated.join(",");
const toSessionPage = (h) => h.assigned.length === 1 && h.assigned[0].includes("/portal/session");

console.log("\n1. The incident: an active row the AP never confirmed");
{
  const h = load({ search: redirect(), live: SESSION, netProvider: ARUBA });
  check(
    "the AP's redirect goes to the login POST page",
    wentTo(h) === "/portal/success",
    wentTo(h),
  );
  check("not to 'you're connected'", h.assigned.length === 0, h.assigned.join());
}
{
  const h = load({ search: redirect(), session: SESSION, live: SESSION, netProvider: ARUBA });
  check("a session in storage goes the same way", wentTo(h) === "/portal/success", wentTo(h));
  check("and the backend is asked about it", h.queries["portal-active-session"] === true);
}
{
  const swallowed = `?netProvider=${ARUBA}?cmd=login&post=${HOST}`;
  const h = load({ search: swallowed, live: SESSION, netProvider: ARUBA });
  check("a second-? join is handled too", wentTo(h) === "/portal/success", wentTo(h));
}

console.log("\n2. A row that ended while the browser still holds it");
{
  const h = load({ search: redirect(), session: SESSION, live: null, netProvider: ARUBA });
  check("the stale local session is cleared", h.cleared);
  check("nothing claims they are connected", h.assigned.length === 0);
  // Clearing re-renders with no session, so the decision finishes on that pass.
  const next = load({ search: redirect(), live: null, netProvider: ARUBA });
  check("the guest is sent to sign in", wentTo(next) === "/portal/welcome", wentTo(next));
}

console.log("\n3. The AP refused the login: never post again by itself");
{
  const h = load({
    search: redirect("&errmsg=Login%20error.%20Please%20retry."),
    live: SESSION,
    netProvider: ARUBA,
  });
  check("the failure screen, which offers a retry", wentTo(h) === "/portal/failure", wentTo(h));
  check("no 'you're connected'", h.assigned.length === 0);
  check("no automatic POST", h.posted.length === 0);
  check(
    "errmsg survives the portal schema, or this guard could not see it",
    m.portalSearchSchema.parse({ errmsg: "Login error. Please retry." }).errmsg ===
      "Login error. Please retry.",
  );
}

console.log("\n4. No AP redirect on this load: the session page, as before");
{
  const h = load({
    search: `?netProvider=${ARUBA}`,
    session: SESSION,
    netProvider: ARUBA,
    mirror: { switchip: HOST },
  });
  check("a QR code or bookmark load is not read as an AP redirect", toSessionPage(h), wentTo(h));
  check("even with the login host in the storage mirror", wentTo(h) === "");
  check("and asks nothing new", h.queries["portal-active-session"] === false);
}
{
  const h = load({
    search: redirect().replace(HOST, "evil.example"),
    live: SESSION,
    netProvider: ARUBA,
  });
  check("an untrusted host is not a reason to leave the session page", toSessionPage(h));
}

console.log("\n5. MikroTik and Omada are unchanged");
{
  const h = load({ search: `?post=${HOST}`, session: SESSION });
  check("MikroTik, session, no NAS redirect: session page", toSessionPage(h));
  check("MikroTik: no live check for that load", h.queries["portal-active-session"] === false);
}
{
  const h = load({ session: SESSION, live: SESSION, hotspotLoginUrl: "http://10.5.50.1/login" });
  check("MikroTik, fresh link-login-only: login POST page", wentTo(h) === "/portal/success");
}
{
  const h = load({ session: SESSION, live: null, hotspotLoginUrl: "http://10.5.50.1/login" });
  const next = load({ live: null, hotspotLoginUrl: "http://10.5.50.1/login" });
  check("MikroTik, redirect and dead row: cleared", h.cleared);
  check("MikroTik, redirect and dead row: to sign-in", wentTo(next) === "/portal/welcome");
}
{
  const h = load({
    search: `?errmsg=x&post=${HOST}`,
    live: SESSION,
    hotspotLoginUrl: "http://10.5.50.1/login",
  });
  check("MikroTik never reads errmsg", wentTo(h) === "/portal/success", wentTo(h));
}
{
  const h = load({ search: `?post=${HOST}`, session: SESSION, netProvider: "omada" });
  check("Omada, session: session page", toSessionPage(h));
  check("Omada: no live check for that load", h.queries["portal-active-session"] === false);
}

console.log("\n6. arubaRedirectAsksForLogin");
const asks = m.arubaRedirectAsksForLogin;
check("post", asks(`?post=${HOST}`));
check("switchip", asks("?switchip=securelogin.arubanetworks.com"));
check("neither", !asks("?cmd=login&mac=aa"));
check("an IP literal is refused", !asks("?post=192.168.1.1"));

console.log(`\n${ran - failures}/${ran} passed`);
if (failures) process.exit(1);
console.log("portal aruba stale session: all checks passed");
