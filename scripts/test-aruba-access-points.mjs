/**
 * Aruba Instant On venues: every access point of the venue on the dashboard,
 * and an "Access point" column + filter on the Guests page
 * (~/wyfy-ops/aruba-ap21/DASHBOARD_PLAN.md P0-A3). And, FIRST, proof that a
 * MikroTik venue and an Omada venue render exactly as they did.
 *
 * Run: node scripts/test-aruba-access-points.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHAT IT GUARDS, in order of how badly a regression would hurt:
 *
 *   1. MIKROTIK AND OMADA ARE UNCHANGED. The real `CustomerDashboardPage` and
 *      the real Guests page are mounted for a MikroTik venue and an Omada
 *      venue: neither requests `/locations/{id}/access-points`, neither
 *      renders a single `aruba-*` element, the Guests table keeps its eleven
 *      columns, and `/guest-sessions` is asked with the exact params it was
 *      asked with before (no `ap_mac`).
 *
 *      With `BASELINE_ROOT=<a checkout of origin/staging>` the same two venues
 *      are ALSO rendered from that checkout and the normalised DOM of both
 *      pages is compared to this branch's: byte-for-byte equal or FAIL.
 *
 *   2. THE ARUBA CARD SHOWS ONLY WHAT THE BACKEND SAID. Two APs from the
 *      read render as two rows with their own counts; a missing figure is
 *      "—", never 0; an idle AP is "No recent activity", never "Offline"; a
 *      failed read is "unavailable", never "no access points".
 *
 *   3. THE FILTER NARROWS FOR REAL. Choosing an AP sends `ap_mac` and keeps
 *      only that AP's sessions even if a backend ignored the parameter.
 *
 * Same harness as `scripts/test-customer-dashboard-fetch-count.mjs`: the
 * only substitution is `@/services/api` (a recording fake) and the router
 * (no navigation under test). Every service, hook and component is real.
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

// ---------------------------------------------------------------------------
// Part A -- the pure module.
// ---------------------------------------------------------------------------
const pureDir = mkdtempSync(join(tmpdir(), "aruba-ap-pure-"));
await build({
  entryPoints: [join(ROOT, "src/lib/aruba-access-points.ts")],
  outfile: join(pureDir, "ap.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const AP = await import(pathToFileURL(join(pureDir, "ap.mjs")).href);

console.log("\nA. Parsing and wording (pure)");
eq("MAC is canonicalised", AP.canonicalApMac("aa-bb-cc-00-00-01"), AP1);
eq("bare-hex MAC is canonicalised", AP.canonicalApMac("aabbcc000001"), AP1);
eq("a non-MAC is returned, not guessed", AP.canonicalApMac("not-a-mac"), "NOT-A-MAC");
{
  const s = AP.toArubaAccessPointsState({
    location_id: LOC,
    applicable: true,
    as_of: "2026-10-04T10:00:00Z",
    unattributed_clients_now: 2,
    items: [{ mac: "aabbcc000002" }, { name: "Lobby", mac: AP1 }],
  });
  eq("items list -> ok", s.status, "ok");
  eq("sorted by display name", s.items.map((a) => a.mac).join(","), `${AP2},${AP1}`);
  eq("as_of is read from the top level", s.asOf, "2026-10-04T10:00:00Z");
  eq("unattributed_clients_now is read", s.unattributedClientsNow, 2);
  const bare = s.items[0];
  eq("absent count is null, not 0", bare.clientsNow, null);
  eq("absent count renders a dash", AP.apCount(bare.clientsNow), "—");
  eq("absent data renders a dash, not 0 B", AP.apDataToday(bare), "—");
  eq("unknown status is the neutral state", bare.status, "no_recent_activity");
  eq("neutral label never says offline", AP.apStatusLabel(bare.status), "No recent activity");
}
{
  const s = AP.toArubaAccessPointsState({
    applicable: true,
    items: [
      { id: "ap-b", name: "Bar", mac: AP2, is_primary: false },
      { id: null, name: null, mac: "54f0b1c8a90a", is_primary: true, clients_now: 0 },
    ],
  });
  eq("the primary AP sorts first", s.items[0].mac, "54:F0:B1:C8:A9:0A");
  eq("id null -> a stable primary key", s.items[0].id, "primary:54:F0:B1:C8:A9:0A");
  eq("is_primary is read", s.items[0].isPrimary, true);
  eq("a measured 0 stays 0", AP.apCount(s.items[0].clientsNow), "0");
  eq("unattributed absent -> null", s.unattributedClientsNow, null);
}
eq(
  "applicable:false is unavailable, not empty",
  AP.toArubaAccessPointsState({ applicable: false, items: [] }).status,
  "unavailable",
);
eq(
  "a bare list is not the contract -> unavailable",
  AP.toArubaAccessPointsState([{ mac: AP1 }]).status,
  "unavailable",
);
eq(
  "an unrecognised payload is unavailable, not empty",
  AP.toArubaAccessPointsState({}).status,
  "unavailable",
);
eq("null payload is unavailable", AP.toArubaAccessPointsState(null).status, "unavailable");
eq(
  "a row without a MAC is dropped",
  AP.toArubaAccessPointsState({ items: [{ name: "x" }] }).items.length,
  0,
);
eq(
  "download + upload today are summed",
  AP.apDataToday(
    AP.toArubaAccessPoint({ mac: AP1, download_bytes_today: 1500, upload_bytes_today: 500 }),
  ),
  "2.0 KB",
);
eq(
  "one measured side is shown alone",
  AP.apDataToday(AP.toArubaAccessPoint({ mac: AP1, download_bytes_today: 3000 })),
  "3.0 KB",
);
eq(
  "the assumed bytes_today_in name is no longer read",
  AP.apDataToday(AP.toArubaAccessPoint({ mac: AP1, bytes_today_in: 3000 })),
  "—",
);
eq(
  "instant_on_status is read",
  AP.toArubaAccessPoint({ mac: AP1, instant_on_status: "offline" }).instantOnStatus,
  "offline",
);
eq(
  "RADIUS evidence names the last activity",
  AP.apStatusDetail(
    { statusSource: "radius", lastSeenAt: "t", instantOnStatus: null },
    null,
    () => "2 minutes ago",
  ),
  "Last guest activity 2 minutes ago",
);
eq(
  "Instant On evidence names the app, at the read's as_of",
  AP.apStatusDetail(
    { statusSource: "instant_on", lastSeenAt: null, instantOnStatus: "online" },
    "t",
    () => "1 minute ago",
  ),
  "From the Instant On app, 1 minute ago",
);
check(
  "an Instant On 'offline' is attributed to the app, never a bare Offline",
  (() => {
    const d = AP.apStatusDetail(
      { statusSource: "instant_on", lastSeenAt: null, instantOnStatus: "offline" },
      "t",
      () => "1 minute ago",
    );
    return /Instant On app/.test(d) && !/Offline/.test(d);
  })(),
);
eq("no unattributed note for 0", AP.apUnattributedNote(0), null);
eq("no unattributed note for null", AP.apUnattributedNote(null), null);
eq(
  "unattributed note for 2",
  AP.apUnattributedNote(2),
  "2 guests online aren't matched to an access point yet.",
);
{
  const items = AP.toArubaAccessPointsState({ items: [{ mac: AP1, name: "Lobby" }] }).items;
  eq("session ap_name wins", AP.sessionApLabel(AP1, "Pool", items), "Pool");
  eq(
    "else the AP list's name for that MAC",
    AP.sessionApLabel("aabbcc000001", null, items),
    "Lobby",
  );
  eq("else the MAC", AP.sessionApLabel(AP2, null, items), AP2);
  eq("no AP recorded -> dash", AP.sessionApLabel(null, null, items), "—");
}
{
  const src = readFileSync(join(ROOT, "src/lib/aruba-access-points.ts"), "utf8");
  check("no fixture arrays in the shipped module", !/const [A-Z_]+ = \[/.test(src));
  check(
    "customer copy never says RADIUS/NAS/WireGuard",
    !/RADIUS|NAS|WireGuard|tunnel/.test(
      [
        AP.ARUBA_AP_UNAVAILABLE,
        AP.ARUBA_AP_EMPTY,
        AP.ARUBA_AP_MANAGE_NOTE,
        AP.apUnattributedNote(3),
      ].join(" "),
    ),
  );
  const card = readFileSync(
    join(ROOT, "src/components/customer/ArubaAccessPointsCard.tsx"),
    "utf8",
  );
  check("the card never renders the word Offline", !/Offline/.test(card));
}

// ---------------------------------------------------------------------------
// Part B -- the real pages in Chromium.
// ---------------------------------------------------------------------------
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

function apiStub(venue, apMode) {
  return `
const LOC = ${JSON.stringify(LOC)};
const ORG = ${JSON.stringify(ORG)};
const VENUE = ${JSON.stringify(venue)};
const ROUTERS = ${JSON.stringify(VENUES[venue])};
const AP_MODE = ${JSON.stringify(apMode)};
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
    if (AP_MODE === "fail") throw Object.assign(new Error("500"), { status: 500 });
    if (AP_MODE === "not-applicable") return { location_id: LOC, applicable: false, as_of: NOW,
      day_start: NOW, online_window_seconds: 900, unattributed_clients_now: 0, items: [] };
    // The real BE P0-A1/A2 contract (envelope already stripped by \`api\`).
    return { location_id: LOC, applicable: true, as_of: NOW, day_start: NOW,
      online_window_seconds: 900, unattributed_clients_now: AP_MODE === "unattributed" ? 2 : 0,
      items: [
      { id: null, name: "Lobby", mac: "AA:BB:CC:00:00:01", model: "AP21", serial: "VNV5M1K1M6",
        is_primary: true, clients_now: 3, sessions_today: 9, download_bytes_today: 2000000,
        upload_bytes_today: 1000000, last_seen_at: NOW, status: "online",
        status_source: "radius", instant_on_status: null },
      { id: "ap2", name: "Terrace", mac: "AA:BB:CC:00:00:02", model: "AP21", serial: null,
        is_primary: false, clients_now: 0, sessions_today: 0, download_bytes_today: 0,
        upload_bytes_today: 0, last_seen_at: null, status: "no_recent_activity",
        status_source: "radius", instant_on_status: null },
    ] };
  }
  if (url === "/guest-sessions") {
    // Deliberately IGNORES ap_mac, like a backend that predates it: the
    // page must still narrow on its own.
    return page(SESSIONS);
  }
  if (url === "/guest-session-groups") {
    // The Guests table's one-row-per-guest listing (2026-10-05). Also
    // ignores ap_mac, for the same reason. One session per guest here.
    return page(SESSIONS.map((s) => ({
      guest_id: s.guest_id, guest_identifier: null, session_count: 1,
      active_session_count: 1, device_count: 1, first_started_at: NOW,
      last_started_at: NOW, bytes_downloaded_total: 0, bytes_uploaded_total: 0,
      active_session_ids: [s.id], latest_session: s,
    })));
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

async function bundleFor(root, venue, apMode) {
  const work = mkdtempSync(join(tmpdir(), `aruba-ap-${venue}-`));
  writeFileSync(join(work, "api-stub.js"), apiStub(venue, apMode));
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

async function render(root, venue, which, { apMode = "ok", interact } = {}) {
  const key = `${root === ROOT ? "head" : "base"}-${venue}-${apMode}`;
  if (!dirs.has(key)) dirs.set(key, await bundleFor(root, venue, apMode));
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
// The Guests table's list request: `/guest-session-groups` since the table
// went one-row-per-guest (2026-10-05); `/guest-sessions` for the "online now"
// count and the dashboard.
const sessionParams = (calls) =>
  calls
    .filter((c) => c.url === "/guest-sessions" || c.url === "/guest-session-groups")
    .map((c) => JSON.stringify(c.params));

/** Press "Export CSV" and return the file's text. */
async function exportCsv(page) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 10_000 }),
    page.getByRole("button", { name: /Export CSV/ }).click(),
  ]);
  return readFileSync(await dl.path(), "utf8");
}
const MIKROTIK_CSV_HEADER =
  "Name,Email,Phone,Device,MAC,IP,Duration,Connected at,Disconnected at,Downloaded,Status";

console.log("\nB1. MikroTik and Omada render unchanged");
for (const venue of ["mikrotik", "omada"]) {
  for (const which of ["dashboard", "users"]) {
    const r = await render(ROOT, venue, which);
    eq(`${venue} ${which}: no access-points request`, apCalls(r.calls).length, 0);
    check(`${venue} ${which}: no aruba-* element`, !/data-testid="aruba-/.test(r.html));
    check(
      `${venue} ${which}: /guest-sessions never carries ap_mac`,
      sessionParams(r.calls).every((p) => !p.includes("ap_mac")),
      sessionParams(r.calls).join(" "),
    );
    if (which === "users") {
      const heads = await r.page.$$eval("thead th", (ths) => ths.length);
      eq(`${venue} users: eleven columns, as before`, heads, 11);
    }
    if (which === "users") {
      const csv = await exportCsv(r.page);
      eq(
        `${venue} users: CSV header unchanged`,
        csv.split(/\r?\n/)[0].replace(/^\uFEFF/, ""),
        MIKROTIK_CSV_HEADER,
      );
    }
    if (BASELINE_ROOT) {
      const b = await render(BASELINE_ROOT, venue, which);
      check(
        `${venue} ${which}: DOM identical to baseline ${BASELINE_ROOT}`,
        b.html === r.html,
        `lengths ${b.html.length} vs ${r.html.length}`,
      );
      if (b.html !== r.html) {
        writeFileSync(join(tmpdir(), `aruba-ap-${venue}-${which}-base.html`), b.html);
        writeFileSync(join(tmpdir(), `aruba-ap-${venue}-${which}-head.html`), r.html);
      }
      await done(b);
    }
    await done(r);
  }
}
if (!BASELINE_ROOT) console.log("  (set BASELINE_ROOT=<origin/staging checkout> for the DOM diff)");

console.log("\nB2. Aruba dashboard: the access points card");
{
  const r = await render(ROOT, "aruba", "dashboard");
  eq("one access-points request", apCalls(r.calls).length, 1);
  const rows = await r.page.$$eval('[data-testid="aruba-ap-row"]', (els) =>
    els.map((e) => e.textContent),
  );
  eq("two APs, two rows", rows.length, 2);
  check(
    "Lobby: online, 3 now, 3.0 MB today",
    /Lobby/.test(rows[0]) &&
      /Active/.test(rows[0]) &&
      /3online now/.test(rows[0]) &&
      /3\.0 MBdata today/.test(rows[0]),
    rows[0],
  );
  // 2026-10-05 redesign: one verdict sentence per AP ("Idle · ...") instead
  // of a "No recent activity" pill beside a separate activity line, and an
  // idle AP's open sessions read "signed in", not "online now".
  check(
    "Terrace: idle, one verdict, measured zeros",
    /Terrace/.test(rows[1]) &&
      /Idle · no guest activity yet/.test(rows[1]) &&
      !/No recent activity/.test(rows[1]) &&
      /0signed in/.test(rows[1]) &&
      /0 Bdata today/.test(rows[1]),
    rows[1],
  );
  check("Lobby shows its last activity", /Active · guest activity /.test(rows[0]), rows[0]);
  const apCall = apCalls(r.calls)[0];
  check(
    "the read sends tz_offset_minutes as an integer",
    Number.isInteger(apCall?.params?.tz_offset_minutes),
    JSON.stringify(apCall?.params),
  );
  check(
    "no unattributed note when there are none",
    !/data-testid="aruba-ap-unattributed"/.test(r.html),
  );
  check("never Offline", !rows.some((t) => /Offline/.test(t)));
  check(
    "the manage note names the Instant On app",
    /Manage access points in the Instant On app/.test(r.html),
  );
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { apMode: "unattributed" });
  const note = await r.page
    .$eval('[data-testid="aruba-ap-unattributed"]', (e) => e.textContent)
    .catch(() => "");
  eq(
    "unattributed guests are said, not dropped",
    note,
    "2 guests online aren't matched to an access point yet.",
  );
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { apMode: "not-applicable" });
  check(
    "applicable:false says unavailable, not 'no access points'",
    /data-testid="aruba-ap-unavailable"/.test(r.html) &&
      !/data-testid="aruba-ap-empty"/.test(r.html),
  );
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "dashboard", { apMode: "fail" });
  check("a failed read says unavailable", /data-testid="aruba-ap-unavailable"/.test(r.html));
  check("a failed read lists no rows and no zero", !/data-testid="aruba-ap-row"/.test(r.html));
  await done(r);
}

console.log("\nB3. Aruba Guests page: column and filter");
{
  const r = await render(ROOT, "aruba", "users");
  const heads = await r.page.$$eval("thead th", (ths) => ths.map((t) => t.textContent.trim()));
  eq("twelve columns", heads.length, 12);
  check("an Access point column", heads.includes("Access point"), heads.join("|"));
  const cells = await r.page.$$eval('[data-testid="aruba-ap-cell"]', (els) =>
    els.map((e) => e.textContent),
  );
  eq("each session names its AP", cells.join(","), "Lobby,Terrace");
  check(
    "unfiltered: no ap_mac sent",
    sessionParams(r.calls).every((p) => !p.includes("ap_mac")),
    sessionParams(r.calls).join(" "),
  );
  await r.page.click('[data-testid="aruba-ap-filter"]');
  await r.page.getByRole("option", { name: "Terrace" }).click();
  await r.page.waitForTimeout(800);
  const calls = await r.page.evaluate(() => window.__CALLS__);
  check(
    "filtered: ap_mac sent for Terrace",
    sessionParams(calls).some((p) => p.includes(`"ap_mac":"${AP2}"`)),
    sessionParams(calls).join(" "),
  );
  const after = await r.page.$$eval('[data-testid="aruba-ap-cell"]', (els) =>
    els.map((e) => e.textContent),
  );
  eq("filtered: only Terrace's guest is listed", after.join(","), "Terrace");
  const csv = (await exportCsv(r.page)).replace(/^\uFEFF/, "").split(/\r?\n/);
  eq(
    "CSV: Access point columns appended at Aruba",
    csv[0],
    `${MIKROTIK_CSV_HEADER},Access point,Access point MAC`,
  );
  check(
    "CSV: the filtered row names its AP and MAC",
    csv.length >= 2 && csv[1].endsWith(`Terrace,${AP2}`),
    csv[1],
  );
  // page_size 100 without a status filter = the export's pages (the
  // "online now" count asks with status=active).
  const exportCalls = sessionParams(await r.page.evaluate(() => window.__CALLS__)).filter(
    (p) => p.includes('"page_size":100') && !p.includes('"status"'),
  );
  check(
    "CSV export also sends ap_mac",
    exportCalls.length > 0 && exportCalls.every((p) => p.includes(`"ap_mac":"${AP2}"`)),
    exportCalls.join(" "),
  );
  await done(r);
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures.length) {
  console.log(`aruba access points: ${failures.length} FAILED`);
  process.exit(1);
}
console.log("aruba access points: all checks passed");
