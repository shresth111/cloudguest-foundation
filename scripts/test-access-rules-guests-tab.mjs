/**
 * Guests & devices lives under Access Rules, right after Access Tiers
 * (owner instruction 2026-10-04, `src/lib/access-rules-tabs.ts`).
 *
 * Executes, rather than greps:
 *   1. the tab table and its permission narrowing (same fail-open rule the
 *      tab had under Block Websites: offered on `guest_access.read`);
 *   2. the `/blocking` route's beforeLoad: `?tab=guests` redirects to
 *      `/policies?tab=guests`, `?tab=websites` and no tab do not redirect,
 *      and the session/venue guards still run first;
 *   3. the `/policies` route accepts `?tab=guests` and drops junk.
 * The rendered tabs per vendor (MikroTik / Omada / Aruba) are asserted in a
 * real browser by scripts/test-controller-venue-nav.mjs.
 *
 * Run: node scripts/test-access-rules-guests-tab.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "access-rules-guests-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

writeFileSync(
  join(work, "router-stub.js"),
  `export function redirect(o) { return { __redirect: true, ...o }; }
   export function createFileRoute(path) { return (options) => ({ path, options }); }`,
);
writeFileSync(
  join(work, "guards-stub.js"),
  `export function requireCustomerSession() { (globalThis.__calls ||= []).push("session"); }`,
);
writeFileSync(
  join(work, "venue-stub.js"),
  `export function requireActiveLocationId() { (globalThis.__calls ||= []).push("venue"); }`,
);
writeFileSync(join(work, "page-stub.js"), `export function CustomerFeaturePage() { return null; }`);
writeFileSync(
  join(work, "entry.js"),
  `export * as tabs from "${p("src/lib/access-rules-tabs.ts")}";
   export { Route as blockingRoute } from "${p("src/routes/blocking.tsx")}";
   export { Route as policiesRoute } from "${p("src/routes/policies.tsx")}";
   export { NAV_PERMISSION_KEYS } from "${p("src/lib/customerNavPermissions.ts")}";`,
);

const outfile = join(work, "bundle.cjs");
await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  outfile,
  logLevel: "error",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: {
    "@tanstack/react-router": join(work, "router-stub.js"),
    "@/lib/authGuards": join(work, "guards-stub.js"),
    "@/lib/customerLocationGuard": join(work, "venue-stub.js"),
    "@/components/customer/CustomerFeaturePage": join(work, "page-stub.js"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});
const m = createRequire(import.meta.url)(outfile);
const T = m.tabs;

console.log("\nAccess Rules tabs");
check(
  "tabs-are-limits-tiers-then-guests",
  T.ACCESS_RULES_TAB_IDS.join(",") === "location,group,guests",
);
check(
  "fail-open-on-a-non-answer",
  [null, undefined, []].every((x) => T.accessRulesTabsFor(x).length === 3),
);
check(
  "guest_access.read-offers-guests-and-devices",
  T.accessRulesTabsFor(["policy.read", "guest_access.read"]).includes("guests"),
);
check(
  "without-guest_access.read-the-guests-tab-is-not-offered",
  T.accessRulesTabsFor(["policy.read"]).join(",") === "location,group",
);
check(
  "guest_access.read-alone-opens-straight-on-guests",
  T.initialAccessRulesTab(undefined, T.accessRulesTabsFor(["guest_access.read"])) === "guests",
);
check(
  "deep-link-to-guests-wins",
  T.initialAccessRulesTab("guests", T.ACCESS_RULES_TAB_IDS) === "guests",
);
check(
  "deep-link-to-a-tab-not-offered-falls-back",
  T.initialAccessRulesTab("guests", T.accessRulesTabsFor(["policy.read"])) === "location",
);
check(
  "unknown-tab-falls-back",
  T.initialAccessRulesTab("block", T.ACCESS_RULES_TAB_IDS) === "location",
);

console.log("\nnav permission keys moved with the tab");
check(
  "policies-row-offered-on-policy.read-or-guest_access.read",
  m.NAV_PERMISSION_KEYS.policies.join(",") === "policy.read,guest_access.read",
);
check(
  "blocking-row-is-content_filtering-only",
  m.NAV_PERMISSION_KEYS.blocking.join(",") === "content_filtering.read",
);

console.log("\n/blocking?tab=guests redirects");
const before = m.blockingRoute.options.beforeLoad;
const run = (search) => {
  globalThis.__calls = [];
  try {
    before({ context: { auth: {} }, location: { pathname: "/blocking" }, search });
    return null;
  } catch (e) {
    return e;
  }
};
const r = run({ tab: "guests" });
check(
  "old-guests-url-redirects-to-access-rules-guests",
  r && r.__redirect && r.to === "/policies" && r.search?.tab === "guests",
  JSON.stringify(r),
);
check("guards-run-before-the-redirect", globalThis.__calls.join(",") === "session,venue");
check("websites-tab-does-not-redirect", run({ tab: "websites" }) === null);
check("no-tab-does-not-redirect", run({}) === null);
const bSearch = m.blockingRoute.options.validateSearch;
check(
  "blocking-still-accepts-guests-so-it-can-redirect",
  bSearch.parse({ tab: "guests" }).tab === "guests",
);

console.log("\n/policies?tab=");
const pSearch = m.policiesRoute.options.validateSearch;
check("policies-accepts-tab-guests", pSearch.parse({ tab: "guests" }).tab === "guests");
check("policies-drops-junk-tab", pSearch.parse({ tab: "nope" }).tab === undefined);

if (failures) {
  console.log(`\n${failures} access-rules guests tab check(s) FAILED`);
  process.exit(1);
}
console.log("\naccess-rules guests tab: all checks passed");
