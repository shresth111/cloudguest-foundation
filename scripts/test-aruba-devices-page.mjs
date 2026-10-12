/**
 * The Devices page and the legacy location page at an Aruba Instant On venue
 * (DASHBOARD_PLAN P1-H, P1-I) -- and, FIRST, proof that a MikroTik venue and
 * an Omada venue render and request exactly as they did.
 *
 * Run: node scripts/test-aruba-devices-page.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 *   1. MIKROTIK AND OMADA ARE UNCHANGED. The real Devices page
 *      (CustomerFeaturePage feature="devices") and the legacy
 *      /workspace/locations/$id page keep Connected Devices, the
 *      `/connected-devices` read, "Device health & interface traffic", and
 *      the Restart button. With `BASELINE_ROOT=<origin/staging checkout>`
 *      the normalised DOM AND the request list must be identical.
 *   2. P1-H, ARUBA: "Online guests by access point" from the access-points
 *      API in place of Connected Devices; no `/connected-devices` request;
 *      "—"/unavailable on a failed read, never 0 or "will show up here".
 *      The 409 NAS_ONLY_DEVICE refusal maps to an Instant On sentence; any
 *      other error is untouched.
 *   3. P1-I, ARUBA: the legacy page never renders Restart / "Routers online"
 *      / "Never"; it sends the owner to the customer dashboard ("/").
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
import { Route as LegacyRoute } from "@/routes/_authenticated/workspace.locations.$locationId";

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
const Legacy = LegacyRoute.component;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={client}>
    <AuthProvider>
      <TooltipProvider>{which === "legacy" ? <Legacy /> : <CustomerFeaturePage feature="devices" />}</TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
`;
}

async function bundleFor(root, venue, mode) {
  const work = mkdtempSync(join(tmpdir(), `aruba-devices-${venue}-`));
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
const cdCalls = (calls) => calls.filter((c) => c.url === "/connected-devices");
const apCalls = (calls) => calls.filter((c) => c.url.endsWith("/access-points"));

console.log("\n1. MikroTik and Omada render and request unchanged");
for (const venue of ["mikrotik", "omada"]) {
  const r = await render(ROOT, venue, "devices");
  const t = await text(r.page);
  check(`${venue} devices: no aruba-* element`, !/data-testid="aruba-/.test(r.html));
  check(`${venue} devices: Connected Devices still there`, /Connected Devices/.test(t));
  check(`${venue} devices: /connected-devices still read`, cdCalls(r.calls).length === 1);
  check(`${venue} devices: no access-points request`, apCalls(r.calls).length === 0);
  check(
    `${venue} devices: device health title unchanged`,
    /Device health & interface traffic/.test(t),
  );
  await done(r);
  const l = await render(ROOT, venue, "legacy");
  const lt = await text(l.page);
  check(`${venue} legacy: no aruba-* element`, !/data-testid="aruba-/.test(l.html));
  check(`${venue} legacy: page renders (Overview tab)`, /Overview/.test(lt), lt.slice(0, 200));
  check(`${venue} legacy: its router is listed (1 total)`, /1 total/.test(lt), lt.slice(0, 400));
  check(`${venue} legacy: no redirect`, (await l.page.evaluate(() => window.__NAV__.length)) === 0);
  await done(l);
  const lr = await render(ROOT, venue, "legacy&tab=routers");
  check(`${venue} legacy Routers tab: Restart still offered`, /Restart/.test(await text(lr.page)));
  await done(lr);
  if (BASELINE_ROOT) {
    for (const which of ["devices", "legacy", "legacy&tab=routers"]) {
      const head = await render(ROOT, venue, which);
      const b = await render(BASELINE_ROOT, venue, which);
      check(
        `${venue} ${which}: DOM identical to baseline`,
        b.html === head.html,
        `lengths ${b.html.length} vs ${head.html.length}`,
      );
      if (b.html !== head.html) {
        writeFileSync(
          join(tmpdir(), `aruba-devices-${venue}-${which.replace(/[^a-z]/g, "_")}-base.html`),
          b.html,
        );
        writeFileSync(
          join(tmpdir(), `aruba-devices-${venue}-${which.replace(/[^a-z]/g, "_")}-head.html`),
          head.html,
        );
      }
      check(
        `${venue} ${which}: request list identical to baseline`,
        sig(b.calls) === sig(head.calls),
        `${b.calls.length} vs ${head.calls.length}`,
      );
      await done(b);
      await done(head);
    }
  }
}
if (!BASELINE_ROOT)
  console.log("  (set BASELINE_ROOT=<origin/staging checkout> for the DOM/request diff)");

console.log("\n2. Aruba Devices page: online guests by access point (P1-H)");
{
  const r = await render(ROOT, "aruba", "devices");
  const t = await text(r.page);
  check("no Connected Devices card", !/Connected Devices/.test(t));
  check("no 'will show up here' promise", !/will show up here/.test(t));
  eq("no /connected-devices request", cdCalls(r.calls).length, 0);
  eq("one access-points request", apCalls(r.calls).length, 1);
  check("Online guests by access point shown", has(r.html, "aruba-guests-by-ap"));
  const rows = await r.page.$$eval('[data-testid="aruba-guests-by-ap-row"]', (els) =>
    els.map((e) => e.innerText.replace(/\s+/g, " ").trim()),
  );
  eq("two AP rows", rows.length, 2);
  check(
    "Lobby: 3 online, 9 sign-ins",
    /Lobby/.test(rows[0] ?? "") && /\b3\b/.test(rows[0]) && /\b9\b/.test(rows[0]),
    rows[0],
  );
  check(
    "Terrace: unmeasured figures read —, never 0",
    /Terrace/.test(rows[1] ?? "") && /—/.test(rows[1]) && !/\b0\b/.test(rows[1]),
    rows[1],
  );
  check("never Offline", !/\bOffline\b/.test(t));
  check("device health card titled for access points", has(r.html, "aruba-device-health-title"));
  check("no 'each network port' at Aruba", !/each network port/.test(t));
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "devices", { mode: "ap-fail" });
  const t = await text(r.page);
  check("failed AP read: unavailable", has(r.html, "aruba-guests-by-ap-unavailable"));
  check("failed AP read: no Connected Devices fallback", !/Connected Devices/.test(t));
  eq("failed AP read: still no /connected-devices request", cdCalls(r.calls).length, 0);
  await done(r);
}

console.log("\n3. Aruba legacy location page (P1-I)");
{
  const r = await render(ROOT, "aruba", "legacy");
  const t = await text(r.page);
  check("no Restart button", !/Restart/.test(t));
  const rt = await render(ROOT, "aruba", "legacy&tab=routers");
  check("Routers tab by URL: no Restart button", !/Restart/.test(await text(rt.page)));
  check(
    "Routers tab by URL: redirected",
    (await rt.page.evaluate(() => window.__NAV__)).some((n) => n.to === "/"),
  );
  await done(rt);
  check("no 'Routers online'", !/Routers online/.test(t));
  check("no 'Never'", !/\bNever\b/.test(t));
  check("no Monitoring tab", !/Monitoring/.test(t));
  const nav = await r.page.evaluate(() => window.__NAV__);
  check(
    "redirected to the customer dashboard",
    nav.some((n) => n.to === "/"),
    JSON.stringify(nav),
  );
  const active = await r.page.evaluate(() =>
    JSON.parse(localStorage.getItem("cg-customer") || "{}"),
  );
  check(
    "venue made active",
    active?.state?.activeLocationId === LOC,
    JSON.stringify(active?.state?.activeLocationId),
  );
  await done(r);
}

console.log("\n4. 409 NAS_ONLY_DEVICE (BE #360)");
{
  const out = mkdtempSync(join(tmpdir(), "nas-only-device-"));
  await build({
    entryPoints: [join(ROOT, "src/lib/nas-only-device.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: join(out, "m.mjs"),
    logLevel: "silent",
  });
  const m = await import(pathToFileURL(join(out, "m.mjs")).href);
  const refusal = (op) => ({
    status: 409,
    code: "x",
    message: "m",
    data: { code: "NAS_ONLY_DEVICE", operation: op },
  });
  check(
    "connected_devices refusal -> Instant On sentence",
    /Instant On app/.test(m.nasOnlyDeviceRefusalMessage(refusal("connected_devices")) ?? ""),
  );
  check(
    "reboot refusal -> restarted from the Instant On app",
    /restarted from the Instant On app/.test(
      m.nasOnlyDeviceRefusalMessage(refusal("reboot")) ?? "",
    ),
  );
  eq(
    "other 409 untouched",
    m.nasOnlyDeviceRefusalMessage({ status: 409, data: { code: "OTHER" } }),
    null,
  );
  eq(
    "400 with the code untouched",
    m.nasOnlyDeviceRefusalMessage({ status: 400, data: { code: "NAS_ONLY_DEVICE" } }),
    null,
  );
  eq("plain error untouched", m.nasOnlyDeviceRefusalMessage(new Error("x")), null);
  const tabs = readFileSync(join(ROOT, "src/components/routers/RouterDetailTabs.tsx"), "utf8");
  check("admin device actions use it", /nasOnlyDeviceRefusalMessage\(err\) \?\?/.test(tabs));
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures.length) {
  console.log(`aruba devices page: ${failures.length} FAILED`);
  process.exit(1);
}
console.log("aruba devices page: all checks passed");
