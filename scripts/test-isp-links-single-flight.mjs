/**
 * Regression test for `ispService.listLinks`'s in-flight coalescing.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 * The customer dashboard mounts `useWanSummary` and `useBandwidthSeries`
 * side by side, and each runs its own effect issuing a byte-identical
 * `listLinks({ page: 1, pageSize: 100, locationId })`. Both hooks
 * deliberately fetch independently -- their own comments defend that, so
 * one card keeps working if the other's shape changes -- and neither goes
 * through React Query, so nothing deduplicates them. A live network
 * capture of app.wyfyguest.com showed the resulting two identical
 * `GET /isp/links` on every dashboard load.
 *
 * The fix shares the in-flight promise only. That makes three properties
 * worth pinning, and the third is the one a careless "optimisation" would
 * break:
 *
 *   1. TWO CONCURRENT IDENTICAL CALLS MAKE ONE REQUEST -- the actual bug.
 *   2. TWO CALLS WITH DIFFERENT QUERIES STILL MAKE TWO. An unscoped
 *      operator read and a location-scoped read must never collide; they
 *      return different rows, and serving one from the other is a
 *      cross-scope leak wearing the disguise of a cache hit.
 *   3. A LATER CALL MAKES A FRESH REQUEST. This is single-flight, not a
 *      cache. If a settled result were retained, the dashboard would keep
 *      showing a failed-over uplink as active until something evicted it,
 *      which is exactly the number this card exists to be right about.
 *
 * Also: a rejection must not poison the key. If the entry outlived the
 * failure, every later caller would be handed the same rejected promise
 * and the page could never recover without a reload.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The real
 * service module is bundled with esbuild against a counting fake of
 * `@/services/api`, so requests are counted at the axios seam and the
 * thing under test is the shipped code, not a restatement of it.
 *
 * Run: node scripts/test-isp-links-single-flight.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "isp-single-flight-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

// A counting stand-in for the axios instance. `get` resolves on the next
// microtask turn so two callers really do overlap, which is the only
// condition under which coalescing is supposed to happen at all.
const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  `export const calls = [];
   export let failNext = false;
   export function setFailNext(v) { failNext = v; }
   export const api = {
     async get(url, config) {
       calls.push({ url, params: config?.params, headers: config?.headers });
       await new Promise((r) => setTimeout(r, 5));
       if (failNext) { failNext = false; throw new Error("boom"); }
       return { data: { items: [], total_items: 0, total_pages: 1, has_next: false, has_previous: false } };
     },
   };
   export default api;`,
);

// `resolveOrganizationId` would reach for a token and a real request; the
// header it produces is not what this test is about.
const orgStub = join(outdir, "org-stub.mjs");
writeFileSync(
  orgStub,
  `export async function resolveOrganizationId() { return "org-1"; }
   export function resetOrganizationIdCache() {}`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { ispService } from "${p("src/services/isp.service.ts")}";
   export { calls, setFailNext } from "${apiStub.replace(/\\/g, "/")}";`,
);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: {
    // Both spellings: the service imports the api by alias and the
    // org-id resolver by relative path, and the relative one pulls the
    // real api (and therefore axios) back in if it isn't stubbed too.
    "@/services/api": apiStub,
    "@/services/organization-id": orgStub,
  },
  plugins: [
    {
      name: "stub-relative-org-id",
      setup(b) {
        b.onResolve({ filter: /(^|\/)organization-id$/ }, () => ({ path: orgStub }));
      },
    },
  ],
  loader: { ".ts": "ts" },
});

const { ispService, calls, setFailNext } = await import(outfile);

const LOC = { page: 1, pageSize: 100, locationId: "loc-1" };

// 1. The bug itself.
calls.length = 0;
await Promise.all([ispService.listLinks(LOC), ispService.listLinks(LOC)]);
check(
  "two concurrent identical reads issue one request",
  calls.length === 1,
  `issued ${calls.length}`,
);

// 2. Different scopes must not share.
calls.length = 0;
await Promise.all([
  ispService.listLinks(LOC),
  ispService.listLinks({ page: 1, pageSize: 100 }),
  ispService.listLinks({ page: 1, pageSize: 100, locationId: "loc-2" }),
]);
check(
  "different queries still issue their own request",
  calls.length === 3,
  `issued ${calls.length}`,
);

// 3. Single-flight, not a cache.
calls.length = 0;
await ispService.listLinks(LOC);
await ispService.listLinks(LOC);
check(
  "a later read is not served from a retained result",
  calls.length === 2,
  `issued ${calls.length}`,
);

// 4. A failure must not poison the key.
calls.length = 0;
setFailNext(true);
await ispService.listLinks(LOC).then(
  () => check("a failed read rejects", false, "it resolved"),
  () => check("a failed read rejects", true),
);
await ispService.listLinks(LOC);
check(
  "a failure does not strand later readers on the rejected promise",
  calls.length === 2,
  `issued ${calls.length}`,
);

console.log("");
if (failures > 0) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
console.log("all checks passed");
