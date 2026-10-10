#!/usr/bin/env node
/**
 * THE MASTER CONSOLE MUST NOT ASK THE API ONCE PER ORGANIZATION FOR THINGS
 * ONE REQUEST CAN ANSWER.
 *
 * "The Master dashboard loads slowly" was investigated on production on
 * 2026-10-10 by timing the real API in-process. The database was not the
 * problem -- every statement ran in well under a millisecond and the old
 * analytics_snapshots duplication was gone. The problem was request count
 * against an API that is one Python process: each request costs it 7-20 ms
 * whatever it does, and a burst is served one after another.
 *
 *   /master            21 requests, 527 SQL statements, ~1.0 s of API time.
 *                      12 of them were `GET /dashboard/organization`, one per
 *                      row of a table that renders 5 rows and reads 3 numbers
 *                      from each: 407 ms, 58% of the page.
 *   /master/customers  94 requests, ~2.5 s. 73 of them were
 *                      `billingService.getSnapshot()` (5 + 4N), called for
 *                      ONE column: the customer's plan name.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 *   1. The organization table's rows are ONE request
 *      (`GET /dashboard/super-admin/organizations`) at any row count, and
 *      map to exactly the fields the per-row path produced.
 *   2. The KPI tiles are ONE request and are their own query: they must not
 *      be bundled back behind the organization rows.
 *   3. Against a backend that predates the endpoint (404) the old per-row
 *      path still works, is bounded by `limit` (the Overview asks for the 5
 *      rows it shows, not 12), and the 404 is paid once per session, not
 *      once per refetch. Any OTHER error is not swallowed into a fan-out.
 *   4. /master and /master/customers do not call the expensive hooks.
 *
 * WHY IT LOOKS LIKE THIS: same as scripts/test-platform-overview-requests.mjs
 * -- no test runner in this repo, so the real service module is bundled with
 * esbuild against a counting fake of `@/services/api` and executed.
 */

import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${extra ? `\n       ${extra}` : ""}`);
}
function eq(name, actual, expected) {
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

// ---------------------------------------------------------------------------
// Fixtures: 17 organizations, the production count on the day of measurement.
// ---------------------------------------------------------------------------
const ORG_COUNT = 17;
const orgs = Array.from({ length: ORG_COUNT }, (_, i) => ({
  id: `org-${i + 1}`,
  name: `Org ${i + 1}`,
  guests: 10 * (i + 1),
  routers: i + 1,
  locations: (i % 3) + 1,
}));

const calls = [];
const count = (url) => calls.filter((c) => c.url === url).length;

const apiStub = `
function fail(status) {
  // What the real interceptor rejects with: a plain AppError carrying
  // \`status\`, NOT an AxiosError (see toAppError in services/api.ts).
  return { status, code: "error", message: "HTTP " + status };
}
export const api = {
  get: async (url, config = {}) => {
    globalThis.__calls.push({ url, params: config.params, headers: config.headers });
    const fx = globalThis.__fx;
    if (url === "/dashboard/super-admin/organizations") {
      if (fx.bulkStatus !== 200) throw fail(fx.bulkStatus);
      return {
        data: {
          total_organizations: fx.orgs.length,
          items: fx.orgs.slice(0, config.params.limit).map((o) => ({
            organization_id: o.id,
            organization_name: o.name,
            guest_count_unique: o.guests,
            router_count: o.routers,
            location_count: o.locations,
          })),
        },
      };
    }
    if (url === "/organizations") {
      return { data: { items: fx.orgs.slice(0, config.params.page_size).map((o) => ({ id: o.id, name: o.name })) } };
    }
    if (url === "/dashboard/organization") {
      const o = fx.orgs.find((x) => x.id === config.headers["X-Organization-Id"]);
      return { data: { guest_count_unique: o.guests, router_count: o.routers, location_count: o.locations } };
    }
    if (url === "/dashboard/super-admin/unified") {
      return {
        data: {
          total_revenue: 1234,
          platform: {
            total_organizations: fx.orgs.length, total_locations: 30, total_routers: 14,
            routers_online: 9, routers_offline: 5, total_guests: 257, todays_guests: 3,
            monthly_guests: 40, total_sessions: 625, active_sessions: 2,
            guest_growth: { delta_percent: 12.5 },
          },
        },
      };
    }
    throw new Error("unexpected request: " + url);
  },
};
`;

const dir = mkdtempSync(join(tmpdir(), "master-landing-"));
writeFileSync(join(dir, "api-stub.js"), apiStub);
writeFileSync(join(dir, "customer-stub.js"), `export const isDemo = () => false;\n`);
writeFileSync(
  join(dir, "entry.mjs"),
  `export { analyticsService } from "${p("src/services/analytics.service.ts")}";`,
);
const outfile = join(dir, "bundle.mjs");
await build({
  entryPoints: [join(dir, "entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  tsconfig: join(ROOT, "tsconfig.json"),
  alias: {
    "@/services/api": join(dir, "api-stub.js"),
    "@/services/customer.service": join(dir, "customer-stub.js"),
  },
});

globalThis.__calls = calls;
globalThis.__fx = { orgs, bulkStatus: 200 };

// The module remembers a 404 for the page session, so each scenario gets a
// freshly evaluated copy, exactly like a fresh page load.
let generation = 0;
async function freshService(bulkStatus) {
  globalThis.__fx.bulkStatus = bulkStatus;
  calls.length = 0;
  generation += 1;
  return (await import(`${outfile}?g=${generation}`)).analyticsService;
}

const expectedRow = (o) => ({
  id: o.id,
  name: o.name,
  activeUsers: o.guests,
  activeRouters: o.routers,
  activeLocations: o.locations,
  revenue: 0,
  monthlyGrowth: 0,
});

// ---------------------------------------------------------------------------
// 1. Organization rows: one request at any row count.
// ---------------------------------------------------------------------------
console.log("\norganization rows -- one request, not one per organization");
for (const limit of [5, 12, 100]) {
  const service = await freshService(200);
  const rows = await service.getOrganizationRows(limit);
  const shown = Math.min(limit, ORG_COUNT);
  eq(`limit=${limit}: exactly 1 request for ${shown} rows`, calls.length, 1);
  eq(
    `limit=${limit}: it is the bulk endpoint, asked for ${limit}`,
    [calls[0].url, calls[0].params],
    ["/dashboard/super-admin/organizations", { limit }],
  );
  eq(`limit=${limit}: no per-organization dashboard request`, count("/dashboard/organization"), 0);
  eq(
    `limit=${limit}: rows are field-for-field what the per-row path produced`,
    rows,
    orgs.slice(0, limit).map(expectedRow),
  );
}

// ---------------------------------------------------------------------------
// 2. KPI tiles: one request, and not bundled with the rows.
// ---------------------------------------------------------------------------
console.log("\nKPI tiles -- their own single request");
{
  const service = await freshService(200);
  const kpis = await service.getPlatformKpis();
  eq("exactly 1 request", calls.length, 1);
  eq("to the unified platform dashboard", calls[0].url, "/dashboard/super-admin/unified");
  eq("tenants", kpis.totalOrganizations, ORG_COUNT);
  eq("routers online / total", [kpis.activeRouters, kpis.totalRouters], [9, 14]);
  eq("active sessions", kpis.activeGuests, 2);
  eq("total guests", kpis.totalGuests, 257);
}
{
  const service = await freshService(200);
  const snapshot = await service.getSnapshot("last30");
  eq("getSnapshot (/master/analytics) is 2 requests, was 2 + N", calls.length, 2);
  eq("getSnapshot still carries twelve organization rows", snapshot.organizations.length, 12);
  eq("getSnapshot still carries the KPIs", snapshot.kpis.totalOrganizations, ORG_COUNT);
  eq(
    "getSnapshot still carries the router split",
    [snapshot.routers.online, snapshot.routers.offline],
    [9, 5],
  );
}

// ---------------------------------------------------------------------------
// 3. A backend without the endpoint: bounded fallback, 404 paid once.
// ---------------------------------------------------------------------------
console.log("\nbackend that predates the endpoint (404) -- bounded fallback");
{
  const service = await freshService(404);
  const rows = await service.getOrganizationRows(5);
  eq("same rows as the bulk path", rows, orgs.slice(0, 5).map(expectedRow));
  eq("1 failed probe + 1 list + 5 rows = 7 requests (the page used to make 13)", calls.length, 7);
  eq(
    "the list is asked for 5 organizations, not 12",
    calls.find((c) => c.url === "/organizations").params,
    { page_size: 5 },
  );
  eq(
    "5 per-organization dashboards, each scoped by header",
    calls
      .filter((c) => c.url === "/dashboard/organization")
      .map((c) => c.headers["X-Organization-Id"]),
    orgs.slice(0, 5).map((o) => o.id),
  );

  calls.length = 0;
  await service.getOrganizationRows(5);
  eq(
    "a refetch in the same session does not probe the missing endpoint again",
    count("/dashboard/super-admin/organizations"),
    0,
  );
  eq("so it is 1 + 5 requests", calls.length, 6);
}
for (const status of [403, 500, null]) {
  const service = await freshService(status);
  let thrown = null;
  try {
    await service.getOrganizationRows(5);
  } catch (err) {
    thrown = err;
  }
  eq(
    `a ${status ?? "network"} error is surfaced, not turned into a fan-out`,
    [thrown?.status ?? null, calls.length],
    [status, 1],
  );
}

// ---------------------------------------------------------------------------
// 4. The pages use the cheap reads.
// ---------------------------------------------------------------------------
console.log("\nthe pages");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const overviewPage = strip(readFileSync(p("src/routes/master.index.tsx"), "utf8"));
const customersPage = strip(readFileSync(p("src/routes/master.customers.tsx"), "utf8"));
check("/master reads KPIs through usePlatformKpis()", /usePlatformKpis\(\)/.test(overviewPage));
check(
  "/master reads rows through usePlatformOrganizationRows(ORGANIZATION_TABLE_ROWS)",
  /usePlatformOrganizationRows\(ORGANIZATION_TABLE_ROWS\)/.test(overviewPage),
);
check(
  "/master asks for the 5 rows it renders",
  /const ORGANIZATION_TABLE_ROWS = 5;/.test(overviewPage),
);
check(
  "/master does not use useAnalyticsSnapshot (KPIs held behind the rows)",
  !/useAnalyticsSnapshot/.test(overviewPage),
);
check("/master does not use useBillingSnapshot (5 + 4N)", !/useBillingSnapshot/.test(overviewPage));
check(
  "/master/customers gets plan names from billingService.getOverview()",
  /billingService\.getOverview\(\)/.test(customersPage),
);
check(
  "/master/customers does not call billingService.getSnapshot() (5 + 4N for one column)",
  !/getSnapshot\(/.test(customersPage),
);

console.log(`\n  organization-table requests for one /master load at N=${ORG_COUNT}`);
console.log("    before  13  (1 list + 12 per-organization dashboards)");
console.log("    after    1");

console.log(
  failures === 0
    ? "\nAll master-landing request checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
