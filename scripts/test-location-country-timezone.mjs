/**
 * Provisioning a venue must not silently stamp it with the wrong timezone.
 *
 * THE DEFECT (Master console, observed 2026-09-12)
 * -----------------------------------------------
 * "Smart location provisioning" step 2 offered Country as raw ISO codes --
 * `US, GB, IN, SG, AE, DE, AU, CA`, US first, no names -- and choosing `IN`
 * left Timezone on `UTC`. The standalone `/master/locations` Create Location
 * dialog was worse in the other direction: it ignored the country entirely and
 * hardcoded `Asia/Kolkata` for every venue it created.
 *
 * WHY THIS IS THE EXPENSIVE KIND OF WRONG. Timezone is not decoration on a
 * location row; it is the frame every timestamp that venue ever produces is
 * read in -- session start and end, daily and monthly report boundaries,
 * business-hours rules, voucher validity windows, scheduled campaign sends.
 * A venue provisioned in India with `UTC` is five and a half hours out on all
 * of them, and NOTHING DOWNSTREAM ERRORS: every number stays plausible and is
 * wrong, until somebody eventually notices that "yesterday's" report covers
 * half of the day before. There is no exception, no red row, no alert. The
 * only defence is not creating the row wrong in the first place.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. EVERY COUNTRY HAS A DEFAULT ZONE, AND NONE OF THEM IS UTC. UTC is the
 *      value the defect produced; it must never be what a country resolves
 *      to, because a venue is somewhere.
 *   2. AN UNKNOWN COUNTRY RETURNS null, NOT A FALLBACK. A caller that gets
 *      null must leave the operator's choice alone. Falling back to UTC here
 *      would reintroduce the exact defect behind a helper that looks correct.
 *   3. THE COUNTRY PICKER SHOWS NAMES. `IN` and `ID` are four rows apart in an
 *      alphabet of two-letter codes.
 *   4. THE ZONE FOLLOWS THE COUNTRY, BUT ONLY UNTIL THE OPERATOR CHOOSES ONE.
 *      Several of these countries span multiple zones, so an operator
 *      provisioning a venue in Perth must be able to say so without the next
 *      Country keystroke undoing it -- a bug that would bite only the person
 *      who knew better.
 *   5. THE STANDALONE DIALOG DERIVES ITS ZONE rather than hardcoding one.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The pure lookup is
 * bundled with esbuild and executed; the wiring is checked against the real
 * component sources.
 *
 * Run: node scripts/test-location-country-timezone.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "country-tz-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { COUNTRY_OPTIONS, TIMEZONE_OPTIONS, countryLabel, defaultTimezoneForCountry }
     from "${join(ROOT, "src/lib/countries.ts").replace(/\\/g, "/")}";`,
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
const { COUNTRY_OPTIONS, TIMEZONE_OPTIONS, countryLabel, defaultTimezoneForCountry } = await import(
  `file://${outfile}`
);

/* ── 1. Every country resolves, and never to UTC ───────────────────────── */

console.log("\n1. Every country has a real default zone");

check("the list is not empty", COUNTRY_OPTIONS.length > 0);
for (const c of COUNTRY_OPTIONS) {
  check(`${c.code} has a name`, typeof c.name === "string" && c.name.length > 1);
  check(
    `${c.code} resolves to a real IANA zone`,
    typeof c.defaultTimezone === "string" && c.defaultTimezone.includes("/"),
    c.defaultTimezone,
  );
  check(`${c.code} does not default to UTC`, c.defaultTimezone !== "UTC");
  // The zone has to be one the runtime actually accepts, or the row is
  // unusable wherever it is finally formatted.
  let valid = true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: c.defaultTimezone });
  } catch {
    valid = false;
  }
  check(`${c.code}'s zone is accepted by Intl`, valid, c.defaultTimezone);
}

// The specific case from the report.
check(
  "India resolves to Asia/Kolkata, not UTC",
  defaultTimezoneForCountry("IN") === "Asia/Kolkata",
  `${defaultTimezoneForCountry("IN")}`,
);

/* ── 2. Unknown countries return null, never a fallback ────────────────── */

console.log("\n2. An unknown country leaves the choice alone");

for (const bad of [null, undefined, "", "ZZ", "XX", "in"]) {
  check(
    `${JSON.stringify(bad)} returns null rather than a guess`,
    defaultTimezoneForCountry(bad) === null,
    `${defaultTimezoneForCountry(bad)}`,
  );
}

/* ── 3. The picker shows names ─────────────────────────────────────────── */

console.log("\n3. The picker is readable without knowing ISO codes");

check("India is labelled by name", countryLabel("IN") === "India (IN)", countryLabel("IN"));
check(
  "the code is kept alongside the name",
  COUNTRY_OPTIONS.every((c) => countryLabel(c.code).includes(c.code)),
);
check(
  "an unknown code degrades to itself rather than to a wrong name",
  countryLabel("ZZ") === "ZZ",
);
check("India is first, where an accidental pick lands", COUNTRY_OPTIONS[0].code === "IN");
check(
  "every country's zone is offered in the timezone picker",
  COUNTRY_OPTIONS.every((c) => TIMEZONE_OPTIONS.includes(c.defaultTimezone)),
);
check("UTC is still offerable deliberately", TIMEZONE_OPTIONS.includes("UTC"));
check(
  "the timezone list has no duplicates",
  new Set(TIMEZONE_OPTIONS).size === TIMEZONE_OPTIONS.length,
);

/* ── 4 & 5. Wiring ─────────────────────────────────────────────────────── */

console.log("\n4. The wizard follows the country, and stops when told to");

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const wizard = read("src/components/locations/PlatformLocationWizard.tsx");

check(
  "the wizard no longer carries its own ISO list",
  !/const COUNTRIES = \[/.test(wizard) && !/const TIMEZONES = \[/.test(wizard),
);
check("it renders country NAMES", /\{c\.name\} \(\{c\.code\}\)/.test(wizard));
check(
  "choosing a country sets the timezone",
  /const onCountryChange[\s\S]{0,400}defaultTimezoneForCountry\(code\)/.test(wizard),
);
check(
  "...but only while the operator has not chosen one",
  /!timezoneTouched \? \{ timezone: tz \}/.test(wizard),
);
check("choosing a timezone marks it as touched", /setTimezoneTouched\(true\)/.test(wizard));
check(
  "and the screen says which of the two is happening",
  /Follows the country until you change it/.test(wizard) &&
    /changing the country will not override it/.test(wizard),
);

console.log("\n5. The standalone Create Location dialog derives its zone");

const locations = read("src/routes/master.locations.tsx");
check(
  "it no longer hardcodes a timezone on create",
  !/timezone: "Asia\/Kolkata",\n\s*\}\);/.test(locations),
);
check(
  "it derives the zone from the chosen country",
  /timezone: defaultTimezoneForCountry\(form\.country\)/.test(locations),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
