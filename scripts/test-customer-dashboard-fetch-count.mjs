/**
 * Regression test: ONE LOAD OF THE CUSTOMER DASHBOARD FETCHES EACH DATASET
 * ONCE.
 *
 * Run: `bun run test:dashboard-fetch-count`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * A live capture of one load of https://app.wyfyguest.com/ issued 31
 * `/api/v1/` requests. Five datasets came back more than once:
 *
 *   GET /guests?location_id=…&page_size=100            x2, byte-identical
 *   GET /locations/{id}/routers?page_size=100          x2, byte-identical
 *   GET /guest-sessions?location_id=…                  x3  (100 / 1&6 / 50)
 *   GET /alerts?organization_id=…                      x2  (1&20 / 10)
 *   GET /isp/links                                     x2  (100 / 1&100)
 *
 * None of it was React Query refetching. Every pair was two *independent
 * call sites*, and three of the five turned out to be code nothing on the
 * page ever read:
 *
 *   1. `useCustomerUsers(locationId, { page: 1, pageSize: 6 })` in
 *      `CustomerDashboardPage` bound its result to `uData` and never used
 *      it -- the "Recent Users" table renders `d.recentUsers`, from
 *      `getDashboard()`. `getUsers()` costs three requests, one of which
 *      is the duplicate `/guests?page_size=100`. `no-unused-vars` is off
 *      in this repo's eslint config, so nothing flagged the binding.
 *   2. `useCustomerLocations()` on the same page fed a store-resync guard
 *      that cannot run: `locationId` is assigned from `activeLocationId`,
 *      so the guard's `activeLocationId !== locationId` is false by
 *      construction. `listLocations()` fans out per location, and its
 *      `/locations/{id}/routers?page_size=100` is byte-identical -- same
 *      params, same X-Organization-Id + X-Location-Id -- to the one
 *      `getDashboard()` makes.
 *   3. `getDashboard()`'s SLA leg read `/isp/links` with an inline
 *      `api.get`, bypassing `ispService.listLinks` entirely. It now goes
 *      through the service -- which needed two fixes of its own before
 *      that helped: the coalescing key had to stop treating an omitted
 *      `page` and `page: 1` as different requests, and it had to start
 *      sharing a settled result briefly, because these two readers turn
 *      out to be sequential rather than concurrent (see the timeline this
 *      test prints, and `LINKS_SHARE_WINDOW_MS`'s own comment).
 *
 * WHY IN A BROWSER, AND WHY THE FAKE HAS LATENCY
 * ---------------------------------------------
 * These are timing facts, not source-text facts: they need a real mount, a
 * real effect flush and a real React Query cache to appear at all. Neither
 * `tsc` nor a grep can see them, and this repo has no test runner (same
 * note as `scripts/test-network-page-fetch-count.mjs`, on which this is
 * modelled) -- so the real components run in real Chromium via esbuild.
 *
 * The recording fake answers after ~12ms rather than immediately, and that
 * is load-bearing rather than incidental. Both mechanisms this page relies
 * on are about elapsed time: the two WAN cards share an *in-flight*
 * `listLinks` promise, which a zero-latency fake makes structurally
 * impossible (every request settles before the next caller reaches it), and
 * `getDashboard()`'s own read is separated from theirs by a measurable gap
 * that only exists if requests take time. A 0ms fake would report
 * duplicates production does not have, and would hide the gap that decided
 * how the sharing works.
 *
 * 12ms is not a claim about production latency -- it is the smallest value
 * that makes the ORDER real. The gap that matters scales with RTT (it is
 * one links round trip plus one summary round trip), so a real connection
 * has a much larger one; that is why the share window is sized in seconds
 * and not against the numbers printed here.
 *
 * The only substitution is `@/services/api` (a recording fake, so counts
 * are taken at the axios seam where the duplicates were observed). Every
 * service, hook, query key and component below it is the shipping one,
 * `CustomerDashboardPage` included. `@tanstack/react-router` is stubbed
 * because there is no router here and `useNavigate` needs one; nothing
 * under test navigates.
 *
 * CASE 2 IS THE CONTROL. It drives the three service functions the page
 * used to drive -- `getDashboard` + `getUsers` + `listLocations`, exactly
 * the pre-fix set -- and asserts the duplicates DO appear, with the same
 * counts the live capture showed. Without it, "exactly one request" could
 * just mean the harness never sees a second one and case 1 would prove
 * nothing.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "dashboard-fetch-count-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name} -- ${detail}`);
  }
};

const LOC = "loc-1";
const ORG = "org-1";

// --- the recording fake for `@/services/api` --------------------------
// Shaped like the real module's surface: `api` with get/post/put/delete
// resolving `{ data }` (the real response interceptor has already
// unwrapped the backend envelope by the time a service sees it), plus the
// storage-key constants and helpers the app imports from the same module.
const API_STUB = `
const LOC = ${JSON.stringify(LOC)};
const ORG = ${JSON.stringify(ORG)};

const page = (items, extra = {}) => ({
  items, page: 1, page_size: 100, total_items: items.length,
  total_pages: 1, has_next: false, has_previous: false, ...extra,
});

const LINK = {
  id: "isp-1", router_id: "r1", organization_id: ORG, location_id: LOC,
  provider_name: "Airtel", link_type: "fiber", connection_mode: "static",
  role: "primary", is_active_uplink: true, auto_failback: true,
  is_enabled: true, priority: 0, interface: "ether1",
  gateway_ip_address: "203.0.113.1", dns_primary: null, dns_secondary: null,
  download_bandwidth_mbps: 500, upload_bandwidth_mbps: 200,
  health_status: "healthy", health_status_source: "automated",
  unhealthy_since: null, latency_ms: 12, packet_loss_percentage: 0,
  current_download_mbps: 100, current_upload_mbps: 20,
  last_checked_at: "2026-01-01T00:00:00Z", consecutive_unhealthy_count: 0,
  created_at: "2026-01-01T00:00:00Z",
};

window.__CALLS__ = [];

function body(url) {
  if (url === "/auth/me") {
    return { id: "u1", email: "owner@example.com", full_name: "Owner", phone_number: null,
             is_active: true, is_verified: true, created_at: "2026-01-01T00:00:00Z" };
  }
  if (url === "/me/permissions") return { user_id: "u1", permissions: ["*"] };
  if (url === "/me/organizations") {
    return [{ id: "m1", organization_id: ORG, status: "active" }];
  }
  if (url === "/dashboard/organization") {
    return { routers_online: 1, routers_offline: 0, total_guests: 3, active_sessions: 1 };
  }
  if (url === "/isp/links") return page([LINK]);
  if (/^\\/isp\\/links\\/[^/]+\\/health-checks$/.test(url)) return page([]);
  if (/^\\/isp\\/links\\/[^/]+\\/health-checks\\/summary$/.test(url)) {
    return { bucket_unit: "hour", start: "", end: "", buckets: [] };
  }
  if (/^\\/organizations\\/[^/]+\\/locations$/.test(url)) {
    return page([{ id: LOC, name: "Front Desk", city: "Mumbai", property_type: "hotel" }]);
  }
  if (/^\\/users\\/[^/]+$/.test(url)) {
    return { id: "u1", email: "owner@example.com", full_name: "Owner",
             data_masking_enabled: true, is_active: true, roles: [] };
  }
  return page([]);
}

// A few milliseconds, deliberately -- see this file's header. An
// immediately-resolving fake makes in-flight coalescing structurally
// impossible and would report duplicates production does not have.
const LATENCY_MS = 12;

function record(method, url, config) {
  window.__CALLS__.push({
    method, url,
    at: Math.round(performance.now()),
    params: config?.params ?? null,
    orgHeader: config?.headers?.["X-Organization-Id"] ?? null,
    locationHeader: config?.headers?.["X-Location-Id"] ?? null,
  });
}
const settle = (v) => new Promise((r) => setTimeout(() => r(v), LATENCY_MS));

export const api = {
  get: async (url, config) => { record("get", url, config); return settle({ data: body(url) }); },
  post: async (url, _b, config) => { record("post", url, config); return settle({ data: {} }); },
  put: async (url, _b, config) => { record("put", url, config); return settle({ data: {} }); },
  delete: async (url, config) => { record("delete", url, config); return settle({ data: {} }); },
};
export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const REFRESH_TOKEN_STORAGE_KEY = "cloudguest_refresh_token";
export const USER_STORAGE_KEY = "cloudguest_user";
export const ROLES_STORAGE_KEY = "cloudguest_roles";
export const ORGS_STORAGE_KEY = "cloudguest_organizations";
export const ACTIVE_ORG_STORAGE_KEY = "cg.activeOrgId";
export const ORG_HEADER = "X-Organization-Id";
export function toAppError(e) { return { message: String(e), status: 0 }; }
export function getAbsoluteApiBase() { return "http://localhost/api/v1"; }
export function resolveActiveOrganizationId() { return null; }
export function setActiveOrganizationId() {}
export default api;
`;
writeFileSync(join(work, "api-stub.js"), API_STUB);

// No router in this harness. Nothing under test navigates; `useNavigate`
// only has to exist. Named exports are enumerated because esbuild resolves
// ESM named imports statically -- a missing one fails the build loudly
// rather than degrading, which is what we want (see
// test-portal-cna-storage-safety.mjs's own note on this).
writeFileSync(
  join(work, "router-stub.js"),
  `export function createFileRoute() { return (o) => o; }
   export function createRootRoute() { return {}; }
   export function useNavigate() { return () => {}; }
   export function useRouter() { return { navigate: () => {} }; }
   export function useRouterState() { return { location: { pathname: "/" } }; }
   export function useParams() { return {}; }
   export function useSearch() { return {}; }
   export function redirect(o) { return o; }
   export function Link({ children }) { return children ?? null; }
   export function Outlet() { return null; }
`,
);

// --- the harness ------------------------------------------------------
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { useEffect, useState } from "react";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { TooltipProvider } from "@/components/ui/tooltip";
   import { AuthProvider } from "@/context/AuthContext";
   import { useCustomerStore } from "@/stores/customerStore";
   import { CustomerDashboardPage } from "@/components/customer/CustomerDashboardPage";
   import { customerService } from "@/services/customer.service";

   const LOC = ${JSON.stringify(LOC)};
   const ORG = ${JSON.stringify(ORG)};

   // A real-looking (non-demo) session: every service short-circuits to a
   // fixture under the demo token and would reach no backend at all.
   localStorage.setItem("cloudguest_token", "a-real-looking-token");
   localStorage.setItem("cloudguest_user", JSON.stringify({
     id: "u1", email: "owner@example.com", fullName: "Owner",
   }));
   localStorage.setItem("cloudguest_roles", JSON.stringify([
     { roleName: "organization-owner", scopeType: "organization", organizationId: ORG, locationId: null },
   ]));
   localStorage.setItem("cloudguest_organizations", JSON.stringify([
     { organizationId: ORG, organizationName: "Acme", status: "active" },
   ]));

   // The store is what the page reads its location out of -- index.tsx
   // will not render this component until it is set.
   useCustomerStore.setState({
     activeLocationId: LOC,
     activeLocation: {
       id: LOC, name: "Front Desk", city: "Mumbai", organizationId: ORG,
       organizationName: "Acme", onlineUsers: 0, bandwidth: "0 MB",
       isp: "Active", lastSync: "Just now", sessionsActive: 0,
       sessionsTotal: 0, routersOnline: 1, routersTotal: 1,
       status: "online", liveness: { state: "live", routersOnline: 1, routersTotal: 1 },
     },
   });

   /** CONTROL. The three service calls this page used to make on mount,
    *  driven concurrently exactly as the page drove them. Every duplicate
    *  the live capture found is produced by this trio, so if the harness
    *  cannot see them here it is not counting. */
   function PreFixServiceCalls() {
     const [done, setDone] = useState(false);
     useEffect(() => {
       Promise.allSettled([
         customerService.getDashboard(LOC),
         customerService.getUsers(LOC, undefined, undefined, 1, 6),
         customerService.listLocations(),
       ]).then(() => setDone(true));
     }, []);
     return <div>{done ? "done" : "running"}</div>;
   }

   const which = new URLSearchParams(location.search).get("case");
   const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   const body = which === "control" ? <PreFixServiceCalls /> : <CustomerDashboardPage />;

   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={client}>
       <AuthProvider>
         <TooltipProvider>{body}</TooltipProvider>
       </AuthProvider>
     </QueryClientProvider>,
   );
`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  // The entry lives in a temp dir, so bare specifiers have no node_modules
  // above them to walk into -- point esbuild at the repo's own. This is the
  // real React/React Query the app ships.
  nodePaths: [resolve(ROOT, "node_modules")],
  loader: { ".css": "empty" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "dashboard-aliases",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({
          path: join(work, "api-stub.js"),
        }));
        b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: join(work, "router-stub.js"),
        }));
        // Modules inside src/services reach the api as a relative "./api"
        // -- catch those too, or the real axios instance loads alongside
        // the stub and half the requests go uncounted.
        b.onResolve({ filter: /^\.\.?\// }, (args) => {
          const target = resolve(args.resolveDir, args.path);
          if (target === join(ROOT, "src", "services", "api")) {
            return { path: join(work, "api-stub.js") };
          }
          return null;
        });
        // `@/x` -> `<root>/src/x`, with the extension probing esbuild would
        // otherwise do for us (an onResolve result must be an exact path).
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          const probes = [
            base,
            `${base}.tsx`,
            `${base}.ts`,
            join(base, "index.tsx"),
            join(base, "index.ts"),
          ];
          for (const p of probes) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8>
   <title>Customer dashboard fetch-count harness</title>
   <div id=root></div>
   <script type=module src="./bundle.js"></script>`,
);

const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const file = readFileSync(join(work, name === "/" ? "/index.html" : name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(file);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

/** Loads one case and returns every recorded request. A fresh page per
 *  case means a fresh QueryClient and fresh module state (the shared
 *  org-id resolver and the isp single-flight map both live at module
 *  scope), so cases cannot mask each other. */
async function callsFor(which) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/index.html?case=${which}`);
  await page.waitForFunction(() => Array.isArray(window.__CALLS__), null, { timeout: 15_000 });
  // Settle: effects flush, the post-mount demo flag flips, every chained
  // fetch (org id -> dashboard -> health-check summary) completes. A
  // duplicate that arrives late still gets counted. Comfortably shorter
  // than the page's own 20s poll intervals, so no poll tick lands here
  // and inflates a count.
  await page.waitForTimeout(2500);
  const calls = await page.evaluate(() => window.__CALLS__);
  await page.close();
  if (errors.length) throw new Error(`${which}: page errors: ${errors.join(" | ")}`);
  return calls;
}

const countOf = (calls, url) => calls.filter((c) => c.url === url).length;
const listOf = (calls, url) =>
  JSON.stringify(calls.filter((c) => c.url === url).map((c) => c.params));

console.log("\nCustomer dashboard, mounted for real:");

// 1 -- The page itself. One request per dataset.
const dash = await callsFor("dashboard");

check(
  "guests-once",
  countOf(dash, "/guests") === 1,
  `GET /guests issued ${countOf(dash, "/guests")} time(s), expected 1 -- ${listOf(dash, "/guests")}`,
);
check(
  "routers-once",
  countOf(dash, `/locations/${LOC}/routers`) === 1,
  `GET /locations/{id}/routers issued ${countOf(dash, `/locations/${LOC}/routers`)} time(s), expected 1 -- ${listOf(dash, `/locations/${LOC}/routers`)}`,
);
check(
  "guest-sessions-once",
  countOf(dash, "/guest-sessions") === 1,
  `GET /guest-sessions issued ${countOf(dash, "/guest-sessions")} time(s), expected 1 -- ${listOf(dash, "/guest-sessions")}`,
);
// Three readers now: the two WAN cards' `listLinks({ page: 1, ... })` and
// `getDashboard()`'s SLA leg, which omits `page`. All three collapse only
// because the key is normalised before it is written -- see
// `normalizeLinkQuery` and scripts/test-isp-links-single-flight.mjs.
check(
  "isp-links-once",
  countOf(dash, "/isp/links") === 1,
  `GET /isp/links issued ${countOf(dash, "/isp/links")} time(s), expected 1 -- ${listOf(dash, "/isp/links")}`,
);
// The dead `useCustomerUsers` was this page's only reader of
// /connected-devices; nothing on it renders a device MAC.
check(
  "no-connected-devices-read",
  countOf(dash, "/connected-devices") === 0,
  `GET /connected-devices issued ${countOf(dash, "/connected-devices")} time(s), expected 0`,
);
// listLocations()' first leg. Its whole fan-out fed an unreachable guard.
check(
  "no-org-locations-fanout",
  countOf(dash, `/organizations/${ORG}/locations`) === 0,
  `GET /organizations/{id}/locations issued ${countOf(dash, `/organizations/${ORG}/locations`)} time(s), expected 0`,
);
// The shared resolver, still doing its job under three concurrent callers.
check(
  "org-lookup-at-most-once",
  countOf(dash, "/me/organizations") <= 1,
  `GET /me/organizations issued ${countOf(dash, "/me/organizations")} time(s)`,
);

// /alerts IS STILL TWO, AND THAT IS THE ANSWER, NOT AN OVERSIGHT.
//
// The header bell (`useAlertsFeed("org")`) reads page_size=20 org-wide and
// re-sorts client-side by triggeredAt "regardless of what the backend's
// default sort is" -- its own comment. The dashboard's Recent Alerts panel
// reads page_size=10 through `getDashboard()` and renders server order.
// Serving the 10 from the 20 would change which alerts appear the moment
// those two orderings disagree, which is a rendered-content change, not
// plumbing. They also differ in demo mode (the bell returns [], the
// dashboard shows its fixture) and in scope headers. Two honest requests
// beat one that quietly changes a panel. Pinned at 2 so that a future
// merge has to be a deliberate edit to this line.
check(
  "alerts-deliberately-two",
  countOf(dash, "/alerts") === 2,
  `GET /alerts issued ${countOf(dash, "/alerts")} time(s), expected 2 (bell page_size=20 + dashboard page_size=10) -- ${listOf(dash, "/alerts")}`,
);

// Two `/isp/links/{id}/health-checks` reads are expected and are NOT a
// duplicate pair: the WAN card asks for 12 rows and the bandwidth chart
// for 60, which are different responses. They could be collapsed by
// slicing the 60 -- but only by coupling a card that never refreshes to
// one that polls every 20s, which would start changing what the WAN card
// shows. Left alone deliberately.
//
// The timeline below is not decoration. It is the measurement that
// decided how `listLinks` shares: it shows `getDashboard()`'s read and the
// WAN cards' read separated by a links round trip plus a summary round
// trip, i.e. strictly sequential, which is why an in-flight-only coalescer
// could not close that pair. Re-read it before changing
// LINKS_SHARE_WINDOW_MS.
console.log(`  info total requests on one dashboard load: ${dash.length}`);
console.log(`  info timeline: ${JSON.stringify(dash.map((c) => [c.at, c.url]))}`);
console.log(
  `  info urls: ${JSON.stringify(
    Object.entries(
      dash.reduce((acc, c) => ({ ...acc, [c.url]: (acc[c.url] ?? 0) + 1 }), {}),
    ).sort(),
  )}`,
);

// 2 -- CONTROL. The pre-fix trio of service calls, so a passing case 1
//      means the harness can actually see a duplicate rather than never
//      looking. These are the live capture's own numbers.
const control = await callsFor("control");
check(
  "control-guests-does-double",
  countOf(control, "/guests") === 2,
  `getDashboard + getUsers issued /guests ${countOf(control, "/guests")} time(s); if this is not 2 the harness is not detecting duplicates and case 1 proves nothing`,
);
check(
  "control-routers-does-double",
  countOf(control, `/locations/${LOC}/routers`) === 2,
  `getDashboard + listLocations issued /locations/{id}/routers ${countOf(control, `/locations/${LOC}/routers`)} time(s); expected 2`,
);
check(
  "control-guest-sessions-triples",
  countOf(control, "/guest-sessions") === 3,
  `the pre-fix trio issued /guest-sessions ${countOf(control, "/guest-sessions")} time(s); expected 3 (100 / 1&6 / 50)`,
);

await browser.close();
server.close();

console.log("");
if (failures.length) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("all checks passed");
