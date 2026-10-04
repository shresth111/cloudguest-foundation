/**
 * Internet Connection and Instant On data at an Aruba Instant On venue
 * (DASHBOARD_PLAN P1-L, P1-K) -- and, FIRST, proof that a MikroTik venue and
 * an Omada venue render and request exactly as they did.
 *
 * Run: node scripts/test-aruba-instant-on-data.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 *   1. MIKROTIK AND OMADA ARE UNCHANGED: Internet Connection (Speed Test,
 *      "Real WAN uplinks per router"), Alerts and the dashboard make no
 *      `/instant-on/` request and render no instant-on-* element. With
 *      `BASELINE_ROOT=<origin/staging checkout>` DOM and request list must
 *      be identical.
 *   2. P1-L, ARUBA: no Speed Test button, no "WAN uplinks per router"; the
 *      ISP record (provider) is still there.
 *   3. P1-K, ARUBA: the customer `instant-on/{access-points,clients,ssids,
 *      alerts}` routes are read; `status: unavailable` and a failed request
 *      both say "Data unavailable · source Instant On", never 0; `ok` data
 *      is shown (1 of 2 online, 3 devices, SSID names, alert rows).
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
};
// The legacy page keeps only rows of the caller's organization.
for (const rows of Object.values(VENUES)) {
  for (const r of rows) Object.assign(r, { organization_id: ORG, location_id: LOC, model: "hAP" });
}

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
  ...(VENUE === "aruba" && apMac ? { ap_mac: apMac, ap_name: null } : {}),
});
const SESSIONS = [
  session("s1", "g1", "11:11:11:11:11:11", ${JSON.stringify(AP1)}),
  session("s22", "g2", "22:22:22:22:22:22", ${JSON.stringify(AP2)}),
];
function body(url, config) {
  if (url === "/auth/me") return { id: "u1", email: "owner@example.com", full_name: "Owner", phone_number: null, is_active: true, is_verified: true, created_at: NOW };
  if (url === "/me/permissions") return { user_id: "u1", permissions: ["*"] };
  if (url === "/me/organizations") return [{ id: "m1", organization_id: ORG, status: "active" }];
  if (url === "/locations/" + LOC + "/routers") return page(ROUTERS);
  if (url === "/isp/links") {
    return page([{ id: "l1", router_id: "r1", organization_id: ORG, location_id: LOC,
      provider_name: "Airtel Fibre", link_type: "fiber", connection_mode: "dhcp", role: "primary",
      is_active_uplink: true, auto_failback: true, is_enabled: true, priority: 1, interface: "ether1",
      gateway_ip_address: null, dns_primary: null, dns_secondary: null, download_bandwidth_mbps: 100,
      upload_bandwidth_mbps: 100, health_status: "unknown", health_status_source: "none",
      unhealthy_since: null, latency_ms: null, packet_loss_percentage: null,
      current_download_mbps: null, current_upload_mbps: null, last_checked_at: null,
      consecutive_unhealthy_count: 0, created_at: NOW }]);
  }
  const ioPrefix = "/network-integrations/locations/" + LOC + "/instant-on/";
  const io = url.startsWith(ioPrefix) ? [url, url.slice(ioPrefix.length)] : null;
  if (io) {
    if (MODE === "io-fail") throw Object.assign(new Error("500"), { status: 500 });
    if (MODE !== "io-ok") return { source: "instant_on", kind: io[1], status: "unavailable",
      unavailable_reason: "not_configured", as_of: null, last_success_at: null,
      stale_after_seconds: 900, items: null };
    const items = {
      "access-points": [{ name: "Lobby", mac: "aa:bb", status: "online" }, { name: "Terrace", mac: "cc:dd", status: "offline" }],
      clients: [{ mac: "1", connection: "wireless" }, { mac: "2", connection: "wireless" }, { mac: "3", connection: "wireless" }],
      ssids: [{ name: "WYFY_ARUBA", enabled: true }, { name: "WYFY_PREMIUM", enabled: true }],
      alerts: [{ type: "access_point_down", severity: "major", device_name: "Terrace", raised_at: NOW, is_cleared: false }],
    }[io[1]];
    return { source: "instant_on", kind: io[1], status: "ok", unavailable_reason: null, as_of: NOW,
      last_success_at: NOW, stale_after_seconds: 900, items };
  }
  if (url === "/connected-devices") {
    return page([{ id: "d1", mac_address: "11:11:11:11:11:11", ip_address: "10.0.0.9",
      hostname: "phone", vendor: null, connected_at: NOW, last_seen_at: NOW }]);
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

const ROUTER_STUB = `export function createFileRoute() { return (o) => ({ ...o,
  useParams: () => ({ locationId: ${JSON.stringify(LOC)} }), useSearch: () => ({ tab: new URLSearchParams(location.search).get("tab") || "overview" }) }); }
export function createRootRoute() { return {}; }
window.__NAV__ = [];
export function useNavigate() { return (o) => { window.__NAV__.push(o); }; }
export function useRouter() { return { navigate: () => {} }; }
export function useRouterState() { return { location: { pathname: "/" } }; }
export function useParams() { return {}; }
export function useSearch() { return {}; }
export function redirect(o) { return o; }
export function Link({ children }) { return children ?? null; }
export function useLocation() { return { pathname: "/" }; }
export function Outlet() { return null; }
`;

const WORKSPACE_STUB = `
const LOC = ${JSON.stringify(LOC)};
const customer = { id: ${JSON.stringify(ORG)}, name: "Acme", organizationId: ${JSON.stringify(ORG)},
  organizationName: "Acme", subscription: { plan: null, billingCycle: "monthly", status: "active", expiryDate: "" },
  owner: { name: "Owner", email: "owner@example.com", mobile: "", role: "Organization Admin", assignedLocations: 1 },
  locations: [{ id: LOC, name: "Front Desk", siteType: "hotel", city: "Mumbai" }], status: "active" };
export function useWorkspace() {
  return { customer, locations: customer.locations, isLoading: false, isError: false,
    activeLocationId: LOC, activeLocation: customer.locations[0], setActiveLocationId() {}, refetch() {} };
}
export function WorkspaceProvider({ children }) { return children; }
`;

function entry(venue) {
  return `import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { deriveLocationLiveness } from "@/lib/location-liveness";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";
import { CustomerDashboardPage } from "@/components/customer/CustomerDashboardPage";

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
const liveness = deriveLocationLiveness(${JSON.stringify(VENUES[venue])}, new Date(${JSON.stringify(NOW_ISO)}));
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
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={client}>
    <AuthProvider>
      <TooltipProvider>{which === "dashboard" ? <CustomerDashboardPage /> : <CustomerFeaturePage feature={which} />}</TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
`;
}

async function bundleFor(root, venue, mode) {
  const work = mkdtempSync(join(tmpdir(), `aruba-io-data-${venue}-`));
  writeFileSync(join(work, "api-stub.js"), apiStub(venue, mode));
  writeFileSync(join(work, "router-stub.js"), ROUTER_STUB);
  writeFileSync(join(work, "workspace-stub.js"), WORKSPACE_STUB);
  writeFileSync(join(work, "entry.jsx"), entry(venue));
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
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: true }),
    },
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
          b.onResolve({ filter: /^@\/context\/WorkspaceContext$/ }, () => ({
            path: join(work, "workspace-stub.js"),
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

const has = (html, testid) => html.includes(`data-testid="${testid}"`);
const text = async (page) => page.evaluate(() => document.getElementById("root").innerText);
const sig = (calls) =>
  calls
    .map((c) => `${c.method} ${c.url} ${JSON.stringify(c.params)}`)
    .sort()
    .join("\n");
const ioCalls = (calls) => calls.filter((c) => c.url.includes("/instant-on/"));
const wait = (page, ms = 1500) => page.waitForTimeout(ms);

console.log("\n1. MikroTik and Omada render and request unchanged");
for (const venue of ["mikrotik", "omada"]) {
  for (const which of ["isp-details", "alerts", "dashboard"]) {
    const r = await render(ROOT, venue, which);
    if (which === "isp-details") await wait(r.page);
    const t = await text(r.page);
    check(`${venue} ${which}: no instant-on request`, ioCalls(r.calls).length === 0);
    check(`${venue} ${which}: no instant-on-* element`, !/data-testid="instant-on-/.test(r.html));
    if (which === "isp-details") {
      check(`${venue} isp: WAN uplinks header kept`, /Real WAN uplinks per router/.test(t));
      check(
        `${venue} isp: Speed Test button kept`,
        (await r.page.$$('button[title="Run a real speed test against this link\'s router"]'))
          .length === 1,
      );
    }
    if (BASELINE_ROOT) {
      const b = await render(BASELINE_ROOT, venue, which);
      if (which === "isp-details") await wait(b.page);
      const head = which === "isp-details" ? await render(ROOT, venue, which) : r;
      if (head !== r) await wait(head.page);
      const hh =
        head === r
          ? r.html
          : normalise(await head.page.evaluate(() => document.getElementById("root").innerHTML));
      const bh = normalise(await b.page.evaluate(() => document.getElementById("root").innerHTML));
      check(
        `${venue} ${which}: DOM identical to baseline`,
        bh === hh,
        `lengths ${bh.length} vs ${hh.length}`,
      );
      if (bh !== hh) {
        writeFileSync(join(tmpdir(), `aruba-io-${venue}-${which}-base.html`), bh);
        writeFileSync(join(tmpdir(), `aruba-io-${venue}-${which}-head.html`), hh);
      }
      const hc = await head.page.evaluate(() => window.__CALLS__);
      const bc = await b.page.evaluate(() => window.__CALLS__);
      check(
        `${venue} ${which}: request list identical to baseline`,
        sig(bc) === sig(hc),
        `${bc.length} vs ${hc.length}`,
      );
      await done(b);
      if (head !== r) await done(head);
    }
    await done(r);
  }
}
if (!BASELINE_ROOT)
  console.log("  (set BASELINE_ROOT=<origin/staging checkout> for the DOM/request diff)");

console.log("\n2. Aruba Internet Connection (P1-L)");
{
  const r = await render(ROOT, "aruba", "isp-details");
  await wait(r.page);
  const t = await text(r.page);
  check("ISP record still shown (provider)", /Airtel Fibre/.test(t));
  eq(
    "no Speed Test button",
    (await r.page.$$('button[title="Run a real speed test against this link\'s router"]')).length,
    0,
  );
  check("no 'WAN uplinks per router' header", !/WAN uplinks per router/.test(t));
  check("header names the Instant On app", /Instant On app/.test(t));
  check("no failover offered", !/Trigger failover/.test(t));
  await done(r);
}

console.log("\n3. Aruba Instant On data (P1-K)");
{
  const r = await render(ROOT, "aruba", "dashboard");
  const kinds = ioCalls(r.calls)
    .map((c) => c.url.split("/").pop())
    .sort();
  eq(
    "dashboard reads access-points, clients, ssids",
    JSON.stringify(kinds),
    JSON.stringify(["access-points", "clients", "ssids"]),
  );
  check(
    "unavailable: honest sentence",
    has(r.html, "instant-on-unavailable") &&
      /Data unavailable · source Instant On/.test(await text(r.page)),
  );
  const block = await r.page.$eval('[data-testid="instant-on-venue-data"]', (e) => e.innerText);
  check("unavailable: no zero", !/\b0\b/.test(block), block);
  eq(
    "still one P0-A2 access-points request",
    r.calls.filter((c) => c.url === "/locations/" + LOC + "/access-points").length,
    1,
  );
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { mode: "io-fail" });
  check("failed request: honest sentence", has(r.html, "instant-on-unavailable"));
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { mode: "io-ok" });
  const block = await r.page.$eval('[data-testid="instant-on-venue-data"]', (e) => e.innerText);
  check("ok: 1 of 2 online", /Access points\s*1 of 2 online/.test(block), block);
  check("ok: 3 devices", /Devices connected\s*3/.test(block), block);
  check("ok: SSID names", /WYFY_ARUBA, WYFY_PREMIUM/.test(block), block);
  check("ok: no unavailable sentence", !/Data unavailable/.test(block), block);
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "alerts");
  eq(
    "alerts page reads instant-on alerts",
    ioCalls(r.calls)
      .map((c) => c.url.split("/").pop())
      .join(),
    "alerts",
  );
  check("alerts unavailable: honest sentence", has(r.html, "instant-on-alerts-unavailable"));
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "alerts", { mode: "io-ok" });
  const rows = await r.page.$$eval('[data-testid="instant-on-alert-row"]', (els) =>
    els.map((e) => e.innerText),
  );
  eq("alerts ok: one row", rows.length, 1);
  check(
    "alerts ok: readable type + device",
    /Access point down · Terrace/.test(rows[0] ?? ""),
    rows[0],
  );
  await done(r);
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures.length) {
  console.log(`aruba instant on data: ${failures.length} FAILED`);
  process.exit(1);
}
console.log("aruba instant on data: all checks passed");
