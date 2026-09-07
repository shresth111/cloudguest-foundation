/**
 * Regression test for the Network Hardware list's liveness cell.
 *
 * WHAT WENT WRONG: the cell rendered the status word and then a bare
 * duration -- `"Up"` followed by `formatSince(statusChangedAt)` -- so a row
 * read "Up · 4m" and every reader understood "up for four minutes".
 *
 * It never meant that. On a real account `statusChangedAt` carried the
 * backend's `last_seen_at`: when a router's sync sweep last observed that
 * MAC. Measured on the live router HJP0ATMRJ6X on 2026-09-07:
 *
 *     device /system/resource uptime : 7h 28m 51s
 *     backend last_seen_at           : 2 minutes ago
 *     dashboard displayed            : "4 mins up"
 *
 * And the gap is not cosmetic. That router rebooted three times in the two
 * hours before that reading (03:50, 04:18, 05:43 UTC). It resumed
 * heartbeating after each one, so time-since-heartbeat looked healthy
 * throughout and hid all three reboots. Uptime is the only one of the two
 * numbers that can show a reboot at all.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. A HEARTBEAT AGE IS NEVER LABELLED AS UPTIME. This is the assertion
 *      that fails against the old implementation. The number that reaches
 *      the screen must be named for the measurement it actually is.
 *   2. AN ABSENT UPTIME IS NEVER BACKFILLED. Most hardware on this screen
 *      is third-party APs, printers and cameras, for which no uptime
 *      source exists anywhere in the platform. `null` must stay `null` --
 *      substituting the heartbeat age is the original bug returning.
 *   3. A STALE READING SAYS SO. The health sweep runs every 600s; a
 *      seven-hour uptime last read forty minutes ago is a claim about the
 *      past and must be quoted with its age.
 *   4. NO COMPONENT PAIRS A BARE DURATION WITH "Up" ANY MORE. The
 *      derivation being right is worthless if a call site reintroduces
 *      the concatenation.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The pure
 * derivation is bundled with esbuild and executed for real; the wiring is
 * checked against the real component sources.
 *
 * Run: node scripts/test-device-liveness.mjs
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
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "device-liveness-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { describeLiveness, formatDuration, formatAge, uptimeCoverage, UPTIME_STALE_AFTER_MS }
     from ${JSON.stringify(join(ROOT, "src/lib/device-liveness.ts"))};`,
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
const { describeLiveness, formatDuration, uptimeCoverage, UPTIME_STALE_AFTER_MS } = await import(
  bundle
);

const NOW = Date.parse("2026-09-07T11:00:00Z");
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

// ---------------------------------------------------------------------------
// 1. The exact reading that produced the bug report.
// ---------------------------------------------------------------------------

console.log("\nthe HJP0ATMRJ6X reading renders as uptime, not as a heartbeat age");

const realRouter = describeLiveness(
  {
    status: "up",
    lastSeenAt: ago(2 * MIN),
    uptimeSeconds: 26931, // 7h 28m 51s, straight off /system/resource
    uptimeRecordedAt: ago(3 * MIN),
  },
  NOW,
);
eq("state is the status word alone", realRouter.state, "Up");
eq("the duration shown is the real uptime", realRouter.detail, "up 7h 28m");
eq("and it is identified as an uptime", realRouter.detailKind, "uptime");
check(
  "the 2-minute heartbeat age is nowhere in the output",
  !JSON.stringify(realRouter).includes("2m"),
  JSON.stringify(realRouter),
);

// ---------------------------------------------------------------------------
// 2. No uptime source but a known connect time: say "connected since".
//    Only when the backend has neither uptime NOR a connect time do we
//    fall back to the heartbeat age, labelled as one.
// ---------------------------------------------------------------------------

console.log("\na device with no boot-uptime but a real connect time reports connected-since");

const ap = describeLiveness(
  {
    status: "up",
    lastSeenAt: ago(4 * MIN),
    connectedAt: ago(3 * 60 * MIN),
    uptimeSeconds: null,
    uptimeRecordedAt: null,
  },
  NOW,
);
eq("state is still Up", ap.state, "Up");
eq("the duration is a connected-since age", ap.detail, "connected 3h 0m");
eq("and identified as such", ap.detailKind, "connected");
check(
  "the 4-minute heartbeat age is not what is shown",
  !JSON.stringify(ap).includes("4m"),
  JSON.stringify(ap),
);

// ---------------------------------------------------------------------------
// 2b. No uptime AND no connect time: the heartbeat age, by its right name.
// ---------------------------------------------------------------------------

console.log("\na device with neither source reports the heartbeat, labelled as one");

const apNoConnect = describeLiveness(
  {
    status: "up",
    lastSeenAt: ago(4 * MIN),
    connectedAt: null,
    uptimeSeconds: null,
    uptimeRecordedAt: null,
  },
  NOW,
);
eq("state is still Up", apNoConnect.state, "Up");
eq("the duration is named as a last-seen age", apNoConnect.detail, "last seen 4m ago");
eq("and identified as such", apNoConnect.detailKind, "lastSeen");
check(
  'the word "up" is never attached to that duration',
  !/\bup 4m\b/.test(`${apNoConnect.state} ${apNoConnect.detail}`),
  `${apNoConnect.state} · ${apNoConnect.detail}`,
);

// This is the whole defect, stated once: the two devices above were seen
// 2 and 4 minutes ago respectively, and must NOT render the same shape.
check(
  "a measured device and an unmeasured one do not render alike",
  realRouter.detailKind !== apNoConnect.detailKind,
);

// ---------------------------------------------------------------------------
// 3. Absence is never filled in.
// ---------------------------------------------------------------------------

console.log("\nan absent uptime is never backfilled from the heartbeat");

for (const seconds of [null, undefined]) {
  const d = describeLiveness(
    {
      status: "up",
      lastSeenAt: ago(9 * MIN),
      connectedAt: null,
      uptimeSeconds: seconds ?? null,
      uptimeRecordedAt: null,
    },
    NOW,
  );
  eq(`uptimeSeconds=${seconds} yields no uptime claim`, d.detailKind, "lastSeen");
}

const neverSeen = describeLiveness(
  {
    status: "unknown",
    lastSeenAt: null,
    connectedAt: null,
    uptimeSeconds: null,
    uptimeRecordedAt: null,
  },
  NOW,
);
eq("a never-observed device says so", neverSeen.state, "Never observed");
eq("and offers no duration at all", neverSeen.detail, null);

// A device the network has never seen cannot meaningfully have an uptime.
const contradiction = describeLiveness(
  {
    status: "unknown",
    lastSeenAt: null,
    connectedAt: null,
    uptimeSeconds: 5000,
    uptimeRecordedAt: ago(MIN),
  },
  NOW,
);
eq("an unknown device never claims uptime either", contradiction.detail, null);

// ---------------------------------------------------------------------------
// 4. A down device's heartbeat age IS its downtime -- that one is honest.
// ---------------------------------------------------------------------------

console.log("\na down device reports how long it has been unreachable");

const down = describeLiveness(
  {
    status: "down",
    lastSeenAt: ago(6 * 60 * MIN),
    connectedAt: ago(20 * 60 * MIN),
    uptimeSeconds: null,
    uptimeRecordedAt: null,
  },
  NOW,
);
eq("state is Down", down.state, "Down");
eq("with the age of the last contact", down.detail, "last seen 6h 0m ago");
check(
  "a down device never claims connected-since from a stale connect time",
  down.detailKind === "lastSeen",
);

// ---------------------------------------------------------------------------
// 5. A stale reading is quoted with its age.
// ---------------------------------------------------------------------------

console.log("\na stale uptime reading is not presented as current");

const fresh = describeLiveness(
  { status: "up", lastSeenAt: ago(MIN), uptimeSeconds: 26931, uptimeRecordedAt: ago(5 * MIN) },
  NOW,
);
check("a reading inside one sweep window is quoted plainly", fresh.stale === false);
eq("with no 'as of'", fresh.detail, "up 7h 28m");

const stale = describeLiveness(
  { status: "up", lastSeenAt: ago(MIN), uptimeSeconds: 26931, uptimeRecordedAt: ago(41 * MIN) },
  NOW,
);
check("a reading older than two sweep windows is flagged", stale.stale === true);
eq("and carries its own age", stale.detail, "up 7h 28m as of 41m ago");
check("the stale threshold sits beyond the 600s sweep interval", UPTIME_STALE_AFTER_MS > 600_000);

// ---------------------------------------------------------------------------
// 6. Duration formatting.
// ---------------------------------------------------------------------------

console.log("\ndurations format at a sensible resolution");

eq("seconds", formatDuration(45), "45s");
eq("minutes", formatDuration(12 * 60), "12m");
eq("hours and minutes", formatDuration(26931), "7h 28m");
eq("days and hours", formatDuration(3 * 86400 + 4 * 3600), "3d 4h");
eq("a negative duration never renders as one", formatDuration(-10), "0s");

// ---------------------------------------------------------------------------
// 7. Coverage, so a mostly-blank column can explain itself.
// ---------------------------------------------------------------------------

console.log("\nuptime coverage is countable");

const coverage = uptimeCoverage([
  { status: "up", lastSeenAt: ago(MIN), uptimeSeconds: 26931, uptimeRecordedAt: ago(MIN) },
  { status: "up", lastSeenAt: ago(MIN), uptimeSeconds: null, uptimeRecordedAt: null },
  { status: "down", lastSeenAt: ago(MIN), uptimeSeconds: null, uptimeRecordedAt: null },
]);
eq("measured count", coverage.measured, 1);
eq("total count", coverage.total, 3);

// ---------------------------------------------------------------------------
// 8. No call site reintroduces the concatenation.
// ---------------------------------------------------------------------------

console.log("\nno component pairs a bare duration with a status word");

const CALL_SITES = [
  "src/routes/switch-location.tsx",
  "src/components/customer/BasicFeatureViews.tsx",
  "src/components/customer/CustomerDashboardPage.tsx",
];
for (const rel of CALL_SITES) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  check(`${rel} no longer imports formatSince`, !/\bformatSince\b/.test(src));
  check(`${rel} does not read statusChangedAt`, !/statusChangedAt/.test(src));
}

for (const rel of CALL_SITES.slice(0, 2)) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  check(`${rel} renders the liveness cell through describeLiveness`, /describeLiveness/.test(src));
}

const store = readFileSync(join(ROOT, "src/stores/deviceStore.ts"), "utf8");
check("the demo store no longer exports formatSince", !/export function formatSince/.test(store));
check("the demo store's field is named lastSeenAt", /lastSeenAt/.test(store));
check("nothing is called statusChangedAt any more", !/statusChangedAt/.test(store));

const service = readFileSync(join(ROOT, "src/services/deviceHardware.service.ts"), "utf8");
check("the real service maps uptime_seconds", /uptime_seconds/.test(service));
check("the real service maps uptime_recorded_at", /uptime_recorded_at/.test(service));
check("the real service exposes lastSeenAt", /lastSeenAt: r\.last_seen_at/.test(service));

console.log(
  failures === 0
    ? `\nall device liveness checks passed\n`
    : `\n${failures} device liveness check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
