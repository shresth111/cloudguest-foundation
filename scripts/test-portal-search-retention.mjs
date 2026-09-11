/**
 * Regression test: the guest portal must never drop the NAS's search params
 * on an internal navigation.
 *
 * Run: node scripts/test-portal-search-retention.mjs
 *
 * THE INCIDENT
 * ------------
 * One real iPhone (iOS 18_7), 7 Sep 2026, production. nginx saw the device
 * load the portal three times with a complete RouterOS redirect:
 *
 *   GET /portal?organizationId=..&locationId=..&routerId=..
 *              &mac=FA:42:FE:9E:29:03&ip=10.5.50.251&dst=
 *              &link-login-only=http://wifi.wyfyguest.com/login
 *
 * and `GET /api/v1/guest/session/active` fired with the right
 * `device_mac=FA:42:FE:9E:29:03` each time -- so the MAC was present and
 * correct on the `/portal` surface. Then two login POSTs, three minutes
 * apart, with these Referers:
 *
 *   FAILED  /portal/welcome?organizationId=..&locationId=..&routerId=..
 *   WORKED  /portal/welcome?organizationId=..&locationId=..&routerId=..
 *                          &mac=FA%3A42%3AFE%3A9E%3A29%3A03&ip=10.5.50.251
 *                          &dst=&link-login-only=http%3A%2F%2F..
 *
 * `device_mac` is optional on three of the four backend login schemas, so
 * the MAC-less login is ACCEPTED and writes a `guest_sessions` row with
 * `device_id = NULL`. In the window before RADIUS Authorize heals it
 * (backend PR #179) that row is invisible to the portal's own "already
 * connected?" check, to login dedup, and to `GET /agent/authorized-macs` --
 * so the MAC never reaches the router's bypass list and the guest is sent
 * back through sign-in. They signed in twice.
 *
 * THE CAUSE, AND WHY IT IS NOT WHAT IT LOOKS LIKE
 * ----------------------------------------------
 * Every `navigate()` under `/portal` did pass `search: (prev) => prev`. The
 * loss was in the `<Link>`s, which passed a whole object:
 *
 *   const portalSearch = { organizationId, locationId, routerId };
 *
 * -- six independent copies of that literal, in PortalShell, useGuestSignIn,
 * portal.terms, portal.session, portal.success and portal.auth.$method. The
 * router builds the destination URL from the object it is given, so those
 * three keys are all that survived. A guest who opened "Terms" from the
 * sign-in card landed on `/portal/terms` already truncated; the Back link
 * there is a faithful `search={(prev) => prev}` and faithfully carried the
 * truncation home. That is the failing referer above, and it is why its
 * params are plain while the working one's are percent-encoded: the three
 * survivors are UUIDs, and every param that needs escaping is one of the
 * four that were dropped.
 *
 * WHAT IS ASSERTED HERE
 * ---------------------
 * A hand-fixed call site proves nothing about the seventh one. The fix is
 * `retainSearchParams` on `/portal`'s `search.middlewares` (see
 * src/lib/portal-search.ts), which TanStack Router collects from the
 * DESTINATION's matched route chain -- so it applies to every navigation
 * into any `/portal/*` route from any caller. This suite therefore drives a
 * REAL `@tanstack/react-router` router built from the REAL schema and the
 * REAL middleware list, through the exact production URL above, and asserts
 * the MAC survives:
 *
 *   1. the lossy shapes themselves (a bare three-key object, a partial
 *      object, no `search` at all) -- these are what regressed;
 *   2. the real two-hop welcome -> terms -> welcome path that produced the
 *      incident;
 *   3. every `/portal/*` destination, so the guarantee is route-wide.
 *
 * Sections 4 and 5 then pin the wiring and the pattern, because a
 * behavioural test against a locally-assembled tree cannot see someone
 * deleting the middleware from the route file or re-typing the literal.
 */
import { build } from "esbuild";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

/* ------------------------------------------------------------------ *
 * Bundle the REAL search module. Output lands under the repo's own
 * node_modules so `@tanstack/react-router` and `zod` resolve exactly as
 * they do in the app -- `packages: "external"` keeps them the real
 * installed copies rather than a second, inlined one.
 * ------------------------------------------------------------------ */
const work = join(ROOT, "node_modules", ".cache", "portal-search-retention");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const outfile = join(work, "portal-search.mjs");

await build({
  entryPoints: [join(ROOT, "src/lib/portal-search.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
});

const { portalSearchSchema, portalSearchMiddlewares, PORTAL_SEARCH_KEYS } = await import(
  pathToFileURL(outfile).href
);
const { createRootRoute, createRoute, createRouter, createMemoryHistory } =
  await import("@tanstack/react-router");

/* ------------------------------------------------------------------ *
 * The route tree. Paths only -- no components, since nothing here
 * renders. The `/portal` route carries the two options that matter and
 * they are the real ones, imported above.
 * ------------------------------------------------------------------ */
const PORTAL_CHILD_PATHS = [
  "/",
  "/welcome",
  "/terms",
  "/verify",
  "/success",
  "/session",
  "/expired",
  "/failure",
  "/closed",
  "/offline",
  "/redirect",
  "/team",
  "/set-password",
  "/not-listed",
  "/auth",
  "/auth/$method",
];

function makeRouter(initialUrl) {
  const rootRoute = createRootRoute({});
  const portalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/portal",
    validateSearch: portalSearchSchema,
    search: { middlewares: portalSearchMiddlewares },
  });
  portalRoute.addChildren(
    PORTAL_CHILD_PATHS.map((path) => createRoute({ getParentRoute: () => portalRoute, path })),
  );
  return createRouter({
    routeTree: rootRoute.addChildren([portalRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
}

/* The real production values, from the nginx log. */
const ORG = "08ec098b-4c1e-4a3f-9d21-6f0a5b3e77c1";
const LOC = "ede8381c-1b44-4d0e-a7c9-2e5f8a91b330";
const RTR = "bfc7ed1c-9a02-4b6d-8f13-4c7e2d0a5169";
const MAC = "FA:42:FE:9E:29:03";
const IP = "10.5.50.251";
const LOGIN_ONLY = "http://wifi.wyfyguest.com/login";

const NAS_URL =
  `/portal/welcome?organizationId=${ORG}&locationId=${LOC}&routerId=${RTR}` +
  `&mac=${encodeURIComponent(MAC)}&ip=${IP}&dst=` +
  `&link-login-only=${encodeURIComponent(LOGIN_ONLY)}`;

/* Exactly the object the six `portalSearch` literals used to build. */
const THREE_KEYS = { organizationId: ORG, locationId: LOC, routerId: RTR };

function carriesEverything(href) {
  const q = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  return (
    q.get("organizationId") === ORG &&
    q.get("locationId") === LOC &&
    q.get("routerId") === RTR &&
    q.get("mac") === MAC &&
    q.get("ip") === IP &&
    q.get("link-login-only") === LOGIN_ONLY &&
    q.has("dst")
  );
}

/* ------------------------------------------------------------------ *
 * 1. The lossy `search` shapes. Each of these is a real shape a caller
 *    under /portal passes today; none of them may be able to narrow the
 *    URL.
 * ------------------------------------------------------------------ */
console.log("\n1. a caller's `search` narrows what it SETS, never what the URL CARRIES");

const r1 = makeRouter(NAS_URL);
await r1.load();

check(
  "the fixture really is the production URL (mac present before we navigate)",
  carriesEverything(r1.state.location.href),
  r1.state.location.href,
);

const lossyShapes = [
  ["the three-key object the six `portalSearch` literals built", { search: THREE_KEYS }],
  ["a single-key object", { search: { organizationId: ORG } }],
  ["an empty object", { search: {} }],
  ["no `search` key at all", {}],
  ["a callback that returns only the three IDs", { search: () => THREE_KEYS }],
  ["the faithful `(prev) => prev`", { search: (prev) => prev }],
];

for (const [label, opts] of lossyShapes) {
  const href = r1.buildLocation({ to: "/portal/terms", ...opts }).href;
  check(`welcome -> terms with ${label}`, carriesEverything(href), href);
}

/* A caller must still be able to SET a value, and to remove one on
 * purpose -- retention that overrode an explicit write would be its own
 * bug. */
const setLang = r1.buildLocation({
  to: "/portal/terms",
  search: { ...THREE_KEYS, lang: "ta" },
}).href;
check("an explicit value still wins over the retained one", setLang.includes("lang=ta"), setLang);
check("...and the rest is still retained alongside it", carriesEverything(setLang), setLang);

const dropMac = r1.buildLocation({
  to: "/portal/terms",
  search: (prev) => ({ ...prev, mac: undefined }),
}).href;
check(
  "an explicitly-cleared param stays cleared (retention is a floor, not an override)",
  !new URLSearchParams(dropMac.slice(dropMac.indexOf("?") + 1)).has("mac"),
  dropMac,
);

/* ------------------------------------------------------------------ *
 * 2. The incident path, hop by hop.
 * ------------------------------------------------------------------ */
console.log("\n2. the production path: /portal/welcome -> /portal/terms -> /portal/welcome");

const hop1 = r1.buildLocation({ to: "/portal/terms", search: THREE_KEYS }).href;
check("hop 1 (the sign-in card's Terms link) keeps the MAC", carriesEverything(hop1), hop1);

const r2 = makeRouter(hop1);
await r2.load();
const hop2 = r2.buildLocation({ to: "/portal/welcome", search: (prev) => prev }).href;
check("hop 2 (the Terms page's Back link) keeps the MAC", carriesEverything(hop2), hop2);

check(
  "the guest lands back on /portal/welcome with the referer the WORKING login had",
  hop2.startsWith("/portal/welcome?") && carriesEverything(hop2),
  hop2,
);

/* ------------------------------------------------------------------ *
 * 2b. The same two-hop path, Omada-flavoured.
 *
 * A controller's redirect carries nine parameters only it can supply, and
 * `netProvider` -- stamped by `/omada/$token`'s loader after it read the
 * provider off the integration row -- decides which vendor's gate
 * `/portal/success` opens. Lose `netProvider` on one hop and the guest
 * completes sign-in, is told they are connected, and is not, because the
 * success page fired the RouterOS branch at a venue with no RouterOS. Lose
 * `clientMac` and the authorize call names no device, which the backend now
 * refuses outright.
 *
 * This is the 7 Sep incident's exact shape with the other vendor's
 * parameters in it, so it is asserted over the same welcome -> terms ->
 * back hops, from the same lossy caller.
 * ------------------------------------------------------------------ */
console.log("\n2b. the same hops, with an Omada controller's redirect");

const OMADA_URL =
  `/portal/welcome?organizationId=${ORG}&locationId=${LOC}&routerId=${RTR}` +
  `&netProvider=omada&clientMac=${encodeURIComponent("AA-BB-CC-DD-EE-FF")}` +
  `&clientIp=10.5.50.251&site=Default&apMac=${encodeURIComponent("11:11:11:11:11:11")}` +
  `&ssidName=Guest%20WiFi&radioId=1&t=1757548800000` +
  `&redirectUrl=${encodeURIComponent("https://example.com/welcome")}`;

function carriesOmada(href) {
  const q = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  return (
    q.get("netProvider") === "omada" &&
    q.get("clientMac") === "AA-BB-CC-DD-EE-FF" &&
    q.get("clientIp") === "10.5.50.251" &&
    q.get("site") === "Default" &&
    q.get("apMac") === "11:11:11:11:11:11" &&
    q.get("ssidName") === "Guest WiFi" &&
    q.get("radioId") === "1" &&
    q.get("t") === "1757548800000" &&
    q.get("redirectUrl") === "https://example.com/welcome"
  );
}

const ro1 = makeRouter(OMADA_URL);
await ro1.load();
check(
  "the fixture really is an Omada redirect (all ten present before we navigate)",
  carriesOmada(ro1.state.location.href),
  ro1.state.location.href,
);

for (const [label, opts] of lossyShapes) {
  const href = ro1.buildLocation({ to: "/portal/terms", ...opts }).href;
  check(`omada welcome -> terms with ${label}`, carriesOmada(href), href);
}

const omadaHop1 = ro1.buildLocation({ to: "/portal/terms", search: THREE_KEYS }).href;
const ro2 = makeRouter(omadaHop1);
await ro2.load();
const omadaHop2 = ro2.buildLocation({ to: "/portal/welcome", search: (prev) => prev }).href;
check("omada hop 2 (the Terms page's Back link) keeps every parameter", carriesOmada(omadaHop2));

const omadaSuccess = ro1.buildLocation({ to: "/portal/success", search: THREE_KEYS }).href;
check(
  "the parameters survive all the way to /portal/success, where they are used",
  carriesOmada(omadaSuccess),
  omadaSuccess,
);

const omadaOffPortal = ro1.buildLocation({ to: "/", search: {} }).href;
check(
  "navigating OFF /portal does not drag the guest's MAC onto an operator page",
  !omadaOffPortal.includes("clientMac"),
  omadaOffPortal,
);

/* The other real round trip: the sign-in card's voucher tab is a `<Link>`
 * to a route with a path param, which is the shape most likely to be
 * hand-built. */
const voucher = r1.buildLocation({
  to: "/portal/auth/$method",
  params: { method: "voucher" },
  search: THREE_KEYS,
}).href;
check("the voucher tab link keeps the MAC", carriesEverything(voucher), voucher);

/* ------------------------------------------------------------------ *
 * 3. Route-wide, not welcome-only.
 * ------------------------------------------------------------------ */
console.log("\n3. every /portal destination, from the lossiest possible caller");

for (const path of PORTAL_CHILD_PATHS) {
  if (path.includes("$")) continue;
  const to = path === "/" ? "/portal" : `/portal${path}`;
  const href = r1.buildLocation({ to, search: THREE_KEYS }).href;
  check(`${to} keeps the MAC`, carriesEverything(href), href);
}

/* Leaving /portal must NOT drag the guest's MAC onto an operator page --
 * middlewares are collected from the destination, so this is already the
 * behaviour; pinning it stops a future "just retain everything globally"
 * from leaking a device identifier into the dashboard's URLs. */
const offPortal = r1.buildLocation({ to: "/", search: {} }).href;
check(
  "navigating OFF /portal does not carry the MAC along",
  !offPortal.includes("mac="),
  offPortal,
);

/* ------------------------------------------------------------------ *
 * 4. The wiring. Section 1-3 build their own tree, so they cannot see
 *    the real route file losing the option.
 * ------------------------------------------------------------------ */
console.log("\n4. the real /portal route declares the middleware");

const portalRouteSrc = readFileSync(join(ROOT, "src/routes/portal.tsx"), "utf8");
check(
  "portal.tsx installs search.middlewares",
  /search:\s*\{\s*middlewares:\s*portalSearchMiddlewares\s*\}/.test(portalRouteSrc),
  "without this, every assertion above is testing a tree the app does not use",
);
check(
  "portal.tsx validates with the same shared schema",
  /validateSearch:\s*portalSearchSchema/.test(portalRouteSrc),
);
check(
  "both come from src/lib/portal-search.ts",
  /from\s+"@\/lib\/portal-search"/.test(portalRouteSrc),
);

const searchLibSrc = readFileSync(join(ROOT, "src/lib/portal-search.ts"), "utf8");
check(
  "the retained key list is derived from the schema, not hand-listed",
  /PORTAL_SEARCH_KEYS\s*=\s*Object\.keys\(portalSearchShape\)/.test(searchLibSrc),
  "a hand-written list is a second thing to remember, which is the bug",
);
for (const key of [
  "mac",
  "ip",
  "dst",
  "link-login-only",
  // The Omada half. `netProvider` is not a controller parameter -- it is
  // stamped by `/omada/$token`'s loader -- but it is retained by the same
  // mechanism and losing it has the same cost.
  "netProvider",
  "clientMac",
  "clientIp",
  "site",
  "apMac",
  "ssidName",
  "radioId",
  "gatewayMac",
  "vid",
  "t",
  "redirectUrl",
]) {
  check(`the schema still declares \`${key}\``, PORTAL_SEARCH_KEYS.includes(key));
}
check(
  "every schema key is retained",
  Object.keys(portalSearchSchema.shape).every((k) => PORTAL_SEARCH_KEYS.includes(k)),
);

/* ------------------------------------------------------------------ *
 * 5. The pattern itself. The middleware makes the literal harmless, but
 *    a harmless-today literal is how the next author learns the wrong
 *    habit -- and it stops being harmless the moment someone renders a
 *    portal `<Link>` from a surface the middleware cannot reach.
 * ------------------------------------------------------------------ */
console.log("\n5. nobody re-types the truncating literal");

const SRC_DIRS = ["src/routes", "src/components/portal-runtime", "src/context", "src/lib"];
const LITERAL = /\{\s*organizationId\s*,\s*locationId\s*,\s*routerId\s*,?\s*\}/;
let scanned = 0;
const offenders = [];
for (const dir of SRC_DIRS) {
  for (const file of readdirSync(join(ROOT, dir))) {
    if (!/\.tsx?$/.test(file)) continue;
    const full = join(dir, file);
    const src = readFileSync(join(ROOT, full), "utf8");
    scanned += 1;
    for (const line of src.split("\n")) {
      // The hook itself is the one legitimate home for the shape, and
      // prose about the incident is not code.
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) continue;
      if (!/search|portalSearch/.test(line)) continue;
      if (LITERAL.test(line)) offenders.push(`${full}: ${line.trim()}`);
    }
  }
}
check(`scanned the portal sources (${scanned} files)`, scanned >= 40, `only ${scanned}`);
check(
  "no hand-built { organizationId, locationId, routerId } search object",
  offenders.length === 0,
  offenders.join(" | ") + " -- use usePortalLinkSearch() instead",
);
check(
  "the one shared usePortalLinkSearch hook exists",
  /export function usePortalLinkSearch\(\)/.test(
    readFileSync(join(ROOT, "src/components/portal-runtime/usePortalLinkSearch.ts"), "utf8"),
  ),
);

rmSync(work, { recursive: true, force: true });

console.log("");
if (failures) {
  console.log(`portal search retention: ${failures} FAILED`);
  process.exit(1);
}
console.log("portal search retention: all checks passed");
