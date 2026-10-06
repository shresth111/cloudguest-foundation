/**
 * Device Logs (Master console): the wording guards.
 *
 * FAILURE MODES THIS LOCKS DOWN
 *
 *   1. UNKNOWN READ AS QUIET. A router that was set up but has never sent a
 *      single line must not read like a router with nothing to report. That
 *      is the `awaiting_first_message` state, and its label must not be a
 *      count, "OK", or anything that sounds settled.
 *   2. A MISSING PRIORITY DRESSED AS "INFO". A syslog line without `<PRI>`
 *      has severity null; it must render "Unknown".
 *   3. AN UNMATCHED LINE BORROWING A NAME. A line whose source address
 *      matched no router must say so; its self-declared tag is not trusted.
 *   4. A WRITE REPORTED AS DONE BEFORE THE READ-BACK. "Not verified" (null)
 *      and "does not match" (false) must stay distinct from verified.
 *   5. The service must send the window as explicit bounds and the screen
 *      must be wired to the shared module (a correct helper wired to
 *      nothing is the same bug).
 *
 * Bundles the real module with esbuild and executes it (this repo has no
 * test runner -- see scripts/test-location-liveness.mjs).
 *
 * Run: node scripts/test-device-logs-presentation.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "device-logs-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/device-logs-presentation.ts")}";
   export { deviceLogParams } from "${p("src/services/deviceLogs.service.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": p("src") },
  // The service imports the axios client; only the pure param builder is
  // exercised here, so the client is stubbed rather than loaded.
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: "api", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export default {};",
          loader: "js",
        }));
      },
    },
  ],
});
const m = await import(`file://${outfile}`);

console.log("\nunknown is never quiet");
const awaiting = m.RECEIVING_STATE.awaiting_first_message;
check("awaiting-first-message has its own label", awaiting.label === "No message received yet");
check(
  "awaiting-first-message does not sound settled",
  !/\b(0|ok|quiet|healthy|no events)\b/i.test(awaiting.label),
  awaiting.label,
);
check("awaiting-first-message detail says unknown", /unknown/i.test(awaiting.detail));
const labels = Object.values(m.RECEIVING_STATE).map((s) => s.label);
check("five states, five distinct labels", new Set(labels).size === 5, labels.join(" | "));
check(
  "receiving is the only green state",
  Object.entries(m.RECEIVING_STATE)
    .filter(([, s]) => s.tone === "online")
    .map(([k]) => k)
    .join() === "receiving",
);
check(
  "feature-off names the env var",
  /CLOUDGUEST_DEVICE_LOGS_ENABLED/.test(m.RECEIVING_STATE.feature_off.detail),
);

console.log("\nseverity");
check("null severity is Unknown, not Info", m.severityLabel(null) === "Unknown");
check("out-of-range severity is Unknown", m.severityLabel(9) === "Unknown");
check("6 is Info", m.severityLabel(6) === "Info");
check("3 is Error", m.severityLabel(3) === "Error");
check("errors are red", m.severityTone(3) === "offline" && m.severityTone(0) === "offline");
check("warnings are amber", m.severityTone(4) === "warning");
check("unknown severity is neutral", m.severityTone(null) === "normal");
check("the first filter keeps everything", m.SEVERITY_FILTER_OPTIONS[0].value === "");

console.log("\nattribution");
check("a matched line has no note", m.attributionNote("tunnel_ip", "8a199617") === null);
const un = m.attributionNote("unattributed", "8a199617");
check("an unmatched line says so", /not matched/i.test(un ?? ""), un);
check("an unmatched line does not trust its tag", /not trusted/i.test(un ?? ""), un);
check(
  "a tag mismatch mentions the hub",
  /hub/i.test(m.attributionNote("tag_mismatch", "deadbeef") ?? ""),
);

console.log("\nread-back");
check("verified", m.verdictLabel(true).label === "Verified on the router");
check(
  "mismatch is not verified",
  m.verdictLabel(false).label !== m.verdictLabel(true).label &&
    m.verdictLabel(false).tone === "offline",
);
check(
  "never verified is its own state",
  m.verdictLabel(null).label === "Not verified" && m.verdictLabel(null).tone === "normal",
);

console.log("\ntime");
const NOW = Date.parse("2026-10-06T09:00:00Z");
check("never", m.formatAgo(null, NOW) === "never");
check("garbage is unknown", m.formatAgo("not a date", NOW) === "unknown");
check("minutes", m.formatAgo("2026-10-06T08:55:00Z", NOW) === "5 min ago");
check("hours", m.formatAgo("2026-10-06T06:00:00Z", NOW) === "3 h ago");
check("future clock is just now", m.formatAgo("2026-10-06T10:00:00Z", NOW) === "just now");

console.log("\nrequest params");
const base = {
  window: "24h",
  organizationId: "",
  locationId: "",
  routerId: "",
  maxSeverity: "",
  q: "",
  unattributed: false,
};
const params = m.deviceLogParams(base, NOW);
check(
  "window sent as explicit since/until",
  params.since === "2026-10-05T09:00:00.000Z" && params.until === "2026-10-06T09:00:00.000Z",
  JSON.stringify(params),
);
check("no severity filter by default", !("max_severity" in params));
check(
  "empty filters are not sent",
  !("organization_id" in params) && !("q" in params) && !("unattributed" in params),
);
const full = m.deviceLogParams(
  { ...base, window: "1h", routerId: "r1", maxSeverity: "4", q: "  login ", unattributed: true },
  NOW,
  "CUR",
);
check(
  "filters are sent",
  full.router_id === "r1" &&
    full.max_severity === "4" &&
    full.q === "login" &&
    full.unattributed === "true",
);
check("cursor is sent", full.cursor === "CUR");

console.log("\nwiring");
const screen = readFileSync(join(ROOT, "src/routes/master.device-logs.tsx"), "utf8");
const drawer = readFileSync(join(ROOT, "src/components/master/DeviceLogsRouterDrawer.tsx"), "utf8");
const shell = readFileSync(join(ROOT, "src/components/master/MasterShell.tsx"), "utf8");
const service = readFileSync(join(ROOT, "src/services/deviceLogs.service.ts"), "utf8");
check("screen uses the shared state labels", /RECEIVING_STATE\[r\.state\]/.test(screen));
check("screen uses severityLabel", /severityLabel\(e\.severity\)/.test(screen));
check("screen shows attribution notes", /attributionNote\(e\.attribution/.test(screen));
check(
  "drawer reports the read-back, not just the 200",
  /verified_ok/.test(drawer) && /toast\.warning/.test(drawer),
);
check("drawer shows the backend-rendered script", /d\.script\.join/.test(drawer));
check("nav item gated on device_logs.read", /"device-logs": \["device_logs\.read"\]/.test(shell));
check(
  "writes gated on device_logs.manage",
  /"device-logs\.manage": \["device_logs\.manage"\]/.test(shell),
);
check(
  "service talks to the platform prefix",
  /"\/platform\/device-logs"/.test(service) && !/\/internal\/device-logs/.test(service),
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
