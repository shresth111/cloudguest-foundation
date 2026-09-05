/**
 * Regression test for the two customer-dashboard KPI figures that were
 * shipping wrong numbers to venue owners.
 *
 * FAILURE MODE 1 -- "avg session" was megabytes wearing a time unit.
 * `getDashboard()` computed it as
 * `sum(bytes_downloaded) / sessions.length / 1e6` and
 * `CustomerDashboardPage` rendered it as `${avgSession} min`. Nothing
 * about it was a duration. It was also unfalsifiable by eye: at a venue
 * where guests stream it read plausibly high, where they check email it
 * read plausibly low, so it survived on the most-viewed screen in the
 * product. Both timestamps needed to do it properly (`started_at`,
 * `ended_at`) were already on the row and already used by the Users
 * table's own duration column.
 *
 * FAILURE MODE 2 -- SLA uptime rounded *up* to a perfect 100%.
 * Both render sites did `${value.toFixed(1)}%`, which rounds to nearest,
 * so everything from 99.95 up printed as "100.0%". The demo fixture is
 * 99.97, which is why the product video shows a flat "SLA UPTIME 100.0%"
 * -- and why a customer who had just sat through an outage could open the
 * dashboard and be told the month was perfect. Overstating uptime is the
 * one rounding direction that costs trust.
 *
 * The load-bearing assertions, in rough order of how badly a regression
 * would hurt:
 *
 *   1. UPTIME MUST NEVER ROUND UP TO 100. Only a genuine 100 may print as
 *      "100%". 99.999 must not. This is the assertion the original bug
 *      would have failed.
 *   2. AVG SESSION MUST BE A DURATION. A fixed set of sessions whose mean
 *      length is known must produce that number, and changing only the
 *      byte counts must not move it at all -- the direct inverse of the
 *      old implementation.
 *   3. A STILL-RUNNING SESSION COUNTS. Skipping rows with no `ended_at`
 *      would bias the mean toward guests who already left.
 *   4. BAD ROWS ARE SKIPPED, NOT COUNTED AS ZERO. One unparseable or
 *      inverted row must not drag the average down.
 *
 * Also asserts the source-level wiring, since a correct helper called by
 * nobody is the same bug wearing a disguise.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The
 * pure derivations are bundled with esbuild and executed for real; the
 * wiring is checked against the real component and service sources.
 *
 * Run: node scripts/test-customer-kpis.mjs
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

// ---------------------------------------------------------------------------
// Bundle the real derivations.
// ---------------------------------------------------------------------------

const outdir = mkdtempSync(join(tmpdir(), "customer-kpis-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { avgSessionMinutes } from "${join(ROOT, "src/lib/session-metrics.ts").replace(/\\/g, "/")}";
   export { formatUptimePercent } from "${join(ROOT, "src/lib/uptime-format.ts").replace(/\\/g, "/")}";`,
);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});

const { avgSessionMinutes, formatUptimePercent } = await import(`file://${outfile}`);

const NOW = new Date("2026-09-05T12:00:00.000Z").getTime();
/** ISO timestamp `minutes` before NOW. */
const ago = (minutes) => new Date(NOW - minutes * 60_000).toISOString();

// ---------------------------------------------------------------------------
// 1. Uptime must never round up to 100.
// ---------------------------------------------------------------------------

console.log("\nuptime never rounds up to 100");

// The exact value behind the product video's "SLA UPTIME 100.0%".
eq("99.97 does not print as 100", formatUptimePercent(99.97), "99.97%");
eq("99.95 does not print as 100", formatUptimePercent(99.95), "99.95%");
eq("99.999 does not print as 100", formatUptimePercent(99.999), "99.99%");
eq("99.9999 does not print as 100", formatUptimePercent(99.9999), "99.99%");
check(
  "nothing below 100 ever renders as 100%",
  [99.9, 99.94, 99.95, 99.97, 99.99, 99.999, 99.99999].every(
    (v) => formatUptimePercent(v) !== "100%" && formatUptimePercent(v) !== "100.0%",
  ),
);
eq("a genuine 100 still prints as 100%", formatUptimePercent(100), "100%");

console.log("\nuptime keeps enough precision to show a dip");
check(
  "99.97 and 99.99 are distinguishable",
  formatUptimePercent(99.97) !== formatUptimePercent(99.99),
);
eq("a bad week reads plainly at one decimal", formatUptimePercent(97.42), "97.4%");
eq("uptime floors rather than rounds up", formatUptimePercent(97.49), "97.4%");

console.log("\nuptime handles junk without inventing a number");
eq("NaN renders as a dash", formatUptimePercent(Number.NaN), "--");
eq("Infinity renders as a dash", formatUptimePercent(Number.POSITIVE_INFINITY), "--");
eq("over-100 clamps rather than printing 100.3%", formatUptimePercent(100.3), "100%");
eq("negative clamps to zero", formatUptimePercent(-4), "0.0%");

// ---------------------------------------------------------------------------
// 2. Avg session must be a duration.
// ---------------------------------------------------------------------------

console.log("\navg session is a duration, not a data volume");

const THIRTY_AND_TEN = [
  { started_at: ago(30), ended_at: ago(0) }, // 30 min
  { started_at: ago(20), ended_at: ago(10) }, // 10 min
];
eq("mean of 30 and 10 minutes is 20", avgSessionMinutes(THIRTY_AND_TEN, NOW), 20);

// The direct inverse of the old implementation: bytes must not move it.
const WITH_BYTES = THIRTY_AND_TEN.map((s, i) => ({
  ...s,
  bytes_downloaded: [999_000_000, 1][i],
}));
eq(
  "byte counts do not affect the figure",
  avgSessionMinutes(WITH_BYTES, NOW),
  avgSessionMinutes(THIRTY_AND_TEN, NOW),
);
check(
  "a heavy-download short session does not read as a long one",
  avgSessionMinutes(
    [{ started_at: ago(2), ended_at: ago(0), bytes_downloaded: 4_000_000_000 }],
    NOW,
  ) === 2,
);

console.log("\navg session counts sessions that are still running");
eq(
  "a live session is measured to now",
  avgSessionMinutes([{ started_at: ago(45), ended_at: null }], NOW),
  45,
);
eq(
  "live and ended sessions average together",
  avgSessionMinutes(
    [
      { started_at: ago(60), ended_at: null },
      { started_at: ago(40), ended_at: ago(20) },
    ],
    NOW,
  ),
  40,
);

console.log("\navg session skips bad rows rather than counting them as zero");
eq(
  "a row with no start is skipped, not counted",
  avgSessionMinutes([{ started_at: null }, { started_at: ago(10), ended_at: ago(0) }], NOW),
  10,
);
eq(
  "an unparseable timestamp is skipped",
  avgSessionMinutes([{ started_at: "not a date" }, { started_at: ago(10), ended_at: ago(0) }], NOW),
  10,
);
eq(
  "an inverted range is skipped",
  avgSessionMinutes(
    [
      { started_at: ago(0), ended_at: ago(30) },
      { started_at: ago(10), ended_at: ago(0) },
    ],
    NOW,
  ),
  10,
);
eq("no countable rows yields 0", avgSessionMinutes([], NOW), 0);
eq("only-bad rows yield 0", avgSessionMinutes([{ started_at: null }], NOW), 0);

// ---------------------------------------------------------------------------
// 3. Wiring -- a correct helper nobody calls is the same bug.
// ---------------------------------------------------------------------------

console.log("\nthe real screens use these helpers");

const service = readFileSync(join(ROOT, "src/services/customer.service.ts"), "utf8");
const dashboard = readFileSync(
  join(ROOT, "src/components/customer/CustomerDashboardPage.tsx"),
  "utf8",
);
const featurePage = readFileSync(
  join(ROOT, "src/components/customer/CustomerFeaturePage.tsx"),
  "utf8",
);

check("customer.service.ts imports avgSessionMinutes", service.includes("@/lib/session-metrics"));
check(
  "customer.service.ts computes avgSession from it",
  /avgSession:\s*avgSessionMinutes\(/.test(service),
);
check(
  "customer.service.ts no longer derives avgSession from bytes_downloaded",
  !/avgSession:[\s\S]{0,220}bytes_downloaded/.test(service),
);

for (const [label, src] of [
  ["CustomerDashboardPage", dashboard],
  ["CustomerFeaturePage", featurePage],
]) {
  check(`${label} imports formatUptimePercent`, src.includes("@/lib/uptime-format"));
  check(`${label} formats slaUptime through it`, src.includes("formatUptimePercent("));
  check(
    `${label} no longer prints slaUptime with toFixed(1)`,
    !/slaUptime\.toFixed\(1\)/.test(src),
  );
}

console.log(
  failures === 0
    ? `\nall customer KPI checks passed\n`
    : `\n${failures} customer KPI check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
