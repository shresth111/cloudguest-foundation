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
};

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
  if (url === "/locations/" + LOC + "/access-points") {
    if (MODE === "ap-fail") throw Object.assign(new Error("404"), { status: 404 });
    // The real P0-A2 contract (download_/upload_bytes_today, as_of at the
    // top level). MODE "ap-idle": the owner's 2026-10-05 screen -- one AP,
    // a session still open, last packet 31 minutes ago.
    if (MODE === "ap-idle") {
      return { location_id: LOC, applicable: true, as_of: NOW, unattributed_clients_now: 0, items: [
        { id: null, name: null, mac: "54:f0:b1:c8:a9:0a", model: "AP21", is_primary: true,
          clients_now: 1, sessions_today: 2, download_bytes_today: 400000000,
          upload_bytes_today: 75000000, last_seen_at: "2026-10-04T09:29:00.000Z",
          status: "no_recent_activity", status_source: null, instant_on_status: null },
      ] };
    }
    return { location_id: LOC, applicable: true, as_of: NOW, unattributed_clients_now: 0, items: [
      { id: "ap1", name: "Lobby", mac: "aa:bb:cc:00:00:01", model: "AP21", clients_now: 3,
        sessions_today: 9, download_bytes_today: 2000000, upload_bytes_today: 1000000,
        last_seen_at: "2026-10-04T09:58:00.000Z", status: "online", status_source: "radius" },
      { id: "ap2", name: "Terrace", mac: "aa:bb:cc:00:00:02", model: "AP21", clients_now: null,
        sessions_today: null, download_bytes_today: null, upload_bytes_today: null,
        last_seen_at: null, status: "no_recent_activity", status_source: null },
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

function entry(venue) {
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

console.log("\n0. One verdict per AP and per venue (pure, lib/aruba-dashboard)");
{
  const pureDir = mkdtempSync(join(tmpdir(), "aruba-dash-pure-"));
  await build({
    entryPoints: [join(ROOT, "src/lib/aruba-dashboard.ts")],
    outfile: join(pureDir, "dash.mjs"),
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
    alias: { "@": join(ROOT, "src") },
  });
  const D = await import(pathToFileURL(join(pureDir, "dash.mjs")).href);
  const rel = (iso) => `at ${iso.slice(11, 16)}`;
  const ap = (o) => ({
    status: "no_recent_activity",
    statusSource: null,
    lastSeenAt: null,
    instantOnStatus: null,
    downloadBytesToday: null,
    uploadBytesToday: null,
    ...o,
  });
  const active = ap({
    status: "online",
    statusSource: "radius",
    lastSeenAt: "2026-10-04T09:58:00Z",
  });
  const idle = ap({ lastSeenAt: "2026-10-04T09:29:00Z" });
  const never = ap({});
  eq(
    "active AP: one sentence",
    D.apVerdict(active, rel).sentence,
    "Active · guest activity at 09:58",
  );
  eq("active AP: counter is online now", D.apVerdict(active, rel).countLabel, "online now");
  eq(
    "idle AP: one sentence carrying the evidence",
    D.apVerdict(idle, rel).sentence,
    "Idle · last guest activity at 09:29",
  );
  eq("idle AP: counter is signed in", D.apVerdict(idle, rel).countLabel, "signed in");
  eq("never-heard AP", D.apVerdict(never, rel).sentence, "Idle · no guest activity yet");
  eq(
    "Instant On online -> active, says where from",
    D.apVerdict(ap({ status: "online", statusSource: "instant_on" }), rel).sentence,
    "Active · online in the Instant On app",
  );
  check(
    "no verdict ever says Offline",
    ![
      active,
      idle,
      never,
      ap({ instantOnStatus: "offline", lastSeenAt: "2026-10-04T09:29:00Z" }),
    ].some((a) => /offline/i.test(`${D.apVerdict(a, rel).label}`)),
  );
  const ok = (items) => ({ status: "ok", items, asOf: null, unattributedClientsNow: 0 });
  const v1 = D.arubaVenueStatus(ok([active, idle]), rel);
  eq("venue: any AP active -> live tone", v1.tone, "live");
  eq("venue: '1 of 2 active'", v1.accessPoints, "1 of 2 active");
  eq("venue: last activity is the newest AP's", v1.lastActivity, "at 09:58");
  const v2 = D.arubaVenueStatus(ok([idle]), rel);
  eq("venue: no AP active -> neutral, never a fault tone", v2.tone, "neutral");
  eq("venue: idle title", v2.title, "No recent guest activity");
  eq("venue: single idle AP", v2.accessPoints, "1 idle");
  const v3 = D.arubaVenueStatus({ status: "unavailable" }, rel);
  eq("venue: failed read -> —, not 0", `${v3.accessPoints}/${v3.lastActivity}`, "—/—");
  eq("venue: failed read is neutral", v3.tone, "neutral");
  eq(
    "venue: no APs listed -> 0, a measured fact",
    D.arubaVenueStatus(ok([]), rel).accessPoints,
    "0",
  );
  eq(
    "venue: never heard -> None yet",
    D.arubaVenueStatus(ok([never]), rel).lastActivity,
    "None yet",
  );
  eq("venue: loading -> …", D.arubaVenueStatus({ status: "loading" }, rel).accessPoints, "…");
  eq(
    "data today: sum of measured octets",
    D.arubaDataToday(
      ok([ap({ downloadBytesToday: 2e6, uploadBytesToday: 1e6 }), ap({ downloadBytesToday: 5e5 })]),
    ),
    "3.5 MB",
  );
  eq("data today: nothing measured -> null (—), not 0 B", D.arubaDataToday(ok([never])), null);
  eq("data today: failed read -> null", D.arubaDataToday({ status: "unavailable" }), null);
  eq(
    "data today: measured zero is a real 0 B",
    D.arubaDataToday(ok([ap({ downloadBytesToday: 0, uploadBytesToday: 0 })])),
    "0 B",
  );
}

console.log("\n0b. Card visuals read only what the row shows (pure)");
{
  const pureDir = mkdtempSync(join(tmpdir(), "aruba-dash-visuals-"));
  await build({
    entryPoints: [
      join(ROOT, "src/lib/aruba-dashboard.ts"),
      join(ROOT, "src/lib/guest-row-visuals.ts"),
    ],
    outdir: pureDir,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
    alias: { "@": join(ROOT, "src") },
  });
  const D = await import(pathToFileURL(join(pureDir, "aruba-dashboard.mjs")).href);
  const G = await import(pathToFileURL(join(pureDir, "guest-row-visuals.mjs")).href);
  const rel = (iso) => `at ${iso.slice(11, 16)}`;
  const base = { status: "no_recent_activity", statusSource: null, lastSeenAt: null };
  const cases = [
    { ...base, status: "online", statusSource: "radius", lastSeenAt: "2026-10-04T09:58:00Z" },
    { ...base, status: "online", statusSource: "instant_on" },
    { ...base, status: "online" },
    { ...base, lastSeenAt: "2026-10-04T09:29:00Z" },
    { ...base, instantOnStatus: "offline" },
    base,
  ];
  check(
    "pill label + detail always rebuild the one sentence",
    cases.every((a) => {
      const v = D.apVerdict(a, rel);
      return v.sentence === (v.detail ? `${v.label} · ${v.detail}` : v.label);
    }),
  );
  eq(
    "idle detail drops the label",
    D.apVerdict(cases[3], rel).detail,
    "last guest activity at 09:29",
  );
  eq("bare Active has no detail", D.apVerdict(cases[2], rel).detail, "");
  eq(
    "device glyphs follow the Device column",
    [
      "iPhone",
      "Android device",
      "iPad",
      "Mac",
      "MacBook Pro",
      "Windows PC",
      "Linux device",
      "Unknown device",
      "",
    ]
      .map(G.deviceKind)
      .join(","),
    "phone,phone,tablet,laptop,laptop,desktop,desktop,unknown,unknown",
  );
  eq(
    "a masked phone / email / phone / placeholder never becomes initials",
    ["XXXXXXX55613", "a***@b.com", "+919876543210", "XXXXXXX", "", "Unknown guest", "Guest"]
      .map((x) => String(G.guestAvatarInitials(x)))
      .join(","),
    "null,null,null,null,null,null,null",
  );
  eq(
    "a real name becomes initials",
    ["Asha Rao", "Ravi"].map(G.guestAvatarInitials).join(","),
    "AR,R",
  );
}

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

console.log("\n2. Aruba: one verdict, no router-only figure, no repeats");
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
  // The dead cards are gone, not reworded.
  check("no Bandwidth card", !/\bBandwidth\b/.test(t) && !has(r.html, "aruba-traffic-unsupported"));
  check("no 'needs a Wyfy-managed router' sentence", !/Wyfy-managed router/.test(t));
  check("no duplicate venue card", !has(r.html, "aruba-venue-card"));
  check("no 'Set up in Instant On' block", !/Set up in Instant On/.test(t));
  check("no 'Nothing to do here'", !/Nothing to do here/.test(t));
  check("no 'Not measured here'", !/Not measured here/.test(t));
  check("no Offline anywhere", !/\bOffline\b/.test(t));
  // The status bar: one verdict + access points, guests online, last activity.
  check("the Aruba status bar is shown", has(r.html, "aruba-status-bar"));
  const title = await r.page.$eval('[data-testid="aruba-status-title"]', (e) => e.innerText);
  eq(
    "verdict: an AP heard from inside its window -> Guest WiFi is active",
    title,
    "Guest WiFi is active",
  );
  const strip = await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText);
  check("strip: access points 1 of 2 active", /Access points\s*1 of 2 active/.test(strip), strip);
  check("strip: guests online from sessions (2)", /Guests online\s*2/.test(strip), strip);
  check(
    "strip: last guest activity is the newest AP packet",
    /Last guest activity\s*2 minutes ago/.test(strip),
    strip,
  );
  check("the header pill says the same verdict", /Guest WiFi active/.test(t));
  eq("'Guests online' is printed once", (t.match(/Guests online/g) ?? []).length, 1);
  check("no 'Currently online' tile repeating it", !/Currently online/.test(t));
  // KPI row: four tiles, no repeats.
  const kpiLabels = await r.page.$$eval(
    "main .grid.lg\\:grid-cols-4 > div span.text-xs.font-medium",
    (els) => els.map((e) => e.textContent),
  );
  eq(
    "KPI row: Guests, Sign-ins today, Avg session, Guest data today",
    kpiLabels.join(" | "),
    "Guests | Sign-ins today | Avg. session time | Guest data today",
  );
  check(
    "Sign-ins today KPI shows today's sessions (2)",
    /Sign-ins today\s*2/.test(t),
    t.match(/Sign-ins today.{0,20}/s)?.[0],
  );
  check(
    "Guest data today is the sum of the APs' measured octets (3.0 MB)",
    /Guest data today\s*3\.0 MB/.test(t),
    t.match(/Guest data today.{0,30}/s)?.[0],
  );
  // The access points take the Bandwidth slot, with one verdict per AP.
  check("the access points card is on the page", has(r.html, "aruba-access-points-card"));
  const verdicts = await r.page.$$eval('[data-testid="aruba-ap-verdict"]', (els) =>
    els.map((e) => e.textContent),
  );
  eq(
    "per-AP verdicts are one sentence each",
    verdicts.join(" | "),
    "Active · guest activity 2 minutes ago | Idle · no guest activity yet",
  );
  // ONE managed-in-Instant-On note, collapsed.
  eq(
    "exactly one 'managed in the Instant On app' note",
    (r.html.match(/data-testid="aruba-managed-note"/g) ?? []).length,
    1,
  );
  check(
    "the note is collapsed by default",
    await r.page.$eval('[data-testid="aruba-managed-note"]', (e) => !e.open),
  );
  eq("'Instant On app' is said once on screen", (t.match(/Instant On app/g) ?? []).length, 1);
  check(
    "useful charts are kept",
    /Guests Online/.test(t) && /Devices by OS/.test(t) && /Sessions by Hour/.test(t),
  );
  check("recent guests and alerts are kept", /Recent Users/.test(t) && /Recent Alerts/.test(t));
  eq("one access-points request feeds bar, KPI and card", apCalls(r.calls).length, 1);
  // Visual polish (2026-10-05): status pill per AP, decorative art hidden.
  eq(
    "each AP row carries its status pill",
    await r.page.$$eval('[data-testid="aruba-ap-verdict"]', (els) =>
      els.map((e) => e.firstElementChild?.textContent).join("|"),
    ),
    "Active|Idle",
  );
  check(
    "every svg in the access points card is aria-hidden",
    await r.page.$eval('[data-testid="aruba-access-points-card"]', (e) =>
      [...e.querySelectorAll("svg")].every((s) => s.closest("[aria-hidden]")),
    ),
  );

  await done(r);
}
{
  // The owner's screen: "Last guest activity 31 minutes ago" beside "No
  // recent activity", and "1 online now". Now one statement.
  const r = await render(ROOT, "aruba", "dashboard", { mode: "ap-idle" });
  const t = await text(r.page);
  const title = await r.page.$eval('[data-testid="aruba-status-title"]', (e) => e.innerText);
  eq("idle venue: verdict is 'No recent guest activity'", title, "No recent guest activity");
  const strip = await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText);
  check("idle venue: access points 1 idle", /Access points\s*1 idle/.test(strip), strip);
  check(
    "idle venue: last activity 31 minutes ago",
    /Last guest activity\s*31 minutes ago/.test(strip),
    strip,
  );
  const row = await r.page.$eval('[data-testid="aruba-ap-row"]', (e) => e.innerText);
  check("idle AP: one sentence", /Idle · last guest activity 31 minutes ago/.test(row), row);
  check("idle AP: no 'No recent activity' pill beside it", !/No recent activity/.test(row), row);
  check(
    "idle AP: an open session reads 'signed in', not 'online now'",
    /signed in/.test(row) && !/online now/.test(row),
    row,
  );
  check("idle AP: 475 MB data today", /475 MB/.test(row), row);
  check("idle venue: Guest data today 475 MB", /Guest data today\s*475 MB/.test(t));
  check("idle venue: never Offline", !/\bOffline\b/.test(t));
  check("idle venue: header pill is neutral 'Idle'", /\bIdle\b/.test(t));
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { mode: "ap-fail" });
  const t = await text(r.page);
  const strip = await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText);
  check("failed AP read: access points —, not 0", /Access points\s*—/.test(strip), strip);
  check("failed AP read: last activity —", /Last guest activity\s*—/.test(strip), strip);
  check("failed AP read: data today —, not 0 B", /Guest data today\s*—/.test(t) && !/0 B/.test(t));
  check("failed AP read: card says unavailable", has(r.html, "aruba-ap-unavailable"));
  check(
    "failed AP read: still no Bandwidth / Internet card",
    !/Bandwidth|Internet Connection/.test(t),
  );
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { mode: "sessions-fail" });
  const t = await text(r.page);
  const strip = await r.page.$eval('[data-testid="aruba-status-strip"]', (e) => e.innerText);
  check(
    "failed sessions read: guests online says —, not 0",
    /Guests online\s*—/.test(strip) && !/Guests online\s*0/.test(strip),
    strip,
  );
  check(
    "failed sessions read: no Uptime / ISP fallback",
    !/Uptime/.test(t) && !/No ISP link/.test(t),
  );
  await done(r);
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures.length) {
  console.log(`aruba customer dashboard: ${failures.length} FAILED`);
  process.exit(1);
}
console.log("aruba customer dashboard: all checks passed");
