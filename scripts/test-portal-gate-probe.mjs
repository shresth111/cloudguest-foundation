/**
 * The "is the hotspot gate already open?" decision, pinned against the REAL
 * `src/lib/portal-gate-probe.ts`.
 *
 * Run: `node scripts/test-portal-gate-probe.mjs`
 *
 * WHY THIS EXISTS: measured on a real MikroTik, a hotspot-login POST from a
 * device that already holds a bypass binding returns 501 from the router's
 * management web server. `/portal/success` therefore probes before it
 * POSTs, and skips the POST only on a yes. The dangerous direction is a
 * WRONG yes -- the POST is the only thing that opens the gate -- so what
 * this file pins is mostly the ways the answer must be "no": every failure,
 * every timeout, every storage problem, and every second ask.
 *
 * The route-level half (the real `attemptSubmit` driving a fake browser)
 * lives in test-portal-cna-storage-safety.mjs, which already bundles
 * portal.success.tsx.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "portal-gate-probe-"));

await build({
  entryPoints: [join(SRC, "lib/portal-gate-probe.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: { "@": SRC },
});

const {
  HOTSPOT_GATE_PROBE_URL,
  HOTSPOT_GATE_PROBE_TIMEOUT_MS,
  HOTSPOT_GATE_PROBE_SESSION_WINDOW_MS,
  hotspotGateProbeAllowed,
  probeHotspotGateOpen,
  hotspotGateAlreadyOpen,
} = await import(join(work, "bundle.mjs"));

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

const NOW = Date.parse("2026-10-11T10:00:00Z");
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const never = () => new Promise(() => {});

/** An environment in which every fence passes and the probe says "open". */
function env(overrides = {}) {
  const calls = [];
  const recorded = [];
  return {
    calls,
    recorded,
    captiveSheet: false,
    sessionStartedAt: iso(5_000),
    now: NOW,
    skippedBefore: () => false,
    recordSkip: () => {
      recorded.push(true);
      return true;
    },
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ type: "opaque" });
    },
    timeoutMs: 40,
    ...overrides,
  };
}

console.log("hotspot gate probe");

// --- 1. The probe target ---------------------------------------------
{
  const url = new URL(HOTSPOT_GATE_PROBE_URL);
  check("probe target is HTTPS", url.protocol === "https:", HOTSPOT_GATE_PROBE_URL);
  check(
    "probe target is not under the product's own domain",
    !/(^|\.)wyfyguest\.com$/i.test(url.hostname),
    url.hostname,
  );
  // The generator's own list of OS connectivity-check hosts -- the ones a
  // venue is most likely to have allowed by hand. Read from source so the
  // two cannot drift.
  const generator = readFileSync(join(SRC, "components/routers/RouterDetailTabs.tsx"), "utf8");
  const pattern = /const CAPTIVE_DETECTION_HOST_PATTERN =\s*"([^"]+)"/.exec(generator)?.[1];
  check("found the generator's captive-detection host pattern", !!pattern);
  check(
    "probe target is not an OS captive-detection host",
    !!pattern && !new RegExp(pattern, "i").test(url.hostname),
    url.hostname,
  );
  check(
    "probe target is a hostname, not an address literal (the DoH drop list is addresses)",
    !/^[\d.]+$/.test(url.hostname) && !url.hostname.includes(":"),
    url.hostname,
  );
  check(
    "the probe can never hold the POST back longer than 1.5s",
    HOTSPOT_GATE_PROBE_TIMEOUT_MS <= 1_500,
    String(HOTSPOT_GATE_PROBE_TIMEOUT_MS),
  );
}

// --- 2. May this attempt probe at all? --------------------------------
check("a fresh session in a real browser may probe", hotspotGateProbeAllowed(env()) === true);
check(
  "never inside the Captive Network Assistant",
  hotspotGateProbeAllowed(env({ captiveSheet: true })) === false,
);
check(
  "never without a fetch implementation",
  hotspotGateProbeAllowed(env({ fetchImpl: undefined })) === false,
);
check(
  "never when a skip was already taken on this browser",
  hotspotGateProbeAllowed(env({ skippedBefore: () => true })) === false,
);
check(
  "never when reading the skip marker throws",
  hotspotGateProbeAllowed(
    env({
      skippedBefore: () => {
        throw new Error("SecurityError");
      },
    }),
  ) === false,
);
check(
  "never for a session past the window (the storage-free no-loop bound)",
  hotspotGateProbeAllowed(
    env({ sessionStartedAt: iso(HOTSPOT_GATE_PROBE_SESSION_WINDOW_MS + 1) }),
  ) === false,
);
check(
  "still allowed at the very edge of the window",
  hotspotGateProbeAllowed(env({ sessionStartedAt: iso(HOTSPOT_GATE_PROBE_SESSION_WINDOW_MS) })) ===
    true,
);
check(
  "never when the session start is in the device's future (clock behind)",
  hotspotGateProbeAllowed(env({ sessionStartedAt: iso(-60_000) })) === false,
);
for (const bad of [undefined, null, "", "not-a-date"]) {
  check(
    `never when the session start is ${JSON.stringify(bad)}`,
    hotspotGateProbeAllowed(env({ sessionStartedAt: bad })) === false,
  );
}

// --- 3. The request ---------------------------------------------------
{
  const e = env();
  const open = await probeHotspotGateOpen(e.fetchImpl, 40);
  check("a completed request reads as open", open === true);
  const { url, init } = e.calls[0] ?? {};
  check(
    "exactly one request, to the probe target",
    e.calls.length === 1 && url === HOTSPOT_GATE_PROBE_URL,
  );
  check(
    "sent no-cors, uncached, without credentials or referrer",
    init?.mode === "no-cors" &&
      init?.cache === "no-store" &&
      init?.credentials === "omit" &&
      init?.referrerPolicy === "no-referrer",
    JSON.stringify({ ...init, signal: undefined }),
  );
  check("carries an abort signal", typeof init?.signal?.aborted === "boolean");
}
check(
  "a rejected request reads as NOT open",
  (await probeHotspotGateOpen(() => Promise.reject(new TypeError("Failed to fetch")), 40)) ===
    false,
);
check(
  "a fetch that throws synchronously reads as NOT open",
  (await probeHotspotGateOpen(() => {
    throw new Error("boom");
  }, 40)) === false,
);
check(
  "a fetch that returns a non-promise does not throw",
  typeof (await probeHotspotGateOpen(() => undefined, 40)) === "boolean",
);
{
  let signal;
  const started = Date.now();
  const open = await probeHotspotGateOpen((_url, init) => {
    signal = init.signal;
    return never(); // ignores its abort signal entirely
  }, 60);
  const took = Date.now() - started;
  check("a request that never settles reads as NOT open", open === false);
  check("...and gives up at the timeout even if fetch ignores the abort", took < 500, `${took}ms`);
  check("...and the request is aborted", signal?.aborted === true);
}
{
  // Late success after the timeout must not flip the answer.
  let release;
  const p = probeHotspotGateOpen(() => new Promise((r) => (release = r)), 30);
  const open = await p;
  release({ type: "opaque" });
  await new Promise((r) => setTimeout(r, 5));
  check("an answer arriving after the timeout stays NOT open", open === false);
}

// --- 4. The whole decision -------------------------------------------
{
  const e = env();
  check("open + recorded => skip the POST", (await hotspotGateAlreadyOpen(e)) === true);
  check("the skip was recorded exactly once", e.recorded.length === 1);
}
{
  const e = env({ fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")) });
  check("request failed => POST", (await hotspotGateAlreadyOpen(e)) === false);
  check("a failed probe records no skip", e.recorded.length === 0);
}
check(
  "request timed out => POST",
  (await hotspotGateAlreadyOpen(env({ fetchImpl: never }))) === false,
);
check(
  "open but the marker did not read back => POST",
  (await hotspotGateAlreadyOpen(env({ recordSkip: () => false }))) === false,
);
check(
  "open but recording the marker throws => POST, and nothing escapes",
  (await hotspotGateAlreadyOpen(
    env({
      recordSkip: () => {
        throw new Error("SecurityError");
      },
    }),
  )) === false,
);
check(
  "a truthy non-boolean from recordSkip is not a yes",
  (await hotspotGateAlreadyOpen(env({ recordSkip: () => "ok" }))) === false,
);
for (const [name, overrides] of [
  ["inside the CNA", { captiveSheet: true }],
  ["after an earlier skip", { skippedBefore: () => true }],
  ["for an old session", { sessionStartedAt: iso(HOTSPOT_GATE_PROBE_SESSION_WINDOW_MS + 1) }],
]) {
  const e = env(overrides);
  const open = await hotspotGateAlreadyOpen(e);
  check(`${name}: POST, and no request is ever sent`, open === false && e.calls.length === 0);
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
