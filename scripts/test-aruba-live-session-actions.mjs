/**
 * No fake success on live-session actions at an Aruba Instant On venue
 * (~/wyfy-ops/aruba-ap21/DASHBOARD_PLAN.md P0-D). And, FIRST, proof that a
 * MikroTik venue and an Omada venue render exactly as they did.
 *
 * Run: node scripts/test-aruba-live-session-actions.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 *   A. THE PURE HELPERS. `liveSessionActionGate` greys Disconnect, Extend and
 *      Reset only for a NAS-only vendor, with Disconnect's own U2 sentence;
 *      `sessionEndToast` never says "disconnected"/"terminated"/"paused" as a
 *      success when `disconnect_enforced` is false AT ARUBA, and keeps the
 *      exact old title everywhere else (MikroTik/Omada even when false --
 *      owner decision); `readDisconnectEnforced` reads both shapes.
 *
 *   B. MIKROTIK AND OMADA ARE UNCHANGED. The real Guests page (table + the
 *      opened guest drawer) and the real Fix-a-Problem (after a guest lookup,
 *      so "Reset this guest's session" is on screen) are mounted at a
 *      MikroTik and an Omada venue: the live Extend / Reset controls are
 *      there and no `*-unsupported` element is. With
 *      `BASELINE_ROOT=<a checkout of origin/staging>` both venues are also
 *      rendered from that checkout and the normalised DOM must be identical.
 *
 *   C. ARUBA: EXTEND AND RESET ARE GREYED LIKE DISCONNECT. Disabled, with
 *      Disconnect's sentence, and pressing them sends nothing.
 *
 *   E. ADMIN LIVE SESSIONS: Disconnect / Pause / Terminate answering
 *      `disconnect_enforced: false` toast exactly as origin/staging does at
 *      MikroTik and Omada (diffed against BASELINE_ROOT when set), and say
 *      "records only / may still be online" at Aruba.
 *
 *   D. THE SERVICES READ `disconnect_enforced` from disconnect, terminate and
 *      pause responses (envelope stripped or not), and the admin screens no
 *      longer toast a hard-coded success after them.
 *
 * Harness: the same as `scripts/test-aruba-access-points.mjs` -- only
 * `@/services/api` (a recording fake) and the router are substituted.
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
const NOW_ISO = "2026-10-04T10:00:00.000Z";
const PHONE = "+919876543210";

// ---------------------------------------------------------------------------
// Part A -- the pure helpers.
// ---------------------------------------------------------------------------
const pureDir = mkdtempSync(join(tmpdir(), "aruba-lsa-pure-"));
await build({
  entryPoints: [join(ROOT, "src/lib/live-session-actions.ts")],
  outfile: join(pureDir, "lsa.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const L = await import(pathToFileURL(join(pureDir, "lsa.mjs")).href);
const occDir = mkdtempSync(join(tmpdir(), "aruba-lsa-cc-"));
await build({
  entryPoints: [join(ROOT, "src/lib/omada-client-controls.ts")],
  outfile: join(occDir, "cc.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const CC = await import(pathToFileURL(join(occDir, "cc.mjs")).href);

console.log("\nA. liveSessionActionGate / sessionEndToast / readDisconnectEnforced");
const ACTIONS = ["disconnect", "extend", "reset-session"];
for (const vendor of ["mikrotik", "MikroTik", "tplink_omada", null, undefined, ""]) {
  for (const action of ACTIONS) {
    const g = L.liveSessionActionGate(action, vendor);
    check(
      `${String(vendor)} ${action}: live, no reason`,
      g.greyed === false && g.reason === null && g.action === action,
      JSON.stringify(g),
    );
  }
}
const disconnectReason = CC.clientControlVerdict("disconnect", {
  controllerManaged: true,
  vendor: "aruba_instant_on",
  capabilities: null,
  controller: null,
  perGuestSpeed: null,
}).reason;
for (const vendor of ["aruba_instant_on", "Aruba_Instant_On"]) {
  for (const action of ACTIONS) {
    const g = L.liveSessionActionGate(action, vendor);
    check(`${vendor} ${action}: greyed`, g.greyed === true, JSON.stringify(g));
    eq(`${vendor} ${action}: Disconnect's own sentence`, g.reason, disconnectReason);
  }
}
eq("the sentence is NAS_ONLY_DISCONNECT", disconnectReason, CC.NAS_ONLY_DISCONNECT);

const OLD_TITLE = {
  disconnect: "Session disconnected",
  terminate: "Session terminated",
  pause: "Session paused",
};
for (const action of ["disconnect", "terminate", "pause"]) {
  // MikroTik / Omada / unidentified venue: the old success title, whatever
  // came back -- including `false` (owner decision: Aruba only).
  for (const enforced of [true, null, undefined, false]) {
    const m = L.sessionEndToast(action, enforced, false);
    check(
      `${action} not NAS-only, enforced=${String(enforced)}: same success toast as before`,
      m.tone === "success" && m.title === OLD_TITLE[action] && m.description === undefined,
      JSON.stringify(m),
    );
  }
  for (const enforced of [true, null, undefined]) {
    const m = L.sessionEndToast(action, enforced, true);
    check(
      `${action} Aruba, enforced=${String(enforced)}: same success toast as before`,
      m.tone === "success" && m.title === OLD_TITLE[action],
      JSON.stringify(m),
    );
  }
  const f = L.sessionEndToast(action, false, true);
  check(`${action} Aruba enforced=false: a warning, not a success`, f.tone === "warning");
  check(
    `${action} Aruba enforced=false: never the old success title`,
    f.title !== OLD_TITLE[action] && /records only/.test(f.title),
    f.title,
  );
  check(
    `${action} Aruba enforced=false: says the device may still be online`,
    /may still be online/.test(f.description ?? ""),
    f.description,
  );
}
eq("read: bare true", L.readDisconnectEnforced({ disconnect_enforced: true }), true);
eq("read: bare false", L.readDisconnectEnforced({ disconnect_enforced: false }), false);
eq("read: bare null", L.readDisconnectEnforced({ disconnect_enforced: null }), null);
eq(
  "read: enveloped false",
  L.readDisconnectEnforced({ data: { disconnect_enforced: false } }),
  false,
);
eq("read: missing field is null", L.readDisconnectEnforced({ id: "s1" }), null);
eq("read: no body is null", L.readDisconnectEnforced(undefined), null);
eq(
  "read: a string is not a boolean",
  L.readDisconnectEnforced({ disconnect_enforced: "false" }),
  null,
);

// ---------------------------------------------------------------------------
// The browser harness.
// ---------------------------------------------------------------------------
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

function apiStub(venue) {
  return `
const LOC = ${JSON.stringify(LOC)};
const ORG = ${JSON.stringify(ORG)};
const ROUTERS = ${JSON.stringify(VENUES[venue])};
const NOW = ${JSON.stringify(NOW_ISO)};
const PHONE = ${JSON.stringify(PHONE)};
const page = (items, extra = {}) => ({
  items, page: 1, page_size: 100, total_items: items.length,
  total_pages: 1, has_next: false, has_previous: false, ...extra,
});
window.__CALLS__ = [];
const session = (id, guest, mac) => ({
  id, status: "active", is_online: true, started_at: NOW, ended_at: null,
  last_activity_at: NOW, ip_address: "10.0.0." + id.length, router_id: "r1",
  location_id: LOC, organization_id: ORG, device_id: null, device_mac: mac,
  guest_id: guest, bytes_downloaded: 0, bytes_uploaded: 0, user_agent: "Android",
  data_limit_mb: null, session_timeout_minutes: 60,
});
const SESSIONS = [
  // Ids end in "-false": every session-ending POST answers
  // disconnect_enforced: false (see postBody), the case P0-D is about.
  session("s1-false", "g1", "11:11:11:11:11:11"),
  session("s22-false", "g2", "22:22:22:22:22:22"),
];
const GUEST = {
  id: "g1", organization_id: ORG, location_id: LOC, identifier: PHONE, display_name: "Asha",
  mac_addresses: ["11:11:11:11:11:11"], device_count: 1, first_seen_at: NOW, last_seen_at: NOW,
  total_visit_count: 1, is_blocked: false, blocked_reason: null, created_at: NOW, updated_at: NOW,
};
function body(url, config) {
  if (url === "/auth/me") return { id: "u1", email: "owner@example.com", full_name: "Owner", phone_number: null, is_active: true, is_verified: true, created_at: NOW };
  if (url === "/me/permissions") return { user_id: "u1", permissions: ["*"] };
  if (url === "/me/organizations") return [{ id: "m1", organization_id: ORG, status: "active" }];
  if (url === "/locations/" + LOC + "/routers") return page(ROUTERS);
  if (url === "/guest-sessions") return page(SESSIONS);
  if (url === "/routers/r1") return { ...ROUTERS[0], location_id: LOC, organization_id: ORG };
  if (url === "/organizations") return page([{ id: ORG, name: "Acme", slug: "acme", status: "active" }]);
  if (url === "/guests") return page([GUEST]);
  if (url === "/guests/g1") return GUEST;
  if (/^\\/organizations\\/[^/]+\\/locations$/.test(url)) {
    return page([{ id: LOC, name: "Front Desk", city: "Mumbai", property_type: "hotel" }]);
  }
  if (/^\\/users\\/[^/]+$/.test(url)) return { id: "u1", email: "owner@example.com", full_name: "Owner", data_masking_enabled: false, is_active: true, roles: [] };
  return page([]);
}
// Session-ending POSTs answer with the id's own verdict: "x-false" -> false,
// "x-true" -> true, "x-null" -> null, "x-env" -> enveloped false, else no field.
function postBody(url) {
  const m = url.match(/^\\/guest-sessions\\/([^/]+)\\/(disconnect|terminate|pause)$/);
  if (!m) return {};
  const id = m[1];
  if (id.endsWith("-false")) return { id, disconnect_enforced: false };
  if (id.endsWith("-true")) return { id, disconnect_enforced: true };
  if (id.endsWith("-null")) return { id, disconnect_enforced: null };
  if (id.endsWith("-env")) return { data: { id, disconnect_enforced: false } };
  return { id };
}
function record(method, url, config) {
  window.__CALLS__.push({ method, url, params: config?.params ?? null });
}
const settle = (fn) => new Promise((res, rej) => setTimeout(() => { try { res({ data: fn() }); } catch (e) { rej(e); } }, 8));
export const api = {
  get: async (url, config) => { record("get", url, config); return settle(() => body(url, config)); },
  post: async (url, _b, config) => { record("post", url, config); return settle(() => postBody(url)); },
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

const ROUTER_STUB = `import { createElement } from "react";
export function createFileRoute() { return (o) => o; }
export function createRootRoute() { return {}; }
export function useNavigate() { return () => {}; }
export function useRouter() { return { navigate: () => {} }; }
export function useRouterState() { return { location: { pathname: "/" } }; }
export function useParams() { return {}; }
export function useSearch() { return {}; }
export function redirect(o) { return o; }
export function Link({ children }) { return createElement("a", { href: "#" }, children); }
export function Outlet() { return null; }
`;

function entry(venue) {
  return `import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { deriveLocationLiveness } from "@/lib/location-liveness";
import { FixAProblem } from "@/components/customer/FixAProblem";
import { Route as UsersRoute } from "@/routes/users";
import { guestService } from "@/services/guest.service";
import { LiveSessionsTable } from "@/components/guests/LiveSessionsTable";
import { Toaster } from "sonner";

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
if (which === "svc") {
  // Part D: the services against the recording fake, no UI.
  (async () => {
    const out = {};
    for (const id of ["s-false", "s-true", "s-null", "s-env", "s-none"]) {
      out["disconnect:" + id] = await guestService.disconnectSession(id, "t");
      out["pause:" + id] = await guestService.pauseSession(id, "t");
      out["terminate:" + id] = await guestService.terminateSession(id, "t");
    }
    window.__SVC__ = out;
  })().catch((e) => { window.__SVC__ = { error: String(e) }; });
} else {
  const Users = UsersRoute.component;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(document.getElementById("root")).render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TooltipProvider>
          {which === "users" ? (
            <Users />
          ) : which === "sessions" ? (
            <LiveSessionsTable />
          ) : (
            <FixAProblem locationId={LOC} masked={false} />
          )}
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
`;
}

async function bundleFor(root, venue) {
  const work = mkdtempSync(join(tmpdir(), `aruba-lsa-${venue}-`));
  writeFileSync(join(work, "api-stub.js"), apiStub(venue));
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
    define: {
      "process.env.NODE_ENV": '"production"',
      // LiveSessionsTable's imports read Vite env at module load.
      "import.meta.env": JSON.stringify({ MODE: "production", DEV: false, PROD: true }),
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
    `<!doctype html><meta charset=utf-8><title>live session actions harness</title><div id=root></div><script type=module src="./bundle.js"></script>`,
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

/** Strip what legitimately differs between two renders of the same tree. */
const normalise = (html) =>
  html
    .replace(/\s(id|aria-controls|aria-labelledby|aria-describedby|for)="[^"]*"/g, "")
    .replace(/\sstyle="[^"]*"/g, "")
    .replace(/\s(stroke-dashoffset|opacity|transform)="[^"]*"/g, "")
    .replace(/url\(#[^)]*\)/g, "url(#)");

/** Guests page with the first guest's drawer open (its Extend buttons live
 * there); Fix-a-Problem after looking up a guest who has a live session. */
const OPEN = {
  sessions: async () => {},
  users: async (page) => {
    await page.locator('button[aria-label^="View "]').first().click();
    await page.waitForTimeout(800);
  },
  fix: async (page) => {
    await page.fill('input[placeholder="98765 43210"]', "9876543210");
    await page.getByRole("button", { name: /Look up/ }).click();
    await page.waitForTimeout(1200);
  },
};

async function render(root, venue, which) {
  const key = `${root === ROOT ? "head" : "base"}-${venue}`;
  if (!dirs.has(key)) dirs.set(key, await bundleFor(root, venue));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await page.clock.setFixedTime(new Date(NOW_ISO));
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/${key}/index.html?page=${which}`);
  await page.waitForFunction(() => Array.isArray(window.__CALLS__), null, { timeout: 15_000 });
  await page.waitForTimeout(2500);
  await OPEN[which](page).catch((e) => {
    throw new Error(`${e.message}\nPAGE ERRORS: ${errors.join(" | ")}`);
  });
  // Portals (the drawer, dialogs) render outside #root.
  const html = normalise(await page.evaluate(() => document.body.innerHTML));
  const calls = await page.evaluate(() => window.__CALLS__);
  return { html, calls, page, errors };
}
const done = async (r) => {
  await r.page.close();
  if (r.errors.length) throw new Error(`page errors: ${r.errors.join(" | ")}`);
};
const has = (html, testid) => html.includes(`data-testid="${testid}"`);
const text = (page) => page.evaluate(() => document.body.innerText);
const posts = (calls) => calls.filter((c) => c.method === "post");

console.log("\nB. MikroTik and Omada render unchanged");
for (const venue of ["mikrotik", "omada"]) {
  for (const which of ["users", "fix"]) {
    const r = await render(ROOT, venue, which);
    const t = await text(r.page);
    check(
      `${venue} ${which}: no *-unsupported element for Extend/Reset`,
      !has(r.html, "extend-unsupported") &&
        !has(r.html, "extend-unsupported-icon") &&
        !has(r.html, "reset-session-unsupported"),
    );
    check(`${venue} ${which}: no Instant On sentence`, !t.includes(CC.NAS_ONLY_DISCONNECT));
    if (which === "users") {
      check(
        `${venue} users: live Extend menu buttons in the table`,
        (await r.page.locator('table button[title="Extend session"]:not([disabled])').count()) ===
          2,
      );
      check(
        `${venue} users: drawer Extend (+30m) is live`,
        await r.page.getByRole("button", { name: "Extend (+30m)" }).isEnabled(),
      );
    } else {
      const reset = r.page.getByRole("button", { name: "Reset this guest's session" });
      check(`${venue} fix: Reset button is there`, (await reset.count()) === 1);
      check(
        `${venue} fix: Reset button is live`,
        (await reset.count()) === 1 && (await reset.isEnabled()),
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
        writeFileSync(join(tmpdir(), `aruba-lsa-${venue}-${which}-base.html`), b.html);
        writeFileSync(join(tmpdir(), `aruba-lsa-${venue}-${which}-head.html`), r.html);
      }
      await done(b);
    }
    await done(r);
  }
}
if (!BASELINE_ROOT) console.log("  (set BASELINE_ROOT=<origin/staging checkout> for the DOM diff)");

console.log("\nC. Aruba: Extend and Reset greyed like Disconnect");
{
  const r = await render(ROOT, "aruba", "users");
  check(
    "table: no live Extend menu",
    (await r.page.locator('table button[title="Extend session"]').count()) === 0,
  );
  const icons = r.page.locator('[data-testid="extend-unsupported-icon"]');
  eq("table: one greyed Extend per online guest", await icons.count(), 2);
  check("table: greyed Extend is disabled", await icons.first().isDisabled());
  eq(
    "table: greyed Extend carries Disconnect's sentence",
    await icons.first().getAttribute("aria-label"),
    CC.NAS_ONLY_DISCONNECT,
  );
  eq(
    "table: Disconnect beside it carries the same sentence",
    await r.page
      .locator('[data-testid="disconnect-unsupported-icon"]')
      .first()
      .getAttribute("aria-label"),
    CC.NAS_ONLY_DISCONNECT,
  );
  check("drawer: greyed Extend block shown", has(r.html, "extend-unsupported"));
  const d30 = r.page.getByRole("button", { name: "Extend (+30m)" });
  const d60 = r.page
    .getByRole("button", { name: "Extend (+1h)" })
    .or(r.page.locator('[data-testid="extend-unsupported"] button').nth(1));
  check("drawer: Extend (+30m) disabled", await d30.isDisabled());
  check("drawer: second Extend disabled", await d60.first().isDisabled());
  const drawerText = await r.page
    .locator('[data-testid="extend-unsupported"]')
    .evaluate((e) => e.innerText);
  check("drawer: the reason is printed", drawerText.includes(CC.NAS_ONLY_DISCONNECT), drawerText);
  check("drawer: Disconnect still greyed", has(r.html, "disconnect-unsupported"));
  await d30.click({ force: true }).catch(() => {});
  await r.page.waitForTimeout(300);
  check(
    "pressing greyed Extend sends nothing",
    !posts(await r.page.evaluate(() => window.__CALLS__)).some((c) => c.url.endsWith("/extend")),
  );
  await done(r);
}
{
  const r = await render(ROOT, "aruba", "fix");
  check("fix: greyed Reset block shown", has(r.html, "reset-session-unsupported"));
  const reset = r.page.getByRole("button", { name: "Reset this guest's session" });
  eq("fix: exactly one Reset button", await reset.count(), 1);
  check("fix: Reset disabled", await reset.isDisabled());
  const t = await r.page
    .locator('[data-testid="reset-session-unsupported"]')
    .evaluate((e) => e.innerText);
  check("fix: Disconnect's sentence printed", t.includes(CC.NAS_ONLY_DISCONNECT), t);
  await reset.click({ force: true }).catch(() => {});
  await r.page.waitForTimeout(300);
  check("fix: no confirm dialog opened", !(await r.page.getByRole("alertdialog").count()));
  check(
    "fix: pressing greyed Reset sends nothing",
    !posts(await r.page.evaluate(() => window.__CALLS__)).some((c) => c.url.endsWith("/terminate")),
  );
  await done(r);
}

console.log("\nD. Services read disconnect_enforced; admin toasts go through the ladder");
{
  const key = "head-svc";
  if (!dirs.has(key)) dirs.set(key, await bundleFor(ROOT, "mikrotik"));
  const page = await browser.newPage();
  await page.goto(`${origin}/${key}/index.html?page=svc`);
  await page.waitForFunction(() => window.__SVC__, null, { timeout: 15_000 });
  const out = await page.evaluate(() => window.__SVC__);
  check("services ran", !out.error, out.error);
  const want = { "s-false": false, "s-true": true, "s-null": null, "s-env": false, "s-none": null };
  for (const op of ["disconnect", "pause", "terminate"]) {
    for (const [id, v] of Object.entries(want)) {
      eq(`${op} ${id}: sessionEnforced`, out[`${op}:${id}`]?.sessionEnforced, v);
    }
  }
  await page.close();
}
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const live = stripComments(
  readFileSync(join(ROOT, "src/components/guests/LiveSessionsTable.tsx"), "utf8"),
);
const detail = stripComments(
  readFileSync(join(ROOT, "src/components/guests/GuestDetailTabs.tsx"), "utf8"),
);
for (const [name, src] of [
  ["LiveSessionsTable", live],
  ["GuestDetailTabs", detail],
]) {
  check(
    `${name}: no hard-coded "Session disconnected/terminated/paused" success`,
    !/toast\.success\("Session (disconnected|terminated|paused)"\)/.test(src) &&
      !/"Session (disconnected|terminated|paused)",\s*"Failed/.test(src),
  );
  check(`${name}: toasts go through sessionEndToast`, /sessionEndToast\(/.test(src));
}

console.log("\nE. Admin Live Sessions toasts when disconnect_enforced is false");
/** Run one session-ending action from the first row's menu; return the toast. */
async function endSession(r, item) {
  const p = r.page;
  await p.locator("tbody tr").first().locator("button").last().click();
  await p.getByRole("menuitem", { name: item, exact: true }).click();
  await p.waitForTimeout(300);
  await p
    .getByRole("button", { name: /^(Confirm|Terminate|Continue)$/ })
    .last()
    .click();
  await p.waitForTimeout(1500);
  const toasts = await p.$$eval("[data-sonner-toast]", (els) => els.map((e) => e.innerText));
  return toasts.join(" | ").trim();
}
const ITEMS = [
  ["Disconnect", "Session disconnected"],
  ["Pause", "Session paused"],
  ["Terminate", "Session terminated"],
];
for (const venue of ["mikrotik", "omada"]) {
  for (const [item, title] of ITEMS) {
    const r = await render(ROOT, venue, "sessions");
    const got = await endSession(r, item);
    check(`${venue} ${item} (enforced=false): toast unchanged, "${title}"`, got === title, got);
    const calls = await r.page.evaluate(() => window.__CALLS__);
    check(
      `${venue} ${item}: the POST really answered enforced=false`,
      calls.some((c) => c.method === "post" && /-false\/(disconnect|pause|terminate)$/.test(c.url)),
    );
    if (BASELINE_ROOT) {
      const b = await render(BASELINE_ROOT, venue, "sessions");
      const want = await endSession(b, item);
      eq(`${venue} ${item}: toast identical to baseline`, got, want);
      await done(b);
    }
    await done(r);
  }
}
for (const [item, title] of ITEMS) {
  const r = await render(ROOT, "aruba", "sessions");
  const got = await endSession(r, item);
  check(
    `aruba ${item} (enforced=false): never "${title}"`,
    got !== "" &&
      got.split("\n")[0] !== title &&
      /records only/.test(got) &&
      /may still be online/.test(got),
    got,
  );
  await done(r);
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures.length) {
  console.log(`aruba live session actions: ${failures.length} FAILED`);
  process.exit(1);
}
console.log("aruba live session actions: all checks passed");
