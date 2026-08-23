/**
 * Regression gate for the Guided Setup output analyser and secret redactor.
 *
 * Run: `npm run test:output-analyser`
 *
 * WHY THIS EXISTS
 * ---------------
 * This module decides whether a provisioning step passed by reading the
 * text a MikroTik printed. Every wrong answer it can give is expensive in
 * a different way:
 *
 *   a false PASS  -> a router ships broken, and the guest-facing symptom
 *                    ("OTP verifies but no real internet") takes hours to
 *                    trace back, as it did on 2026-08-18;
 *   a false FAIL  -> an installer factory-resets a healthy router at a
 *                    customer site;
 *   a leaked key  -> the WireGuard private key or the RADIUS shared secret
 *                    ends up in app state, a log, or a support ticket,
 *                    because the content tells operators to run
 *                    `/interface wireguard print detail` and
 *                    `/radius print detail` and this feature has them
 *                    paste the result into the app.
 *
 * `tsc` cannot see any of this. It is a text parser over device output:
 * the types are all `string`, and every bug lives in what the strings
 * mean. So the fixtures below are real RouterOS output shapes -- v6 and
 * v7, `print` and `print detail`, healthy and each specific way the fleet
 * has actually broken.
 *
 * THE FOUR INVARIANTS THIS FILE DEFENDS
 * -------------------------------------
 *  1. `0.0.0.0` never scores PASS. A default route with `gateway=0.0.0.0`
 *     and flag `Is` prints completely normally and ate a live provisioning
 *     session on 2026-08-21. The same truthiness bug is live in the
 *     backend today (`mikrotik_adapter.py::_get_dynamic_default_gateway_sync`
 *     -> `str(gateway) if gateway else None`).
 *  2. Absence of an error is never evidence. RouterOS `set [find ...]`
 *     against an empty match succeeds silently, and an empty paste looks
 *     identical to an empty result.
 *  3. The wrong command never scores as the right one.
 *  4. `bad-replies` is watched. It is the fourth RADIUS counter, it is
 *     neither a reject nor a timeout, and missing it cost the 2026-08-18
 *     outage.
 *
 * The module under test is the real `analyse.ts` / `assertions.ts` /
 * `phases.content.ts` / `progress.ts`, bundled for Node with esbuild
 * (already a transitive devDependency via Vite) -- same approach as
 * `test-fw-rule-order.mjs`. Nothing here reimplements the logic it tests.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "output-analyser-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}`);
  }
};

writeFileSync(
  join(work, "entry.js"),
  [
    `export * from "@/components/routers/guided-setup/analyse";`,
    `export { ASSERTIONS, UNVERIFIABLE_CHECK_IDS } from "@/components/routers/guided-setup/assertions";`,
    `export { PHASES } from "@/components/routers/guided-setup/phases.content";`,
    `export * from "@/components/routers/guided-setup/progress";`,
  ].join("\n"),
);

await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  outfile: join(work, "bundle.mjs"),
  logLevel: "error",
  banner: {
    js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": '"/api/v1"',
    "import.meta.env": "{}",
  },
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "src-alias",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

const mod = await import(pathToFileURL(join(work, "bundle.mjs")).href);
const {
  analyseOutput,
  redactSecrets,
  parseOutput,
  identifyMenu,
  parseDurationSeconds,
  isUsableIpv4,
  REDACTION_MARKER,
  ASSERTIONS,
  UNVERIFIABLE_CHECK_IDS,
  PHASES,
  emptyProgress,
  loadProgress,
  saveProgress,
  phaseAllHaan,
  phaseHasNahi,
  answerKey,
} = mod;

// ---------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------

const CHECKS = new Map();
for (const ph of PHASES) for (const c of ph.checks) CHECKS.set(c.id, { phase: ph, check: c });

/** Score a paste exactly the way `CheckRow` does. */
function score(checkId, raw) {
  const entry = CHECKS.get(checkId);
  if (!entry) throw new Error(`no such check: ${checkId}`);
  const assertion = entry.check.assert ?? ASSERTIONS[checkId];
  return analyseOutput({ raw, assertion, failFix: entry.check.failFix });
}

const verdict = (checkId, raw) => score(checkId, raw).verdict;

/** The fix the analyser auto-selected, as its `when` text. */
function pickedFix(checkId, raw) {
  const r = score(checkId, raw);
  if (r.fixIndex === null) return null;
  return CHECKS.get(checkId).check.failFix[r.fixIndex].when;
}

const today = new Date();
const ISO_TODAY = today.toISOString().slice(0, 10);
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const LEGACY_TODAY = `${MONTHS[today.getMonth()]}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

// =====================================================================
// 1. THE REDACTOR
// =====================================================================
// The content sends operators to two commands that print live secrets.
// These fixtures are those commands' real output shapes.

console.log("\n-- redactor --");

const WG_DETAIL = `Flags: X - disabled; R - running
 0  R name="wg-cloudguest" mtu=1420 listen-port=13231 private-key="cGxhaW50ZXh0cHJpdmF0ZWtleWZvcnRlc3Rpbmcxc2s9" public-key="U2VydmVyUHVibGljS2V5Rm9yVGVzdGluZzEyMzQ1Njc4PQ=="`;

{
  const { text, report } = redactSecrets(WG_DETAIL);
  check(
    "wireguard private-key is stripped",
    !text.includes("cGxhaW50ZXh0cHJpdmF0ZWtleWZvcnRlc3Rpbmcxc2s9"),
    "private key survived redaction",
  );
  check(
    "wireguard public-key is preserved",
    text.includes("U2VydmVyUHVibGljS2V5Rm9yVGVzdGluZzEyMzQ1Njc4PQ=="),
    "public key was redacted -- it is public and is real evidence",
  );
  check(
    "redacted private-key keeps its key=value shape",
    text.includes(`private-key="${REDACTION_MARKER}"`),
    `structure mangled: ${text}`,
  );
  check(
    "surrounding fields survive redaction",
    text.includes('name="wg-cloudguest"') &&
      text.includes("mtu=1420") &&
      text.includes("listen-port=13231"),
    "redaction damaged fields the analyser still needs",
  );
  check(
    "redaction is reported",
    report.count === 1 && report.keys.includes("private-key"),
    JSON.stringify(report),
  );
}

const RADIUS_DETAIL = `Flags: X - disabled
 0   service=hotspot called-id="" domain="" address=10.20.0.1 secret="Wyfy!Sh4red$ecret" authentication-port=1812 accounting-port=1813 timeout=3s accounting-backup=no realm="" src-address=10.20.0.50`;

{
  const { text, report } = redactSecrets(RADIUS_DETAIL);
  check(
    "radius shared secret is stripped",
    !text.includes("Wyfy!Sh4red$ecret"),
    "shared secret survived",
  );
  check(
    "radius non-secret fields survive",
    text.includes("address=10.20.0.1") &&
      text.includes("timeout=3s") &&
      text.includes("service=hotspot"),
    "redaction damaged fields the rec-regenerated assertion reads",
  );
  check(
    "radius redaction reported as secret",
    report.keys.includes("secret"),
    JSON.stringify(report),
  );
}

{
  // Idempotence matters because `CheckRow` binds the textarea to the
  // redacted text: every keystroke re-runs the redactor over its own
  // previous output.
  const once = redactSecrets(RADIUS_DETAIL).text;
  const twice = redactSecrets(once).text;
  check("redaction is idempotent", once === twice, "second pass changed the text");
}

{
  // Replacing an empty value would fabricate a secret that does not exist.
  const { text } = redactSecrets('0 service=hotspot secret="" address=10.20.0.1');
  check("an empty secret stays empty", text.includes('secret=""'), text);
}

{
  // `/radius print` (no `detail`) has no `key=` anywhere -- the secret is
  // a bare column. Sliced only because SECRET is provably the last column.
  const RADIUS_TABLE = `Flags: X - disabled
 #   SERVICE    CALLED-ID   DOMAIN   ADDRESS      SECRET
 0   hotspot                         10.20.0.1    Wyfy!Sh4red$ecret`;
  const { text, report } = redactSecrets(RADIUS_TABLE);
  check("tabular secret column is stripped", !text.includes("Wyfy!Sh4red$ecret"), text);
  check("tabular redaction keeps the rest of the row", text.includes("10.20.0.1"), text);
  check("tabular redaction is reported", report.count >= 1, JSON.stringify(report));
}

{
  // Not the last column: slicing would shred a field, so nothing is cut
  // and the caller is told to warn instead of pretending it is clean.
  const AMBIGUOUS = `Flags: X - disabled
 #   NAME     SECRET      GROUP
 0   admin    hunter2     full`;
  const { report } = redactSecrets(AMBIGUOUS);
  check(
    "an unsliceable secret column is flagged, not guessed",
    report.columnSecretSuspected === true,
    "columnSecretSuspected was not set",
  );
}

{
  const { text } = redactSecrets(
    'password: hunter2\npre-shared-key=abc123\nwpa2-pre-shared-key="zzz"',
  );
  check(
    "colon form, pre-shared-key and wpa2 variants all redacted",
    !text.includes("hunter2") && !text.includes("abc123") && !text.includes("zzz"),
    text,
  );
}

{
  // The redactor runs on every paste, including ones with no secrets at
  // all. It must not touch the markers the analyser reads.
  const innocuous = `==== PORTAL FILES ====\n  flash/hotspot/login.html   size=2841\n====================\nRESULT: OK -- upar wala poora path note kar lo`;
  const { text, report } = redactSecrets(innocuous);
  check(
    "innocuous output is untouched",
    text === innocuous && report.count === 0,
    "redactor altered clean text",
  );
  const withMarker = redactSecrets(
    '0 name="login.html" contents="<form> $(link-login-only) </form>"',
  ).text;
  check(
    "the $(link-login-only) marker survives redaction",
    withMarker.includes("$(link-login-only)"),
    withMarker,
  );
}

{
  // End to end: the secret must not reach the caller even by accident.
  const r = analyseOutput({ raw: RADIUS_DETAIL, assertion: ASSERTIONS["rec-regenerated"] });
  check(
    "analyseOutput returns redacted text, never the raw paste",
    !r.redactedText.includes("Wyfy!Sh4red$ecret") && r.redaction.count >= 1,
    "analyseOutput leaked the shared secret to its caller",
  );
  check(
    "redaction does not break menu identification",
    r.verdict === "PASS",
    `expected PASS on a healthy redacted /radius print detail, got ${r.verdict}: ${r.reason}`,
  );
}

// =====================================================================
// 2. PARSER UNITS
// =====================================================================
// Every pair here means the same thing on a real device. An exact-string
// rule over any of them eventually says FAIL on a healthy router.

console.log("\n-- parser and coercion --");

check(
  "00:05:00 and 5m are the same duration",
  parseDurationSeconds("00:05:00") === 300 && parseDurationSeconds("5m") === 300,
  "duration parse diverged",
);
check(
  "none parses to Infinity, so it fails any finite max",
  parseDurationSeconds("none") === Infinity,
  "none did not become Infinity",
);
check(
  "RouterOS 300ms default parses",
  parseDurationSeconds("300ms") === 0.3,
  "ms form not handled",
);
check("1m30s parses", parseDurationSeconds("1m30s") === 90, "compound units not handled");
check(
  "0.0.0.0 is not a usable IPv4",
  isUsableIpv4("0.0.0.0") === false,
  "THE bug: 0.0.0.0 accepted as an address",
);
check(
  "a real gateway is a usable IPv4",
  isUsableIpv4("192.168.29.1") === true,
  "valid address rejected",
);

{
  const p = parseOutput(
    `Flags: D - DYNAMIC; X - DISABLED, I - INACTIVE, A - ACTIVE; s - STATIC\n0 Is  0.0.0.0/0    0.0.0.0    1`,
    "/ip route",
  );
  check(
    "flags resolve by MEANING against the device's own legend",
    p.records[0].flagMeanings.includes("inactive") && p.records[0].flagsUnresolved === false,
    JSON.stringify(p.records[0]),
  );
}

{
  // `/ip hotspot user print` rows read ` 0 X all      guest ...`. `all` is
  // a three-letter SERVER value; a naive short-alpha-token rule eats it as
  // a flag and shifts every field right.
  const p = parseOutput(
    `Flags: X - disabled, D - dynamic\n #   SERVER   NAME    ADDRESS   PROFILE   UPTIME\n 0 X all      guest                       default   0s`,
    "/ip hotspot user",
  );
  check(
    "a 3-letter column value is not mistaken for flag letters",
    p.records[0].flagLetters === "X" && p.records[0].raw.trim().startsWith("all"),
    JSON.stringify(p.records[0]),
  );
}

{
  const p = parseOutput(
    ` 0   interface=ether1 status=bound address=192.168.29.244/24`,
    "/ip dhcp-client",
  );
  check(
    "flags are left unresolved when there is no legend and no fallback",
    p.records[0].flagsUnresolved === true,
    "claimed to resolve flags it could not see",
  );
}

// =====================================================================
// 3. WRONG_OUTPUT -- the discriminators
// =====================================================================

console.log("\n-- WRONG_OUTPUT --");

const IFACE_PRINT = `Flags: D - dynamic, X - disabled, R - running, S - slave
 #     NAME      TYPE       ACTUAL-MTU L2MTU  MAX-L2MTU
 0  R  ether1    ether            1500  1598       1598
 1  R  ether2    ether            1500  1598       1598`;

const DHCP_CLIENT_PRINT = `Flags: X - disabled, I - invalid, D - dynamic
 #   INTERFACE   USE-PEER-DNS  ADD-DEFAULT-ROUTE  STATUS
 0 D ether1      yes           yes                bound`;

{
  // The canonical case from the brief: asked for the DHCP client, pasted
  // the interface list. Both are tabular, both mention ether1.
  const r = score("wan-lease", IFACE_PRINT);
  check(
    "`/interface print` pasted for the DHCP check is WRONG_OUTPUT",
    r.verdict === "WRONG_OUTPUT",
    `got ${r.verdict}`,
  );
  check(
    "...and the wrong menu is named, not just rejected",
    r.reason.includes("/interface"),
    r.reason,
  );
}

const WG_HOST_PRINT = `Flags: X - disabled, D - dynamic
 #   ACTION  SRC-ADDRESS  DST-HOST                 DST-PORT  PATH
 0   allow                portal.wyfyguest.com`;

const WG_IP_PRINT = `Flags: X - disabled, D - dynamic
 #   ACTION  SRC-ADDRESS  DST-ADDRESS      PROTOCOL  DST-PORT
 ;;; cloudguest-portal-https
 0   accept               40.80.86.193`;

{
  // The two walled-garden menus are one word apart and look nearly
  // identical. Each fingerprint lists the other's key as a neverKey.
  check(
    "walled-garden IP list pasted for the host check is WRONG_OUTPUT",
    verdict("wg-host", WG_IP_PRINT) === "WRONG_OUTPUT",
    verdict("wg-host", WG_IP_PRINT),
  );
  check(
    "walled-garden host list pasted for the IP check is WRONG_OUTPUT",
    verdict("wg-ip", WG_HOST_PRINT) === "WRONG_OUTPUT",
    verdict("wg-ip", WG_HOST_PRINT),
  );
}

{
  const OTHER_BLOCK = `==== ROUTER AUDIT ====\nidentity     : MikroTik\nhotspot-count=0\nradius-count=0\n====================`;
  const r = score("gate-pass", OTHER_BLOCK);
  check("another block's output is WRONG_OUTPUT", r.verdict === "WRONG_OUTPUT", `got ${r.verdict}`);
  check(
    "...and names the block that was actually run",
    r.reason.includes("ROUTER AUDIT"),
    r.reason,
  );
}

{
  check(
    "unrelated prose is WRONG_OUTPUT, never PASS",
    verdict("gate-pass", "haan bhai ho gaya sab theek hai") === "WRONG_OUTPUT",
    "free text scored as something other than WRONG_OUTPUT",
  );
}

// =====================================================================
// 4. INCOMPLETE -- half a paste is not a verdict
// =====================================================================

console.log("\n-- INCOMPLETE --");

check(
  "an empty paste is INCOMPLETE, never PASS or FAIL",
  verdict("gate-pass", "") === "INCOMPLETE",
  verdict("gate-pass", ""),
);
check(
  "whitespace only is INCOMPLETE",
  verdict("gate-pass", "   \n\n  ") === "INCOMPLETE",
  "blank paste scored",
);

{
  // Every block in the content closes with a bare `====================`.
  // Banner without closer means the copy stopped partway -- a sentinel
  // pair that already existed in the content, not one invented for this.
  const TRUNCATED = `==== INTERNET GATE ====\nping 8.8.8.8            : true`;
  check(
    "a block cut off before its closing line is INCOMPLETE",
    verdict("gate-pass", TRUNCATED) === "INCOMPLETE",
    verdict("gate-pass", TRUNCATED),
  );
}

{
  const PAGED = `Flags: X - disabled, I - invalid, D - dynamic\n #   INTERFACE   STATUS\n 0 D ether1      bound\n-- [Q quit|D dump|down]`;
  check(
    "a paged terminal screen is INCOMPLETE",
    verdict("wan-lease", PAGED) === "INCOMPLETE",
    verdict("wan-lease", PAGED),
  );
}

{
  // THE ONE THAT MATTERS: a truncated counter list that still contains
  // `accepts: 21` must not pass. `requires` names bad-replies, so a paste
  // missing the fourth counter cannot reach any verdict but INCOMPLETE.
  const PARTIAL_COUNTERS = `      pending: 0\n     requests: 24\n      accepts: 21\n      rejects: 0`;
  const r = score("radius-counters", PARTIAL_COUNTERS);
  check(
    "counters truncated before bad-replies are INCOMPLETE, not PASS",
    r.verdict === "INCOMPLETE",
    `got ${r.verdict} -- a paste missing bad-replies must never score`,
  );
}

{
  // A route table cut off before the gateway column. It contains
  // `0.0.0.0/0` and an ACTIVE flag -- everything a token-grep would want.
  const CUT_ROUTE = `Flags: D - DYNAMIC; X - DISABLED, I - INACTIVE, A - ACTIVE; s - STATIC\n#      DST-ADDRESS  GATEWAY        DISTANCE\n0 As   0.0.0.0/0`;
  const r = score("wan-route-active", CUT_ROUTE);
  check(
    "a route row with no gateway does not PASS",
    r.verdict !== "PASS",
    `got PASS on a gateway-less row`,
  );
  check("...it fails with the gateway repair selected", r.verdict === "FAIL", `got ${r.verdict}`);
}

{
  // A DHCP row cut off before the STATUS column. `bound` is absent, so
  // there is nothing to confirm -- and nothing is invented.
  const CUT_DHCP = `Flags: X - disabled, I - invalid, D - dynamic\n #   INTERFACE   USE-PEER-DNS  ADD-DEFAULT-ROUTE  STATUS\n 0 D ether1      yes`;
  check(
    "a DHCP row cut before STATUS is not PASS",
    verdict("wan-lease", CUT_DHCP) !== "PASS",
    "invented a status",
  );
}

// =====================================================================
// 5. THE SILENT FAILURES
// =====================================================================
// Each of these prints perfectly normally on a broken router.

console.log("\n-- silent failures --");

const ROUTE_DEAD_V7 = `Flags: D - DYNAMIC; X - DISABLED, I - INACTIVE, A - ACTIVE; c - CONNECT, s - STATIC, d - DHCP
Columns: DST-ADDRESS, GATEWAY, DISTANCE
#      DST-ADDRESS  GATEWAY      DISTANCE
0 Is   0.0.0.0/0    0.0.0.0             1`;

const ROUTE_LIVE_V7 = `Flags: D - DYNAMIC; X - DISABLED, I - INACTIVE, A - ACTIVE; c - CONNECT, s - STATIC, d - DHCP
Columns: DST-ADDRESS, GATEWAY, DISTANCE
#      DST-ADDRESS  GATEWAY        DISTANCE
0 As   0.0.0.0/0    192.168.29.1          1`;

const ROUTE_LIVE_V6 = `Flags: X - disabled, A - active, D - dynamic, C - connect, S - static, B - blackhole, U - unreachable, P - prohibit
 #      DST-ADDRESS        PREF-SRC        GATEWAY            DISTANCE
 0 A S  0.0.0.0/0                          192.168.29.1              1`;

const ROUTE_DEAD_V6 = `Flags: X - disabled, A - active, D - dynamic, C - connect, S - static, B - blackhole, U - unreachable, P - prohibit
 #      DST-ADDRESS        PREF-SRC        GATEWAY            DISTANCE
 0   S  0.0.0.0/0                          0.0.0.0                   1`;

const ROUTE_DETAIL_DEAD = `Flags: X - disabled, I - inactive, D - dynamic
 0 I S  dst-address=0.0.0.0/0 gateway=0.0.0.0 distance=1 scope=30 target-scope=10 comment="cloudguest-plain-wan1"`;

{
  const r = score("wan-route-active", ROUTE_DEAD_V7);
  check(
    "gateway=0.0.0.0 with flag Is is FAIL (the 2026-08-21 bug)",
    r.verdict === "FAIL",
    `got ${r.verdict}`,
  );
  check(
    "...and the pre-written 0.0.0.0 repair is auto-selected",
    pickedFix("wan-route-active", ROUTE_DEAD_V7) ===
      "flags Is dikha raha hai, ya GATEWAY column me 0.0.0.0 hai",
    `picked: ${pickedFix("wan-route-active", ROUTE_DEAD_V7)}`,
  );
}

check(
  "the same dead route in `print detail` form is FAIL",
  verdict("wan-route-active", ROUTE_DETAIL_DEAD) === "FAIL",
  verdict("wan-route-active", ROUTE_DETAIL_DEAD),
);
check(
  "a dead route in RouterOS 6 form is FAIL",
  verdict("wan-route-active", ROUTE_DEAD_V6) === "FAIL",
  verdict("wan-route-active", ROUTE_DEAD_V6),
);
check(
  "a healthy v7 route is PASS",
  verdict("wan-route-active", ROUTE_LIVE_V7) === "PASS",
  verdict("wan-route-active", ROUTE_LIVE_V7),
);
check(
  "a healthy v6 route (space-separated flags) is PASS",
  verdict("wan-route-active", ROUTE_LIVE_V6) === "PASS",
  verdict("wan-route-active", ROUTE_LIVE_V6),
);

{
  // RouterOS 6 has no INACTIVE flag: an inactive route simply lacks `A`,
  // and the row otherwise looks completely healthy.
  const V6_NO_A = `Flags: X - disabled, A - active, D - dynamic, C - connect, S - static
 #      DST-ADDRESS        PREF-SRC        GATEWAY            DISTANCE
 0   S  0.0.0.0/0                          192.168.29.1              1`;
  check(
    "a v6 route missing the ACTIVE flag is FAIL, not PASS",
    verdict("wan-route-active", V6_NO_A) === "FAIL",
    verdict("wan-route-active", V6_NO_A),
  );
}

{
  const EMPTY_ROUTE = `Flags: D - DYNAMIC; X - DISABLED, I - INACTIVE, A - ACTIVE\nColumns: DST-ADDRESS, GATEWAY, DISTANCE\n#      DST-ADDRESS  GATEWAY      DISTANCE`;
  check(
    "no default route at all is FAIL",
    verdict("wan-route-active", EMPTY_ROUTE) === "FAIL",
    verdict("wan-route-active", EMPTY_ROUTE),
  );
}

// --- RADIUS: four counters, not three --------------------------------

const counters = (o) =>
  `      pending: ${o.pending ?? 0}\n     requests: ${o.requests ?? 0}\n      accepts: ${o.accepts ?? 0}\n      rejects: ${o.rejects ?? 0}\n      resends: ${o.resends ?? 0}\n     timeouts: ${o.timeouts ?? 0}\n  bad-replies: ${o.badReplies ?? 0}`;

{
  const raw = counters({ requests: 24, accepts: 21, badReplies: 3 });
  const r = score("radius-counters", raw);
  check(
    "bad-replies > 0 is FAIL even when rejects and timeouts are 0",
    r.verdict === "FAIL",
    `got ${r.verdict}`,
  );
  check(
    "...and selects the bad-replies branch, not the rejects one",
    pickedFix("radius-counters", raw) === "bad-replies badh rahe hain",
    `picked: ${pickedFix("radius-counters", raw)}`,
  );
}

check(
  "timeouts > 0 is FAIL",
  verdict("radius-counters", counters({ requests: 4, timeouts: 4 })) === "FAIL",
  "timeouts ignored",
);
check(
  "rejects > 0 is FAIL",
  verdict("radius-counters", counters({ requests: 4, rejects: 4 })) === "FAIL",
  "rejects ignored",
);
check(
  "accepts with all three error counters zero is PASS",
  verdict("radius-counters", counters({ requests: 21, accepts: 21 })) === "PASS",
  "healthy counters not accepted",
);

{
  // All zero means the router has not seen a single RADIUS request. That
  // is the absence of evidence, and the diagnostics content says so
  // explicitly. Promoting it to PASS would certify an untested router.
  const r = score("radius-counters", counters({}));
  check("all-zero counters are UNKNOWN, never PASS", r.verdict === "UNKNOWN", `got ${r.verdict}`);
}

// --- Empty result vs empty paste -------------------------------------

{
  // `set [find ...]` against an empty match succeeds and prints nothing.
  // An empty result is only trusted when the output proves the command
  // ran: a Flags legend, a column header, or the echoed prompt line.
  const EMPTY_USER = `Flags: X - disabled\n #   NAME                     GROUP    ADDRESS   LAST-LOGGED-IN`;
  check(
    "a framed empty result is a trustworthy PASS",
    verdict("rec-secrets-gone", EMPTY_USER) === "PASS",
    verdict("rec-secrets-gone", EMPTY_USER),
  );
  check(
    "an unframed empty paste is INCOMPLETE, not PASS",
    verdict("rec-secrets-gone", "") === "INCOMPLETE",
    "empty paste scored as an empty result",
  );

  const STILL_THERE = `Flags: X - disabled\n #   NAME             GROUP    ADDRESS   LAST-LOGGED-IN\n 0   cloudguest-api   full               ${LEGACY_TODAY} 09:12:01`;
  check(
    "a surviving cloudguest-api user is FAIL",
    verdict("rec-secrets-gone", STILL_THERE) === "FAIL",
    verdict("rec-secrets-gone", STILL_THERE),
  );
}

// --- The hotspot bypass ----------------------------------------------

const hotspotAudit = (o) =>
  `==== HOTSPOT AUDIT ====
server       : hotspot1  interface=bridge  idle-timeout=${o.idle ?? "00:05:00"}
login-by     : ${o.loginBy ?? "http-pap"}
dns-name     : wifi.wyfyguest.com
use-radius   : true
shared-users : ${o.shared ?? 5}
keepalive    : none
guest user   : ${o.guest ?? "disabled=true"}
====================`;

check(
  "a healthy hotspot audit passes idle-timeout",
  verdict("hs-idle", hotspotAudit({})) === "PASS",
  verdict("hs-idle", hotspotAudit({})),
);
check(
  "idle-timeout=none is FAIL (nothing ever closes a session)",
  verdict("hs-idle", hotspotAudit({ idle: "none" })) === "FAIL",
  verdict("hs-idle", hotspotAudit({ idle: "none" })),
);
check(
  "idle-timeout=5m is the same fact as 00:05:00",
  verdict("hs-idle", hotspotAudit({ idle: "5m" })) === "PASS",
  "5m rejected while 00:05:00 passed",
);
check(
  "login-by=http-pap alone is PASS",
  verdict("hs-loginby", hotspotAudit({})) === "PASS",
  verdict("hs-loginby", hotspotAudit({})),
);
// ORDER STILL DOES NOT MATTER -- but it is demonstrated with a member that
// is harmless, because the pair it used to be demonstrated with is not.
// Both of these checks read `https,http-pap` / `http-pap,https` and
// asserted PASS, and the fixture's own healthy default WAS `https,http-pap`
// -- so the suite's definition of a correct router was the value that
// shipped a full-screen certificate warning to every guest.
check(
  "login-by order does not matter (cookie,http-pap)",
  verdict("hs-loginby", hotspotAudit({ loginBy: "cookie,http-pap" })) === "PASS",
  "ordered list rejected",
);
check(
  "login-by order does not matter (http-pap,cookie)",
  verdict("hs-loginby", hotspotAudit({ loginBy: "http-pap,cookie" })) === "PASS",
  "reordered list rejected",
);
// THE REGRESSION GUARD. `memberOf http-pap` is satisfied by
// `https,http-pap`, so on its own it called the broken value correct.
// Both orders, because the whole point of the rule above is that RouterOS
// does not promise one.
check(
  "login-by=https,http-pap is FAIL -- http-pap being present is not enough",
  verdict("hs-loginby", hotspotAudit({ loginBy: "https,http-pap" })) === "FAIL",
  verdict("hs-loginby", hotspotAudit({ loginBy: "https,http-pap" })),
);
check(
  "login-by=http-pap,https is FAIL in the other order too",
  verdict("hs-loginby", hotspotAudit({ loginBy: "http-pap,https" })) === "FAIL",
  verdict("hs-loginby", hotspotAudit({ loginBy: "http-pap,https" })),
);
check(
  "login-by=cookie,http-chap is FAIL",
  verdict("hs-loginby", hotspotAudit({ loginBy: "cookie,http-chap" })) === "FAIL",
  "the RouterOS default was accepted",
);
check(
  "shared-users 5 is PASS",
  verdict("hs-shared", hotspotAudit({})) === "PASS",
  verdict("hs-shared", hotspotAudit({})),
);
check(
  "shared-users 1 is FAIL",
  verdict("hs-shared", hotspotAudit({ shared: 1 })) === "FAIL",
  verdict("hs-shared", hotspotAudit({ shared: 1 })),
);
check(
  "an enabled local guest user is FAIL (full portal bypass)",
  verdict("hs-guest", hotspotAudit({ guest: "disabled=false" })) === "FAIL",
  verdict("hs-guest", hotspotAudit({ guest: "disabled=false" })),
);
check(
  "a disabled local guest user is PASS",
  verdict("hs-guest", hotspotAudit({})) === "PASS",
  verdict("hs-guest", hotspotAudit({})),
);
check(
  "no local guest user at all is PASS",
  verdict("hs-guest", hotspotAudit({ guest: "nahi hai (accha)" })) === "PASS",
  verdict("hs-guest", hotspotAudit({ guest: "nahi hai (accha)" })),
);

// --- Clock: the app knows real time, the router does not --------------

const clockPrint = (d) =>
  `                  time: 09:14:02\n                  date: ${d}\n      time-zone-autodetect: yes\n        time-zone-name: Asia/Kolkata\n            gmt-offset: +05:30\n            dst-active: no`;

check(
  "today's date in ISO form (RouterOS >= 7.10) is PASS",
  verdict("clock-date", clockPrint(ISO_TODAY)) === "PASS",
  verdict("clock-date", clockPrint(ISO_TODAY)),
);
check(
  "today's date in legacy form (RouterOS <= 7.9) is PASS",
  verdict("clock-date", clockPrint(LEGACY_TODAY)) === "PASS",
  verdict("clock-date", clockPrint(LEGACY_TODAY)),
);
check(
  "jan/01/1970 is FAIL (battery-less hEX, breaks the heartbeat)",
  verdict("clock-date", clockPrint("jan/01/1970")) === "FAIL",
  verdict("clock-date", clockPrint("jan/01/1970")),
);

// --- Corroboration: a self-printed verdict is a claim, not proof ------

{
  // The audit block no longer grades itself -- it prints seven counts and
  // the app decides. But the scepticism is the same: two independent
  // readings of one fact that disagree are never resolved in the
  // optimistic direction.
  const audit = (over = {}, extra = "") => {
    const counts = {
      "hotspot-count": 0,
      "radius-count": 0,
      "wireguard-count": 0,
      "apiuser-count": 0,
      "cert-count": 0,
      "file-count": 0,
      "firewall-count": 0,
      ...over,
    };
    const body = Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    return `==== ROUTER AUDIT ====\nidentity     : MikroTik\n${body}\n${extra}====================`;
  };

  check(
    "a genuinely clean audit is PASS",
    verdict("audit-clean", audit()) === "PASS",
    verdict("audit-clean", audit()),
  );

  // THE 2026-08-23 REGRESSION, in the only form it can still take. The old
  // block printed `RESULT: PURANA CONFIG MILA` on every router alive
  // because `$dirty` did not survive the line break. There is no
  // self-printed verdict left to be unconditionally wrong -- a clean
  // router now has to produce seven literal zeroes to pass, and nothing
  // else can fake them.
  for (const key of [
    "hotspot-count",
    "radius-count",
    "wireguard-count",
    "apiuser-count",
    "cert-count",
    "file-count",
    "firewall-count",
  ]) {
    check(
      `a non-zero ${key} is FAIL, never PASS`,
      verdict("audit-clean", audit({ [key]: 1 })) === "FAIL",
      verdict("audit-clean", audit({ [key]: 1 })),
    );
  }

  const LYING = audit({}, "cloudguest-file: flash/cloudguest-hotspot/login.html\n");
  check(
    "file-count=0 above a listed cloudguest file is FAIL, not PASS",
    verdict("audit-clean", LYING) === "FAIL",
    verdict("audit-clean", LYING),
  );
  check(
    "...and it selects the old-files repair, not the generic reset",
    pickedFix("audit-clean", LYING) ===
      "file-count 0 se zyada hai, jaise flash/cloudguest-hotspot/",
    `picked: ${pickedFix("audit-clean", LYING)}`,
  );

  const FILES = audit(
    { "file-count": 26 },
    "cloudguest-file: flash/cloudguest-hotspot/login.html\n",
  );
  check(
    "the real hEX case (26 leftover files) selects the old-files repair",
    pickedFix("audit-clean", FILES) ===
      "file-count 0 se zyada hai, jaise flash/cloudguest-hotspot/",
    `picked: ${pickedFix("audit-clean", FILES)}`,
  );
  check(
    "a leftover hotspot selects the full-reset repair",
    pickedFix("audit-clean", audit({ "hotspot-count": 1 })) === "koi bhi count 0 se zyada aaya",
    `picked: ${pickedFix("audit-clean", audit({ "hotspot-count": 1 }))}`,
  );

  // A paste that shows only some of the counts cannot reach a verdict.
  const TRUNCATED = `==== ROUTER AUDIT ====\nidentity     : MikroTik\nhotspot-count=0\nradius-count=0\n====================`;
  check(
    "a partial count list is INCOMPLETE, never PASS",
    verdict("audit-clean", TRUNCATED) === "INCOMPLETE",
    verdict("audit-clean", TRUNCATED),
  );

  // An unparseable count makes `intBetween` null, which matches no rule.
  const GARBLED = audit({ "cert-count": "?" });
  check(
    "a count that is not a number lands on UNKNOWN, not PASS",
    verdict("audit-clean", GARBLED) === "UNKNOWN",
    verdict("audit-clean", GARBLED),
  );

  // WHAT THE OPERATOR ACTUALLY PASTES. The 2026-08-23 transcript is a full
  // console session: every line of the block echoed behind an
  // `[admin@hEX] > ` prompt, with its output underneath. Those echoed
  // command lines contain the literal text `hotspot-count="` -- so the
  // parser sees each key TWICE, once from the command and once from the
  // real output. `parseOutput` drops prompt lines before building `kv`,
  // and `kv` is last-occurrence-wins besides, so the real value is the one
  // that survives. This is not hypothetical plumbing: the old assertion
  // read `{ from: "raw" }`, which is the WHOLE cleaned text INCLUDING the
  // prompt lines, so its `textIncludes "purani files"` rule matched the
  // echoed `:put "  purani FILES/FOLDER mili"` command itself and would
  // have failed a spotless router on any full-session paste.
  const SESSION = [
    `[admin@hEX] > :put "==== ROUTER AUDIT ===="`,
    `==== ROUTER AUDIT ====`,
    `[admin@hEX] > :put ("identity     : " . [/system identity get name])`,
    `identity     : hEX`,
    ...[
      "hotspot-count",
      "radius-count",
      "wireguard-count",
      "apiuser-count",
      "cert-count",
      "file-count",
      "firewall-count",
    ].flatMap((k) => [
      `[admin@hEX] > :put ("${k}=" . [:tostr [:len [/ip hotspot find]]])`,
      `${k}=0`,
    ]),
    `[admin@hEX] > :foreach f in=[/file find where name~"cloudguest"] do={ :put ("cloudguest-file: " . [/file get $f name]) }`,
    `[admin@hEX] > :put "===================="`,
    `====================`,
  ].join("\n");
  check(
    "a full echoed console session of a clean router is PASS",
    verdict("audit-clean", SESSION) === "PASS",
    verdict("audit-clean", SESSION),
  );

  // The same session with the commands but none of their output. This is a
  // real mis-paste (the operator copies the block, not the terminal), and
  // it must never become a verdict -- INCOMPLETE and UNKNOWN are the two
  // states `CheckRow` lets a human override, and FAIL is not one of them.
  const COMMANDS_ONLY = PHASES[0].paste[0].script
    .split("\n")
    .map((l) => `[admin@hEX] > ${l}`)
    .join("\n");
  check(
    "the block pasted back without its output is INCOMPLETE, not FAIL",
    ["INCOMPLETE", "UNKNOWN"].includes(verdict("audit-clean", COMMANDS_ONLY)),
    verdict("audit-clean", COMMANDS_ONLY),
  );
}

{
  const TUNNEL_LYING = `==== TUNNEL + RADIUS ====\nlast-handshake : 1m30s\nradius server  : 0.0.0.0\nRESULT: PASS -- hub tak pahunch gaye\n====================`;
  check(
    "RESULT: PASS with a 0.0.0.0 RADIUS address is FAIL",
    verdict("tunnel-up", TUNNEL_LYING) === "FAIL",
    verdict("tunnel-up", TUNNEL_LYING),
  );

  const TUNNEL_OK = `==== TUNNEL + RADIUS ====\nlast-handshake : 1m30s\nradius server  : 10.20.0.1\nRESULT: PASS -- hub tak pahunch gaye\n====================`;
  check(
    "a real tunnel PASS is PASS",
    verdict("tunnel-up", TUNNEL_OK) === "PASS",
    verdict("tunnel-up", TUNNEL_OK),
  );

  const NO_RADIUS = `==== TUNNEL + RADIUS ====\nradius server  : \nRESULT: FAIL -- koi RADIUS entry nahi hai\n====================`;
  check(
    "a blank radius server line selects the no-entry branch",
    pickedFix("tunnel-up", NO_RADIUS) === "RESULT: FAIL -- koi RADIUS entry nahi hai",
    `picked: ${pickedFix("tunnel-up", NO_RADIUS)}`,
  );
}

{
  // THE HEARTBEAT SCHEDULER. The first hEX passed every other check in
  // this flow and still sat in Master console as `provisioning`, because
  // the single-line paste died before the Heartbeat chunk and nothing
  // anywhere said so. `sched=0` was discoverable on the device the whole
  // time; no check asked for it.
  const hb = (o = {}) =>
    [
      "==== HEARTBEAT ====",
      `sched count    : ${o.count ?? "1"}`,
      ...(o.count === "0"
        ? []
        : [
            "  name         : cloudguest-heartbeat",
            "  interval     : 00:05:00",
            `  next-run     : ${o.nextRun ?? "aug/23/2026 06:35:00"}`,
          ]),
      o.count === "0"
        ? "RESULT: FAIL -- koi cloudguest scheduler nahi hai, heartbeat kabhi nahi jayega"
        : "RESULT: PASS -- scheduler maujood hai",
      "====================",
    ].join("\n");

  check(
    "a scheduler with a next-run is PASS",
    verdict("hb-scheduler", hb()) === "PASS",
    verdict("hb-scheduler", hb()),
  );
  check(
    "sched count 0 is FAIL -- this is the founder's router",
    verdict("hb-scheduler", hb({ count: "0" })) === "FAIL",
    verdict("hb-scheduler", hb({ count: "0" })),
  );
  check(
    "sched count 0 selects the never-pasted branch",
    pickedFix("hb-scheduler", hb({ count: "0" })) ===
      "RESULT: FAIL -- koi cloudguest scheduler nahi hai, heartbeat kabhi nahi jayega",
    `picked: ${pickedFix("hb-scheduler", hb({ count: "0" }))}`,
  );
  // A SCHEDULER THAT EXISTS BUT WILL NEVER FIRE IS NOT A PASS. Same
  // outcome as no scheduler at all, and it is what a wrong clock produces
  // -- which the hEX has after every power cut, having no battery.
  const stalled = hb().replace(/  next-run     : .*/, "  next-run     : ");
  check(
    "a scheduler with a blank next-run is FAIL, not PASS",
    verdict("hb-scheduler", stalled) === "FAIL",
    verdict("hb-scheduler", stalled),
  );
  check(
    "a blank next-run selects the clock branch, not the never-pasted one",
    pickedFix("hb-scheduler", stalled) === "sched count 0 se zyada hai par next-run blank hai",
    `picked: ${pickedFix("hb-scheduler", stalled)}`,
  );
  // MISSING EVIDENCE IS NOT A PASS. The count line is printed
  // unconditionally, so its absence means the block was not run or not
  // fully pasted -- neither of which is proof a scheduler exists.
  check(
    "output with no sched count line is INCOMPLETE, never PASS",
    verdict("hb-scheduler", "==== HEARTBEAT ====\n====================") === "INCOMPLETE",
    verdict("hb-scheduler", "==== HEARTBEAT ====\n===================="),
  );
}

// =====================================================================
// 6. BRANCH SELECTION
// =====================================================================
// The content was written sentinel-first: one `failFix[].when` is
// literally the string a branch selector would match.

console.log("\n-- fix branch selection --");

{
  const gate = (ping, res) =>
    `==== INTERNET GATE ====\nping 8.8.8.8            : ${ping}\nresolve portal.wyfy...  : ${res}\n====================\nRESULT: ${ping === "true" && res === "true" ? "PASS -- aage badho" : "FAIL -- niche wala fix chalao"}`;

  check(
    "internet + DNS both up is PASS",
    verdict("gate-pass", gate("true", "true")) === "PASS",
    verdict("gate-pass", gate("true", "true")),
  );
  check(
    "ping true + resolve false picks the pre-written DNS branch",
    pickedFix("gate-pass", gate("true", "false")) === "ping true par resolve false",
    `picked: ${pickedFix("gate-pass", gate("true", "false"))}`,
  );
  check(
    "ping false picks the route branch instead",
    pickedFix("gate-pass", gate("false", "false")) === "ping bhi false",
    `picked: ${pickedFix("gate-pass", gate("false", "false"))}`,
  );
}

check(
  "a healthy DHCP client is PASS",
  verdict("wan-lease", DHCP_CLIENT_PRINT) === "PASS",
  verdict("wan-lease", DHCP_CLIENT_PRINT),
);

{
  const SEARCHING = DHCP_CLIENT_PRINT.replace("bound", "searching...");
  check(
    "a searching DHCP client picks the cable branch",
    pickedFix("wan-lease", SEARCHING) === "status searching... pe atka hai",
    `picked: ${pickedFix("wan-lease", SEARCHING)}`,
  );
}

check(
  "the portal IP entry is PASS",
  verdict("wg-ip", WG_IP_PRINT) === "PASS",
  verdict("wg-ip", WG_IP_PRINT),
);
check(
  "the portal host entry is PASS",
  verdict("wg-host", WG_HOST_PRINT) === "PASS",
  verdict("wg-host", WG_HOST_PRINT),
);

{
  // A changed portal IP is a WARNING, not a FAIL: the content's own fix
  // is "re-run the block, it updates the entry". Failing here would send
  // installers chasing a healthy router.
  const MOVED = WG_IP_PRINT.replace("40.80.86.193", "40.80.90.10");
  check(
    "a portal IP that moved is WARNING, not FAIL",
    verdict("wg-ip", MOVED) === "WARNING",
    verdict("wg-ip", MOVED),
  );

  const EMPTY_WG = `Flags: X - disabled, D - dynamic\n #   ACTION  SRC-ADDRESS  DST-ADDRESS      PROTOCOL  DST-PORT`;
  check(
    "an empty walled-garden IP list is FAIL",
    verdict("wg-ip", EMPTY_WG) === "FAIL",
    verdict("wg-ip", EMPTY_WG),
  );
}

{
  // login.html existing is not the same fact as login.html being ours --
  // "guest sees the blue MikroTik page" is a wrong-CONTENT failure.
  const FILE_OK = ` 0 name="flash/hotspot/login.html" type="html file" size=2841 contents="<form action=\\"$(link-login-only)\\">"`;
  check(
    "login.html containing $(link-login-only) is PASS",
    verdict("portal-files", FILE_OK) === "PASS",
    verdict("portal-files", FILE_OK),
  );

  const FILE_STOCK = ` 0 name="flash/hotspot/login.html" type="html file" size=1102 contents="<html>MikroTik hotspot</html>"`;
  check(
    "a stock MikroTik login.html is FAIL",
    verdict("portal-files", FILE_STOCK) === "FAIL",
    verdict("portal-files", FILE_STOCK),
  );

  const FILE_NO_CONTENTS = ` 0 name="flash/hotspot/login.html" type="html file" size=2841 creation-time=${LEGACY_TODAY}`;
  check(
    "a file listing with no contents is UNKNOWN, not PASS",
    verdict("portal-files", FILE_NO_CONTENTS) === "UNKNOWN",
    verdict("portal-files", FILE_NO_CONTENTS),
  );

  const BLOCK_WRONG_PATH = `==== PORTAL FILES ====\n  hotspot/login.html   size=2841\n====================\nRESULT: OK -- upar wala poora path note kar lo`;
  check(
    "a login.html outside flash/ is WARNING (the silent wrong-model path)",
    verdict("portal-files", BLOCK_WRONG_PATH) === "WARNING",
    verdict("portal-files", BLOCK_WRONG_PATH),
  );

  const BLOCK_RIGHT_PATH = `==== PORTAL FILES ====\n  flash/hotspot/login.html   size=2841\n====================\nRESULT: OK -- upar wala poora path note kar lo`;
  check(
    "the path-only block is UNKNOWN, not PASS (it cannot see contents)",
    verdict("portal-files", BLOCK_RIGHT_PATH) === "UNKNOWN",
    verdict("portal-files", BLOCK_RIGHT_PATH),
  );

  const BLOCK_MISSING = `==== PORTAL FILES ====\n====================\nRESULT: FAIL -- login.html mila hi nahi`;
  check(
    "no login.html at all is FAIL",
    verdict("portal-files", BLOCK_MISSING) === "FAIL",
    verdict("portal-files", BLOCK_MISSING),
  );
}

// =====================================================================
// 7. STRUCTURAL INVARIANTS OVER THE CONTENT
// =====================================================================
// These are the ones that catch a future edit rather than a present bug.

console.log("\n-- content invariants --");

check(
  "the flow is nine phases (VLAN cut, confirmed 2026-08-22)",
  PHASES.length === 9,
  `found ${PHASES.length} phases`,
);

// ---------------------------------------------------------------------
// THE CONSOLE-SCOPE GUARD
// ---------------------------------------------------------------------
// The RouterOS terminal runs EACH ENTERED LINE as its own program. A
// `:local` declared on one line does not exist on the next. On 2026-08-23
// the Phase 0 audit block was pasted into a real hEX (RouterOS 7.23.3)
// and every `:set dirty ...` line came back `syntax error` -- not one of
// its seven checks ran, and because an undefined `$dirty` is not equal to
// 0 the block printed `RESULT: PURANA CONFIG MILA` unconditionally. It
// would have said that on a factory-fresh router too, forever.
//
// Every paste block and every fix command in the content had the same
// shape. They are fixed; this is what stops the next one. The rule it
// enforces is exactly the defect and nothing wider: a variable REFERENCED
// on a line must have been BOUND on that same line -- by `:local`,
// `:global`, `:set` is not a binder, or by a `:for` / `:foreach` loop
// variable. A `:local` declared and consumed inside one line is fine, and
// a single-line `;`-joined script (the shape the Master console's own
// generator emits) is the intended way to keep carried state.
{
  /** Every pasteable script the operator is ever handed, with a label. */
  const pasteables = [];
  for (const p of PHASES) {
    p.paste.forEach((b, i) =>
      pasteables.push([`phase "${p.id}" paste[${i}] (${b.label})`, b.script]),
    );
    for (const c of p.checks) {
      if (/^\s*[/:]/.test(c.command)) pasteables.push([`check "${c.id}" command`, c.command]);
      (c.failFix ?? []).forEach((f, i) => {
        if (f.command) pasteables.push([`check "${c.id}" failFix[${i}].command`, f.command]);
      });
    }
  }

  const RE_VAR_USE = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
  const RE_SET = /:set\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  const RE_BIND = /:(?:local|global)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  const RE_LOOP = /:(?:for|foreach)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:from|in)\b/g;
  const names = (line, re) => [...line.matchAll(re)].map((m) => m[1]);

  const offenders = [];
  for (const [label, script] of pasteables) {
    script.split("\n").forEach((line, n) => {
      const bound = new Set([...names(line, RE_BIND), ...names(line, RE_LOOP)]);
      // `:set x` READS an existing binding, so it is a use, not a bind.
      const used = new Set([...names(line, RE_VAR_USE), ...names(line, RE_SET)]);
      for (const v of used) {
        if (!bound.has(v)) offenders.push(`${label}, line ${n + 1}: $${v}`);
      }
    });
  }

  check(
    "no paste block carries a variable across a line break",
    offenders.length === 0,
    `${offenders.length} unbound reference(s). The RouterOS console runs each line as its own ` +
      `program, so these read a variable that no longer exists -- the line will either be a ` +
      `syntax error or, worse, evaluate against nothing and print a confident wrong answer. ` +
      `Join the statements onto ONE line with ";", or restructure the block to carry no state ` +
      `at all.\n      ${offenders.slice(0, 12).join("\n      ")}` +
      (offenders.length > 12 ? `\n      ... and ${offenders.length - 12} more` : ""),
  );

  // The guard is worthless if it cannot see the pattern it was written
  // for, so it is pointed at the exact block that shipped broken.
  const REGRESSION = `:local dirty 0\n:if ([:len [/ip hotspot find]] > 0) do={ :set dirty ($dirty + 1) }`;
  const caught = REGRESSION.split("\n").some((line, n) => {
    if (n === 0) return false;
    const bound = new Set([...names(line, RE_BIND), ...names(line, RE_LOOP)]);
    const used = new Set([...names(line, RE_VAR_USE), ...names(line, RE_SET)]);
    return [...used].some((v) => !bound.has(v));
  });
  check("...and that guard demonstrably fires on the original bug", caught, "the guard is blind");

  // Same shape, legally flattened onto one line: must NOT fire, or the
  // guard would ban the very fix it is meant to enforce.
  const FLATTENED = `:local dirty 0; :if ([:len [/ip hotspot find]] > 0) do={ :set dirty ($dirty + 1) }; :put $dirty`;
  const bound = new Set([...names(FLATTENED, RE_BIND), ...names(FLATTENED, RE_LOOP)]);
  const used = new Set([...names(FLATTENED, RE_VAR_USE), ...names(FLATTENED, RE_SET)]);
  check(
    "...and does NOT fire on a single-line script that keeps its own state",
    [...used].every((v) => bound.has(v)),
    "the guard bans the legal single-line shape",
  );
}

{
  const ids = [...CHECKS.keys()];
  const allIds = PHASES.flatMap((p) => p.checks.map((c) => c.id));
  check(
    "every check id is globally unique",
    ids.length === allIds.length,
    "duplicate check id -- ASSERTIONS is keyed by id alone, so a duplicate silently attaches the wrong assertion to a check",
  );
}

{
  const unknown = Object.keys(ASSERTIONS).filter((id) => !CHECKS.has(id));
  check(
    "every assertion targets a check that exists",
    unknown.length === 0,
    `orphans: ${unknown.join(", ")}`,
  );
}

{
  // The load-bearing link: an assertion selects a repair by quoting its
  // `when` text. Reword the fix without rewording the rule and the branch
  // silently stops being selected -- the operator gets a FAIL with no
  // guidance and no error anywhere.
  const broken = [];
  for (const [id, a] of Object.entries(ASSERTIONS)) {
    const entry = CHECKS.get(id);
    if (!entry) continue;
    const whens = (entry.check.failFix ?? []).map((f) => f.when);
    for (const rule of a.rules) {
      if (rule.fix && !whens.includes(rule.fix)) broken.push(`${id} -> "${rule.fix}"`);
    }
  }
  check(
    "every rule's fix selector matches a real failFix.when",
    broken.length === 0,
    broken.join("; "),
  );
}

{
  const covered = new Set([...Object.keys(ASSERTIONS), ...UNVERIFIABLE_CHECK_IDS]);
  const missing = [...CHECKS.keys()].filter((id) => !covered.has(id));
  check(
    "every check is either asserted or explicitly declared unverifiable",
    missing.length === 0,
    `unaccounted for: ${missing.join(", ")} -- a new check must be given an assertion or added to UNVERIFIABLE_CHECK_IDS on purpose`,
  );
}

{
  const both = [...UNVERIFIABLE_CHECK_IDS].filter((id) => ASSERTIONS[id]);
  check("no check is both asserted and declared unverifiable", both.length === 0, both.join(", "));
}

{
  const bad = Object.entries(ASSERTIONS).filter(([, a]) => !a.rules?.length || !a.fallback);
  check(
    "every assertion has rules and an UNKNOWN fallback",
    bad.length === 0,
    bad.map(([id]) => id).join(", "),
  );
}

{
  // WRONG_OUTPUT is identification's verdict, not a rule's. A rule that
  // reached the point of running has already proved it is the right
  // command, so emitting WRONG_OUTPUT there would be incoherent.
  const bad = [];
  for (const [id, a] of Object.entries(ASSERTIONS)) {
    if (a.rules.some((r) => r.verdict === "WRONG_OUTPUT")) bad.push(id);
  }
  check(
    "no rule emits WRONG_OUTPUT (that is identification's job)",
    bad.length === 0,
    bad.join(", "),
  );
}

{
  // The five phase-7 checks are a phone test. If one ever grows an
  // assertion, someone has claimed the app can verify "the portal opened
  // on my phone", which it cannot.
  const phone = PHASES.find((p) => p.id === "phonetest");
  const asserted = phone.checks.filter((c) => c.assert || ASSERTIONS[c.id]);
  check(
    "the phone-test phase stays human-confirmed",
    asserted.length === 0,
    asserted.map((c) => c.id).join(", "),
  );
  check(
    "the phone-test phase still has five checks",
    phone.checks.length === 5,
    `found ${phone.checks.length}`,
  );
}

{
  const r = analyseOutput({ raw: "anything at all", assertion: undefined });
  check(
    "a check with no assertion reports itself unverifiable",
    r.unverifiable === true && r.verdict === "UNKNOWN",
    JSON.stringify(r.verdict),
  );
}

// =====================================================================
// 8. PROGRESS
// =====================================================================

console.log("\n-- progress --");

{
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };

  check(
    "empty progress is version 2",
    emptyProgress().version === 2,
    `version ${emptyProgress().version}`,
  );

  // A stored v1 blob holds "haan"/"nahi", which this code would read as
  // neither passed nor failed. Discarding it costs a few re-answers;
  // half-trusting it certifies a router nobody checked.
  store.set(
    "cg_guided_setup_r1",
    JSON.stringify({
      version: 1,
      currentPhaseId: "wan",
      answers: { "wan:wan-lease": "haan" },
      donePhaseIds: ["audit"],
      secretsSafePhaseIds: [],
      updatedAt: 1,
    }),
  );
  const loaded = loadProgress("r1");
  check(
    "a version 1 blob is discarded, not half-trusted",
    Object.keys(loaded.answers).length === 0 && loaded.donePhaseIds.length === 0,
    JSON.stringify(loaded),
  );

  saveProgress("r2", {
    ...emptyProgress(),
    currentPhaseId: "gate",
    answers: { "gate:gate-pass": "PASS" },
  });
  check(
    "a version 2 blob round-trips",
    loadProgress("r2").answers["gate:gate-pass"] === "PASS",
    JSON.stringify(loadProgress("r2")),
  );

  const hotspot = PHASES.find((p) => p.id === "hotspot");
  const answersOf = (v) =>
    Object.fromEntries(hotspot.checks.map((c) => [answerKey(hotspot.id, c.id), v]));

  check(
    "all PASS opens a stop gate",
    phaseAllHaan(hotspot, answersOf("PASS")) === true,
    "PASS did not satisfy the gate",
  );
  check(
    "all WARNING opens a stop gate",
    phaseAllHaan(hotspot, answersOf("WARNING")) === true,
    "WARNING blocked the gate",
  );
  check(
    "UNKNOWN does NOT open a stop gate",
    phaseAllHaan(hotspot, answersOf("UNKNOWN")) === false,
    "UNKNOWN was promoted to a pass",
  );
  check(
    "INCOMPLETE does NOT open a stop gate",
    phaseAllHaan(hotspot, answersOf("INCOMPLETE")) === false,
    "INCOMPLETE was promoted to a pass",
  );
  check(
    "WRONG_OUTPUT does NOT open a stop gate",
    phaseAllHaan(hotspot, answersOf("WRONG_OUTPUT")) === false,
    "WRONG_OUTPUT was promoted to a pass",
  );
  check(
    "FAIL does not open a stop gate",
    phaseAllHaan(hotspot, answersOf("FAIL")) === false,
    "FAIL opened the gate",
  );
  check(
    "an unanswered phase does not open a stop gate",
    phaseAllHaan(hotspot, {}) === false,
    "an empty answer set opened the gate",
  );
  check(
    "only FAIL marks the phase rail broken",
    phaseHasNahi(hotspot, answersOf("FAIL")) === true &&
      phaseHasNahi(hotspot, answersOf("WRONG_OUTPUT")) === false,
    "rail tone reacts to a mis-paste",
  );

  delete globalThis.window;
}

// ---------------------------------------------------------------------

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\noutput-analyser: all checks passed");
