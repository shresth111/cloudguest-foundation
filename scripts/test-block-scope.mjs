/**
 * Regression test for WHERE a block written on Blocked Guests lands
 * (`src/lib/block-scope.ts`) and for the screen that writes it
 * (`src/components/features/BlockUsers.tsx`, `src/routes/agent.index.tsx`).
 *
 * WHY THESE ARE THE ASSERTIONS
 * ----------------------------
 * The screen had a control labelled "Applies to" listing every location in
 * the account, and it set nothing. `handleBlock` sends the `locationId`
 * PROP; the select's state (`bu`) reached neither the request nor -- outside
 * demo -- the table filter beside it. An owner could pick "Delhi Office",
 * press Block, and write a rule for whichever venue the dashboard was on.
 *
 * The half that does damage is the missing-prop case. `createAccessRule`
 * builds a plain object and axios JSON.stringifies it, so an undefined
 * `locationId` is dropped from the body; the backend's
 * `GuestAccessRuleCreate.location_id` defaults to None; and NULL is not
 * "unknown" at enforcement time -- `list_matching_guest_rules` ORs
 * `location_id IS NULL` into every lookup, so the rule fires at EVERY
 * location in the organization. The agent/staff-preview dashboard mounted
 * Access Rules with no `locationId` while the active location sat in scope,
 * so an agent blocking one guest at one venue banned them account-wide with
 * nothing on screen saying so.
 *
 * So, in order of how much damage the failure does:
 *
 *   1. AN ORG-WIDE BLOCK IS NAMED AS ONE. `blockScope` must return
 *      `organization` for a missing location and say so in words, and the
 *      confirm sentence must not round it down to a single venue.
 *   2. THE SCOPE COMES FROM THE PROP, NEVER THE PICKER. The demo unit is
 *      structurally unreachable outside demo.
 *   3. THE AGENT ROUTE PASSES A LOCATION. The one mount path that produced
 *      the NULL is checked at its source.
 *   4. THE SCREEN DOES NOT RE-IMPLEMENT ANY OF IT, and no longer offers a
 *      real customer a select that sets nothing.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-connection-verdicts.mjs` for the same note). The pure module
 * is bundled with esbuild and executed for real; the wiring is checked
 * against the real component source.
 *
 * Run: node scripts/test-block-scope.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "block-scope-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export * from ${JSON.stringify(join(ROOT, "src/lib/block-scope.ts"))};\n`);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const { blockScope, blockScopeConfirmation } = await import(bundle);

// A real account's locations, as `useCustomerLocations` would give them.
const NAMES = { "loc-1": "Mumbai HQ", "loc-2": "Delhi Office" };
const nameForLocation = (id) => NAMES[id] ?? "";

console.log("\na block at one venue is scoped to that venue");
{
  const s = blockScope({ demo: false, locationId: "loc-1", nameForLocation });
  eq("kind is location", s.kind, "location");
  eq("label is the venue's name", s.label, "Mumbai HQ");
  eq("orgWide is false", s.orgWide, false);
  eq(
    "the confirm sentence names the venue",
    blockScopeConfirmation(s),
    "This applies at Mumbai HQ.",
  );
}

console.log("\nTHE DEFECT: no location means every location, and it says so");
// This is the case that banned a guest account-wide from a screen whose
// control named one venue. Every assertion here is about it being SAID.
for (const missing of [undefined, null, ""]) {
  const s = blockScope({ demo: false, locationId: missing, nameForLocation });
  eq(`locationId ${JSON.stringify(missing)} -> organization`, s.kind, "organization");
  eq(`locationId ${JSON.stringify(missing)} -> orgWide`, s.orgWide, true);
  check(
    `locationId ${JSON.stringify(missing)} label says every location`,
    /every location/i.test(s.label),
    JSON.stringify(s.label),
  );
  const sentence = blockScopeConfirmation(s);
  check(
    `locationId ${JSON.stringify(missing)} confirm sentence says every location`,
    /every location in this account/i.test(sentence),
    JSON.stringify(sentence),
  );
  // The specific misreading that made this invisible: an org-wide block
  // described as though it were scoped to the venue on screen.
  check(
    `locationId ${JSON.stringify(missing)} confirm sentence does not name a single venue`,
    !/^This applies at (?!every)/.test(sentence),
    JSON.stringify(sentence),
  );
}

console.log("\nthe picker cannot substitute for the prop");
// `demoUnit` is the "Applies to" value. Outside demo it must not reach the
// label at all -- passing it alongside a real location, and alongside no
// location, must change nothing.
{
  const withUnit = blockScope({
    demo: false,
    locationId: "loc-1",
    nameForLocation,
    demoUnit: "Delhi Office",
  });
  eq("a demoUnit does not override a real location", withUnit.label, "Mumbai HQ");

  const noLoc = blockScope({
    demo: false,
    locationId: undefined,
    nameForLocation,
    demoUnit: "Delhi Office",
  });
  eq("a demoUnit does not stand in for a missing location", noLoc.kind, "organization");
  check(
    "a demoUnit never appears in a real label",
    !/Delhi Office/.test(noLoc.label),
    JSON.stringify(noLoc.label),
  );
}

console.log("\na venue whose name has not arrived is still a venue");
{
  const s = blockScope({ demo: false, locationId: "loc-unknown", nameForLocation });
  eq("kind is still location", s.kind, "location");
  eq("orgWide is still false", s.orgWide, false);
  eq("the label is vague but true", s.label, "this location");
  check(
    "a raw id is never printed at a venue admin",
    !/loc-unknown/.test(s.label) && !/loc-unknown/.test(blockScopeConfirmation(s)),
    JSON.stringify(s.label),
  );
  check("the label is never empty", s.label.length > 0);
}

console.log("\nthe demo account is untouched");
{
  const s = blockScope({
    demo: true,
    locationId: undefined,
    nameForLocation,
    demoUnit: "Bangalore DC",
  });
  eq("kind is demo", s.kind, "demo");
  eq("the label is the picker's value", s.label, "Bangalore DC");
  // The demo writes nothing, so it is never the alarming state.
  eq("demo is never org-wide", s.orgWide, false);
}

console.log("\nthe screen uses the shared ladder and offers no control that sets nothing");
const src = readFileSync(join(ROOT, "src/components/features/BlockUsers.tsx"), "utf8");
check(
  "BlockUsers imports blockScope from @/lib/block-scope",
  /blockScope/.test(src) && /@\/lib\/block-scope/.test(src),
);
check(
  "BlockUsers does not define a second scope ladder",
  !/const\s+orgWide\s*=\s*!/.test(src),
  "a local copy would drift from the one this test executes",
);
check(
  "BlockUsers still sends the locationId prop, not the picker",
  /locationId,/.test(src) && !/locationId:\s*bu\b/.test(src),
);
// The select may exist ONLY inside the demo branch. A real customer gets a
// statement, because a control that sets nothing is the defect itself.
{
  const selectAt = src.indexOf('id="bu-select"');
  const demoBranchAt = src.indexOf("{demo ? (");
  check("the bu-select still exists for the demo", selectAt !== -1);
  check(
    "the bu-select is inside the demo branch",
    selectAt !== -1 && demoBranchAt !== -1 && selectAt > demoBranchAt,
    `select at ${selectAt}, demo branch at ${demoBranchAt}`,
  );
}
check(
  "the scope is rendered where the picker was",
  /data-testid="block-scope"/.test(src) && /data-scope=/.test(src),
);
check(
  "the confirm dialog states the scope",
  /blockScopeConfirmation\(scope\)/.test(src),
  "the last moment before the write no longer says where it lands",
);
check(
  "the blocked list does not call an account-wide list one location's",
  /blocked anywhere in this account/.test(src),
  "the table subtitle still claims a location it is not filtered to",
);

console.log("\nthe agent dashboard passes a location to the features it mounts");
const agentSrc = readFileSync(join(ROOT, "src/routes/agent.index.tsx"), "utf8");
check(
  "agent.index.tsx passes locationId into renderFeature",
  /renderFeature\(\s*active\s*,\s*\{[^}]*locationId:\s*activeLocation\?\.id/s.test(agentSrc),
  "the staff-preview dashboard is writing rules with no location again",
);
check(
  "agent.index.tsx still passes the data-masking flag",
  /masked:\s*agent\.dataMasking/.test(agentSrc),
  "threading a location must not drop PII masking",
);

console.log(failures === 0 ? "\nall block-scope checks passed" : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
