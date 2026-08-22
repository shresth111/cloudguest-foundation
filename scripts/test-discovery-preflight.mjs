/**
 * Regression test for the fleet wizard's Discovery pre-flight gate.
 *
 * FAILURE MODE THIS LOCKS DOWN (reported 2026-08-22, provisioning a real
 * MikroTik): the Discover step offered an enabled button for a router
 * whose preconditions could not possibly be met. Pressing it opened a
 * socket to a WireGuard tunnel address, waited out the connect timeout,
 * and returned:
 *
 *     Could not connect to device at '10.20.0.64' for discovery: timed out
 *
 * That message is honest but not identifying -- at least four independent
 * things must be true before a byte can flow to that address, and it names
 * none of them. Worse, the step's own status strip rendered
 * `WireGuard: Reachable` off `router.status === "online"`, which is the
 * WAN heartbeat and says nothing whatsoever about the tunnel. The operator
 * was actively told the tunnel was fine.
 *
 * The load-bearing assertions here are the two directions the guards must
 * never drift in:
 *
 *   1. An UNRECOGNIZED backend status must degrade to `unknown`, never to
 *      `pass`. Flip `normalizePreconditionStatus`'s fallback and
 *      `unrecognized-status-is-not-pass` goes red immediately -- that is
 *      the mutation that would let a newer backend silently re-enable a
 *      button an older frontend should be refusing.
 *
 *   2. `unknown` must never read as a clean bill of health.
 *      `discoveryPreflightIsReassuring` exists solely so "we could not
 *      check this" cannot be rendered as "this is fine", which is the
 *      exact fabricated-success-path the backend pre-flight was written to
 *      avoid.
 *
 * Also asserts the source-level bindings that connect those pure guards to
 * the actual button, since a correct predicate wired to nothing is the
 * same bug wearing a disguise.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The
 * pure guards are bundled with esbuild and executed for real; the wiring
 * is checked against the component source.
 *
 * Run: node scripts/test-discovery-preflight.mjs
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

// ---------------------------------------------------------------------------
// Bundle the real pure guards.
// ---------------------------------------------------------------------------

const outdir = mkdtempSync(join(tmpdir(), "discovery-preflight-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export {
     normalizePreconditionStatus,
     isDiscoveryBlocked,
     discoveryPreflightIsReassuring,
   } from "${join(ROOT, "src/lib/discovery-preflight.ts").replace(/\\/g, "/")}";`,
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

const { normalizePreconditionStatus, isDiscoveryBlocked, discoveryPreflightIsReassuring } =
  await import(`file://${outfile}`);

function preflight(overrides = {}) {
  return {
    routerId: "r1",
    canAttempt: true,
    summary: null,
    checks: [],
    blockingCount: 0,
    unverifiedCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Status normalization -- the fail-safe direction.
// ---------------------------------------------------------------------------

console.log("\nstatus normalization");
check("pass survives", normalizePreconditionStatus("pass") === "pass");
check("fail survives", normalizePreconditionStatus("fail") === "fail");
check("unknown survives", normalizePreconditionStatus("unknown") === "unknown");
check(
  "unrecognized-status-is-not-pass",
  normalizePreconditionStatus("degraded") === "unknown",
  normalizePreconditionStatus("degraded"),
);
check("empty-status-is-not-pass", normalizePreconditionStatus("") === "unknown");
check("casing-is-not-coerced-to-pass", normalizePreconditionStatus("PASS") === "unknown");

// ---------------------------------------------------------------------------
// 2. Blocking predicate.
// ---------------------------------------------------------------------------

console.log("\nblocking predicate");
check("known-unmet-precondition-blocks", isDiscoveryBlocked(preflight({ canAttempt: false })));
check("clean-preflight-does-not-block", isDiscoveryBlocked(preflight()) === false);
check(
  "absent-preflight-does-not-block",
  isDiscoveryBlocked(null) === false && isDiscoveryBlocked(undefined) === false,
);

// ---------------------------------------------------------------------------
// 3. Unknown must never read as reassurance.
// ---------------------------------------------------------------------------

console.log("\nunknown is not fine");
check(
  "unverified-preconditions-are-not-reassuring",
  discoveryPreflightIsReassuring(preflight({ unverifiedCount: 1 })) === false,
);
check(
  "fully-verified-clean-preflight-is-reassuring",
  discoveryPreflightIsReassuring(preflight()) === true,
);
check("absent-preflight-is-not-reassuring", discoveryPreflightIsReassuring(null) === false);
check(
  "blocked-preflight-is-not-reassuring",
  discoveryPreflightIsReassuring(preflight({ canAttempt: false })) === false,
);

// ---------------------------------------------------------------------------
// 4. The wiring. A correct guard bound to nothing is still the bug.
// ---------------------------------------------------------------------------

console.log("\nwizard wiring");
const wizard = readFileSync(
  join(ROOT, "src/components/routers/fleet-wizard/RouterFleetSetupWizard.tsx"),
  "utf8",
);

check("discover-step-button-consults-the-gate", /disabled=\{loading \|\| blocked\}/.test(wizard));
check(
  "footer-button-consults-the-gate",
  /discover\.isPending \|\| isDiscoveryBlocked\(discoveryPreflight\.data\)/.test(wizard),
);
check(
  "blocked-state-explains-itself",
  wizard.includes("Discovery is disabled because a precondition above is unmet"),
);
check(
  "unverified-count-is-surfaced-to-the-operator",
  wizard.includes("could not be checked without"),
);
check(
  "preflight-failure-does-not-imply-readiness",
  wizard.includes("it is unknown whether this router"),
);
// The strip that actively lied: `WireGuard: Reachable` derived from the WAN
// heartbeat. It must not come back.
check(
  "wan-heartbeat-is-not-reported-as-wireguard-reachability",
  !/label="WireGuard"[\s\S]{0,120}router\.status === "online"/.test(wizard),
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
