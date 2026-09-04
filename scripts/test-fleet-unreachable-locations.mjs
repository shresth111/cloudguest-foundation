/**
 * Regression test for the fleet list reporting locations it could not read.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 * There is no endpoint that lists routers platform-wide. `routerService
 * .list()` assembles the fleet by fanning `GET /locations/{id}/routers`
 * across every location and concatenating, under `Promise.allSettled` so
 * that one unreachable location does not take the whole page down.
 *
 * Keeping the page up is right. Dropping the rejected ones *silently* was
 * not: a router missing from a fleet list is the single thing nobody
 * notices, because "eight routers" and "eight routers plus two locations
 * we could not read" render identically. An operator counting devices had
 * no way to tell a short list from a complete one.
 *
 * Three properties, in the order they matter:
 *
 *   1. A FAILING LOCATION IS COUNTED, NOT SWALLOWED. This is the bug.
 *   2. THE SURVIVORS STILL COME BACK. The whole reason for `allSettled` is
 *      that one bad location must not blank the fleet; a "fix" that
 *      rejected the lot would be worse than what it replaced.
 *   3. AN ALL-GOOD FLEET REPORTS ZERO. A count that is non-zero when
 *      nothing failed would train operators to ignore the warning, which
 *      is the same defect one level up.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The real
 * service module is bundled with esbuild against a fake of
 * `@/services/api` that can be told which location to fail, so the thing
 * under test is the shipped code rather than a restatement of it.
 *
 * Run: node scripts/test-fleet-unreachable-locations.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "fleet-unreachable-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

// Two organizations, one location each, one router each. `failLocation`
// picks which location's read rejects, the way an unreachable or archived
// location behaves in production.
const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  `export let failLocation = null;
   export function setFailLocation(v) { failLocation = v; }
   const page = (items) => ({ data: { items, total_items: items.length, total_pages: 1, has_next: false, has_previous: false } });
   const router = (id, locationId) => ({
     id, name: "r-" + id, serial_number: "SN" + id, model: "hEX",
     status: "online", location_id: locationId, organization_id: "org-" + locationId,
     management_ip_address: "10.0.0.1", public_ip_address: null,
     last_seen_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
   });
   export const api = {
     async get(url) {
       if (url === "/organizations") {
         return page([{ id: "org-a", name: "Org A" }, { id: "org-b", name: "Org B" }]);
       }
       if (url === "/organizations/org-a/locations") return page([{ id: "loc-a", name: "Loc A" }]);
       if (url === "/organizations/org-b/locations") return page([{ id: "loc-b", name: "Loc B" }]);
       if (url === "/locations/loc-a/routers") {
         if (failLocation === "loc-a") throw new Error("403 on loc-a");
         return page([router("a1", "loc-a")]);
       }
       if (url === "/locations/loc-b/routers") {
         if (failLocation === "loc-b") throw new Error("403 on loc-b");
         return page([router("b1", "loc-b")]);
       }
       return page([]);
     },
   };
   // Re-exported because sibling service modules pulled into the bundle
   // import them from the api module; nothing here depends on their values.
   export const ORGS_STORAGE_KEY = "orgs";
   export const ROLES_STORAGE_KEY = "roles";
   export const TOKEN_STORAGE_KEY = "token";
   export default api;`,
);

const demoStub = join(outdir, "demo-stub.mjs");
writeFileSync(
  demoStub,
  `export function isDemo() { return false; }
   export async function resolveOrganizationId() { return "org-a"; }
   export function resetOrganizationIdCache() {}
   export default { isDemo };`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { routerService } from "${p("src/services/router.service.ts")}";
   export { setFailLocation } from "${apiStub.replace(/\\/g, "/")}";`,
);

const outfile = join(outdir, "bundle.mjs");
try {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
    alias: { "@/services/api": apiStub },
    plugins: [
      {
        name: "stub-side-modules",
        setup(b) {
          // Anything that would drag in axios, a token, or a browser global.
          b.onResolve({ filter: /(^|\/)(organization-id|demo)$/ }, () => ({ path: demoStub }));
        },
      },
    ],
    loader: { ".ts": "ts" },
  });
} catch (e) {
  console.log(
    (e.errors || [])
      .slice(0, 6)
      .map((x) => `${x.text} @ ${x.location ? x.location.file + ":" + x.location.line : "?"}`)
      .join("\n"),
  );
  process.exit(1);
}

const { routerService, setFailLocation } = await import(outfile);
const QUERY = { page: 1, pageSize: 100 };

// 3. Nothing failed -> zero, so the warning stays meaningful.
setFailLocation(null);
let res = await routerService.list(QUERY);
check(
  "an all-good fleet reports zero unreachable",
  res.unreachableLocationCount === 0,
  `got ${res.unreachableLocationCount}`,
);
check("an all-good fleet returns every router", res.rows.length === 2, `got ${res.rows.length}`);

// 1 + 2. One location fails.
setFailLocation("loc-a");
res = await routerService.list(QUERY);
check(
  "a failing location is counted",
  res.unreachableLocationCount === 1,
  `got ${res.unreachableLocationCount}`,
);
check(
  "the surviving location's routers still come back",
  res.rows.length === 1 && res.rows[0].id === "b1",
  `got ${res.rows.length} rows: ${res.rows.map((r) => r.id).join(",")}`,
);

console.log("");
if (failures > 0) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
console.log("all checks passed");
