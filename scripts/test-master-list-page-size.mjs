/**
 * Regression test for the two 422s every Master page load fired
 * (2026-10-02):
 *
 *   GET /organizations?page=1&page_size=200                              -> 422
 *   GET /network-integrations/platform/integrations?page=1&page_size=200 -> 422
 *
 * Both backend routes declare `page_size: int = Query(default=25, ge=1,
 * le=100)`, so a request above 100 is rejected outright, not clamped. The
 * callers wanted "all of them" (the organization scope picker and Router
 * Fleet's controller -> integration join), and got nothing.
 *
 * WHAT THIS LOCKS DOWN:
 *  1. `organizationService.listAll()` and
 *     `networkIntegrationService.listAllPlatformIntegrations()` never send a
 *     `page_size` above 100.
 *  2. They walk `has_next` and return EVERY row -- the fix is not "ask for
 *     100 and silently drop tenant 101".
 *  3. A failed page rejects the whole read: no partial list that looks
 *     complete.
 *  4. Filters given to `listAllPlatformIntegrations` reach every page.
 *  5. `listAllPages`' runaway guard throws rather than truncates.
 *  6. Statically: no literal page size above its endpoint's cap ANYWHERE
 *     in src/ (see section 6 below for why the first version of this scan
 *     missed four of them).
 *
 * Follow-up (same day): the services that fan out across tenants
 * (`fetchAllOrganizations` -> per-org locations -> per-location routers, in
 * router/location/nas/guest/billing) each read ONE page of 100 and called
 * it "all". They now walk `has_next` through `getAllItems`, which is
 * exercised below against a fake backend that enforces each endpoint's own
 * `le=` (100 everywhere, 200 on `/monitored-hardware`).
 *
 * Same shape as `test-controller-devices-service.mjs`: the real services are
 * bundled with esbuild against a stubbed `api`, so the real code runs.
 *
 * Run: node scripts/test-master-list-page-size.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

let checks = 0;
let failures = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, a, e) =>
  check(name, a === e, `expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);

const outdir = mkdtempSync(join(tmpdir(), "master-list-page-size-"));

// A fake backend that enforces the real `le=100` and paginates a fixed
// row set, so an over-sized request fails here the way it does in prod.
const apiStub = `
globalThis.__ml ??= { calls: [], rows: {}, failOnPage: null, failUrl: null, caps: {}, noHasNext: false };
function paginate(url, params, headers) {
  const st = globalThis.__ml;
  st.calls.push({ url, params: { ...params }, headers: { ...(headers || {}) } });
  const size = params.page_size ?? 25; // the routes' own default
  // Each endpoint's real \`le=\` -- 100 unless the route says otherwise.
  const cap = st.caps[url] ?? 100;
  if (!(size >= 1 && size <= cap)) {
    const err = new Error("Request failed with status code 422");
    err.response = { status: 422 };
    throw err;
  }
  const page = params.page ?? 1;
  if (st.failOnPage === page && (st.failUrl === null || st.failUrl === url)) {
    const err = new Error("Request failed with status code 500");
    err.response = { status: 500 };
    throw err;
  }
  const org = headers && headers["X-Organization-Id"];
  const all = (org && st.rows[url + "|" + org]) || st.rows[url] || [];
  const items = all.slice((page - 1) * size, page * size);
  const total_pages = Math.max(1, Math.ceil(all.length / size));
  const data = {
    items,
    page,
    page_size: size,
    total_items: all.length,
    total_pages,
    has_next: page < total_pages,
    has_previous: page > 1,
  };
  if (st.noHasNext) {
    delete data.has_next;
    delete data.total_pages;
  }
  return { data };
}
export const api = {
  get: async (url, opts) => paginate(url, (opts && opts.params) || {}, opts && opts.headers),
  post: async () => ({ data: {} }),
  put: async () => ({ data: {} }),
  patch: async () => ({ data: {} }),
  delete: async () => ({ data: {} }),
};
export function crossOrganizationHeaders() { return {}; }
export function toAppError(e) { return e; }
`;
writeFileSync(join(outdir, "api-stub.mjs"), apiStub);
writeFileSync(
  join(outdir, "cust-stub.mjs"),
  `export function isDemo() { return false; }
export async function resolveOrgId() { return "org-1"; }
export async function resolveOrganizationId() { return "org-1"; }`,
);

writeFileSync(join(outdir, "guest-portal-stub.mjs"), "export const guestPortalApi = {};");

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { organizationService } from "${p("src/services/organization.service.ts")}";
export { networkIntegrationService } from "${p("src/services/network-integration.service.ts")}";
export { listAllPages, getAllItems, BACKEND_MAX_PAGE_SIZE } from "${p("src/services/list-all-pages.ts")}";
export { routerService } from "${p("src/services/router.service.ts")}";
export { locationService } from "${p("src/services/location.service.ts")}";
export { nasService } from "${p("src/services/nas.service.ts")}";
export { guestService } from "${p("src/services/guest.service.ts")}";
export { contentFilterService } from "${p("src/services/contentFilter.service.ts")}";
export { deviceHardwareService } from "${p("src/services/deviceHardware.service.ts")}";
export { campaignService } from "${p("src/services/campaign.service.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": p("src") },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^(\.\/|.*services\/)api$/ }, () => ({
          path: join(outdir, "api-stub.mjs"),
        }));
        // Imported by network-integration.service for the guest portal's
        // unauthenticated calls; nothing under test reaches it.
        b.onResolve({ filter: /guest-portal-api$/ }, () => ({
          path: join(outdir, "guest-portal-stub.mjs"),
        }));
        // campaign.service resolves the caller's org through /users/me;
        // nothing under test is about that, so it is a fixed id here.
        b.onResolve({ filter: /\/organization-id$/ }, () => ({
          path: join(outdir, "cust-stub.mjs"),
        }));
        b.onResolve({ filter: /services\/customer\.service$/ }, () => ({
          path: join(outdir, "cust-stub.mjs"),
        }));
      },
    },
  ],
});

const {
  organizationService,
  networkIntegrationService,
  listAllPages,
  getAllItems,
  BACKEND_MAX_PAGE_SIZE,
  routerService,
  locationService,
  nasService,
  guestService,
  contentFilterService,
  deviceHardwareService,
  campaignService,
} = await import(`file://${outfile}`);
const st = globalThis.__ml;

const org = (i) => ({
  id: `org-${i}`,
  name: `Org ${i}`,
  slug: `org-${i}`,
  legal_name: null,
  org_type: "customer",
  status: "active",
  parent_organization_id: null,
  contact_email: `o${i}@example.com`,
  contact_phone: null,
  timezone: "Asia/Kolkata",
  default_locale: "en",
  settings: {},
  subscription_tier: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});
const integ = (i) => ({
  id: `int-${i}`,
  organization_id: `org-${i % 7}`,
  location_id: `loc-${i}`,
  provider: "omada",
  name: `Controller ${i}`,
  status: "connected",
  is_enabled: true,
  base_url: "https://omada.example",
  auth_mode: "openapi_client",
});

eq("backend cap constant is the backend's le=100", BACKEND_MAX_PAGE_SIZE, 100);

// The fake backend itself must reject 200, or every check below is vacuous.
let rejected200 = false;
try {
  await organizationService.list({ page: 1, pageSize: 200 });
} catch (e) {
  rejected200 = e?.response?.status === 422;
}
check("stub backend reproduces the prod 422 for page_size=200", rejected200);

// --- 1+2. organizations: 14 (today) and 250 (growth) ----------------------
for (const n of [14, 250]) {
  st.calls.length = 0;
  st.failOnPage = null;
  st.rows["/organizations"] = Array.from({ length: n }, (_, i) => org(i));
  const all = await organizationService.listAll();
  eq(`orgs listAll returns all ${n}`, all.length, n);
  eq(`orgs listAll last row is org-${n - 1}`, all[all.length - 1]?.id, `org-${n - 1}`);
  check(
    `orgs listAll (${n}) never sends page_size > 100`,
    st.calls.every((c) => c.params.page_size <= 100),
    JSON.stringify(st.calls.map((c) => c.params.page_size)),
  );
  eq(`orgs listAll (${n}) request count`, st.calls.length, Math.max(1, Math.ceil(n / 100)));
}

// --- 3. a failed page rejects the whole read -------------------------------
st.rows["/organizations"] = Array.from({ length: 250 }, (_, i) => org(i));
st.failOnPage = 2;
let orgErr = null;
try {
  await organizationService.listAll();
} catch (e) {
  orgErr = e;
}
check("orgs listAll rejects when page 2 fails (no partial directory)", orgErr !== null);
st.failOnPage = null;

// --- integrations ----------------------------------------------------------
const INTEG_URL = "/network-integrations/platform/integrations";
st.calls.length = 0;
st.rows[INTEG_URL] = Array.from({ length: 205 }, (_, i) => integ(i));
const ints = await networkIntegrationService.listAllPlatformIntegrations();
eq("integrations listAll returns all 205", ints.length, 205);
eq("integrations listAll maps location_id", ints[204]?.locationId, "loc-204");
check(
  "integrations listAll never sends page_size > 100",
  st.calls.every((c) => c.params.page_size <= 100),
  JSON.stringify(st.calls.map((c) => c.params.page_size)),
);
eq("integrations listAll hits the platform route", st.calls[0]?.url, INTEG_URL);
eq("integrations listAll request count", st.calls.length, 3);

// 4. filters reach every page
st.calls.length = 0;
await networkIntegrationService.listAllPlatformIntegrations({
  provider: "omada",
  organizationId: "org-3",
});
check(
  "integrations listAll forwards filters on every page",
  st.calls.length === 3 &&
    st.calls.every((c) => c.params.provider === "omada" && c.params.organization_id === "org-3"),
  JSON.stringify(st.calls.map((c) => c.params)),
);

st.failOnPage = 3;
let intErr = null;
try {
  await networkIntegrationService.listAllPlatformIntegrations();
} catch (e) {
  intErr = e;
}
check("integrations listAll rejects when the last page fails", intErr !== null);
st.failOnPage = null;

// --- 5. runaway guard ------------------------------------------------------
let pagesAsked = 0;
let runawayErr = null;
try {
  await listAllPages(
    async () => {
      pagesAsked += 1;
      return { rows: [1], hasNext: true };
    },
    { maxPages: 3 },
  );
} catch (e) {
  runawayErr = e;
}
check("listAllPages throws instead of truncating a never-ending list", runawayErr !== null);
eq("listAllPages stopped at maxPages", pagesAsked, 3);

let askedSize = null;
await listAllPages(
  async (_page, size) => {
    askedSize = size;
    return { rows: [], hasNext: false };
  },
  { pageSize: 500 },
);
eq("listAllPages clamps a requested pageSize to the backend cap", askedSize, 100);

// --- 7. getAllItems: the raw-endpoint walk ---------------------------------
function resetBackend() {
  st.calls.length = 0;
  st.rows = {};
  st.failOnPage = null;
  st.failUrl = null;
  st.caps = {};
  st.noHasNext = false;
}
const row = (prefix) => (i) => ({ id: `${prefix}-${i}`, name: `${prefix} ${i}` });

resetBackend();
st.rows["/things"] = Array.from({ length: 230 }, row("t"));
eq("getAllItems returns all 230", (await getAllItems("/things")).length, 230);
check(
  "getAllItems sends page_size <= 100 and forwards params on every page",
  st.calls.length === 3 && st.calls.every((c) => c.params.page_size === 100),
  JSON.stringify(st.calls.map((c) => c.params)),
);

// No has_next / total_pages in the payload: a full page means "maybe more".
resetBackend();
st.noHasNext = true;
st.rows["/things"] = Array.from({ length: 200 }, row("t"));
eq("getAllItems without has_next still reads all 200", (await getAllItems("/things")).length, 200);
eq("...and stops on the empty page after two full ones", st.calls.length, 3);

resetBackend();
st.rows["/things"] = Array.from({ length: 230 }, row("t"));
st.failOnPage = 2;
let gaiErr = null;
try {
  await getAllItems("/things");
} catch (e) {
  gaiErr = e;
}
check("getAllItems rejects when a middle page fails", gaiErr?.response?.status === 500);

// --- 8. the cross-tenant fan-outs, past 100 at every level ----------------
// 130 orgs. org-0 has 120 locations; one of those has 105 routers. Every
// other org has one location with one router. 129 + 119 + 105 = 353 routers.
function seedFleet() {
  resetBackend();
  st.rows["/organizations"] = Array.from({ length: 130 }, (_, i) => ({
    id: `org-${i}`,
    name: `Org ${i}`,
  }));
  for (let o = 0; o < 130; o++) {
    const nLoc = o === 0 ? 120 : 1;
    st.rows[`/organizations/org-${o}/locations`] = Array.from({ length: nLoc }, (_, l) => ({
      id: `loc-${o}-${l}`,
      name: `Loc ${o}-${l}`,
      organization_id: `org-${o}`,
      status: "active",
    }));
    for (let l = 0; l < nLoc; l++) {
      const nR = o === 0 && l === 7 ? 105 : 1;
      st.rows[`/locations/loc-${o}-${l}/routers`] = Array.from({ length: nR }, (_, r) => ({
        id: `r-${o}-${l}-${r}`,
        name: `Router ${o}-${l}-${r}`,
        location_id: `loc-${o}-${l}`,
        serial_number: `S${o}${l}${r}`,
        status: "online",
        vendor: "mikrotik",
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
      }));
    }
  }
}
const overCap = () =>
  st.calls.filter(
    (c) => !(c.params.page_size >= 1 && c.params.page_size <= (st.caps[c.url] ?? 100)),
  );

seedFleet();
const fleet = await routerService.listAll();
eq(
  "routerService.listAll returns the whole 353-router fleet (no 200 slice)",
  fleet.rows.length,
  353,
);
eq("routerService.listAll: no location dropped", fleet.unreachableLocationCount, 0);
check(
  "routerService.listAll reads router 105 of the big location",
  fleet.rows.some((r) => r.id === "r-0-7-104"),
);
check(
  "routerService.listAll reads org 130 (page 2 of /organizations)",
  fleet.rows.some((r) => r.organizationName === "Org 129"),
);
eq("routerService.listAll: no request over its endpoint cap", overCap().length, 0);

seedFleet();
const page2 = await routerService.list({ page: 2, pageSize: 25 });
eq("routerService.list still windows client-side (page 2 of 25)", page2.rows.length, 25);
eq("routerService.list total is the whole fleet", page2.total, 353);

seedFleet();
const locs = await locationService.listAll();
eq("locationService.listAll returns all 249 locations across 130 orgs", locs.length, 249);
eq("locationService.listAll: no request over its endpoint cap", overCap().length, 0);

seedFleet();
const scoped = await locationService.list({ organizationId: "org-0", page: 1, pageSize: 500 });
eq("locationService.list(org) reads all 120 of one org's locations", scoped.total, 120);

seedFleet();
st.rows["/radius/nas"] = Array.from({ length: 150 }, (_, i) => ({
  id: `nas-${i}`,
  // org-129 is on page 2 of /organizations. listAll drops NAS rows whose org
  // is not in the directory (archived-org filter), so a one-page directory
  // made every one of these vanish as if its tenant were archived.
  organization_id: "org-129",
  location_id: "loc-129-0",
  router_id: null,
  name: `NAS ${i}`,
  status: "active",
}));
const nas = await nasService.listAll();
eq("nasService.listAll returns all 150 NAS clients (tenant 130's included)", nas.length, 150);
eq(
  "nasService.listAll resolves the location of a page-2 tenant",
  nas[0]?.locationName,
  "Loc 129-0",
);

// A failed page inside one tenant's fan-out is counted, not hidden.
seedFleet();
st.failUrl = "/organizations/org-0/locations";
st.failOnPage = 2;
const partial = await routerService.listAll();
eq(
  "a failed page of one org's locations is reported (unreachableOrganizationCount), not silently short",
  partial.unreachableOrganizationCount,
  1,
);
eq("...and the other 129 tenants' routers still load", partial.rows.length, 129);
check(
  "...and none of that org's routers appear as if the list were complete",
  !partial.rows.some((r) => r.id.startsWith("r-0-")),
);

// A failed page of the tenant directory fails the whole read.
seedFleet();
st.failUrl = "/organizations";
st.failOnPage = 2;
let dirErr = null;
try {
  await routerService.listAll();
} catch (e) {
  dirErr = e;
}
check("a failed page of /organizations fails the fleet read", dirErr !== null);

// guest teams fan-out (allPages) for a global caller
seedFleet();
st.rows["/guest-teams|org-3"] = Array.from({ length: 140 }, (_, i) => ({
  id: `team-${i}`,
  organization_id: "org-3",
  name: `Team ${i}`,
}));
const teams = await guestService.listTeams();
eq("guestService.listTeams() reads all 140 of one tenant's teams", teams.length, 140);

resetBackend();
st.rows["/guest-teams"] = Array.from({ length: 101 }, (_, i) => ({ id: `team-${i}`, name: "t" }));
eq(
  "guestService.listTeams(org) reads team 101",
  (await guestService.listTeams("org-1")).length,
  101,
);

// --- 9. the three call sites that asked for more than the cap -------------
resetBackend();
st.rows["/content-filter-rules"] = Array.from({ length: 160 }, (_, i) => ({
  id: `cf-${i}`,
  router_id: "r1",
  name: `Rule ${i}`,
  value_type: "domain",
  value: `site${i}.example`,
  is_enabled: true,
}));
const cf = await contentFilterService.listAll("r1");
eq(
  "contentFilterService.listAll returns all 160 rules (FixAProblem asked for 200 -> 422)",
  cf.length,
  160,
);
eq("contentFilterService.listAll: no request over le=100", overCap().length, 0);
check(
  "contentFilterService.listAll sends router_id on every page",
  st.calls.every((c) => c.params.router_id === "r1"),
);

resetBackend();
let cf422 = null;
try {
  await contentFilterService.list({ routerId: "r1", page: 1, pageSize: 200 });
} catch (e) {
  cf422 = e?.response?.status;
}
eq("the old FixAProblem request (200) is what the fake backend 422s", cf422, 422);

// /monitored-hardware is the one route whose cap is 200.
resetBackend();
st.caps["/monitored-hardware"] = 200;
st.rows["/monitored-hardware"] = Array.from({ length: 450 }, (_, i) => ({
  id: `hw-${i}`,
  location_id: "loc-1",
  name: `Device ${i}`,
  mac_address: "AA:BB:CC:DD:EE:FF",
  device_type: "ap",
}));
const hw = await deviceHardwareService.list("loc-1");
eq(
  "deviceHardwareService.list returns all 450 devices (one request of 200 dropped 250)",
  hw.length,
  450,
);
check(
  "deviceHardwareService.list uses that route's own cap (200 per page, 3 pages)",
  st.calls.length === 3 && st.calls.every((c) => c.params.page_size === 200),
  JSON.stringify(st.calls.map((c) => c.params.page_size)),
);
eq("deviceHardwareService.list: no request over le=200", overCap().length, 0);

// campaigns: the old 20-page clamp is now an error, not a short list
resetBackend();
st.rows["/campaigns"] = Array.from({ length: 250 }, (_, i) => ({
  id: `c-${i}`,
  name: `C ${i}`,
  status: i % 2 ? "active" : "draft",
  campaign_type: "banner",
}));
const kpis = await campaignService.getKpis();
eq("campaign KPIs count all 250, not the first 100", kpis.total, 250);
eq("campaign KPI active count is over all rows", kpis.active, 125);

// --- 6. static: no fixed page size above its endpoint's cap ----------------
//
// WHY THE FIRST VERSION OF THIS SCAN MISSED FOUR. It was
//   /(organizationService\.list|listPlatformIntegrations)\(\s*\{[^}]*?pageSize:\s*(\d+)/
// i.e. it only looked inside a call to one of the two functions #373
// fixed. The survivors were:
//   - master.routers.tsx: `const FLEET_LIST_QUERY = { page: 1, pageSize: 200, ... }`,
//     an object literal passed BY NAME to `useRouters(...)` -- no call text
//     around the number at all;
//   - master.console.tsx: `routerService.list({ page: 1, pageSize: 200 })`
//     and superadmin.service.ts: `routerService.list({ ..., pageSize: 1000 })`
//     -- a different callee;
//   - FixAProblem.tsx: `contentFilterService.list({ ..., pageSize: 200 })`
//     -- a different callee (shipped in the OperationsFeatures chunk).
// This version looks at the NUMBER, not the callee: any `pageSize`,
// `page_size`, `maxPageSize` or `*PAGE_SIZE` bound to a literal, whether as
// an object property, a call argument, a default parameter or a constant.
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(name)) yield full;
  }
}

const PAGE_SIZE_LITERAL =
  /\b(pageSize|page_size|maxPageSize|perPage|per_page|[A-Z][A-Z0-9_]*PAGE_SIZE)\b\s*(?:[:=]|\?\?)\s*([0-9][0-9_]*)\b/g;

/** Endpoints whose own `le=` is above 100. Each entry names the route and
 * its cap, so an exception is never a mystery number. */
const ALLOWLIST = [
  {
    file: "src/services/deviceHardware.service.ts",
    key: "maxPageSize",
    value: 200,
    endpoint: "GET /monitored-hardware",
    cap: "page_size: int = Query(default=100, ge=1, le=200)  (monitored_hardware/router.py)",
  },
];
const LIMIT = 100;

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, pre) => pre);
}

function scan(rel, src) {
  const found = [];
  for (const m of stripComments(src).matchAll(PAGE_SIZE_LITERAL)) {
    const value = Number(m[2].replace(/_/g, ""));
    if (value <= LIMIT) continue;
    const allowed = ALLOWLIST.some((a) => a.file === rel && a.key === m[1] && a.value === value);
    if (!allowed) found.push(`${rel}: ${m[1]} ${value}`);
  }
  return found;
}

// The scanner must catch every shape that slipped through before -- if it
// does not, a clean scan below proves nothing.
const shapes = {
  "object literal (FLEET_LIST_QUERY)": "const Q = {\n  page: 1,\n  pageSize: 200,\n  search: '' };",
  "call argument": "routerService.list({ page: 1, pageSize: 1000 });",
  "snake_case param": "api.get('/x', { params: { location_id: id, page_size: 200 } });",
  constant: "const SESSIONS_PAGE_SIZE = 250;",
  "default parameter": "async function f(page = 1, pageSize = 500) {}",
  "maxPageSize override": "getAllItems('/x', { maxPageSize: 200 });",
};
for (const [label, snippet] of Object.entries(shapes)) {
  check(`scan catches: ${label}`, scan("fixture.ts", snippet).length === 1, snippet);
}
check(
  "scan ignores comments and values <= 100",
  scan("fixture.ts", "// page_size=200 in prose\n/* pageSize: 500 */\nconst q = { pageSize: 100 };")
    .length === 0,
);

const offenders = [];
const allowHits = new Set();
for (const file of walk(p("src"))) {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
  if (/\.test\.tsx?$/.test(rel)) continue;
  const src = readFileSync(file, "utf8");
  offenders.push(...scan(rel, src));
  for (const a of ALLOWLIST) {
    if (a.file === rel && new RegExp(`\\b${a.key}\\s*:\\s*${a.value}\\b`).test(stripComments(src)))
      allowHits.add(a.file);
  }
}
check(
  "no fixed page size above 100 anywhere in src/ (outside the allowlist)",
  offenders.length === 0,
  offenders.join("; "),
);
check(
  "every allowlist entry is still in use (no stale exception)",
  ALLOWLIST.every((a) => allowHits.has(a.file)),
);

// A tenant-directory read must walk every page. Calling the paginated
// `organizationService.list` for page 1 of 100 is the truncation shape the
// five `fetchAllOrganizations()` helpers had; `listAll()` is the fix.
const firstPageDirectory = [];
const DIRECTORY_FIRST_PAGE = /organizationService\.list\(\{\s*page:\s*1,\s*pageSize:\s*100\s*\}\)/g;
const ROUTER_FIRST_SLICE = /routerService\.list\(\{[^}]*pageSize:\s*(?:100|200|1000)\s*\}\)/g;
for (const file of walk(p("src"))) {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
  const src = stripComments(readFileSync(file, "utf8"));
  for (const m of src.matchAll(DIRECTORY_FIRST_PAGE)) firstPageDirectory.push(`${rel}: ${m[0]}`);
  for (const m of src.matchAll(ROUTER_FIRST_SLICE)) firstPageDirectory.push(`${rel}: ${m[0]}`);
}
check(
  "no 'all orgs' / 'all routers' read that is really page 1 of a fixed size",
  firstPageDirectory.length === 0,
  firstPageDirectory.join("; "),
);

// fetchAllOrganizations() in every fan-out service walks pages.
for (const svc of ["guest", "billing", "location", "router", "nas"]) {
  const src = readFileSync(p(`src/services/${svc}.service.ts`), "utf8");
  const body = src.slice(src.indexOf("async function fetchAllOrganizations"));
  const fn = body.slice(0, body.indexOf("\n}\n"));
  check(
    `${svc}.service fetchAllOrganizations walks every page`,
    /getAllItems<\w+>\("\/organizations"\)/.test(fn) && !/page_size/.test(stripComments(fn)),
    fn,
  );
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} check(s) failed`);
  process.exit(1);
}
console.log(`\n${checks} checks`);
console.log("master-list-page-size: all checks passed");
