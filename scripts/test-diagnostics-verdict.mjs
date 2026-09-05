/**
 * Regression test for Connection Tools reporting a failed check as a success.
 *
 * THE FAILURE MODE. The backend records a ping that reached nothing as
 * `status: "success"` with `received: 0, packet_loss_percentage: 100` --
 * correctly, because from its point of view the command it was asked to run
 * ran. The page then coloured everything off that field. So a venue whose
 * internet was down got, all at once:
 *
 *     ✓ 8.8.8.8 — 0/4 received (100% loss)     in a green box
 *     Last result: Success                      in a green KPI tile
 *     "Ping to 8.8.8.8 completed"               in a green toast
 *
 * on a page whose own header reads "Trouble connecting or opening a site?
 * Fix it right here." It is the one answer the page exists to get right,
 * and the person reading it is by definition already having a bad day.
 *
 * The cause is that "did the command execute" and "did the target answer"
 * are different questions and only the first was being asked.
 * `diagnosticVerdict` separates them: `executed` carries the first,
 * `outcome`/`tone` carry the second, and the UI colours off the second.
 *
 * The load-bearing assertions, in rough order of how badly a regression
 * would hurt:
 *
 *   1. A COMPLETED PING THAT REACHED NOTHING IS NOT GREEN. This is the
 *      assertion the original bug would have failed. Total loss must be
 *      `danger`, whatever `status` says.
 *   2. PARTIAL LOSS IS NOT GREEN EITHER. A venue dropping half its packets
 *      is not "success"; it is the intermittent fault that is hardest to
 *      catch and most worth surfacing.
 *   3. A CLEAN RUN IS STILL GREEN. A test that fixes a false positive by
 *      making everything red has moved the bug, not removed it.
 *   4. A RUN THAT NEVER EXECUTED IS DISTINGUISHABLE from one that executed
 *      and found nothing -- different causes, different next steps, and the
 *      old code showed the same red box for both.
 *   5. THE ROUTER'S ADDRESS NEVER REACHES THE VENUE OWNER. Backend error
 *      strings carry the management IP (`10.20.0.1`); a cafe owner should
 *      never see a tunnel address.
 *   6. THE FOUR API FAILURES STAY FOUR DIFFERENT ANSWERS. 403, 404, 422 and
 *      a client timeout collapsed into one sentence that was wrong for
 *      three of them, and claimed the router was unreachable when it was
 *      perfectly reachable.
 *
 * Also asserts the source-level wiring, since a correct helper called by
 * nobody is the same bug wearing a disguise.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-customer-kpis.mjs` for the same note). The pure derivations
 * are bundled with esbuild and executed for real; the wiring is checked
 * against the real component source.
 *
 * Run: node scripts/test-diagnostics-verdict.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "diagnostics-verdict-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { diagnosticVerdict, didDiagnosticExecute, summarizeDiagnosticResult, redactDeviceAddresses, describeRecordedFailure, describeDiagnosticApiError } from "${join(
    ROOT,
    "src/lib/diagnostics-presentation.ts",
  ).replace(/\\/g, "/")}";`,
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
  diagnosticVerdict,
  didDiagnosticExecute,
  summarizeDiagnosticResult,
  redactDeviceAddresses,
  describeRecordedFailure,
  describeDiagnosticApiError,
} = await import(`file://${outfile}`);

/** A ping run in the exact shape the backend writes. */
const ping = (received, sent = 4, extra = {}) => ({
  id: "r1",
  diagnosticType: "ping",
  target: "8.8.8.8",
  status: "success",
  errorMessage: null,
  createdAt: "2026-09-05T12:00:00.000Z",
  result: {
    sent,
    received,
    packet_loss_percentage: ((sent - received) / sent) * 100,
    avg_rtt_ms: received > 0 ? 24 : null,
  },
  ...extra,
});

// ---------------------------------------------------------------------------
// 1. The bug itself: a completed ping that reached nothing.
// ---------------------------------------------------------------------------

console.log("\na completed ping that reached nothing is not a success");

const deadTarget = diagnosticVerdict(ping(0));
eq("total loss is not toned success", deadTarget.tone, "danger");
eq("total loss reads as unreachable", deadTarget.outcome, "unreachable");
check(
  "total loss still records that the command executed",
  deadTarget.executed === true,
  "the router did its job; the target did not answer -- both facts matter",
);
check(
  "the headline does not call it a success",
  !/success|completed/i.test(deadTarget.headline),
  deadTarget.headline,
);
check(
  "the backend's own status field is still 'success' -- the fixture is honest",
  ping(0).status === "success",
  "if this ever fails the backend changed and this test is testing nothing",
);

// ---------------------------------------------------------------------------
// 2. Partial loss is not green either.
// ---------------------------------------------------------------------------

console.log("\npartial loss is surfaced, not rounded away");

eq("half the packets lost is a warning", diagnosticVerdict(ping(2)).tone, "warning");
eq("half the packets lost reads as degraded", diagnosticVerdict(ping(2)).outcome, "degraded");
eq("one packet lost of four is still a warning", diagnosticVerdict(ping(3)).tone, "warning");
check(
  "no partial-loss run is ever toned success",
  [1, 2, 3].every((r) => diagnosticVerdict(ping(r)).tone !== "success"),
);

// ---------------------------------------------------------------------------
// 3. A clean run is still green.
// ---------------------------------------------------------------------------

console.log("\na clean run is still a success");

const clean = diagnosticVerdict(ping(4));
eq("every packet returned is toned success", clean.tone, "success");
eq("every packet returned reads as reached", clean.outcome, "reached");
check("the measurement survives into the detail line", /4\/4|100%|24/.test(clean.detail ?? ""));

// ---------------------------------------------------------------------------
// 4. Never-executed is distinguishable from executed-and-found-nothing.
// ---------------------------------------------------------------------------

console.log("\na check that never ran is not the same as a check that found nothing");

const neverRan = diagnosticVerdict(
  ping(0, 4, {
    status: "failed",
    errorMessage: "Could not connect to router at '10.20.0.1': timed out",
    result: {},
  }),
);
eq("a failed run reads as failed", neverRan.outcome, "failed");
check("a failed run records that it did not execute", neverRan.executed === false);
check(
  "failed and unreachable are different outcomes",
  neverRan.outcome !== deadTarget.outcome,
  "the old code showed one red box for both, so the reader could not tell which",
);
check("didDiagnosticExecute agrees", didDiagnosticExecute({ status: "failed" }) === false);
check(
  "didDiagnosticExecute accepts the real success value",
  didDiagnosticExecute({ status: "success" }) === true,
);

// ---------------------------------------------------------------------------
// 5. The router's address never reaches the venue owner.
// ---------------------------------------------------------------------------

console.log("\nthe router's own address stays off the customer's screen");

check(
  "the tunnel IP is stripped from a recorded failure",
  !/10\.20\.0\.1/.test(
    describeRecordedFailure({
      errorMessage: "Could not connect to router at '10.20.0.1': timed out",
      target: "8.8.8.8",
    }),
  ),
);
check(
  "the verdict built from that failure is clean too",
  !/10\.20\.0\.1/.test(`${neverRan.headline} ${neverRan.detail ?? ""}`),
  `${neverRan.headline} ${neverRan.detail ?? ""}`,
);
check(
  "an arbitrary device address is stripped",
  !/192\.168\.88\.1/.test(redactDeviceAddresses("dial 192.168.88.1 failed")),
);
check(
  "the target the customer typed is NOT stripped -- they need to see it",
  redactDeviceAddresses("ping to 8.8.8.8 failed", "8.8.8.8").includes("8.8.8.8"),
);

// ---------------------------------------------------------------------------
// 6. The four API failures stay four different answers.
// ---------------------------------------------------------------------------

console.log("\nfour different API failures get four different answers");

const opts = { kind: "ping", target: "8.8.8.8", elapsedMs: 500, timeoutMs: 20000 };
const forbidden = describeDiagnosticApiError({ status: 403, message: "" }, opts);
const missing = describeDiagnosticApiError({ status: 404, message: "" }, opts);
const unset = describeDiagnosticApiError(
  { status: 422, message: "missing device connection credentials" },
  opts,
);
const timedOut = describeDiagnosticApiError(
  { status: null, message: "" },
  {
    ...opts,
    elapsedMs: 20000,
  },
);

check(
  "all four titles differ",
  new Set([forbidden.title, missing.title, unset.title, timedOut.title]).size === 4,
);
check("a permission failure is not retryable", forbidden.retryable === false);
check("an unfinished router setup is not retryable", unset.retryable === false);
check(
  "none of the three reachable-router cases claims the router was unreachable",
  [forbidden, missing, unset].every(
    (p) => !/could not reach|unreachable/i.test(`${p.title} ${p.description}`),
  ),
  "the old single sentence blamed the router for a permissions problem",
);
check(
  "the timeout points at Recent runs rather than denying the run happened",
  /recent runs/i.test(timedOut.description),
  "the backend keeps going after the client gives up and records the run",
);

// ---------------------------------------------------------------------------
// 7. Wiring -- a correct helper nobody calls is the same bug in disguise.
// ---------------------------------------------------------------------------

console.log("\nthe page actually uses the verdict");

const ops = readFileSync(join(ROOT, "src/components/features/OperationsFeatures.tsx"), "utf8");
const debugging = ops.slice(ops.indexOf("function DiagnosticResultView"));

check("DiagnosticResultView calls diagnosticVerdict", /diagnosticVerdict\(run\)/.test(debugging));
check(
  "the result banner no longer colours off run.status",
  !/run\.status\s*!==\s*"success"/.test(debugging),
);
check(
  "the KPI tile no longer colours off lastRun.status",
  !/lastRun\?\.status\s*===\s*"success"/.test(debugging),
);
check(
  "the history rows no longer colour off r.status",
  !/r\.status\s*===\s*"success"/.test(debugging),
);
check(
  "the toast reports the verdict rather than 'completed'",
  !/completed`\)/.test(debugging) && /verdict\.headline/.test(debugging),
);
check(
  "the thrown-error path uses describeDiagnosticApiError",
  /describeDiagnosticApiError\(/.test(debugging),
);
check(
  "the single catch-all sentence is gone",
  !/Could not reach the router to run this diagnostic/.test(debugging),
);
check(
  "resetSession scopes the lookup to the organization",
  /organizationId: await resolveOrgId\(\)/.test(debugging),
);
check(
  "a failed router fetch no longer claims the venue has no router",
  /routersError \?/.test(debugging),
);
check(
  "summarizeDiagnosticResult is used for history rows",
  /summarizeDiagnosticResult\(/.test(debugging),
);

console.log(
  failures === 0
    ? `\nall diagnostics verdict checks passed\n`
    : `\n${failures} diagnostics verdict check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
