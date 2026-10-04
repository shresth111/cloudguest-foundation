/**
 * The customer dashboard at an Aruba Instant On venue (DASHBOARD_PLAN P0-C),
 * and, FIRST, proof that a MikroTik venue and an Omada venue render exactly
 * as they did.
 *
 * Run: node scripts/test-aruba-customer-dashboard.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 *   1. MIKROTIK AND OMADA ARE UNCHANGED. The real `CustomerDashboardPage`
 *      and Guests page are mounted at a MikroTik and an Omada venue: no
 *      `aruba-*` element, the Internet Connection card and the System /
 *      Routers / ISP strip and the Uptime KPI are all still there. With
 *      `BASELINE_ROOT=<a checkout of origin/staging>` both venues are also
 *      rendered from that checkout and the normalised DOM must be identical.
 *
 *   2. ARUBA: NO ROUTER-ONLY FIGURE ANYWHERE ON THE DASHBOARD. No Internet
 *      Connection card (so no Speed Test), no System / Routers / ISP, no
 *      Uptime; instead guests online, last sign-in and sign-ins today from
 *      this platform's own session records -- "—" when that read failed,
 *      never a 0 standing in for it.
 *
 * Harness: the same as `scripts/test-customer-dashboard-fetch-count.mjs` --
 * only `@/services/api` (a recording fake) and the router are substituted.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_ROOT = process.env.BASELINE_ROOT ? resolve(process.env.BASELINE_ROOT) : null;

let ran = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  ran += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
  }
};
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const LOC = "loc-1";
const ORG = "org-1";
const AP1 = "AA:BB:CC:00:00:01";
const AP2 = "AA:BB:CC:00:00:02";

const NOW_ISO = "2026-10-04T10:00:00.000Z";

const VENUES = {
  mikrotik: [
    { id: "r1", name: "Gateway", status: "online", last_seen_at: NOW_ISO, vendor: "mikrotik" },
  ],
  omada: [
    { id: "r1", name: "Omada", status: "online", last_seen_at: null, vendor: "tplink_omada" },
  ],
  aruba: [
    { id: "r1", name: "AP21", status: "online", last_seen_at: null, vendor: "aruba_instant_on" },
  ],
  // P1-F: the backend's `last_radius_at` (P1-E), NAS-only rows only.
  "aruba-active": [
    {
      id: "r1",
      name: "AP21",
      status: "pending_provisioning",
      last_seen_at: null,
      vendor: "aruba_instant_on",
      last_radius_at: "2026-10-04T09:56:00.000Z",
    },
  ],
  "aruba-quiet": [
    {
      id: "r1",
      name: "AP21",
      status: "pending_provisioning",
      last_seen_at: null,
      vendor: "aruba_instant_on",
      last_radius_at: "2026-10-04T07:00:00.000Z",
    },
  ],
};
const isAruba = (venue) => venue.startsWith("aruba");

function apiStub(venue, mode) {
  return `
const LOC = ${JSON.stringify(LOC)};
const ORG = ${JSON.stringify(ORG)};
const VENUE = ${JSON.stringify(venue)};
const ROUTERS = ${JSON.stringify(VENUES[venue])};
const MODE = ${JSON.stringify(mode)};
const NOW = ${JSON.stringify(NOW_ISO)};
const page = (items, extra = {}) => ({
  items, page: 1, page_size: 100, total_items: items.length,
  total_pages: 1, has_next: false, has_previous: false, ...extra,
});
window.__CALLS__ = [];
const session = (id, guest, mac, apMac) => ({
  id, status: "active", is_online: true, started_at: NOW, ended_at: null,
  ip_address: "10.0.0." + id.length, router_id: "r1", device_id: null,
  device_mac: mac, guest_id: guest, bytes_downloaded: 0, user_agent: "Android",
  ...(VENUE.startsWith("aruba") && apMac ? { ap_mac: apMac, ap_name: null } : {}),
});
const SESSIONS = [
  session("s1", "g1", "11:11:11:11:11:11", ${JSON.stringify(AP1)}),
  session("s22", "g2", "22:22:22:22:22:22", ${JSON.stringify(AP2)}),
];
function body(url, config) {
  if (url === "/auth/me") return { id: "u1", email: "owner@example.com", full_name: "Owner", phone_number: null, is_active: true, is_verified: true, created_at: NOW };
  if (url === "/me/permissions") return { user_id: "u1", permissions: ["*"] };
  if (url === "/me/organizations") return [{ id: "m1", organization_id: ORG, status: "active" }];
  if (url === "/locations/" + LOC + "/routers") {
    if (MODE === "routers-fail") throw Object.assign(new Error("500"), { status: 500 });
    return page(ROUTERS);
  }
  if (url === "/locations/" + LOC + "/access-points") {
    if (MODE === "ap-fail") throw Object.assign(new Error("404"), { status: 404 });
    return { items: [
      { id: "ap1", name: "Lobby", mac: "aa:bb:cc:00:00:01", model: "AP21", clients_now: 3,
        sessions_today: 9, bytes_today_in: 2000000, bytes_today_out: 1000000,
        last_seen_at: NOW, status: "online", status_source: "radius", as_of: NOW },
      { id: "ap2", name: "Terrace", mac: "aa:bb:cc:00:00:02", model: "AP21", clients_now: null,
        sessions_today: null, bytes_today_in: null, bytes_today_out: null,
        last_seen_at: null, status: "no_recent_activity", status_source: "radius", as_of: NOW },
    ] };
  }
  if (url === "/guest-sessions") {
    if (MODE === "sessions-fail") throw Object.assign(new Error("500"), { status: 500 });
    // Deliberately IGNORES ap_mac, like a backend that predates it: the
    // page must still narrow on its own.
    return page(SESSIONS);
  }
  if (url === "/guest-analytics/dashboard-series") {
    return { start: "", end: "", bucket: "hour", guests: 2, sessions: 2, avg_session_seconds: 600,
             peak_online: 2, series: [{ bucket_start: NOW, arrivals: 1, online: 2 }],
             os_breakdown: [{ name: "Android", count: 2 }] };
  }
  if (/^\\/organizations\\/[^/]+\\/locations$/.test(url)) {
    return page([{ id: LOC, name: "Front Desk", city: "Mumbai", property_type: "hotel" }]);
  }
  if (/^\\/users\\/[^/]+$/.test(url)) return { id: "u1", email: "owner@example.com", full_name: "Owner", data_masking_enabled: true, is_active: true, roles: [] };
  return page([]);
}
function record(method, url, config) {
  window.__CALLS__.push({ method, url, params: config?.params ?? null });
}
const settle = (fn) => new Promise((res, rej) => setTimeout(() => { try { res({ data: fn() }); } catch (e) { rej(e); } }, 8));
export const api = {
  get: async (url, config) => { record("get", url, config); return settle(() => body(url, config)); },
  post: async (url, _b, config) => { record("post", url, config); return settle(() => ({})); },
  put: async (url, _b, config) => { record("put", url, config); return settle(() => ({})); },
  patch: async (url, _b, config) => { record("patch", url, config); return settle(() => ({})); },
  delete: async (url, config) => { record("delete", url, config); return settle(() => ({})); },
  interceptors: { request: { use() {} }, response: { use() {} } },
  defaults: { headers: { common: {} } },
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
export const ORG_SCOPE_HEADER = "X-Organization-Scope";
export const ALL_ORGANIZATIONS = "all";
export function isAppError(v) { return !!v && typeof v === "object" && "message" in v && "status" in v; }
export function requestErrorOf() { return null; }
export function requestErrorMessage(_v, fallback) { return fallback; }
export function resolveOrganizationScope() { return null; }
export function setOrganizationScope() {}
export function crossOrganizationHeaders() { return undefined; }
export default api;
`;
}

const ROUTER_STUB = `export function createFileRoute() { return (o) => o; }
export function createRootRoute() { return {}; }
export function useNavigate() { return () => {}; }
export function useRouter() { return { navigate: () => {} }; }
export function useRouterState() { return { location: { pathname: "/" } }; }
export function useParams() { return {}; }
export function useSearch() { return {}; }
export function redirect(o) { return o; }
export function Link({ children }) { return children ?? null; }
export function Outlet() { return null; }
`;

function entry(venue, mode = "ok") {
  return `import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { deriveLocationLiveness } from "@/lib/location-liveness";
import { CustomerDashboardPage } from "@/components/customer/CustomerDashboardPage";
import { Route as UsersRoute } from "@/routes/users";

const LOC = ${JSON.stringify(LOC)};
const ORG = ${JSON.stringify(ORG)};
localStorage.setItem("cloudguest_token", "a-real-looking-token");
localStorage.setItem("cloudguest_user", JSON.stringify({ id: "u1", email: "owner@example.com", fullName: "Owner" }));
localStorage.setItem("cloudguest_roles", JSON.stringify([
  { roleName: "organization-owner", roleSlug: "organization-owner", scopeType: "organization", organizationId: ORG, locationId: null },
]));
localStorage.setItem("cloudguest_organizations", JSON.stringify([
  { organizationId: ORG, organizationName: "Acme", status: "active" },
]));
// P1-J "stored-failed": the routers read failed when the venue was picked,
// so the persisted snapshot is "can't tell".
const liveness = ${JSON.stringify(mode)} === "stored-failed"
  ? deriveLocationLiveness(null)
  : deriveLocationLiveness(${JSON.stringify(VENUES[venue])}, new Date(${JSON.stringify(NOW_ISO)}));
window.__STORE__ = () => useCustomerStore.getState().activeLocation;
useCustomerStore.setState({
  activeLocationId: LOC,
  activeLocation: {
    id: LOC, name: "Front Desk", city: "Mumbai", organizationId: ORG, organizationName: "Acme",
    onlineUsers: 0, bandwidth: "0 MB", isp: "Active", lastSync: "Just now", sessionsActive: 0,
    sessionsTotal: 0, routersOnline: liveness.routersOnline, routersTotal: liveness.routersTotal,
    status: "online", liveness,
  },
});
const which = new URLSearchParams(location.search).get("page");
const Users = UsersRoute.component;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={client}>
    <AuthProvider>
      <TooltipProvider>{which === "users" ? <Users /> : <CustomerDashboardPage />}</TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
`;
}

async function bundleFor(root, venue, mode) {
  const work = mkdtempSync(join(tmpdir(), `aruba-ap-${venue}-`));
  writeFileSync(join(work, "api-stub.js"), apiStub(venue, mode));
  writeFileSync(join(work, "router-stub.js"), ROUTER_STUB);
  writeFileSync(join(work, "entry.jsx"), entry(venue, mode));
  await build({
    entryPoints: [join(work, "entry.jsx")],
    bundle: true,
    format: "esm",
    jsx: "automatic",
    outfile: join(work, "bundle.js"),
    logLevel: "error",
    nodePaths: [resolve(ROOT, "node_modules")],
    loader: {
      ".css": "empty",
      ".svg": "dataurl",
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".webp": "dataurl",
    },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "aliases",
        setup(b) {
          b.onResolve({ filter: /^@\/services\/api$/ }, () => ({
            path: join(work, "api-stub.js"),
          }));
          b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
            path: join(work, "router-stub.js"),
          }));
          b.onResolve({ filter: /^\.\.?\// }, (args) => {
            const target = resolve(args.resolveDir, args.path);
            if (target === join(root, "src", "services", "api"))
              return { path: join(work, "api-stub.js") };
            return null;
          });
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = join(root, "src", args.path.slice(2));
            for (const p of [
              base,
              `${base}.tsx`,
              `${base}.ts`,
              join(base, "index.tsx"),
              join(base, "index.ts"),
            ]) {
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
    `<!doctype html><meta charset=utf-8><title>aruba ap harness</title><div id=root></div><script type=module src="./bundle.js"></script>`,
  );
  return work;
}

const dirs = new Map();
const server = createServer((req, res) => {
  const [, key, ...rest] = req.url.split("?")[0].split("/");
  const dir = dirs.get(key);
  const name = rest.join("/") || "index.html";
  try {
    const file = readFileSync(join(dir, name));
    res.writeHead(200, { "content-type": name.endsWith(".js") ? "text/javascript" : "text/html" });
    res.end(file);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

/** Strip what legitimately differs between two renders of the same tree:
 * React's generated ids, inline styles (animation progress, chart sizes),
 * looping-animation frame attributes); class lists, text and structure are
 * kept. */
const normalise = (html) =>
  html
    .replace(/\s(id|aria-controls|aria-labelledby|aria-describedby|for)="[^"]*"/g, "")
    .replace(/\sstyle="[^"]*"/g, "")
    // framer-motion's looping SVG animations write their current frame here.
    .replace(/\s(stroke-dashoffset|opacity|transform)="[^"]*"/g, "")
    .replace(/url\(#[^)]*\)/g, "url(#)");

async function render(root, venue, which, { mode = "ok", interact } = {}) {
  const key = `${root === ROOT ? "head" : "base"}-${venue}-${mode}`;
  if (!dirs.has(key)) dirs.set(key, await bundleFor(root, venue, mode));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await page.clock.setFixedTime(new Date(NOW_ISO));
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/${key}/index.html?page=${which}`);
  await page.waitForFunction(() => Array.isArray(window.__CALLS__), null, { timeout: 15_000 });
  await page.waitForTimeout(2500);
  if (interact) await interact(page);
  const html = normalise(await page.evaluate(() => document.getElementById("root").innerHTML));
  const calls = await page.evaluate(() => window.__CALLS__);
  const out = { html, calls, page, errors };
  return out;
}
const done = async (r) => {
  await r.page.close();
  if (r.errors.length) throw new Error(`page errors: ${r.errors.join(" | ")}`);
};
const apCalls = (calls) => calls.filter((c) => c.url.endsWith("/access-points"));
const sessionParams = (calls) =>
  calls.filter((c) => c.url === "/guest-sessions").map((c) => JSON.stringify(c.params));

const has = (html, testid) => html.includes(`data-testid="${testid}"`);
const text = async (page) => page.evaluate(() => document.getElementById("root").innerText);

console.log("\n1. MikroTik and Omada render unchanged");
for (const venue of ["mikrotik", "omada"]) {
  const r = await render(ROOT, venue, "dashboard");
  const t = await text(r.page);
  check(`${venue}: no aruba-* element`, !/data-testid="aruba-/.test(r.html));
  check(`${venue}: Internet Connection card still there`, /Internet Connection/.test(t));
  check(
    `${venue}: System / Routers / ISP strip still there`,
    /System/.test(t) && /Routers/.test(t) && /ISP/.test(t),
  );
  check(`${venue}: Uptime KPI still there`, /Uptime/.test(t));
  check(`${venue}: no Sign-ins today KPI`, !/Sign-ins today/.test(t));
  check(
    `${venue}: links/health read as before`,
    r.calls.some((c) => c.url === "/isp/links"),
  );
  if (BASELINE_ROOT) {
    for (const which of ["dashboard", "users"]) {
      const head = which === "dashboard" ? r : await render(ROOT, venue, which);
      const b = await render(BASELINE_ROOT, venue, which);
      check(
        `${venue} ${which}: DOM identical to baseline ${BASELINE_ROOT}`,
        b.html === head.html,
        `lengths ${b.html.length} vs ${head.html.length}`,
      );
      if (b.html !== head.html) {
        writeFileSync(join(tmpdir(), `aruba-dash-${venue}-${which}-base.html`), b.html);
        writeFileSync(join(tmpdir(), `aruba-dash-${venue}-${which}-head.html`), head.html);
      }
      await done(b);
      if (head !== r) await done(head);
    }
  }
  await done(r);
}
if (!BASELINE_ROOT) console.log("  (set BASELINE_ROOT=<origin/staging checkout> for the DOM diff)");

console.log("\n2. Aruba: no router-only figure on the dashboard (P0-C)");
{
  const r = await render(ROOT, "aruba", "dashboard");
  const t = await text(r.page);
  check("no Internet Connection card", !/Internet Connection/.test(t));
  check("no Speed Test", !/Speed test|Speed Test/.test(t));
  check(
    "no System / Routers / ISP figures",
    !/\bRouters\b/.test(t) && !/\bISP\b/.test(t) && !/System\n/.test(t),
  );
  check("no Uptime KPI", !/Uptime/.test(t));
  // "Unknown guest" is a guest with no name on file -- a real label, not a
  // status. Any other "Unknown" is a router figure leaking through.
  check(
    "no 'Unknown' status anywhere",
    !/\bUnknown\b(?! guest)/.test(t),
    t.match(/.{0,40}Unknown(?! guest).{0,40}/)?.[0],
  );
  check("no 'No ISP link'", !/No ISP link/.test(t));
  check("the Aruba strip is shown", has(r.html, "aruba-status-strip"));
  const strip = await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText);
  check("strip: guests online from sessions (2)", /Guests online\s*2/.test(strip), strip);
  check(
    "strip: last sign-in is a real time",
    /Last sign-in\s*\S/.test(strip) && !/Last sign-in\s*—/.test(strip),
    strip,
  );
  check("strip: access points counted (2)", /Access points\s*2/.test(strip), strip);
  check(
    "strip: no last_radius_at -> last guest activity —, not a time",
    /Last guest activity\s*—/.test(strip),
    strip,
  );
  check(
    "Sign-ins today KPI shows today's sessions (2)",
    /Sign-ins today\s*2/.test(t),
    t.match(/Sign-ins today.{0,20}/s)?.[0],
  );
  check("the venue card is there", has(r.html, "aruba-venue-card"));
  check("Bandwidth still gives way to U6", has(r.html, "aruba-traffic-unsupported"));
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { mode: "sessions-fail" });
  const t = await text(r.page);
  const strip = has(r.html, "aruba-status-strip")
    ? await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText)
    : "";
  check(
    "failed sessions read: strip says —, not 0",
    !strip || (/Guests online\s*—/.test(strip) && !/Guests online\s*0/.test(strip)),
    strip,
  );
  check(
    "failed sessions read: no Uptime / ISP fallback",
    !/Uptime/.test(t) && !/No ISP link/.test(t),
  );
  await done(r);
}

console.log("\n3. Aruba liveness from the access points' own activity (P1-F)");
{
  const r = await render(ROOT, "aruba-active", "dashboard");
  const t = await text(r.page);
  check(
    "recent last_radius_at: status bar says sign-ins working + minutes ago",
    /Guest sign-ins working · last activity 4 minutes ago/.test(t),
    t.slice(0, 300),
  );
  check("badge says Guest sign-ins working", /Guest sign-ins working/.test(t));
  const strip = await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText);
  check(
    "strip: last guest activity 4 minutes ago",
    /Last guest activity\s*4 minutes ago/.test(strip),
    strip,
  );
  check("strip: access points 2", /Access points\s*2/.test(strip), strip);
  check("never Offline", !/\bOffline\b/i.test(t));
  check(
    "never Unknown",
    !/\bUnknown\b(?! guest)/.test(t),
    t.match(/.{0,40}Unknown(?! guest).{0,40}/)?.[0],
  );
  eq(
    "one access-points request (shared with the card)",
    r.calls.filter((c) => c.url.endsWith("/access-points")).length,
    1,
  );
  await done(r);
}
{
  const r = await render(ROOT, "aruba-quiet", "dashboard");
  const t = await text(r.page);
  check(
    "3h-old last_radius_at: No guest activity for 3h",
    /No guest activity for 3h/.test(t),
    t.slice(0, 300),
  );
  check("quiet: never Offline", !/\bOffline\b/i.test(t));
  check("quiet: never Unknown", !/\bUnknown\b(?! guest)/.test(t));
  check("quiet: no 'Guest sign-ins working'", !/Guest sign-ins working/.test(t));
  await done(r);
}
{
  const r = await render(ROOT, "aruba-active", "dashboard", { mode: "ap-fail" });
  const strip = await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText);
  check("failed access-points read: AP count —, never 0", /Access points\s*—/.test(strip), strip);
  await done(r);
}

console.log("\n4. Stale venue snapshot (P1-J)");
{
  // Picked while the routers read failed: the stored snapshot is "can't tell".
  // The Guests page (not the dashboard) re-reads once on load and the Aruba
  // gates apply -- here the access-point filter only an Aruba venue gets.
  const r = await render(ROOT, "aruba-active", "users", { mode: "stored-failed" });
  const routerReads = r.calls.filter((c) => c.url === "/locations/" + LOC + "/routers").length;
  check(
    "stored-failed Aruba: venue routers re-read on load",
    routerReads >= 1,
    String(routerReads),
  );
  const vendors = await r.page.evaluate(() =>
    window.__STORE__()?.liveness?.routers?.map((x) => x.vendor),
  );
  eq(
    "stored snapshot refreshed to Aruba",
    JSON.stringify(vendors),
    JSON.stringify(["aruba_instant_on"]),
  );
  check("Aruba gates applied after load (AP filter)", has(r.html, "aruba-ap-filter"));
  await done(r);
}
{
  // Stored Aruba verdict, then the dashboard's own routers read FAILS: the
  // Aruba dashboard stays (no Internet Connection card, no ISP strip), and
  // the stored snapshot is not overwritten by the failure.
  const r = await render(ROOT, "aruba-active", "dashboard", { mode: "routers-fail" });
  const t = await text(r.page);
  check("failed read: still the Aruba strip", has(r.html, "aruba-status-strip"));
  check("failed read: no Internet Connection card", !/Internet Connection/.test(t));
  check("failed read: no ISP / Routers figures", !/\bISP\b/.test(t) && !/\bRouters\b/.test(t));
  const vendors = await r.page.evaluate(() =>
    window.__STORE__()?.liveness?.routers?.map((x) => x.vendor),
  );
  eq(
    "failed read: stored Aruba snapshot kept",
    JSON.stringify(vendors),
    JSON.stringify(["aruba_instant_on"]),
  );
  await done(r);
}
{
  // Stored Aruba verdict, Guests page, routers read fails: gates stay Aruba.
  const r = await render(ROOT, "aruba-active", "users", { mode: "routers-fail" });
  check("Guests page, failed re-read: Aruba gates kept", has(r.html, "aruba-ap-filter"));
  await done(r);
}
for (const venue of ["mikrotik", "omada"]) {
  for (const which of ["dashboard", "users"]) {
    const r = await render(ROOT, venue, which);
    const routerReads = r.calls.filter((c) => c.url === "/locations/" + LOC + "/routers").length;
    eq(
      `${venue} ${which}: venue routers read count unchanged`,
      routerReads,
      which === "dashboard" ? 1 : 0,
    );
    if (BASELINE_ROOT) {
      const b = await render(BASELINE_ROOT, venue, which);
      const sig = (calls) =>
        calls
          .map((c) => `${c.method} ${c.url} ${JSON.stringify(c.params)}`)
          .sort()
          .join("\n");
      check(
        `${venue} ${which}: request list identical to baseline`,
        sig(b.calls) === sig(r.calls),
        `${b.calls.length} vs ${r.calls.length}`,
      );
      await done(b);
    }
    await done(r);
  }
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures.length) {
  console.log(`aruba customer dashboard: ${failures.length} FAILED`);
  process.exit(1);
}
console.log("aruba customer dashboard: all checks passed");
