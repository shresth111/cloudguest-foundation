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
 * The properties worth pinning:
 *
 *   1. TWO CONCURRENT IDENTICAL CALLS MAKE ONE REQUEST -- the actual bug.
 *   1b. AN OMITTED `page` AND AN EXPLICIT `page: 1` ARE ONE CALL. They are
 *      the same request on the wire (`page: int = Query(default=1)`), and
 *      they were two different keys, which is why a third reader --
 *      `getDashboard()`'s SLA leg, which omits `page` -- shared nothing
 *      with the two WAN cards, which pass it.
 *   2. TWO CALLS WITH DIFFERENT QUERIES STILL MAKE TWO. An unscoped
 *      operator read and a location-scoped read must never collide; they
 *      return different rows, and serving one from the other is a
 *      cross-scope leak wearing the disguise of a cache hit.
 *   3. A SETTLED RESULT IS SHARED, BUT ONLY BRIEFLY, AND NEVER ACROSS A
 *      WRITE. This assertion used to read "a later call makes a fresh
 *      request. This is single-flight, not a cache. If a settled result
 *      were retained, the dashboard would keep showing a failed-over
 *      uplink as active until something evicted it, which is exactly the
 *      number this card exists to be right about."
 *
 *      That fear is exactly right and is now answered by eviction rather
 *      than by refusing to retain. What forced the change is a
 *      measurement, not a preference: the dashboard's three readers are
 *      SEQUENTIAL, not concurrent -- the WAN cards live inside the
 *      `d ? … : …` branch and do not mount until `getDashboard()` has
 *      already resolved, one links round trip and one summary round trip
 *      later (timed in scripts/test-customer-dashboard-fetch-count.mjs).
 *      Nothing keyed on "in flight right now" can bridge that. So a
 *      success is retained for `LINKS_SHARE_WINDOW_MS` -- far under the
 *      20s poll every live reader of this list already refreshes on -- and
 *      dropped by `dropLinksCache()` after every write that can change a
 *      link row. Cases 3a/3b/3c below pin the window, its expiry, and the
 *      write eviction; 3c is the one that keeps the old comment's failed-
 *      over uplink honest.
 *
 * Also: a rejection must not poison the key, and must not be retained. If
 * the entry outlived the failure, every later caller would be handed the
 * same rejected promise and the page could never recover without a reload.
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
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
   const list = { data: { items: [], total_items: 0, total_pages: 1, has_next: false, has_previous: false } };
   export const api = {
     async get(url, config) {
       calls.push({ url, params: config?.params, headers: config?.headers });
       await new Promise((r) => setTimeout(r, 5));
       if (failNext) { failNext = false; throw new Error("boom"); }
       return list;
     },
     async post(url, _b, config) {
       calls.push({ url, params: config?.params, headers: config?.headers });
       await new Promise((r) => setTimeout(r, 5));
       return { data: {} };
     },
     async put(url, _b, config) {
       calls.push({ url, params: config?.params, headers: config?.headers });
       await new Promise((r) => setTimeout(r, 5));
       return { data: {} };
     },
     async delete(url, config) {
       calls.push({ url, params: config?.params, headers: config?.headers });
       await new Promise((r) => setTimeout(r, 5));
       return { data: {} };
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

// The share window is wall-clock, so the clock is what gets moved rather
// than the test sleeping through it. `Date.now` is the only clock the
// service reads.
const realNow = Date.now;
let clockSkew = 0;
Date.now = () => realNow() + clockSkew;
const advance = (ms) => {
  clockSkew += ms;
};
// Read straight out of the module so the test cannot drift from the
// constant it is asserting about.
const WINDOW_MS = Number(
  readFileSync(join(ROOT, "src/services/isp.service.ts"), "utf8")
    .match(/LINKS_SHARE_WINDOW_MS = ([\d_]+)/)[1]
    .replace(/_/g, ""),
);

const LOC = { page: 1, pageSize: 100, locationId: "loc-1" };

/** Every case below asks for the same key, and a settled result is now
 *  retained for a while -- so each case starts from a clean slate by
 *  stepping the clock past the window rather than by reaching into the
 *  service's internals. */
function freshCase() {
  advance(WINDOW_MS + 1);
  calls.length = 0;
}

// 1. The bug itself.
freshCase();
await Promise.all([ispService.listLinks(LOC), ispService.listLinks(LOC)]);
check(
  "two concurrent identical reads issue one request",
  calls.length === 1,
  `issued ${calls.length}`,
);

// 1b. THE KEY HOLE. `GET /isp/links` declares `page: int = Query(default=1)`
//     (backend app/domains/isp/router.py), so `{ pageSize: 100 }` and
//     `{ page: 1, pageSize: 100 }` are the same request written two ways --
//     and, before the key was normalised, two different keys. That is not a
//     hypothetical pair: `customerService.getDashboard()`'s SLA leg writes
//     the first and the dashboard's two WAN cards write the second, all
//     three on the same page load, which is why `/isp/links` still went out
//     twice with this map sitting right there. A cache key that disagrees
//     with itself is worse than no cache: it costs the lookup and buys
//     nothing.
freshCase();
await Promise.all([
  ispService.listLinks({ pageSize: 100, locationId: "loc-1" }),
  ispService.listLinks({ page: 1, pageSize: 100, locationId: "loc-1" }),
]);
check(
  "an omitted page and an explicit page 1 share one request",
  calls.length === 1,
  `issued ${calls.length}`,
);
// ...and the request that goes out must be the normalised one, or the key
// describes something the wire never sent.
check(
  "the coalesced request sends the normalised page",
  calls.length === 1 && calls[0].params?.page === 1,
  `sent page=${JSON.stringify(calls[0]?.params?.page)}`,
);

// 2. Different scopes must not share.
freshCase();
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

// 3a. A sequential second read INSIDE the window is served from the
//     retained result. This is the dashboard's actual shape: the WAN cards
//     mount only once getDashboard() has resolved, so the two reads never
//     overlap and in-flight coalescing alone left `/isp/links` at two.
freshCase();
await ispService.listLinks(LOC);
advance(Math.floor(WINDOW_MS / 2));
await ispService.listLinks(LOC);
check(
  "a sequential read inside the share window reuses the result",
  calls.length === 1,
  `issued ${calls.length} (window ${WINDOW_MS}ms)`,
);

// 3b. ...and past it, goes back to the network. This is a window, not a
//     cache: nothing may be served indefinitely.
freshCase();
await ispService.listLinks(LOC);
advance(WINDOW_MS + 1);
await ispService.listLinks(LOC);
check(
  "a read past the share window refetches",
  calls.length === 2,
  `issued ${calls.length} (window ${WINDOW_MS}ms)`,
);

// 3c. THE OLD COMMENT'S FEAR, PINNED. A write that can change a link row
//     must evict, or "Check health" / a manual status flip / a failover
//     would invalidate-and-refetch straight back into the pre-write rows
//     and the card would keep calling a failed-over uplink active.
for (const [name, run] of [
  ["checkLinkHealth", () => ispService.checkLinkHealth("l1")],
  ["setManualStatus", () => ispService.setManualStatus("l1", "unhealthy")],
  ["triggerFailover", () => ispService.triggerFailover("r1")],
  ["updateLink", () => ispService.updateLink("l1", { isEnabled: false })],
  ["removeLink", () => ispService.removeLink("l1")],
  ["runSpeedTest", () => ispService.runSpeedTest("l1")],
]) {
  freshCase();
  await ispService.listLinks(LOC);
  await run();
  calls.length = 0;
  await ispService.listLinks(LOC);
  check(
    `${name} evicts the retained result`,
    calls.length === 1,
    `the read after ${name} issued ${calls.length} request(s); 0 means it was served the pre-write rows`,
  );
}

// A failure is never retained either -- a rejected read must not be able
// to turn into a retained empty answer.
freshCase();
setFailNext(true);
await ispService.listLinks(LOC).catch(() => {});
await ispService.listLinks(LOC);
check("a failed read retains nothing", calls.length === 2, `issued ${calls.length}`);

// 4. A failure must not poison the key.
freshCase();
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
