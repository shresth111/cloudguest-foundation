/**
 * Trusted Devices at an Aruba Instant On venue (portal side).
 *
 *   1. THE LOOP GUARD (src/lib/portal-aruba-trusted.ts), bundled and run: an
 *      AP refusal (`errmsg`) or a recent attempt for the same device stops
 *      the automatic login; storage that throws (iOS's CNA) never throws out.
 *   2. WIRING. Source checks on `/portal/`: Aruba-only, after the live-session
 *      check, POST before the bookkeeping, at most once per load, and the
 *      backend route it asks.
 *
 * Run: node scripts/test-portal-aruba-trusted.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "portal-aruba-trusted-"));
const src = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

await build({
  entryPoints: [join(ROOT, "src/lib/portal-aruba-trusted.ts")],
  bundle: true,
  format: "esm",
  outfile: join(work, "trusted.mjs"),
  platform: "node",
  logLevel: "silent",
});
const T = await import(pathToFileURL(join(work, "trusted.mjs")).href);

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}
const throwingStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
};

console.log("\n1. Loop guard");
const MAC = "60:f4:45:0b:28:66";
globalThis.window = { sessionStorage: memoryStorage() };
check("a fresh device is tried", T.shouldTryArubaTrustedLogin(MAC, "?cmd=login&mac=" + MAC));
check(
  "the AP's refusal stops it",
  !T.shouldTryArubaTrustedLogin(MAC, "?cmd=login&errmsg=Login%20error.%20Please%20retry."),
);
T.recordArubaTrustedAttempt(MAC, 1_000);
check("a recent attempt stops it", T.arubaTrustedAttemptIsRecent(MAC.toUpperCase(), 2_000));
check(
  "and expires after the cooldown",
  !T.arubaTrustedAttemptIsRecent(MAC, 1_000 + T.ARUBA_TRUSTED_ATTEMPT_COOLDOWN_MS),
);
check("another device is unaffected", !T.arubaTrustedAttemptIsRecent("11:22:33:44:55:66", 2_000));
globalThis.window = { sessionStorage: throwingStorage };
let threw = false;
try {
  T.recordArubaTrustedAttempt(MAC);
  check("throwing storage reads as no attempt", !T.arubaTrustedAttemptIsRecent(MAC));
} catch {
  threw = true;
}
check("throwing storage never throws out", !threw);

console.log("\n2. Wiring");
const index = src("src/routes/portal.index.tsx");
check("Aruba only", /isArubaInstantOnProvider\(netProvider\)/.test(index));
check(
  "asked only after the live-session check found nothing",
  /tryTrustedLogin && !session && liveSessionChecked && !liveSession/.test(index),
);
check("never at a closed venue", /config\.isOpenNow !== false && trustedCheckEnabled/.test(index));
check("at most once per load", /trustedLoginSubmitted\.current = true/.test(index));
const post = index.indexOf("submitTopLevelForm(");
const record = index.indexOf("recordArubaTrustedAttempt(deviceMac)");
check("POST before the bookkeeping (CNA storage throws)", post > 0 && record > post);
check(
  "the AP host goes through the allowlist",
  /arubaLoginTarget\(arubaRedirect\?\.switchip\)/.test(index),
);
check(
  "the backend route",
  /"\/guest\/session\/trusted-device"/.test(src("src/services/portal-runtime.service.ts")),
);

console.log(`\n${ran - failures}/${ran} passed`);
if (failures) process.exit(1);
console.log("portal aruba trusted: all checks passed");
