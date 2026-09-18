/**
 * The data limit, executed for real -- not read for shapes.
 *
 * `scripts/test-session-rules-enforcement.mjs` is the source-structural half:
 * it proves the value leaves Guest WiFi Limits aimed at the FUP policy rather
 * than at the bandwidth policy nobody reads. It cannot prove the number that
 * arrives there is the number the venue typed, and that is where this control
 * can still be wrong in a way nothing shouts about.
 *
 * WHY A SECOND FILE, AND WHY IT RUNS THE REAL CODE
 * ------------------------------------------------
 * Standing rule in this repository: new wiring gets a test that constructs it
 * the way the app does. It exists because of two shipped incidents -- a
 * factory nobody instantiated in a test that 500'd guest login at every venue,
 * and a request shape nobody asserted on that made a feature unreachable for
 * months while its own test read the same wrong place and passed.
 *
 * So `fupPolicyRules` is bundled with esbuild and CALLED with exactly the
 * object `LocationPolicies.handleSave` builds out of the form's three pieces
 * of state -- `{ quota: parseFloat(dlQuota), unit: dlUnit, resets: dlResets }`
 * -- rather than with a tidy literal invented here.
 *
 * THE FOUR WAYS THIS GOES WRONG, IN ORDER OF WHAT THEY COST
 * ---------------------------------------------------------
 *   1. A CAP OF ZERO. `is_fup_usage_exceeded` treats a limit of 0 as already
 *      met, so a quota that rounds or parses down to 0 is not "no limit", it
 *      is "no internet for anybody at this venue", refused at the very next
 *      login. This is the one failure that takes a venue off the air.
 *   2. A CAP THAT WAS NEVER WRITTEN. The venue types 2 GB, sees it saved, and
 *      the guests are uncapped -- the original bug, in a new spelling.
 *   3. THE SAVE THAT ERASES THE OTHER SETTING. A policy version is a whole
 *      rules object. Publishing the daily time limit without the data keys
 *      leaves them absent from the version that is now current, which the
 *      backend reads as "no data cap". Changing one setting must not silently
 *      delete the other, in either direction.
 *   4. A CAP THAT CANNOT BE CLEARED. Writing "no cap" by omitting the fields
 *      leaves the previous version's answer standing as the venue's current
 *      one, so a limit becomes impossible to remove -- the mirror image of
 *      never writing it at all.
 *
 * Run: node scripts/test-data-limit-rules.mjs
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
const eq = (name, actual, expected) =>
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "data-limit-rules-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/services/policy-engine.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  // policy-engine.ts imports the axios client for its CRUD calls. The four
  // pure helpers under test touch none of it, and stubbing the module is
  // cheaper and more honest than standing up a fake HTTP layer for functions
  // that never make a request. `@/` is the repo's own alias; esbuild does not
  // read tsconfig paths through a synthetic entry point, so it is mapped here.
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({
          path: "stub-api",
          namespace: "stub",
        }));
        b.onResolve({ filter: /^@\// }, (args) => ({
          path: join(ROOT, "src", args.path.slice(2)),
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents:
            "export const api = {}; export const crossOrganizationHeaders = () => undefined;",
          loader: "js",
        }));
      },
    },
  ],
});

const { fupPolicyRules, fupDataLimitFromRules, dataLimitToMb, FUP_DATA_RESET_PERIODS } =
  await import(`file://${outfile}`);

// Exactly how LocationPolicies.handleSave builds the argument: three pieces of
// form state, the quota still a string off a number input.
const fromForm = (dlQuota, dlUnit, dlResets, dailyLimitMinutes = null) =>
  fupPolicyRules({
    dailyTimeLimitMinutes: dailyLimitMinutes,
    dataLimit: { quota: parseFloat(dlQuota), unit: dlUnit, resets: dlResets },
  });

// ---------------------------------------------------------------------------
// 1. The number the venue typed is the number the backend gets.
// ---------------------------------------------------------------------------

console.log("\nthe venue's number survives the trip");

eq("2 GB daily -> 2048 MB on the daily field", fromForm("2", "GB", "Daily"), {
  daily_time_limit_minutes: null,
  daily_data_limit_mb: 2048,
  weekly_data_limit_mb: null,
  monthly_data_limit_mb: null,
});
eq("500 MB weekly lands on the weekly field", fromForm("500", "MB", "Weekly"), {
  daily_time_limit_minutes: null,
  daily_data_limit_mb: null,
  weekly_data_limit_mb: 500,
  monthly_data_limit_mb: null,
});
eq("10 GB monthly lands on the monthly field", fromForm("10", "GB", "Monthly"), {
  daily_time_limit_minutes: null,
  daily_data_limit_mb: null,
  weekly_data_limit_mb: null,
  monthly_data_limit_mb: 10240,
});
eq("a fractional GB becomes a whole MB", dataLimitToMb(1.5, "GB"), 1536);

// ---------------------------------------------------------------------------
// 2. No accidental zero, ever.
//
// The form refuses a non-positive quota before it gets here (see `validate()`),
// but rounding is the second route to the same place and it has no form
// validation in front of it: half a megabyte is a cap somebody typed, and
// flooring it to 0 would read to the backend as "already exceeded".
// ---------------------------------------------------------------------------

console.log("\na cap never quietly becomes zero");

check("0.5 MB rounds up, not down to zero", dataLimitToMb(0.5, "MB") === 1);
check("0.4 MB still does not reach zero", dataLimitToMb(0.4, "MB") === 0);
check(
  "a sub-megabyte GB value stays positive",
  dataLimitToMb(0.001, "GB") === 1,
  `got ${dataLimitToMb(0.001, "GB")}`,
);

// The second of those is the honest limit of this rounding, not a bug hidden:
// 0.4 MB genuinely rounds to 0, which is why `validate()` refuses an empty or
// non-positive quota on the form and why this file says so out loud rather
// than asserting a comfortable number.

// ---------------------------------------------------------------------------
// 3. One version carries both settings, so neither save erases the other.
// ---------------------------------------------------------------------------

console.log("\nthe time limit and the data limit travel together");

eq(
  "a data cap saved alongside a 4-hour daily limit keeps both",
  fromForm("2", "GB", "Daily", 240),
  {
    daily_time_limit_minutes: 240,
    daily_data_limit_mb: 2048,
    weekly_data_limit_mb: null,
    monthly_data_limit_mb: null,
  },
);
eq(
  "a daily time limit saved with no data cap still states every data field",
  fupPolicyRules({ dailyTimeLimitMinutes: 120, dataLimit: null }),
  {
    daily_time_limit_minutes: 120,
    daily_data_limit_mb: null,
    weekly_data_limit_mb: null,
    monthly_data_limit_mb: null,
  },
);

// ---------------------------------------------------------------------------
// 4. A cap can be removed, and removal is written down.
// ---------------------------------------------------------------------------

console.log("\nclearing a cap says there is no cap");

const cleared = fupPolicyRules({ dailyTimeLimitMinutes: null, dataLimit: null });
for (const key of [
  "daily_time_limit_minutes",
  "daily_data_limit_mb",
  "weekly_data_limit_mb",
  "monthly_data_limit_mb",
]) {
  check(
    `${key} is present and null, not absent`,
    key in cleared && cleared[key] === null,
    `got ${JSON.stringify(cleared[key])}`,
  );
}

// ---------------------------------------------------------------------------
// 5. Reload shows what was saved.
//
// The reverse trip. A venue that types "2 GB / Daily" and comes back must see
// "2 GB / Daily" -- not "2048 MB", and not a blank that invites them to set it
// a second time.
// ---------------------------------------------------------------------------

console.log("\nthe form reads back what the venue typed");

for (const [quota, unit, resets] of [
  [2, "GB", "Daily"],
  [500, "MB", "Weekly"],
  [10, "GB", "Monthly"],
  [1, "MB", "Daily"],
]) {
  eq(
    `${quota} ${unit} / ${resets} round-trips`,
    fupDataLimitFromRules(fromForm(String(quota), unit, resets)),
    {
      quota,
      unit,
      resets,
    },
  );
}
eq("a policy with no data cap reads back as no cap", fupDataLimitFromRules(cleared), null);
eq(
  "an FUP policy written before this field existed reads back as no cap",
  fupDataLimitFromRules({}),
  null,
);
eq("an undefined rules payload reads back as no cap", fupDataLimitFromRules(undefined), null);

// A policy carrying more than one period -- writable by hand through the API,
// and not expressible on this one-cap form. It must show a REAL cap rather
// than nothing, because "no limit" on a screen whose venue is capped is the
// same untruth this whole change removes, pointing the other way.
eq(
  "a hand-written multi-period policy shows the strictest-period cap it has",
  fupDataLimitFromRules({ weekly_data_limit_mb: 5120, monthly_data_limit_mb: 20480 }),
  { quota: 5, unit: "GB", resets: "Weekly" },
);

// ---------------------------------------------------------------------------
// 6. The period list is the one the backend meters.
// ---------------------------------------------------------------------------

console.log("\nonly periods GuestQuotaUsage actually resets are offered");

eq("three periods, in order", [...FUP_DATA_RESET_PERIODS], ["Daily", "Weekly", "Monthly"]);
check(
  'no "Per session" period exists to be chosen',
  !FUP_DATA_RESET_PERIODS.includes("Per session"),
  "GuestQuotaUsage is keyed on QuotaPeriodType, which has no per-session member",
);

// ---------------------------------------------------------------------------

if (failures > 0) {
  console.error(`\nFAIL: ${failures} data-limit rule check(s) failed.`);
  process.exit(1);
}
console.log("\nPASS: all data-limit rule checks passed.");
