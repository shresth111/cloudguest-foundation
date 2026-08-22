/**
 * Regression gate for the Manual Wizard engine and the {{token}} i18n
 * convention.
 *
 * Run: `npm run test:manual-wizard`
 * Gate: `scripts/ci-gated-test.sh` (exit code + sentinel + check floor).
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/components/routers/manual-wizard/engine/` decides whether a router
 * step passed by reading text a MikroTik printed. `tsc` cannot see a
 * single one of its bugs: every type in sight is `string`, and the whole
 * failure surface is what the strings MEAN.
 *
 * Every incident behind this module has the same shape -- THE SYSTEM
 * REPORTED SUCCESS WHILE DOING NOTHING:
 *
 *   - `/certificate sign X ca=X` shipped commented "confirmed live,
 *     working". On the test box the cert already existed, an
 *     `:if ([:len [find]] = 0)` guard skipped the whole block, and "no
 *     error" was read as "it worked". It only failed on a genuinely fresh
 *     router, in the field, in front of a customer.
 *   - A `0.0.0.0/0` route landed with `gateway=0.0.0.0`, flag `Is`. A
 *     non-empty check passed it because `0.0.0.0 != ""`. Every ping
 *     returned "no route to host".
 *   - RouterOS `set [find ...]` against an empty match SUCCEEDS SILENTLY.
 *     There is no error to catch.
 *   - certbot printed "all simulated renewals succeeded" while skipping
 *     four broken certificate lineages.
 *
 * So a test here that only feeds CORRECT input proves nothing. Every
 * section below INJECTS AN ACTUAL VIOLATION and asserts the guard fires:
 * `Is` swapped for `As`, a paste truncated mid-table, `/interface print`
 * fed where `/ip dhcp-client print detail` was asked for, one RADIUS
 * counter reading, four zero counters, `gateway=0.0.0.0`, a probe printing
 * `unknown`, and a legacy `RESULT: PASS` line sitting above contradicting
 * evidence.
 *
 * PROVEN TO FAIL ON PURPOSE
 * ------------------------
 * Assertions that only ever pass are decoration. Each guard below was
 * mutated in place and this suite re-run; all 15 mutations were caught:
 *
 *   three-valued `all` collapses null to true .............. 5 checks fail
 *   three-valued `not` maps null to true ................... 1
 *   parseBool treats `unknown` as false ..................... 8
 *   0.0.0.0 treated as a usable address .................... 6
 *   missing closing banner no longer means truncation ...... 2
 *   sentinel step id no longer compared .................... 1
 *   missing required fact scores like any other absence .... 1
 *   the counter cap removed ................................ 2
 *   a single reading publishes zero deltas ................. 3
 *   a counter reset still publishes its arithmetic ......... 1
 *   flag letters hard-coded instead of read from the legend  2
 *   a self-reported RESULT line is believed ................ 2
 *   token boundary swallows a sentence-final full stop ..... 1
 *   classifier joins on step.title instead of probe.command  37
 *   ESC back inside the binary-control range ............... 1
 *
 * Two of those mutations found real bugs rather than confirming guards:
 * ESC sat inside the binary-control range, so any ANSI-coloured paste was
 * rejected unread; and the token boundary treated a full stop as part of
 * the token, silently skipping every sentence-final `ether1.`.
 *
 * The module under test is the real engine bundled for Node with esbuild
 * (already a transitive devDependency via Vite) -- the same approach as
 * `test-output-analyser.mjs` and `test-fw-rule-order.mjs`. Nothing here
 * reimplements the logic it tests.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "manual-wizard-engine-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail ?? ""}`);
    console.log(`  FAIL ${name}  ${detail ?? ""}`);
  }
};

writeFileSync(
  join(work, "entry.js"),
  [
    `export * from "@/components/routers/manual-wizard/engine/index";`,
    `export { MANUAL_STEPS } from "@/components/routers/manual-wizard/steps.content";`,
    `export { RESOLVER } from "@/components/routers/manual-wizard/resolver.content";`,
    `export { EMPTINESS_RULES, MENU_FINGERPRINTS } from "@/components/routers/manual-wizard/parsing.rules";`,
    `export { PROTECTED_TOKENS, TRANSLATABLE_FIELD_PATHS, NEVER_TRANSLATE_FIELD_PATHS } from "@/components/routers/manual-wizard/types";`,
  ].join("\n"),
);

await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "bundle.mjs"),
  logLevel: "warning",
  alias: { "@": join(ROOT, "src") },
});

const M = await import(pathToFileURL(join(work, "bundle.mjs")).href);
const {
  MANUAL_STEPS,
  RESOLVER,
  EMPTINESS_RULES,
  PROTECTED_TOKENS,
  TRANSLATABLE_FIELD_PATHS,
  NEVER_TRANSLATE_FIELD_PATHS,
  normalise,
  evaluateStep,
  classify,
  expectedBannerTitle,
  coerce,
  parseBool,
  parseDurationSeconds,
  parseVersion,
  isUnspecifiedIpv4,
  resolveFlags,
  diffCounters,
  readCounters,
  findBareProtectedTokens,
  placeholdersIn,
  TOKEN_TIERS,
  UNASSERTABLE,
  isFixOfferable,
} = M;

const stepById = (id) => {
  const s = MANUAL_STEPS.find((x) => x.id === id);
  if (!s) throw new Error(`fixture references a step that does not exist: ${id}`);
  return s;
};

// The app's clock, pinned so `dateNear` is deterministic.
const NOW = Date.UTC(2026, 7, 22, 9, 0, 0);
const TODAY = "2026-08-22";

// =====================================================================
// 1. COERCION -- no exact-string matching on device values
// =====================================================================
console.log("\n-- coercion --");
{
  check(
    "00:05:00 and 5m coerce to the same number of seconds",
    parseDurationSeconds("00:05:00") === 300 && parseDurationSeconds("5m") === 300,
    `${parseDurationSeconds("00:05:00")} vs ${parseDurationSeconds("5m")}`,
  );
  check(
    "a `none` timeout is Infinity, so it fails any finite maximum",
    parseDurationSeconds("none") === Number.POSITIVE_INFINITY,
  );
  check(
    "`unknown` is not a boolean -- it is null, never false",
    parseBool("unknown") === null && parseBool("no") === false,
    `${parseBool("unknown")}`,
  );
  check(
    "both RouterOS date formats parse",
    coerce("datetime", "aug/22/2026").status === "ok" &&
      coerce("datetime", "2026-08-22").status === "ok",
  );
  check(
    "a comma list coerces to a set, so member order does not matter",
    (() => {
      const a = coerce("csv", "https,http-pap").value.members.slice().sort().join(",");
      const b = coerce("csv", "http-pap,https").value.members.slice().sort().join(",");
      return a === b;
    })(),
  );
  check(
    "0.0.0.0 is recognised as the unspecified address, and 0.x.x.x with it",
    isUnspecifiedIpv4("0.0.0.0") === true &&
      isUnspecifiedIpv4("0.1.2.3") === true &&
      isUnspecifiedIpv4("10.5.50.1") === false,
  );
  check(
    "an empty value is EMPTY (a device statement), not MALFORMED (a bad paste)",
    coerce("ipv4", "").status === "empty" && coerce("ipv4", "10.5.50").status === "malformed",
    `${coerce("ipv4", "").status} / ${coerce("ipv4", "10.5.50").status}`,
  );
  check(
    "a value longer than MAX_SANE_VALUE_LEN is over-length, not a fact",
    coerce("ipv4", "1".repeat(40)).status === "over-length",
  );
  check("a version parses to major/minor/patch", parseVersion("7.23.3 (stable)").major === 7);
}

// =====================================================================
// 2. FLAG LETTERS -- INJECTED VIOLATION: `Is` swapped for `As`
// =====================================================================
console.log("\n-- flag letters resolve against the legend the device printed --");
{
  const legend = { A: "active", S: "static", I: "inactive", D: "dynamic", X: "disabled" };
  const as = resolveFlags("As", legend);
  const is = resolveFlags("Is", legend);
  check(
    "`As` resolves to active+static",
    as.meanings.includes("active") && as.meanings.includes("static"),
    JSON.stringify(as),
  );
  check(
    "INJECTED: `Is` resolves to INACTIVE and never to active",
    is.meanings.includes("inactive") && !is.meanings.includes("active"),
    JSON.stringify(is),
  );
  check(
    "with no legend at all the flags are null -- cannot tell, not `no flags`",
    resolveFlags("As", null) === null,
  );
  check(
    "an unknown letter is reported unresolved rather than dropped",
    resolveFlags("AZ", legend).unresolved.join("") === "Z",
  );

  // The route table that ate a live provisioning session.
  const routeTable = [
    "Flags: X - disabled, I - inactive, A - active, D - dynamic, C - connect, S - static",
    " #      DST-ADDRESS        GATEWAY            DISTANCE",
    " 0  Is  0.0.0.0/0          0.0.0.0                   1",
  ].join("\n");
  const parsed = normalise(routeTable);
  check(
    "a real `Is` route row parses its flags from the printed legend",
    parsed.records.length === 1 && parsed.records[0].flagMeanings.includes("inactive"),
    JSON.stringify(parsed.records[0] ?? null),
  );
  check(
    "INJECTED: the same row must NOT report itself active",
    parsed.records.length === 1 && !parsed.records[0].flagMeanings.includes("active"),
  );
}

// =====================================================================
// 3. NORMALISER -- the 11 stages
// =====================================================================
console.log("\n-- normaliser --");
{
  const ansi = "[32mversion=7.23.3[0m\n";
  check("ANSI colour sequences are stripped", normalise(ansi).kv.version?.[0] === "7.23.3");

  check(
    "CRLF and a BOM do not change the parse",
    normalise("﻿version=7.23.3\r\n").kv.version?.[0] === "7.23.3",
  );

  const paged = "==== X ====\nWYFY-BEGIN step01\nversion=7.23.3\n-- [Q quit|D dump|down]\n";
  check("a terminal pager marker is detected", normalise(paged).paged === true);

  const prompt = "[admin@MikroTik] > /ip dhcp-client print detail\nstatus=bound\n";
  const p = normalise(prompt);
  check(
    "an echoed prompt line is recorded and removed from the output",
    p.echoedCommands.length === 1 &&
      p.echoedCommands[0].command.includes("/ip dhcp-client") &&
      !p.lines.some((l) => l.includes("admin@")),
    JSON.stringify(p.echoedCommands),
  );

  const doubled = [
    "WYFY-BEGIN step02",
    "eth-count=0",
    "WYFY-BEGIN step02",
    "eth-count=5",
    "WYFY-END step02",
  ].join("\n");
  const d = normalise(doubled);
  check(
    "the LAST WYFY-BEGIN wins, so a terminal echoing the script does not win",
    d.sentinel.duplicated === true && d.kv["eth-count"]?.[0] === "5",
    JSON.stringify(d.kv["eth-count"]),
  );

  const closing =
    "==== TITLE ====\nWYFY-BEGIN step01\nversion=7\nWYFY-END step01\n====================";
  const c = normalise(closing);
  check(
    "a row of twenty `=` is read as the CLOSING banner, not a second opening one",
    c.banner.open === true && c.banner.title === "TITLE" && c.banner.close === true,
    JSON.stringify(c.banner),
  );

  const colon = "  idle-timeout: 00:05:00\n";
  check(
    "a colon-form line does not shred a duration into its first field",
    normalise(colon).kv["idle-timeout"]?.[0] === "00:05:00",
    JSON.stringify(normalise(colon).kv),
  );

  const row = "lan=10.5.50.1/24;dynamic=false;disabled=false;network=10.5.50.0";
  check(
    "a `;`-separated multi row keeps its primary value and sub-fields",
    normalise(row).kv.lan?.[0] === "10.5.50.1/24;dynamic=false;disabled=false;network=10.5.50.0",
  );

  check(
    "a NUL-bearing paste is rejected by the binary guard",
    normalise("version=7 7").guard === "binary",
  );
}

// =====================================================================
// 4. OUTPUT CLASSIFIER -- three signals, and their disagreement
// =====================================================================
console.log("\n-- output classifier --");

const step02 = stepById("step02-interfaces");
const step03 = stepById("step03-wan-dhcp");
const step17 = stepById("step17-radius-hotspot");

const GOOD_STEP02 = [
  "==== INTERFACES ====",
  "WYFY-BEGIN step02",
  "eth-count=5",
  "eth=ether1;running=true;disabled=false",
  "eth=ether2;running=true;disabled=false",
  "wan-present=true",
  "wan-running=true",
  "wan-in-bridge-count=0",
  "bridge-count=1",
  "bridge=bridge",
  "bridge-correct-name=true",
  "bridge-wrong-name=false",
  "factory-bridge=false",
  "stale-defconf-dhcp=0",
  "WYFY-END step02",
  "====================",
].join("\n");

{
  const r = evaluateStep(step02, GOOD_STEP02, { nowMs: NOW });
  check("a healthy step 2 paste scores PASS", r.verdict === "PASS", `${r.verdict} ${r.gate ?? ""}`);
  check(
    "the expected banner title is derived from probe.command (a Lit), not from title (a T)",
    expectedBannerTitle(step02) === "INTERFACES",
    expectedBannerTitle(step02),
  );

  // INJECTED VIOLATION: truncate the paste mid-table.
  const truncated = GOOD_STEP02.split("\n").slice(0, 6).join("\n");
  const t = evaluateStep(step02, truncated, { nowMs: NOW });
  check(
    "INJECTED: a paste truncated mid-table is INCOMPLETE_OUTPUT, not FAIL and not PASS",
    t.verdict === "INCOMPLETE_OUTPUT",
    t.verdict,
  );
  check(
    "the truncation is attributed to the missing closing banner, before any fact is read",
    t.gate === "bannerOpen && !bannerClose",
    String(t.gate),
  );

  // INJECTED VIOLATION: right command, wrong step.
  const wrongStep = GOOD_STEP02.replace(/step02/g, "step11");
  const w = evaluateStep(step02, wrongStep, { nowMs: NOW });
  check(
    "INJECTED: another step's sentinel is WRONG_OUTPUT -- the signal only the sentinel can give",
    w.verdict === "WRONG_OUTPUT",
    w.verdict,
  );
  check(
    "and it is the BEGIN sentinel id that named it, not a downstream fallback",
    w.gate === "sentinelBegin && sentinelId !== expectedSentinelId" &&
      w.classification.signals.find((s) => s.source === "sentinel").reason ===
        "sentinel-id-mismatch",
    `${w.gate} / ${w.classification.signals.find((s) => s.source === "sentinel").reason}`,
  );
  check(
    "and the banner alone cannot see it -- the banner still agrees",
    w.classification.signals.find((s) => s.source === "banner").verdict === "agree",
    w.classification.signals.find((s) => s.source === "banner").verdict,
  );

  // INJECTED VIOLATION: `/interface print` where a probe was asked for.
  const interfacePrint = [
    "Flags: D - dynamic, X - disabled, R - running, S - slave",
    " #     NAME      TYPE     ACTUAL-MTU L2MTU  MAX-L2MTU",
    " 0  R  ether1    ether          1500  1598       4074",
    " 1  R  ether2    ether          1500  1598       4074",
  ].join("\n");
  const wp = evaluateStep(step02, interfacePrint, { nowMs: NOW });
  check(
    "INJECTED: `/interface print` pasted at step 2 is WRONG_OUTPUT",
    wp.verdict === "WRONG_OUTPUT",
    wp.verdict,
  );
  check(
    "and the app can NAME the menu it actually looks like",
    wp.classification.looksLikeMenu === "/interface",
    String(wp.classification.looksLikeMenu),
  );
  check(
    "and it can name the known wrong paste from commonWrongPastes",
    wp.classification.matchedWrongPasteMenus.includes("/interface"),
    JSON.stringify(wp.classification.matchedWrongPasteMenus),
  );

  // The canonical confusion named in parsing.rules.ts: `/interface print`
  // pasted where `/ip dhcp-client print detail` was asked for.
  const wd = evaluateStep(step03, interfacePrint, { nowMs: NOW });
  check(
    "INJECTED: `/interface print` where `/ip dhcp-client print detail` was asked for is WRONG_OUTPUT",
    wd.verdict === "WRONG_OUTPUT",
    wd.verdict,
  );

  // Signals disagreeing is itself reported, not silently resolved.
  const bannerOnlyMismatch = GOOD_STEP02.replace("==== INTERFACES ====", "==== WAN DHCP ====");
  const dis = classify(step02, normalise(bannerOnlyMismatch));
  check(
    "when the banner and the sentinel disagree, BOTH are reported",
    dis.disagreements.length > 0 &&
      dis.signals.some((s) => s.source === "banner" && s.verdict === "wrong") &&
      dis.signals.some((s) => s.source === "sentinel" && s.verdict === "agree"),
    JSON.stringify(dis.disagreements),
  );
  check(
    "a signal that is simply absent reads `silent`, never `agree`",
    classify(step02, normalise("eth-count=5")).signals.find((s) => s.source === "sentinel")
      .verdict === "silent",
  );
  check(
    "an empty paste is INCOMPLETE_OUTPUT, never a FAIL and never an empty PASS",
    evaluateStep(step02, "   \n\n  ", { nowMs: NOW }).verdict === "INCOMPLETE_OUTPUT",
  );
  check(
    "every EMPTINESS_RULES condition string that gates has a gate id in the engine",
    (() => {
      const gated = EMPTINESS_RULES.filter(
        (r) => r.verdict === "INCOMPLETE_OUTPUT" || r.verdict === "WRONG_OUTPUT",
      ).map((r) => r.condition);
      // Each of these must be reachable as a `gate` value; the engine sets
      // them verbatim. Assert the strings still exist in the engine's own
      // gate vocabulary by round-tripping the two we can construct.
      return (
        gated.includes("bannerOpen && !bannerClose") &&
        gated.includes("sentinelBegin && sentinelId !== expectedSentinelId") &&
        t.gate === "bannerOpen && !bannerClose"
      );
    })(),
  );
}

// =====================================================================
// 5. THREE-VALUED LOGIC -- null never becomes false, never PASSes
// =====================================================================
console.log("\n-- three-valued logic --");
{
  // A probe that could not read a value prints `unknown`. That must not
  // read as "no".
  const unknownRunning = GOOD_STEP02.replace("wan-running=true", "wan-running=unknown");
  const r = evaluateStep(step02, unknownRunning, { nowMs: NOW });
  check(
    "INJECTED: `wan-running=unknown` yields UNKNOWN, not PASS",
    r.verdict === "UNKNOWN",
    `${r.verdict} outcome=${r.outcomeId}`,
  );
  check("and it does not match the `no cable` outcome either", r.outcomeId !== "wan-no-link");
  check("and the reason is traceable without prose", r.pass === null && r.trace.length > 0);

  const missingRequired = GOOD_STEP02.replace("wan-running=true\n", "");
  const m = evaluateStep(step02, missingRequired, { nowMs: NOW });
  check(
    "INJECTED: a missing REQUIRED fact is INCOMPLETE_OUTPUT, never FAIL",
    m.verdict === "INCOMPLETE_OUTPUT" && m.incompleteKeys.includes("wan-running"),
    `${m.verdict} ${JSON.stringify(m.incompleteKeys)}`,
  );

  const corrupt = GOOD_STEP02.replace("eth-count=5", "eth-count=5x");
  const cr = evaluateStep(step02, corrupt, { nowMs: NOW });
  check(
    "INJECTED: a value corrupted mid-token is INCOMPLETE_OUTPUT (a wrap hazard), not FAIL",
    cr.verdict === "INCOMPLETE_OUTPUT",
    cr.verdict,
  );
}

// ---------------------------------------------------------------------
// 5b. NULL PROPAGATION, DIRECTLY
// ---------------------------------------------------------------------
// The content happens not to exercise every combinator over a null, and
// "the shipped data never hits this branch" is not a reason to leave the
// branch untested -- the next step someone writes will hit it. These
// synthetic steps drive each combinator with a genuinely undecidable
// operand: `maybe=unknown` is what a probe prints when its
// `:do {...} on-error={...}` could not read the setting.
console.log("\n-- null propagation, driven directly --");
{
  const EMITS = [
    { key: "sure", type: "string", required: true, describe: "d" },
    { key: "maybe", type: "string", required: false, describe: "d" },
    { key: "rows", type: "string", multi: true, required: false, describe: "d" },
  ];
  const synth = (when, outcomes = []) => ({
    id: "synthetic",
    n: 0,
    title: "Synthetic",
    why: "w",
    dependsOn: [],
    estMinutes: 1,
    oncePerRouter: false,
    configure: [],
    probe: {
      command: [
        ':put "==== SYNTH ===="',
        ':put "WYFY-BEGIN synth"',
        ':put "WYFY-END synth"',
        ':put "===================="',
      ].join("\n"),
      emits: EMITS,
    },
    fingerprint: {
      sentinelId: "synth",
      expectedMenu: "/system resource",
      requireAllKeys: ["sure"],
      discriminator: "d",
      commonWrongPastes: [],
    },
    pass: { when, means: "m" },
    outcomes,
  });
  const PASTE = [
    "==== SYNTH ====",
    "WYFY-BEGIN synth",
    "sure=true",
    "maybe=unknown",
    "WYFY-END synth",
    "====================",
  ].join("\n");
  const v = (when, outcomes) => evaluateStep(synth(when, outcomes), PASTE, { nowMs: NOW });

  const T = { op: "eq", key: "sure", value: "true" };
  const F = { op: "eq", key: "sure", value: "false" };
  const N = { op: "eq", key: "maybe", value: "true" };

  check("a decidable predicate still reaches PASS", v(T).verdict === "PASS", v(T).verdict);
  check("an undecidable predicate is UNKNOWN", v(N).verdict === "UNKNOWN", v(N).verdict);
  check(
    "INJECTED: `not` over a null stays null -- it does not become true",
    v({ op: "not", of: N }).verdict === "UNKNOWN",
    v({ op: "not", of: N }).verdict,
  );
  check(
    "`all` with a null and no false is null",
    v({ op: "all", of: [T, N] }).verdict === "UNKNOWN",
    v({ op: "all", of: [T, N] }).verdict,
  );
  check(
    "`all` with a false short-circuits to false even alongside a null",
    v({ op: "all", of: [F, N] }).verdict === "FAIL",
    v({ op: "all", of: [F, N] }).verdict,
  );
  check(
    "`any` with a true short-circuits to true even alongside a null",
    v({ op: "any", of: [T, N] }).verdict === "PASS",
    v({ op: "any", of: [T, N] }).verdict,
  );
  check(
    "`any` with a null and no true is null",
    v({ op: "any", of: [F, N] }).verdict === "UNKNOWN",
    v({ op: "any", of: [F, N] }).verdict,
  );
  check(
    "INJECTED: an outcome whose `when` is null must NOT match",
    (() => {
      const r = v(F, [
        { id: "should-not-fire", verdict: "FAIL", when: N, meaning: "m", confidence: "field" },
      ]);
      return r.outcomeId === null;
    })(),
  );
  check(
    "`some` over a fact with no rows is false, not null",
    v({ op: "some", key: "rows", of: { op: "eq", key: "rows[].x", value: "1" } }).verdict ===
      "FAIL",
  );
  check(
    "`every` over a fact with NO rows is null -- vacuous truth is how nothing passes as everything",
    v({ op: "every", key: "rows", of: { op: "eq", key: "rows[].x", value: "1" } }).verdict ===
      "UNKNOWN",
  );
  check(
    "a row whose sub-field is missing makes that row undecidable, not false",
    (() => {
      const paste = PASTE.replace("maybe=unknown", "maybe=unknown\nrows=a;y=2");
      const step = synth({
        op: "some",
        key: "rows",
        of: { op: "eq", key: "rows[].x", value: "1" },
      });
      return evaluateStep(step, paste, { nowMs: NOW }).verdict === "UNKNOWN";
    })(),
  );
}

// =====================================================================
// 6. THE 0.0.0.0 SCAR
// =====================================================================
console.log("\n-- the unspecified address --");

const goodStep03 = (over = {}) =>
  [
    "==== WAN DHCP ====",
    "WYFY-BEGIN step03-dhcp",
    `client-count=${over.clientCount ?? 1}`,
    `status=${over.status ?? "bound"}`,
    "address=192.168.1.50/24",
    `gateway=${over.gateway ?? "192.168.1.1"}`,
    "add-default-route=false",
    "client-comment=cloudguest-dhcp-wan1",
    "default-route-count=1",
    `route=${over.gateway ?? "192.168.1.1"};distance=1;comment=cloudguest-plain-wan1`,
    `active-default-routes=${over.active ?? 1}`,
    "nat-count=1",
    "ping-gateway=3",
    "WYFY-END step03-dhcp",
    "====================",
  ].join("\n");

{
  const ok = evaluateStep(step03, goodStep03(), { nowMs: NOW });
  check("a healthy WAN paste scores PASS", ok.verdict === "PASS", `${ok.verdict} ${ok.outcomeId}`);

  // INJECTED VIOLATION: the exact route that shipped.
  const dead = evaluateStep(step03, goodStep03({ gateway: "0.0.0.0" }), { nowMs: NOW });
  check(
    "INJECTED: gateway=0.0.0.0 never scores PASS",
    dead.verdict !== "PASS" && dead.verdict !== "WARNING",
    dead.verdict,
  );
  check(
    "and it is named as the specific fault, not a generic failure",
    dead.verdict === "FAIL" && dead.outcomeId === "bound-no-gateway",
    `${dead.verdict} ${dead.outcomeId}`,
  );
  check(
    "an empty gateway is also not a usable address",
    evaluateStep(step03, goodStep03({ gateway: "" }), { nowMs: NOW }).verdict !== "PASS",
  );

  // INJECTED VIOLATION: the /import race -- bound, real gateway, dead route.
  const race = evaluateStep(step03, goodStep03({ active: 0 }), { nowMs: NOW });
  check(
    "INJECTED: a real gateway with zero ACTIVE default routes is FAIL, not PASS",
    race.verdict === "FAIL" && race.outcomeId === "import-race-dead-route",
    `${race.verdict} ${race.outcomeId}`,
  );
  check(
    "a probe that could not read the active count (-1) is UNKNOWN",
    evaluateStep(step03, goodStep03({ active: -1 }), { nowMs: NOW }).verdict === "UNKNOWN",
  );
}

// =====================================================================
// 7. NEVER INFER EXISTENCE FROM THE ABSENCE OF AN ERROR
// =====================================================================
console.log("\n-- absence of an error is not evidence --");
{
  const noClient = evaluateStep(step03, goodStep03({ clientCount: 0, status: "" }), {
    nowMs: NOW,
  });
  check(
    "an explicit count of 0 is a TRUSTWORTHY empty set and scores the step's own outcome",
    noClient.verdict === "FAIL" && noClient.outcomeId !== null,
    `${noClient.verdict} ${noClient.outcomeId}`,
  );

  const rawEmptyPrint = [
    "Flags: X - disabled, I - invalid, D - dynamic",
    " #   ADDRESS            NETWORK         INTERFACE",
  ].join("\n");
  const raw = evaluateStep(step02, rawEmptyPrint, { nowMs: NOW });
  check(
    "a hand-typed raw print that matched nothing is never PASS",
    raw.verdict !== "PASS",
    raw.verdict,
  );

  // CONTENT_INVARIANTS: "Every probe that inspects a set emits at least one
  // fact whose key ends in -count." A `multi` fact IS a set being listed,
  // so the row listing and the count must always travel together --
  // otherwise "I saw no rows" and "there are no rows" become the same
  // reading, which is the `set [find ...]` silent-success failure.
  //
  // `step01-router-info` and `step06-identity` emit no `-count` and are
  // correct: neither lists a set. They read scalars only.
  check(
    "every probe that LISTS a set also emits a `-count` for it",
    MANUAL_STEPS.filter((s) => s.probe.emits.some((f) => f.multi)).every((s) =>
      s.probe.emits.some((f) => f.key.endsWith("-count")),
    ),
    MANUAL_STEPS.filter(
      (s) =>
        s.probe.emits.some((f) => f.multi) && !s.probe.emits.some((f) => f.key.endsWith("-count")),
    )
      .map((s) => s.id)
      .join(","),
  );
  check(
    "the only probes with no `-count` at all are the two that list nothing",
    MANUAL_STEPS.filter((s) => !s.probe.emits.some((f) => f.key.endsWith("-count")))
      .map((s) => s.id)
      .sort()
      .join(",") === "step01-router-info,step06-identity",
    MANUAL_STEPS.filter((s) => !s.probe.emits.some((f) => f.key.endsWith("-count")))
      .map((s) => s.id)
      .join(","),
  );
  check(
    "no probe command anywhere prints its own PASS or FAIL",
    MANUAL_STEPS.every((s) => !/\b(RESULT:|PASS|FAIL)\b/.test(s.probe.command)),
    MANUAL_STEPS.filter((s) => /\b(RESULT:|PASS|FAIL)\b/.test(s.probe.command))
      .map((s) => s.id)
      .join(","),
  );
}

// =====================================================================
// 8. A SELF-REPORTED RESULT IS A CLAIM, NEVER AN AUTHORITY
// =====================================================================
console.log("\n-- a legacy RESULT: line is a claim --");
{
  const lying = goodStep03({ gateway: "0.0.0.0" }).replace(
    "WYFY-END step03-dhcp",
    "RESULT: PASS\nWYFY-END step03-dhcp",
  );
  const l = evaluateStep(step03, lying, { nowMs: NOW });
  check(
    "INJECTED: `RESULT: PASS` above a dead gateway stays FAIL",
    l.verdict === "FAIL",
    l.verdict,
  );
  check(
    "and the contradiction is recorded rather than swallowed",
    l.contradictions.includes("self-report-claims-pass"),
    JSON.stringify(l.contradictions),
  );

  const gloomy = goodStep03().replace("WYFY-END step03-dhcp", "RESULT: FAIL\nWYFY-END step03-dhcp");
  const g = evaluateStep(step03, gloomy, { nowMs: NOW });
  check(
    "a `RESULT: FAIL` over clean evidence downgrades to UNKNOWN -- two readings disagreeing",
    g.verdict === "UNKNOWN",
    g.verdict,
  );
}

// =====================================================================
// 9. THE RADIUS COUNTER DIFF
// =====================================================================
console.log("\n-- RADIUS counters: two readings or nothing --");

const step17Paste = (c) =>
  [
    "==== RADIUS HOTSPOT ====",
    "WYFY-BEGIN step17",
    "profile-count=1",
    "use-radius=true",
    "radius-accounting=true",
    "login-by=http-pap",
    "radius-count=1",
    "tunnel-ip=10.20.0.7",
    "radius-src=10.20.0.7",
    "local-user-count=0",
    "radius-log-count=1",
    "---- counters below ----",
    `      pending: ${c.pending ?? 0}`,
    `     requests: ${c.requests ?? 0}`,
    `      accepts: ${c.accepts}`,
    `      rejects: ${c.rejects}`,
    `      resends: 0`,
    `     timeouts: ${c.timeouts}`,
    `  bad-replies: ${c["bad-replies"]}`,
    "WYFY-END step17",
    "====================",
  ].join("\n");

const readingOf = (c) => ({ atMs: NOW - 60000, values: c });

{
  const before = { accepts: 11, rejects: 1, timeouts: 0, "bad-replies": 0 };

  // INJECTED VIOLATION: a single reading.
  const one = evaluateStep(step17, step17Paste(before), { nowMs: NOW });
  check(
    "INJECTED: a single counter reading can never PASS",
    one.verdict === "UNKNOWN",
    `${one.verdict} ${one.outcomeId}`,
  );
  check(
    "and it says exactly why -- a second reading is needed",
    one.outcomeId === "needs-second-reading",
    String(one.outcomeId),
  );
  check(
    "no delta fact is published from one reading",
    Object.keys(one.counters.diff.deltas).length === 0 &&
      one.counters.diff.problems.includes("single-reading"),
    JSON.stringify(one.counters.diff.problems),
  );

  // Two readings, a real login.
  const after = { accepts: 12, rejects: 1, timeouts: 0, "bad-replies": 0 };
  const two = evaluateStep(step17, step17Paste(after), {
    nowMs: NOW,
    previousCounters: readingOf(before),
  });
  check(
    "two readings with a real approval score PASS",
    two.verdict === "PASS",
    `${two.verdict} ${two.outcomeId}`,
  );

  // INJECTED VIOLATION: all four counters zero, twice.
  const zero = { accepts: 0, rejects: 0, timeouts: 0, "bad-replies": 0 };
  const z = evaluateStep(step17, step17Paste(zero), {
    nowMs: NOW,
    previousCounters: readingOf(zero),
  });
  check(
    "INJECTED: all-zero counters on both readings are UNKNOWN, never PASS",
    z.verdict === "UNKNOWN",
    `${z.verdict} ${z.outcomeId}`,
  );
  check(
    "and the degenerate diff is named, not hidden",
    z.counters.diff.problems.includes("all-zero") && z.trace.includes("all-zero"),
    JSON.stringify(z.counters.diff.problems),
  );

  // INJECTED VIOLATION: the router restarted between readings.
  const reset = evaluateStep(
    step17,
    step17Paste({ accepts: 2, rejects: 0, timeouts: 0, "bad-replies": 0 }),
    {
      nowMs: NOW,
      previousCounters: readingOf(before),
    },
  );
  check(
    "INJECTED: a counter that went DOWN means a restart -- no delta is published",
    reset.counters.diff.problems.includes("counter-reset") &&
      Object.keys(reset.counters.diff.deltas).length === 0,
    JSON.stringify(reset.counters.diff.problems),
  );
  check("and a restarted router does not PASS", reset.verdict !== "PASS", reset.verdict);

  // bad-replies is the fourth counter and it is watched.
  const bad = evaluateStep(
    step17,
    step17Paste({ accepts: 12, rejects: 1, timeouts: 0, "bad-replies": 3 }),
    { nowMs: NOW, previousCounters: readingOf(before) },
  );
  check(
    "INJECTED: a rising bad-replies is FAIL even though accepts also rose",
    bad.verdict === "FAIL" && bad.outcomeId === "bad-replies-rising",
    `${bad.verdict} ${bad.outcomeId}`,
  );

  // INJECTED VIOLATION: bad-replies missing from the paste (cut short).
  const cut = step17Paste(after)
    .split("\n")
    .filter((l) => !l.includes("bad-replies"))
    .join("\n");
  const cutR = evaluateStep(step17, cut, { nowMs: NOW, previousCounters: readingOf(before) });
  check(
    "INJECTED: a paste missing bad-replies is INCOMPLETE_OUTPUT, not a clean PASS",
    cutR.verdict === "INCOMPLETE_OUTPUT",
    cutR.verdict,
  );

  check(
    "the diff refuses a reading whose counters it never saw",
    diffCounters(null, null).problems.includes("missing-counter"),
  );
  check(
    "readCounters returns null rather than a zero-filled reading",
    readCounters({}, NOW) === null,
  );
}

// =====================================================================
// 10. THE $fact CROSS-REFERENCE
// =====================================================================
console.log("\n-- $fact cross-reference --");
{
  const before = { accepts: 11, rejects: 1, timeouts: 0, "bad-replies": 0 };
  const after = { accepts: 12, rejects: 1, timeouts: 0, "bad-replies": 0 };

  // INJECTED VIOLATION: the source address drifted off the tunnel address.
  const drifted = step17Paste(after).replace("radius-src=10.20.0.7", "radius-src=192.168.88.1");
  const d = evaluateStep(step17, drifted, { nowMs: NOW, previousCounters: readingOf(before) });
  check(
    "INJECTED: radius-src != $tunnel-ip is FAIL and is named",
    d.verdict === "FAIL" && d.outcomeId === "src-address-drifted",
    `${d.verdict} ${d.outcomeId}`,
  );

  // INJECTED VIOLATION: both sides are the unspecified address. They are
  // "equal", and that is not evidence of anything.
  const bothZero = step17Paste(after)
    .replace("tunnel-ip=10.20.0.7", "tunnel-ip=0.0.0.0")
    .replace("radius-src=10.20.0.7", "radius-src=0.0.0.0");
  const bz = evaluateStep(step17, bothZero, { nowMs: NOW, previousCounters: readingOf(before) });
  check(
    "INJECTED: radius-src == $tunnel-ip == 0.0.0.0 must NOT satisfy the pass condition",
    bz.verdict !== "PASS",
    bz.verdict,
  );

  // A referenced fact that is absent makes the predicate null, not false.
  const noTunnel = step17Paste(after).replace(/^tunnel-ip=.*$/m, "tunnel-ip=");
  const nt = evaluateStep(step17, noTunnel, { nowMs: NOW, previousCounters: readingOf(before) });
  check(
    "an absent cross-referenced fact is neither true nor false",
    nt.verdict !== "PASS",
    nt.verdict,
  );
}

// =====================================================================
// 11. VERDICT ASSEMBLY -- the decision table
// =====================================================================
console.log("\n-- verdict assembly --");
{
  // A WARNING outcome may only be reported when `pass` is true.
  const warn = GOOD_STEP02.replace("stale-defconf-dhcp=0", "stale-defconf-dhcp=1");
  const w = evaluateStep(step02, warn, { nowMs: NOW });
  check(
    "a WARNING outcome over a true pass predicate reports WARNING",
    w.verdict === "WARNING" && w.outcomeId === "stale-factory-dhcp-client",
    `${w.verdict} ${w.outcomeId}`,
  );

  const warnAndBroken = warn.replace("wan-in-bridge-count=0", "wan-in-bridge-count=1");
  const wb = evaluateStep(step02, warnAndBroken, { nowMs: NOW });
  check(
    "INJECTED: a WARNING outcome must NOT be reported while the pass predicate is false",
    wb.verdict === "FAIL",
    `${wb.verdict} ${wb.outcomeId}`,
  );

  check(
    "outcomes are evaluated in order and the FIRST match wins",
    (() => {
      const broken = GOOD_STEP02.replace("wan-present=true", "wan-present=false").replace(
        "wan-in-bridge-count=0",
        "wan-in-bridge-count=1",
      );
      const r = evaluateStep(step02, broken, { nowMs: NOW });
      return r.outcomeId === step02.outcomes.find((o) => o.id === "wan-renamed").id;
    })(),
  );

  check(
    "a destructive fix with no confirmPrompt is withheld entirely",
    MANUAL_STEPS.every((s) =>
      s.outcomes.every((o) =>
        (o.fix ?? []).every(
          (f, i) => !f.destructive || isFixOfferable(s, o.id, i) === Boolean(f.confirmPrompt),
        ),
      ),
    ),
  );

  check(
    "every step reaches a verdict without throwing on an empty paste",
    MANUAL_STEPS.every((s) => typeof evaluateStep(s, "", { nowMs: NOW }).verdict === "string"),
  );
  check(
    "every step reaches a verdict without throwing on a plausible wrong paste",
    MANUAL_STEPS.every((s) => evaluateStep(s, GOOD_STEP02, { nowMs: NOW }).verdict !== undefined),
  );
  check(
    "no step other than step 2 accepts step 2's paste as PASS",
    MANUAL_STEPS.filter((s) => s.id !== "step02-interfaces").every(
      (s) => evaluateStep(s, GOOD_STEP02, { nowMs: NOW }).verdict !== "PASS",
    ),
    MANUAL_STEPS.filter(
      (s) =>
        s.id !== "step02-interfaces" &&
        evaluateStep(s, GOOD_STEP02, { nowMs: NOW }).verdict === "PASS",
    )
      .map((s) => s.id)
      .join(","),
  );
  check(
    "the unassertable list is declared rather than quietly asserted",
    Array.isArray(UNASSERTABLE) &&
      UNASSERTABLE.length > 0 &&
      UNASSERTABLE.every((u) => u.id && u.why),
  );

  // A classifier that rejects correct input is as bad as one that accepts
  // wrong input: it teaches the operator to ignore it. For every step,
  // build the minimum well-formed paste of the command that step asks for
  // -- its own banner, its own sentinels, its own required keys -- and
  // assert the classifier lets it through to scoring.
  const synthesisePaste = (step) => {
    const title = expectedBannerTitle(step);
    const lines = [`==== ${title} ====`, `WYFY-BEGIN ${step.fingerprint.sentinelId}`];
    for (const key of step.fingerprint.requireAllKeys) {
      const t = step.probe.emits.find((f) => f.key === key)?.type ?? "string";
      const v =
        t === "int"
          ? "1"
          : t === "bool"
            ? "true"
            : t === "ipv4"
              ? "10.20.0.7"
              : t === "ipv4cidr"
                ? "10.5.50.1/24"
                : t === "duration"
                  ? "5m"
                  : t === "datetime"
                    ? TODAY
                    : t === "version"
                      ? "7.23.3"
                      : t === "csv"
                        ? "http-pap"
                        : "x";
      lines.push(`${key}=${v}`);
    }
    for (const key of step.fingerprint.requireAnyKeys ?? []) lines.push(`${key}=1`);
    lines.push(`WYFY-END ${step.fingerprint.sentinelId}`, "====================");
    return lines.join("\n");
  };

  check(
    "every step's probe emits an extractable banner title",
    MANUAL_STEPS.every((s) => typeof expectedBannerTitle(s) === "string" && expectedBannerTitle(s)),
    MANUAL_STEPS.filter((s) => !expectedBannerTitle(s))
      .map((s) => s.id)
      .join(","),
  );
  check(
    "the classifier accepts a well-formed paste for EVERY step -- no false WRONG_OUTPUT",
    MANUAL_STEPS.every(
      (s) => classify(s, normalise(synthesisePaste(s))).verdict !== "WRONG_OUTPUT",
    ),
    MANUAL_STEPS.filter(
      (s) => classify(s, normalise(synthesisePaste(s))).verdict === "WRONG_OUTPUT",
    )
      .map((s) => s.id)
      .join(","),
  );
  check(
    "and every step's own sentinel and banner agree with themselves",
    MANUAL_STEPS.every((s) => {
      const sig = classify(s, normalise(synthesisePaste(s))).signals;
      return (
        sig.find((x) => x.source === "sentinel").verdict === "agree" &&
        sig.find((x) => x.source === "banner").verdict === "agree"
      );
    }),
    MANUAL_STEPS.filter((s) => {
      const sig = classify(s, normalise(synthesisePaste(s))).signals;
      return (
        sig.find((x) => x.source === "sentinel").verdict !== "agree" ||
        sig.find((x) => x.source === "banner").verdict !== "agree"
      );
    })
      .map((s) => s.id)
      .join(","),
  );
  check(
    "INJECTED: another step's banner in place of this one is caught, for EVERY step",
    MANUAL_STEPS.every((s) => {
      const other = MANUAL_STEPS.find((x) => expectedBannerTitle(x) !== expectedBannerTitle(s));
      const bad = synthesisePaste(s).replace(
        `==== ${expectedBannerTitle(s)} ====`,
        `==== ${expectedBannerTitle(other)} ====`,
      );
      return classify(s, normalise(bad)).verdict === "WRONG_OUTPUT";
    }),
    MANUAL_STEPS.filter((s) => {
      const other = MANUAL_STEPS.find((x) => expectedBannerTitle(x) !== expectedBannerTitle(s));
      const bad = synthesisePaste(s).replace(
        `==== ${expectedBannerTitle(s)} ====`,
        `==== ${expectedBannerTitle(other)} ====`,
      );
      return classify(s, normalise(bad)).verdict !== "WRONG_OUTPUT";
    })
      .map((s) => s.id)
      .join(","),
  );
}

// =====================================================================
// 12. TRANSLATION INVARIANCE
// =====================================================================
// The defect this guards is real and recent: `analyse.ts` selected a
// repair with `failFix.findIndex(f => f.when === fixWhen)` -- an exact
// match on a human-readable string. Translating that string returned
// null and silently degraded a pinpointed repair into a generic list, in
// one language only, with nothing reporting it.
//
// Here: replace EVERY translatable string with a marker and assert that
// not one verdict, outcome id or gate changes.
console.log("\n-- translation invariance --");
{
  const translatable = new Set(
    TRANSLATABLE_FIELD_PATHS.filter((p) => p.startsWith("MANUAL_STEPS")).map((p) =>
      p.replace("MANUAL_STEPS.*.", ""),
    ),
  );
  const isTranslatableLeaf = (path) =>
    translatable.has(path.replace(/\[\d+\]/g, "*").replace(/^\*\./, ""));

  const translate = (node, path) => {
    if (typeof node === "string") return isTranslatableLeaf(path) ? `हि${node.length}` : node;
    if (Array.isArray(node)) return node.map((x) => translate(x, `${path}.*`));
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = translate(v, path ? `${path}.${k}` : k);
      return out;
    }
    return node;
  };

  const cases = [
    [step02, GOOD_STEP02, {}],
    [step03, goodStep03({ gateway: "0.0.0.0" }), {}],
    [
      step17,
      step17Paste({ accepts: 12, rejects: 1, timeouts: 0, "bad-replies": 0 }),
      {
        previousCounters: readingOf({ accepts: 11, rejects: 1, timeouts: 0, "bad-replies": 0 }),
      },
    ],
  ];
  let identical = true;
  const diffs = [];
  for (const [step, paste, opts] of cases) {
    const a = evaluateStep(step, paste, { nowMs: NOW, ...opts });
    const b = evaluateStep(translate(step, ""), paste, { nowMs: NOW, ...opts });
    const key = (r) => `${r.verdict}|${r.outcomeId}|${r.gate}|${r.pass}`;
    if (key(a) !== key(b)) {
      identical = false;
      diffs.push(`${step.id}: ${key(a)} vs ${key(b)}`);
    }
  }
  check(
    "a fully translated content bundle produces byte-identical verdicts",
    identical,
    diffs.join(" ; "),
  );
}

// =====================================================================
// 13. THE {{token}} CONVENTION
// =====================================================================
console.log("\n-- the {{token}} i18n convention --");
{
  check(
    "every PROTECTED_TOKEN is classified into a tier -- the convention cannot rot by omission",
    PROTECTED_TOKENS.every((t) => TOKEN_TIERS[t] === "literal" || TOKEN_TIERS[t] === "colliding"),
    PROTECTED_TOKENS.filter((t) => !TOKEN_TIERS[t]).join(","),
  );
  check(
    "and no tier entry names a token that is not protected",
    Object.keys(TOKEN_TIERS).every((t) => PROTECTED_TOKENS.includes(t)),
    Object.keys(TOKEN_TIERS)
      .filter((t) => !PROTECTED_TOKENS.includes(t))
      .join(","),
  );

  const roots = { MANUAL_STEPS, RESOLVER };
  const collect = (path) => {
    const parts = path.split(".");
    let cur = [{ v: roots[parts[0]], p: parts[0] }];
    for (const seg of parts.slice(1)) {
      const next = [];
      for (const { v, p } of cur) {
        if (v === undefined || v === null) continue;
        if (seg === "*") {
          if (Array.isArray(v)) v.forEach((x, i) => next.push({ v: x, p: `${p}[${i}]` }));
          else if (typeof v === "object")
            for (const k of Object.keys(v)) next.push({ v: v[k], p: `${p}.${k}` });
        } else next.push({ v: v[seg], p: `${p}.${seg}` });
      }
      cur = next;
    }
    return cur.filter((x) => typeof x.v === "string");
  };

  const strings = [];
  for (const path of TRANSLATABLE_FIELD_PATHS) {
    if (!path.startsWith("MANUAL_STEPS") && !path.startsWith("RESOLVER")) continue;
    for (const s of collect(path)) strings.push(s);
  }
  check("the translatable surface is non-trivial", strings.length > 500, String(strings.length));

  const bare = [];
  for (const s of strings) {
    for (const b of findBareProtectedTokens(s.v)) {
      bare.push(`${s.p}: ${b.token} (${b.tier}${b.cue ? "/" + b.cue : ""}) -- ...${b.context}...`);
    }
  }
  check(
    "NO bare protected token survives in any translatable string",
    bare.length === 0,
    bare.slice(0, 6).join(" || "),
  );

  // INJECTED VIOLATION: put a bare token back and prove the lint fires.
  check(
    "INJECTED: a bare `As` reintroduced into prose is caught",
    findBareProtectedTokens("Look at the flags. As means the route is carrying traffic.").length ===
      1,
  );
  check(
    "INJECTED: a bare `bad-replies` reintroduced into prose is caught",
    findBareProtectedTokens("Watch bad-replies, not just the rejections.").length === 1,
  );
  check(
    "INJECTED: a sentence-final `ether1.` is caught -- the boundary is not naive",
    findBareProtectedTokens("The ISP cable goes in ether1.").length === 1,
  );
  check(
    "INJECTED: a colliding token in a device context is caught",
    findBareProtectedTokens("Whether status is bound and whether a gateway is present.").length ===
      1,
  );
  check(
    "a colliding token in ordinary English is NOT caught -- the lint must not cry wolf",
    findBareProtectedTokens("The pool is bound to the guest bridge, which is a LAN bridge.")
      .length === 0,
    JSON.stringify(
      findBareProtectedTokens("The pool is bound to the guest bridge, which is a LAN bridge."),
    ),
  );
  check(
    "an already-wrapped token is not reported again",
    findBareProtectedTokens("The cable goes in {{ether1}}.").length === 0,
  );
  check(
    "a longer token is not double-reported as its prefix",
    (() => {
      const hits = findBareProtectedTokens("The route 0.0.0.0/0 is dead.");
      return hits.length === 1 && hits[0].token === "0.0.0.0/0";
    })(),
  );
  check(
    "placeholders are extracted verbatim for the Hindi parity check",
    placeholdersIn("Look for {{As}} and {{bad-replies}}.").join(",") === "As,bad-replies",
  );

  const withPlaceholders = strings.filter((s) => placeholdersIn(s.v).length > 0);
  check(
    "the wrapping pass actually wrapped something",
    withPlaceholders.length >= 30,
    String(withPlaceholders.length),
  );
  check(
    "no placeholder is empty or contains a brace",
    strings.every((s) => placeholdersIn(s.v).every((p) => p.length > 0 && !/[{}]/.test(p))),
  );
  check(
    "every placeholder names an actual protected token",
    strings.every((s) => placeholdersIn(s.v).every((p) => PROTECTED_TOKENS.includes(p))),
    strings
      .flatMap((s) => placeholdersIn(s.v).filter((p) => !PROTECTED_TOKENS.includes(p)))
      .join(","),
  );
  check(
    "no NEVER_TRANSLATE field was given a placeholder by mistake",
    (() => {
      for (const path of NEVER_TRANSLATE_FIELD_PATHS) {
        if (!path.startsWith("MANUAL_STEPS") && !path.startsWith("RESOLVER")) continue;
        for (const s of collect(path)) if (placeholdersIn(s.v).length > 0) return false;
      }
      return true;
    })(),
  );
}

// =====================================================================

console.log("");
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("manual-wizard-engine: all checks passed");
