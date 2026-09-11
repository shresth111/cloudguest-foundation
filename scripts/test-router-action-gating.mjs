/**
 * Regression test for which lifecycle actions the router surfaces offer.
 *
 * WHAT WENT WRONG: `RouterTable.tsx` (the list every operator uses) decided
 * Suspend vs Reinstate from
 *
 *     const disabled = status === "suspended" || status === "offline" ||
 *                      status === "decommissioned";
 *     disabled ? <Reinstate/> : <Suspend/>
 *
 * which answers "does this router look inactive?" rather than "does the
 * backend accept this edge?". `routers.$routerId.tsx` (the detail page) had
 * already been gated properly against the real transition graph. The two
 * disagreed, and the list was the wrong one.
 *
 * Measured against `app/domains/router/enums.py`'s ROUTER_STATUS_TRANSITIONS,
 * the list was wrong four ways, three of them worse than the reported one:
 *
 *   - `pending_provisioning` / `provisioning` were offered SUSPEND, which
 *     has no edge at all from either. (The reported defect.)
 *   - `decommissioned` was offered REINSTATE. Decommissioned is terminal:
 *     the graph allows nothing out of it.
 *   - `offline` was offered REINSTATE; the legal edge from offline is
 *     SUSPEND, which is what the detail page offers.
 *   - Reinstate posted `status: "online"`. `suspended -> online` is not an
 *     edge, and `online` is a claim only a device heartbeat may make.
 *
 * So three of the four would have posted a transition the API rejects --
 * and because `updateStatus` sends one call for every selected id, a single
 * ineligible row in a bulk selection failed the whole batch.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. THE RULE MATCHES THE BACKEND GRAPH, for all six statuses and all
 *      three actions. Executed against the real module, not re-described.
 *   2. REINSTATE LANDS ON `offline`, NEVER `online`.
 *   3. BOTH SURFACES READ THE SAME MODULE. The defect was two copies of one
 *      rule; a test that only checks the rule would not have caught it.
 *      Neither file may re-derive the rule inline.
 *   4. A ROUTER THAT CAN ACCEPT NEITHER IS TOLD WHY. Every such status has
 *      a reason string, and it is never rendered next to a live button.
 *   5. THE REASON IS NOT ATTACHED TO A `disabled` CONTROL, which takes no
 *      pointer events -- so a `title` on it could never fire (#258).
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The pure rule is
 * bundled with esbuild and executed for real; the wiring is checked against
 * the real component sources.
 *
 * Run: node scripts/test-router-action-gating.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
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

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

const outdir = mkdtempSync(join(tmpdir(), "router-action-gating-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export * from ${JSON.stringify(join(ROOT, "src/lib/router-actions.ts"))};`);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
});
const {
  canSuspendRouter,
  canReinstateRouter,
  canDecommissionRouter,
  routerToggleUnavailableReason,
  REINSTATE_TARGET_STATUS,
  SUSPEND_TARGET_STATUS,
} = await import(bundle);

// ---------------------------------------------------------------------------
// 1. The rule, against the backend's own graph.
// ---------------------------------------------------------------------------

console.log("the transition rule matches ROUTER_STATUS_TRANSITIONS");

// app/domains/router/enums.py, read 2026-09-11. `suspend` is `-> suspended`,
// `reinstate` is the edge out of `suspended`, `decommission` is
// `-> decommissioned`.
const EXPECTED = {
  pending_provisioning: { suspend: false, reinstate: false, decommission: true },
  provisioning: { suspend: false, reinstate: false, decommission: true },
  online: { suspend: true, reinstate: false, decommission: true },
  offline: { suspend: true, reinstate: false, decommission: true },
  suspended: { suspend: false, reinstate: true, decommission: true },
  decommissioned: { suspend: false, reinstate: false, decommission: false },
};

for (const [status, want] of Object.entries(EXPECTED)) {
  check(
    `${status}: suspend ${want.suspend}`,
    canSuspendRouter(status) === want.suspend,
    `got ${canSuspendRouter(status)}`,
  );
  check(
    `${status}: reinstate ${want.reinstate}`,
    canReinstateRouter(status) === want.reinstate,
    `got ${canReinstateRouter(status)}`,
  );
  check(
    `${status}: decommission ${want.decommission}`,
    canDecommissionRouter(status) === want.decommission,
    `got ${canDecommissionRouter(status)}`,
  );
}

// The specific row that was reported.
check(
  "a pending_provisioning router is NOT offered suspend",
  canSuspendRouter("pending_provisioning") === false,
);
// The three that were not reported but were equally wrong.
check("a decommissioned router is NOT offered reinstate", !canReinstateRouter("decommissioned"));
check(
  "a decommissioned router is NOT offered decommission",
  !canDecommissionRouter("decommissioned"),
);
check(
  "an offline router is offered suspend, not reinstate",
  canSuspendRouter("offline") && !canReinstateRouter("offline"),
);

// ---------------------------------------------------------------------------
// 2. Reinstate lands on offline.
// ---------------------------------------------------------------------------

console.log("\nreinstating never asserts online");

check(
  `REINSTATE_TARGET_STATUS is "offline" (got ${JSON.stringify(REINSTATE_TARGET_STATUS)})`,
  REINSTATE_TARGET_STATUS === "offline",
  "suspended -> online is not an edge, and only a heartbeat may assert online",
);
check(`SUSPEND_TARGET_STATUS is "suspended"`, SUSPEND_TARGET_STATUS === "suspended");

// ---------------------------------------------------------------------------
// 3. Both surfaces read the same module.
// ---------------------------------------------------------------------------

console.log("\nboth surfaces read one rule, not two copies");

const TABLE = readFileSync(join(ROOT, "src/components/routers/RouterTable.tsx"), "utf8");
const DETAIL = readFileSync(join(ROOT, "src/routes/_authenticated/routers.$routerId.tsx"), "utf8");

for (const [label, src] of [
  ["RouterTable.tsx", TABLE],
  ["routers.$routerId.tsx", DETAIL],
]) {
  check(`${label} imports the shared rule`, /from "@\/lib\/router-actions"/.test(src));
  check(`${label} uses canSuspendRouter`, /canSuspendRouter\(/.test(src));
  check(`${label} uses canReinstateRouter`, /canReinstateRouter\(/.test(src));
}

const TABLE_CODE = stripComments(TABLE);

// The exact shape of the old rule. This is the assertion that fails against
// the old implementation.
check(
  "RouterTable no longer decides from `status === suspended || offline || decommissioned`",
  !/status\s*===\s*"suspended"\s*\|\|[\s\S]{0,120}?status\s*===\s*"decommissioned"/.test(
    TABLE_CODE,
  ),
  "that is the rule that offered Suspend on pending_provisioning",
);
check(
  'RouterTable no longer posts a literal "online" status',
  !/status:\s*"online"/.test(TABLE_CODE) && !/\?\s*"online"\s*:/.test(TABLE_CODE),
  "reinstate must land on offline",
);
check(
  "the detail page no longer restates the rule inline",
  !/status\s*===\s*"online"\s*\|\|\s*\w+\.status\s*===\s*"offline"/.test(stripComments(DETAIL)),
);

// ---------------------------------------------------------------------------
// 4. A router that can accept neither is told why.
// ---------------------------------------------------------------------------

console.log("\na row that can accept neither says why");

for (const status of Object.keys(EXPECTED)) {
  const reason = routerToggleUnavailableReason(status);
  const togglable = EXPECTED[status].suspend || EXPECTED[status].reinstate;
  if (togglable) {
    check(`${status}: no reason shown beside a live button`, reason === null, `got ${reason}`);
  } else {
    check(`${status}: has a reason`, typeof reason === "string" && reason.length > 20);
    check(
      `${status}: the reason names a next step, not an API rule`,
      typeof reason === "string" && !/transition|edge|enum|api\b/i.test(reason),
      `got ${JSON.stringify(reason)}`,
    );
  }
}

check("RouterTable renders the reason", /routerToggleUnavailableReason\(/.test(TABLE_CODE));

// ---------------------------------------------------------------------------
// 5. The reason is not hung on a control that cannot fire it.
// ---------------------------------------------------------------------------

console.log("\nthe explanation is reachable (a disabled control takes no pointer events)");

// #258's finding: `disabled` kills pointer events, so `title`/tooltip never
// fires. The reason must therefore be plain text, and the bulk buttons must
// use aria-disabled (which keeps events) rather than the `disabled` prop.
check(
  "the row reason is plain text, not a disabled DropdownMenuItem",
  !/<DropdownMenuItem[^>]*\bdisabled\b/.test(TABLE_CODE),
  "a disabled menu item cannot show a title or tooltip",
);
check("bulk buttons use aria-disabled, not the disabled prop", /aria-disabled=\{/.test(TABLE_CODE));
const bulkBar = TABLE_CODE.slice(
  TABLE_CODE.indexOf("selectedCount > 0"),
  TABLE_CODE.indexOf("selectedCount > 0") + 3000,
);
check(
  "no bulk action button carries the inert `disabled` prop",
  !/<Button[^>]*\sdisabled=\{(?!.*isFetching)/.test(bulkBar),
);

console.log(
  failures === 0
    ? `\nall router action gating checks passed\n`
    : `\n${failures} router action gating check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
