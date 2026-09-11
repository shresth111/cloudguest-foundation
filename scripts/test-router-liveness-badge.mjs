/**
 * Regression test for the Router Fleet list's Status badge.
 *
 * WHAT WENT WRONG: `master.routers.tsx` maps a derived `RouterLivenessState`
 * to a badge through `LIVENESS_BADGE`, which was typed `Record<string, ...>`
 * and was missing entries. A miss fell through to
 *
 *     LIVENESS_BADGE[live.state] ?? { label: r.status, tone: "normal" }
 *
 * which prints the raw backend enum. So an enrolled MikroTik whose heartbeat
 * has never arrived -- `routers.status = 'provisioning'`, the single most
 * common field failure on this fleet, and the exact case
 * `src/lib/location-liveness.ts` was written for -- rendered the literal
 * word `provisioning` in the Status cell an operator reads.
 *
 * `Record<string, ...>` is what let that compile. The map is now keyed by
 * `RouterLivenessState` itself, so a state added to the union without a
 * badge is a tsc error rather than a leaked enum on screen.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. EVERY MEMBER OF `RouterLivenessState` HAS A BADGE. Derived from the
 *      union in `location-liveness.ts`, not from a list hard-coded here --
 *      a hard-coded list is the same defect one level up, and would go
 *      stale the next time a state is added. This is the assertion that
 *      fails against the old implementation, for `never-checked-in`.
 *   2. NO BADGE LABEL IS A RAW BACKEND ENUM. The six values of
 *      `app/domains/router/enums.py` must never reach the screen: they are
 *      what the fallback leaked, and `pending_provisioning` is not a
 *      sentence an operator can act on.
 *   3. THE FALLBACK THAT PRINTED `r.status` IS GONE. With the map keyed by
 *      the union there is no key to miss, and keeping a fallback that
 *      prints the enum would leave the failure mode reachable.
 *   4. THE TWO NEVER-BEEN-UP STATES READ DIFFERENTLY. `setup-not-started`
 *      (script never run) and `never-checked-in` (enrolled, heartbeat never
 *      followed) send an operator to two different jobs. `setup-not-started`
 *      used to wear the words "Never checked in" while the state actually
 *      named `never-checked-in` had no entry at all.
 *   5. REAL ROUTER SHAPES LAND ON A BADGE. The states are not asserted in
 *      the abstract: representative rows are driven through the real
 *      `deriveRouterLiveness` and the resulting state looked up.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The pure
 * derivation is bundled with esbuild and executed for real; the badge map
 * is read out of the real route source.
 *
 * Run: node scripts/test-router-liveness-badge.mjs
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

const LIVENESS_SRC = readFileSync(join(ROOT, "src/lib/location-liveness.ts"), "utf8");
const ROUTE_SRC = readFileSync(join(ROOT, "src/routes/master.routers.tsx"), "utf8");

/** Comments in this file quote the very patterns asserted against below --
 * the note explaining why the `r.status` fallback was removed contains the
 * fallback. Strip comments before asserting on code, or the prose defeats
 * the test. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const ROUTE_CODE = stripComments(ROUTE_SRC);

// ---------------------------------------------------------------------------
// 1. The set of states, read off the type rather than assumed.
// ---------------------------------------------------------------------------

console.log("the liveness states, derived from RouterLivenessState");

const unionMatch = LIVENESS_SRC.match(/export type RouterLivenessState =([\s\S]*?);\n/);
check("RouterLivenessState is declared in location-liveness.ts", !!unionMatch);
if (!unionMatch) process.exit(1);

// Strip block comments first: the union's members are documented inline and
// a doc comment mentioning another state's name would otherwise be scraped
// as if it were a member.
const STATES = [...unionMatch[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/"([a-z-]+)"/g)].map(
  (m) => m[1],
);
check(
  `the union has members (${STATES.length} found: ${STATES.join(", ")})`,
  STATES.length >= 8,
  `parsed ${JSON.stringify(STATES)}`,
);

const badgeMatch = ROUTE_SRC.match(/const LIVENESS_BADGE[^=]*=\s*\{([\s\S]*?)\n\s{2}\};/);
check("LIVENESS_BADGE is declared in master.routers.tsx", !!badgeMatch);
if (!badgeMatch) process.exit(1);

const badgeBody = badgeMatch[1].replace(/\/\/[^\n]*/g, "");
const BADGE_KEYS = [...badgeBody.matchAll(/(?:^|\n)\s*"?([a-z-]+)"?\s*:\s*\{/g)].map((m) => m[1]);

// ---------------------------------------------------------------------------
// 2. Every state has a badge, and no badge is orphaned.
// ---------------------------------------------------------------------------

console.log("\nevery liveness state has a badge");

for (const state of STATES) {
  check(`${state} has a badge entry`, BADGE_KEYS.includes(state));
}
for (const key of BADGE_KEYS) {
  check(`badge key ${key} is a real liveness state`, STATES.includes(key));
}

// The map is keyed by the union, so tsc -- not this script -- is what
// catches the next missing state. Assert the typing itself, because a
// revert to Record<string, ...> would silently remove that guarantee and
// leave only this test standing between the defect and the screen.
check(
  "LIVENESS_BADGE is keyed by RouterLivenessState, not by string",
  /const LIVENESS_BADGE:\s*Record<\s*RouterLivenessState\s*,/.test(ROUTE_SRC),
  "Record<string, ...> lets a missing state compile",
);

// ---------------------------------------------------------------------------
// 3. No raw backend enum reaches a label, and the fallback is gone.
// ---------------------------------------------------------------------------

console.log("\nno raw backend status reaches the screen");

// app/domains/router/enums.py
const BACKEND_STATUSES = [
  "pending_provisioning",
  "provisioning",
  "online",
  "offline",
  "suspended",
  "decommissioned",
];

const LABELS = [...badgeBody.matchAll(/label:\s*"([^"]*)"/g)].map((m) => m[1]);
check(
  `every badge entry has a label (${LABELS.length} of ${BADGE_KEYS.length})`,
  LABELS.length === BADGE_KEYS.length,
);
for (const label of LABELS) {
  // Case-sensitive and exact, on purpose. The leak printed `r.status`
  // verbatim -- lower-case, snake_case, straight out of the column. A
  // capitalised "Suspended" is deliberate human copy that happens to share
  // a word with the enum, and failing it would be a false positive that
  // teaches the next engineer to loosen the test.
  check(
    `label ${JSON.stringify(label)} is not a raw backend enum`,
    !BACKEND_STATUSES.includes(label),
  );
  check(`label ${JSON.stringify(label)} is human copy, not snake_case`, !label.includes("_"));
}

check(
  "statusBadge no longer falls back to printing r.status",
  !/\?\?\s*\{\s*label:\s*r\.status/.test(ROUTE_CODE),
  "the ?? fallback is what leaked the enum",
);

// ---------------------------------------------------------------------------
// 4. The two never-been-up states are distinguishable.
// ---------------------------------------------------------------------------

console.log("\nthe two never-been-up states say different things");

const labelFor = (key) => {
  const m = badgeBody.match(new RegExp(`"?${key}"?\\s*:\\s*\\{[^}]*label:\\s*"([^"]*)"`));
  return m ? m[1] : null;
};
const neverChecked = labelFor("never-checked-in");
const setupNotStarted = labelFor("setup-not-started");
check("never-checked-in has a label", !!neverChecked);
check("setup-not-started has a label", !!setupNotStarted);
check(
  `their labels differ (${JSON.stringify(neverChecked)} vs ${JSON.stringify(setupNotStarted)})`,
  !!neverChecked && !!setupNotStarted && neverChecked !== setupNotStarted,
  "collapsing them costs the operator the next action",
);

// ---------------------------------------------------------------------------
// 5. Real router shapes land on a badge.
// ---------------------------------------------------------------------------

console.log("\nreal router rows resolve to a badge");

const outdir = mkdtempSync(join(tmpdir(), "router-liveness-badge-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { deriveRouterLiveness } from ${JSON.stringify(join(ROOT, "src/lib/location-liveness.ts"))};`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
});
const { deriveRouterLiveness } = await import(bundle);

const NOW = new Date("2026-09-11T11:00:00Z");
const ago = (min) => new Date(NOW.getTime() - min * 60_000).toISOString();

// The `provisioning` case is the one that shipped broken: enrolment
// exchanged a token (so last_seen_at is set) and no heartbeat ever followed.
const ROWS = [
  {
    what: "an enrolled MikroTik whose heartbeat never arrived",
    row: {
      id: "r1",
      name: "Lobby AP",
      status: "provisioning",
      last_seen_at: ago(90),
      vendor: "mikrotik",
    },
    expect: "never-checked-in",
  },
  {
    what: "a MikroTik added but never set up",
    row: {
      id: "r2",
      name: "Cafe AP",
      status: "pending_provisioning",
      last_seen_at: null,
      vendor: "mikrotik",
    },
    expect: "setup-not-started",
  },
  {
    what: "a MikroTik rewound for re-provisioning",
    row: {
      id: "r3",
      name: "Pool AP",
      status: "pending_provisioning",
      last_seen_at: ago(400),
      vendor: "mikrotik",
    },
    expect: "never-checked-in",
  },
  {
    what: "a healthy MikroTik",
    row: { id: "r4", name: "Bar AP", status: "online", last_seen_at: ago(1), vendor: "mikrotik" },
    expect: "online",
  },
  {
    what: "a MikroTik that has gone quiet",
    row: {
      id: "r5",
      name: "Roof AP",
      status: "online",
      last_seen_at: ago(120),
      vendor: "mikrotik",
    },
    expect: "went-silent",
  },
  {
    what: "a TP-Link Omada controller",
    row: {
      id: "r6",
      name: "Omada",
      status: "pending_provisioning",
      last_seen_at: null,
      vendor: "tplink_omada",
    },
    expect: "not-applicable",
  },
  {
    what: "a router reporting a status this build does not know",
    row: { id: "r7", name: "Odd", status: "quarantined", last_seen_at: null, vendor: "mikrotik" },
    expect: "unknown",
  },
];

for (const { what, row, expect } of ROWS) {
  const state = deriveRouterLiveness(row, NOW).state;
  check(`${what} derives ${expect}`, state === expect, `got ${JSON.stringify(state)}`);
  check(`${what} has a badge`, BADGE_KEYS.includes(state), `state ${state} would print r.status`);
  const label = labelFor(state);
  check(
    `${what} does not render its raw status (${row.status})`,
    !!label && label !== row.status,
    `label ${JSON.stringify(label)}`,
  );
}

console.log(
  failures === 0
    ? `\nall router liveness badge checks passed\n`
    : `\n${failures} router liveness badge check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
