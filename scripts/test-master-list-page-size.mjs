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
 *  6. Statically: no caller of `organizationService.list(` or
 *     `listPlatformIntegrations(` in src/ passes a literal pageSize > 100.
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
globalThis.__ml ??= { calls: [], rows: {}, failOnPage: null };
function paginate(url, params) {
  const st = globalThis.__ml;
  st.calls.push({ url, params: { ...params } });
  const size = params.page_size;
  if (!(size >= 1 && size <= 100)) {
    const err = new Error("Request failed with status code 422");
    err.response = { status: 422 };
    throw err;
  }
  const page = params.page ?? 1;
  if (st.failOnPage === page) {
    const err = new Error("Request failed with status code 500");
    err.response = { status: 500 };
    throw err;
  }
  const all = st.rows[url] ?? [];
  const items = all.slice((page - 1) * size, page * size);
  const total_pages = Math.max(1, Math.ceil(all.length / size));
  return {
    data: {
      items,
      page,
      page_size: size,
      total_items: all.length,
      total_pages,
      has_next: page < total_pages,
      has_previous: page > 1,
    },
  };
}
export const api = { get: async (url, opts) => paginate(url, (opts && opts.params) || {}) };
export function crossOrganizationHeaders() { return {}; }
export function toAppError(e) { return e; }
`;
writeFileSync(join(outdir, "api-stub.mjs"), apiStub);
writeFileSync(
  join(outdir, "cust-stub.mjs"),
  `export function isDemo() { return false; }
export async function resolveOrgId() { return "org-1"; }`,
);

writeFileSync(join(outdir, "guest-portal-stub.mjs"), "export const guestPortalApi = {};");

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { organizationService } from "${p("src/services/organization.service.ts")}";
export { networkIntegrationService } from "${p("src/services/network-integration.service.ts")}";
export { listAllPages, BACKEND_MAX_PAGE_SIZE } from "${p("src/services/list-all-pages.ts")}";`,
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
        b.onResolve({ filter: /services\/customer\.service$/ }, () => ({
          path: join(outdir, "cust-stub.mjs"),
        }));
      },
    },
  ],
});

const { organizationService, networkIntegrationService, listAllPages, BACKEND_MAX_PAGE_SIZE } =
  await import(`file://${outfile}`);
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

// --- 6. static: no over-cap literal at either call site --------------------
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(name)) yield full;
  }
}
const offenders = [];
const CALL = /(organizationService\.list|listPlatformIntegrations)\(\s*\{[^}]*?pageSize:\s*(\d+)/gs;
for (const file of walk(p("src"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(CALL)) {
    if (Number(m[2]) > 100)
      offenders.push(`${file.slice(ROOT.length + 1)}: ${m[1]} pageSize ${m[2]}`);
  }
}
check(
  "no caller passes a literal pageSize > 100 to either list",
  offenders.length === 0,
  offenders.join("; "),
);

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} check(s) failed`);
  process.exit(1);
}
console.log(`\n${checks} checks`);
console.log("master-list-page-size: all checks passed");
