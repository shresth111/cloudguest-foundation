/**
 * Regression test for per-property whitelist-only mode -- the pure decision
 * layer (`src/lib/whitelist-only.ts`) and the wiring that carries it to the
 * backend.
 *
 * WHY THESE ARE THE ASSERTIONS
 * ----------------------------
 * This switch closes a venue's WiFi to the public. Every failure below is a
 * way of taking a property offline, or of telling its owner something
 * untrue at the exact moment they decide, ordered by damage:
 *
 *   1. LETTING IT ON WITH A LIST THAT MATCHES NOBODY. Every rule the
 *      Always Allowed form wrote before 2026-09-06 stored bare national
 *      digits (`9876543210`) while guests sign in as E.164
 *      (`+919876543210`). Under the old default-allow that was invisible.
 *      Under whitelist-only the identical unchanged row refuses every
 *      guest at the property -- including the owner -- while the dashboard
 *      renders a full, correct-looking list of allowed people. This is the
 *      one that costs a venue a day of trading, so it is checked first.
 *   2. LETTING IT ON WITH AN EMPTY LIST. Nobody gets online: not the
 *      listed guests, not the owner, not whoever is diagnosing it.
 *   3. CALLING A PERMANENT RULE EXPIRED. A rule with no `expires_at` never
 *      expires. Reading `""` as expired would make a fully permanent list
 *      look empty and block a legitimate switch-on -- and, in the KPI
 *      strip, label a live allow-list "Expired".
 *   4. A SWITCH THAT SAVES NOTHING. This file's `portal.service.ts` checks
 *      are the four-places rule: wire interface, `toPortal`, `create`, and
 *      `update`'s explicit whitelist. That whitelist is where new fields go
 *      to die -- `fontFamily`, the two consent `_text` columns, and the
 *      Terms textarea in PR #226 all rendered, accepted an edit, showed a
 *      success toast, and wrote nothing.
 *   5. WRITING `""` INSTEAD OF `NULL` FOR A CLEARED MESSAGE. `""` reads as
 *      "the venue published an empty refusal message" and defeats the
 *      platform's own default copy.
 *   6. SHIPPING THE REFUSAL TEXTAREA PRE-FILLED. PR #226 found a Terms
 *      textarea seeded with a placeholder sentence that would have become
 *      every venue's published terms on their first unrelated Save.
 *   7. AIMING THE WRITE AT THE ORGANISATION DEFAULT. The backend refuses
 *      `whitelist_only_enabled=true` on a config with `location_id IS
 *      NULL` because a default is inherited by every location without an
 *      override -- one toggle would close the entire estate. The UI must
 *      resolve a location-specific config or refuse.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The pure
 * module is bundled with esbuild and executed for real; the wiring is
 * checked against the real service and component sources, because a correct
 * decision nobody sends is the same bug wearing a disguise.
 *
 * Run: node scripts/test-whitelist-only-guardrails.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "whitelist-only-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/lib/whitelist-only.ts").replace(/\\/g, "/")}";`,
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
const {
  evaluateWhitelistOnlyReadiness,
  isRuleActive,
  isMatchableIdentifier,
  whitelistOnlySummary,
  describeBlocker,
  countRecentDenials,
  WHITELIST_ONLY_DENIAL_FAILURE_REASON,
} = await import(`file://${outfile}`);

const NOW = new Date("2026-09-06T12:00:00.000Z").getTime();
const inDays = (d) => new Date(NOW + d * 86_400_000).toISOString();
const agoHours = (h) => new Date(NOW - h * 3_600_000).toISOString();

const number = (over = {}) => ({
  id: "n1",
  tab: "number",
  identifier: "+919876543210",
  name: "Ravi Sharma",
  endDate: inDays(7),
  ...over,
});
const device = (over = {}) => ({
  id: "d1",
  tab: "device",
  identifier: "AA:BB:CC:DD:EE:FF",
  name: "Office Printer",
  endDate: inDays(7),
  ...over,
});
const kinds = (r) => r.blockers.map((b) => b.kind).sort();

// ── 1. a list that matches nobody must refuse the switch ─────────────────
console.log("\nguardrail 2: a mis-keyed list is refused, by name");
{
  const legacy = number({ id: "legacy", identifier: "9876543210", name: "Ravi Sharma" });
  const r = evaluateWhitelistOnlyReadiness([legacy, number({ id: "ok" })], NOW);
  check("a pre-E.164 bare national number blocks the switch", !r.canEnable);
  eq("...as a malformed blocker", kinds(r).join(","), "malformed");
  const b = r.blockers.find((x) => x.kind === "malformed");
  eq("...naming exactly the offending row", b.entries.length, 1);
  eq("...by its stored identifier", b.entries[0].identifier, "9876543210");
  const { detail } = describeBlocker(b, "Mumbai HQ");
  check(
    "...and the copy quotes the number the owner has to go and fix",
    detail.includes("9876543210"),
  );
  check(
    "...and tells them what the right shape looks like",
    detail.includes("+919876543210") && /country code/i.test(detail),
  );
  check(
    "...and says why the list looks correct on screen",
    /look correct|looks correct/i.test(detail),
  );
}
{
  const r = evaluateWhitelistOnlyReadiness([number(), device()], NOW);
  check("a fully E.164 list is allowed on", r.canEnable);
  eq("...with nothing to report", r.blockers.length, 0);
}
{
  // A rule already inert cannot refuse anybody, so it must not veto the
  // switch either -- only *active* rules are judged.
  const stale = number({ id: "old", identifier: "9876543210", endDate: inDays(-1) });
  const r = evaluateWhitelistOnlyReadiness([stale, number({ id: "ok" })], NOW);
  check("an EXPIRED mis-keyed row does not block the switch", r.canEnable);
  eq("...and is not counted as on the list", r.activeNumbers, 1);
  eq("...but is counted as expired", r.expired, 1);
}
{
  const r = evaluateWhitelistOnlyReadiness([device({ identifier: "AABBCCDDEEFF" })], NOW);
  check("a device address without separators also blocks", !r.canEnable);
}
check("an email-keyed identifier rule is legitimate", isMatchableIdentifier("guest@hotel.com"));
check("a bare national number is not", !isMatchableIdentifier("9876543210"));
check("nor is a number with a leading zero after +", !isMatchableIdentifier("+09876543210"));
check("E.164 is", isMatchableIdentifier("+919876543210"));

// ── 2. an empty list must refuse the switch ──────────────────────────────
console.log("\nguardrail 1: an empty list is refused");
{
  const r = evaluateWhitelistOnlyReadiness([], NOW);
  check("zero entries blocks the switch", !r.canEnable);
  eq("...as an empty blocker", kinds(r).join(","), "empty");
  const { detail } = describeBlocker(r.blockers[0], "Mumbai HQ");
  check("...naming the property", detail.includes("Mumbai HQ"));
  check(
    "...and saying who gets locked out, including the owner",
    /staff/i.test(detail) && /guest/i.test(detail),
  );
}
{
  const r = evaluateWhitelistOnlyReadiness([number({ endDate: inDays(-1) })], NOW);
  check("a list of only EXPIRED entries is an empty list", !r.canEnable);
  eq("...and reads as empty, not malformed", kinds(r).join(","), "empty");
}

// ── 3. a permanent rule is live, not expired ─────────────────────────────
console.log("\na rule with no end date never expires");
check("no end date is active", isRuleActive("", NOW));
check("a future end date is active", isRuleActive(inDays(1), NOW));
check("a past end date is not", !isRuleActive(inDays(-1), NOW));
check("an unparseable end date is not", !isRuleActive("not-a-date", NOW));
{
  const r = evaluateWhitelistOnlyReadiness([number({ endDate: "" }), device({ endDate: "" })], NOW);
  check("a wholly permanent list can turn the switch on", r.canEnable);
  eq("...and counts as two live entries", r.activeTotal, 2);
}

// ── 4. the live count and the named confirmation ─────────────────────────
console.log("\nguardrail 3: the switch says what it is about to do");
{
  const entries = [
    ...Array.from({ length: 12 }, (_, i) => number({ id: `n${i}` })),
    ...Array.from({ length: 3 }, (_, i) => device({ id: `d${i}` })),
  ];
  const r = evaluateWhitelistOnlyReadiness(entries, NOW);
  const line = whitelistOnlySummary(r, "Mumbai HQ");
  check(
    "the summary counts guests and devices separately",
    line.startsWith("12 guests and 3 devices"),
  );
  check("...names the property", line.includes("Mumbai HQ"));
  check(
    "...and says everyone else is refused AT THE PORTAL, not dropped",
    /login page/i.test(line) && /refused/i.test(line),
  );
}
eq(
  "one of each is singular",
  whitelistOnlySummary({ activeNumbers: 1, activeDevices: 1 }, "Delhi Office").split(".")[0],
  "1 guest and 1 device are on the list for Delhi Office",
);
eq(
  "zero is plural",
  whitelistOnlySummary({ activeNumbers: 0, activeDevices: 0 }, "X").startsWith(
    "0 guests and 0 devices",
  ),
  true,
);

// ── 5. the refused-guest count ───────────────────────────────────────────
console.log("\nguardrail 4: refused guests in the last 24 hours");
{
  const rows = [
    { failure_reason: WHITELIST_ONLY_DENIAL_FAILURE_REASON, attempted_at: agoHours(1) },
    { failure_reason: WHITELIST_ONLY_DENIAL_FAILURE_REASON, attempted_at: agoHours(23) },
    { failure_reason: WHITELIST_ONLY_DENIAL_FAILURE_REASON, attempted_at: agoHours(25) },
    { failure_reason: "OtpExpiredError", attempted_at: agoHours(1) },
    { failure_reason: null, attempted_at: agoHours(1) },
    { failure_reason: WHITELIST_ONLY_DENIAL_FAILURE_REASON, attempted_at: null },
  ];
  eq("only whitelist refusals inside the window are counted", countRecentDenials(rows, NOW), 2);
  eq(
    "the reason string matches the backend constant byte for byte",
    WHITELIST_ONLY_DENIAL_FAILURE_REASON,
    "WhitelistOnlyAccessDeniedError",
  );
}

// ── 6. the four-places rule in portal.service.ts ─────────────────────────
console.log("\nthe four places a new config field has to reach");
const service = readFileSync(join(ROOT, "src/services/portal.service.ts"), "utf8");
const wireIface = service.slice(
  service.indexOf("interface BackendCaptivePortalConfig"),
  service.indexOf("interface BackendListResponse"),
);
const toPortalFn = service.slice(
  service.indexOf("function toPortal("),
  service.indexOf("// orgId, when given"),
);
const createFn = service.slice(
  service.indexOf("  async create("),
  service.indexOf("  async update("),
);
const updateFn = service.slice(
  service.indexOf("  async update("),
  service.indexOf("  async duplicate("),
);

for (const field of ["whitelist_only_enabled", "whitelist_only_denied_message"]) {
  check(`place 1/4 -- ${field} is on the wire interface`, wireIface.includes(field));
  check(`place 3/4 -- ${field} is in create()'s body`, createFn.includes(field));
  check(`place 4/4 -- ${field} is in update()'s whitelist`, updateFn.includes(field));
}
check("place 2/4 -- toPortal reads both back", /whitelistOnly:\s*{/.test(toPortalFn));
check(
  "...defaulting a pre-migration response to OFF, not to closed",
  /whitelist_only_enabled \?\? false/.test(toPortalFn),
);
check(
  "update() leaves the flag alone when the patch does not mention it",
  /patch\.whitelistOnly\?\.enabled !== undefined/.test(updateFn),
);
check(
  "update() leaves the message alone when the patch does not mention it",
  /patch\.whitelistOnly\?\.deniedMessage !== undefined/.test(updateFn),
);
check(
  "a cleared refusal message writes NULL, not an empty string",
  /deniedMessage\.trim\(\) \|\| null/.test(updateFn) &&
    /deniedMessage\?\.trim\(\) \|\| null/.test(createFn),
);
check(
  "create() never brings a new config into the world already closed",
  /whitelist_only_enabled: input\.whitelistOnly\?\.enabled \?\? false/.test(createFn),
);
check("the service can resolve a LOCATION-specific config", /async forLocation\(/.test(service));
check(
  "...and returns null rather than falling back to the org default",
  /c\.location_id === locationId/.test(service) &&
    /if \(own\.length === 0\) return null;/.test(service),
);

// ── 7. the screen itself ─────────────────────────────────────────────────
console.log("\nthe switch on the Always Allowed screen");
const screen = readFileSync(join(ROOT, "src/components/features/WhiteList.tsx"), "utf8");
check("the switch is rendered", /data-testid="whitelist-only-switch"/.test(screen));
check(
  "it is disabled while the list cannot support it",
  /disabled=\{wlSaving \|\| wlLoading \|\| \(!wlEnabled && !canEnable\)\}/.test(screen),
);
check(
  "the live count is on screen beside it",
  /whitelistOnlySummary\(readiness, wlLocationName\)/.test(screen),
);
check(
  "blockers are rendered, not just computed",
  /describeBlocker\(blocker, wlLocationName\)/.test(screen),
);
check(
  "turning it ON goes through a confirmation",
  /setConfirmOpen\(true\)/.test(screen) && /AlertDialog/.test(screen),
);
check(
  "...confirmed against the property BY NAME, not a generic yes/no",
  /confirmText\.trim\(\)\.toLowerCase\(\) === wlLocationName\.trim\(\)\.toLowerCase\(\)/.test(
    screen,
  ),
);
check(
  "...and the action stays disabled until the name matches",
  /disabled=\{!confirmMatches\}/.test(screen),
);
check(
  "turning it OFF needs no confirmation -- it only ever widens access",
  /if \(!next\) \{\s*void persistWhitelistOnly\(false, wlMessage\);/.test(screen),
);
check(
  "the refused-guest count is shown once it is on",
  /data-testid="whitelist-only-denials"/.test(screen),
);
check("the refusal message textarea exists", /data-testid="whitelist-only-message"/.test(screen));
check(
  "...and ships EMPTY -- an example that can be saved by accident is PR #226's bug",
  /useState\(""\);?\s*\n\s*const \[wlMessageDirty/.test(screen) ||
    /const \[wlMessage, setWlMessage\] = useState\(""\)/.test(screen),
);
check(
  "...with the example in the placeholder instead",
  /placeholder="e\.g\. Ask the front desk/.test(screen),
);
check(
  "the write is aimed at a location-specific config, never the org default",
  /portalService\.forLocation\(orgId, wlLocationId\)/.test(screen),
);
check(
  "...and a server refusal is surfaced in the server's own words",
  /err instanceof Error \? err\.message : ""/.test(screen),
);
check(
  "org-wide rules (location_id IS NULL) count toward a property's list",
  /!e\.locationId \|\| e\.locationId === wlLocationId/.test(screen),
);
check(
  "the KPI strip and the switch share one definition of 'live'",
  /isRuleActive\(end, Date\.now\(\)\)/.test(screen),
);

console.log(
  failures === 0
    ? `\nall whitelist-only guardrail checks passed\n`
    : `\n${failures} whitelist-only guardrail check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
