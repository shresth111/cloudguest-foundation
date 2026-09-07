/**
 * Regression test for the Reports screen's "Team" filter.
 *
 * WHAT WENT WRONG: `UserReports.tsx` held
 * `const TEAMS = ["Sales Team", "Executive VIP", "Contractors",
 * "Maintenance Staff"]` and rendered it into the Team dropdown for every
 * account, demo or real. A real venue that has never created a guest team
 * was shown four teams that exist nowhere -- not in its database, not in
 * any seed. They were invented by the frontend.
 *
 * That distinction matters for the fix: this was NOT a report faithfully
 * rendering demo fixture rows (which is a data problem, solved by looking
 * at the right org), and NOT a seeded default (which would be solved by
 * SQL). No query returned these names, so nothing but deleting the literal
 * could remove them.
 *
 * `GET /guest-teams` is real and `guestService.listTeams()` already calls
 * it for the Guests > Teams screen; the dropdown was simply never wired.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. A REAL ACCOUNT NEVER SEES FIXTURES. This is the assertion that
 *      fails against the old implementation, which had no demo branch at
 *      all.
 *   2. "NONE" IS A STATE, NOT A GAP. A venue with no teams must resolve to
 *      an explicit empty state so the UI can say so deliberately, rather
 *      than an empty dropdown that reads as a loading bug.
 *   3. UNKNOWN IS NOT ZERO. A failed lookup must not be reported as "this
 *      venue has no teams" -- we do not know that.
 *
 * Run: node scripts/test-report-team-options.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "team-options-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { resolveTeamOptions, DEMO_TEAMS, NO_TEAMS_NOTICE, TEAMS_LOOKUP_FAILED_NOTICE }
     from "${join(ROOT, "src/lib/report-team-options.ts").replace(/\\/g, "/")}";`,
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
const { resolveTeamOptions, DEMO_TEAMS, NO_TEAMS_NOTICE, TEAMS_LOOKUP_FAILED_NOTICE } =
  await import(`file://${outfile}`);

// ---------------------------------------------------------------------------
// 1. A real account never sees fixtures.
// ---------------------------------------------------------------------------

console.log("\na real account is never offered invented teams");

const realEmpty = resolveTeamOptions({ demo: false, teams: [] });
eq("a real venue with no teams resolves to empty", realEmpty.kind, "empty");
check(
  "the empty state carries no options at all",
  realEmpty.options === undefined,
  JSON.stringify(realEmpty),
);

// The exact defect, stated directly: none of the four invented names may
// reach a real account through any resolution path.
for (const input of [
  { demo: false, teams: [] },
  { demo: false, teams: null },
  { demo: false, teams: [], failed: true },
  { demo: false, teams: ["Ground Floor Staff"] },
]) {
  const state = resolveTeamOptions(input);
  const offered = state.options ?? [];
  check(
    `no fixture team leaks for ${JSON.stringify(input)}`,
    !offered.some((t) => DEMO_TEAMS.includes(t)),
    JSON.stringify(offered),
  );
}

const realTeams = resolveTeamOptions({
  demo: false,
  teams: ["Ground Floor Staff", "Housekeeping"],
});
eq("a real venue with teams is ready", realTeams.kind, "ready");
eq(
  "a real venue is offered exactly what the API returned",
  realTeams.options.join("|"),
  "Ground Floor Staff|Housekeeping",
);

// ---------------------------------------------------------------------------
// 2. "None" is a state, and loading is distinct from it.
// ---------------------------------------------------------------------------

console.log("\nnot-yet-loaded is distinguishable from genuinely none");

eq(
  "an unfetched list is loading",
  resolveTeamOptions({ demo: false, teams: null }).kind,
  "loading",
);
check(
  "the empty-state copy reads as deliberate, not broken",
  /no guest teams/i.test(NO_TEAMS_NOTICE) && !/error|failed|couldn't/i.test(NO_TEAMS_NOTICE),
  NO_TEAMS_NOTICE,
);
check(
  "the empty-state copy says where a team would be created",
  /Guests/.test(NO_TEAMS_NOTICE) && /Teams/.test(NO_TEAMS_NOTICE),
  NO_TEAMS_NOTICE,
);

// ---------------------------------------------------------------------------
// 3. A failed lookup is not "none".
// ---------------------------------------------------------------------------

console.log("\na failed lookup never claims the venue has no teams");

eq(
  "failure resolves to error, not empty",
  resolveTeamOptions({ demo: false, teams: null, failed: true }).kind,
  "error",
);
eq(
  "failure outranks an empty array, since the array may be a stale default",
  resolveTeamOptions({ demo: false, teams: [], failed: true }).kind,
  "error",
);
check(
  "the error copy does not assert a count",
  !/no guest teams/i.test(TEAMS_LOOKUP_FAILED_NOTICE),
  TEAMS_LOOKUP_FAILED_NOTICE,
);

// ---------------------------------------------------------------------------
// 4. Demo still looks like a product.
// ---------------------------------------------------------------------------

console.log("\ndemo accounts keep their fixtures");

const demoState = resolveTeamOptions({ demo: true, teams: null });
eq("demo is ready even before any fetch", demoState.kind, "ready");
eq("demo offers the fixture list", demoState.options.join("|"), DEMO_TEAMS.join("|"));
eq(
  "demo ignores a real API result entirely",
  resolveTeamOptions({ demo: true, teams: ["Ground Floor Staff"] }).options.join("|"),
  DEMO_TEAMS.join("|"),
);

// ---------------------------------------------------------------------------
// 5. The component no longer holds its own list.
// ---------------------------------------------------------------------------

console.log("\nthe Reports screen has no hardcoded team list of its own");

const reports = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");
check("UserReports.tsx declares no TEAMS constant", !/^const TEAMS\s*=/m.test(reports));
for (const invented of DEMO_TEAMS) {
  check(`"${invented}" is not written into the component`, !reports.includes(`"${invented}"`));
}
check(
  "the Team dropdown is driven by resolveTeamOptions",
  /resolveTeamOptions/.test(reports) && /teamOptions\.kind/.test(reports),
);
check("the real team list comes from the guest-teams API", /guestService\.listTeams/.test(reports));

console.log(
  failures === 0
    ? `\nall report team option checks passed\n`
    : `\n${failures} report team option check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
