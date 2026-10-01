#!/usr/bin/env node
// =====================================================================
// GUEST CONNECTION RECORDS: AAA TIMELINE  +  SECURITY ACTIVITY
// =====================================================================
// Two new customer-facing logs (cloud-guest feat/aaa-and-security-logs):
//
//   * Guest Connection Records -> click a Guest Session Log row -> the
//     session's AAA timeline (GET /guest-sessions/{id}/timeline).
//   * Security Score -> "Security activity" (GET /security/activity).
//
// What this pins, worst-first:
//   1. Honesty: an unmeasured protection renders NO sentence (never "0"),
//      and a zero renders the zero sentence, not "Stopped 0 attempts".
//   2. The session id that opens a timeline is not a report column, so it is
//      neither shown nor exported in the Guest Session Log CSV.
//   3. Mapping: snake_case API -> the camelCase types the UI reads.
//   4. The timeline CSV goes through the shared formula-safe toCsv.
//   5. i18n: every new key exists in en AND hi; Hindi says मेहमान for guest.
//
// Run: node scripts/test-aaa-and-security-logs.mjs

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
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

// Bundle the pure modules; the api client is stubbed so nothing touches
// window/localStorage/axios at import time.
const outdir = mkdtempSync(join(tmpdir(), "aaa-logs-"));
const entry = join(outdir, "entry.mjs");
const src = (p) => join(ROOT, "src", p).replace(/\\/g, "/");
writeFileSync(
  entry,
  [
    `export { toSessionTimeline } from "${src("services/sessionTimeline.service.ts")}";`,
    `export { toActivity } from "${src("services/security.service.ts")}";`,
    `export { fmtBytes, fmtDuration, timelineCsv } from "${src("lib/session-timeline.ts")}";`,
    `export { activitySentence } from "${src("lib/security-activity.ts")}";`,
  ].join("\n"),
);
const stubApi = {
  name: "stub-api",
  setup(b) {
    b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: "api", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export const api = {};",
      loader: "js",
    }));
  },
};
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [stubApi],
  resolveExtensions: [".ts", ".tsx", ".js", ".mjs"],
});
const { toSessionTimeline, toActivity, fmtBytes, fmtDuration, timelineCsv, activitySentence } =
  await import(`file://${outfile}`);

// --- 1. honesty of the activity sentences ------------------------------------
console.log("\nsecurity activity sentences never invent a number");
const fakeT = (key, opts) => `${key}|${opts.n ?? ""}`;
const base = {
  key: "private_network",
  label: "Keep guests off your private network",
  source: "router",
  routersReporting: 1,
  routersTotal: 1,
  lastReadAt: null,
  topRules: [],
  unavailableReason: null,
  sentence: "backend sentence",
};
eq(
  "unavailable -> no sentence",
  activitySentence(fakeT, { ...base, available: false, count: null }),
  null,
);
eq(
  "zero -> zero sentence",
  activitySentence(fakeT, { ...base, available: true, count: 0 }),
  "securityActivity.zero.private_network|0",
);
eq(
  "count -> sentence with the count",
  activitySentence(fakeT, { ...base, available: true, count: 312 }),
  "securityActivity.sentence.private_network|312",
);

// --- 2. the session id is not a column --------------------------------------
console.log("\nthe drill-down id is not shown or exported");
const reports = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");
const cols = reports.slice(
  reports.indexOf('"guest-session-log": ['),
  reports.indexOf('"login-access-log": ['),
);
check("COLUMNS[guest-session-log] has no sessionId column", !cols.includes("sessionId"));
check("the row carries sessionId for the drill-down", /sessionId: s\.id \?\? null/.test(reports));
check(
  "a row only becomes clickable when it has a sessionId",
  /onRowSelect && r\.sessionId/.test(reports),
);
check(
  "login log prefers the plain-words reason",
  /failureReason: a\.failure_reason_text \?\? a\.failure_reason/.test(reports),
);
const nal = readFileSync(join(ROOT, "src/components/features/NetworkActivityLog.tsx"), "utf8");
check(
  "Guest Connection Records opens the timeline drawer",
  /GuestSessionTimelineDrawer/.test(nal) && /onRowSelect=/.test(nal),
);
const svc = readFileSync(join(ROOT, "src/services/sessionTimeline.service.ts"), "utf8");
check(
  "timeline calls the real endpoint",
  /\/guest-sessions\/\$\{encodeURIComponent\(sessionId\)\}\/timeline/.test(svc),
);
check("timeline sends the org header", /"X-Organization-Id": orgId/.test(svc));

// --- 3. mapping ---------------------------------------------------------------
console.log("\nAPI -> UI mapping");
const tl = toSessionTimeline({
  session_id: "s1",
  guest_identifier: "+91******21",
  authorization: {
    auth_method: "otp_sms",
    auth_method_text: "OTP by SMS",
    time_limit_minutes: 60,
    idle_timeout_minutes: 15,
    data_limit_mb: null,
    speed_limit: "2M/10M",
    router_checked: true,
  },
  accounting: {
    status: "disconnected",
    started_at: "2026-10-01T10:00:00Z",
    ended_at: "2026-10-01T11:00:00Z",
    duration_seconds: 3600,
    bytes_uploaded: 1000,
    bytes_downloaded: 2_500_000,
    device_ip: "10.5.50.23",
    device_mac: "AA:BB:CC:DD:EE:FF",
    nas_ip_address: null,
    nas_identifier: "cg-8a199617",
    router_name: "Hall Router",
    router_session_id: "81a00001",
    venue_public_ip: "103.248.87.30",
    end_reason_text: "The device left the WiFi.",
    router_reported: true,
  },
  entries: [
    {
      at: "2026-10-01T10:00:00Z",
      first_seen_at: null,
      phase: "authentication",
      kind: "portal_login_failed",
      outcome: "failure",
      title: "Sign-in failed on the WiFi login page",
      detail: "Wrong OTP entered.",
      repeat_count: 2,
      raw: { reason_code: "=cmd|' /C calc'!A0" },
    },
  ],
  notes: [],
});
eq("authorization mapped", tl.authorization.speedLimit, "2M/10M");
eq(
  "accounting mapped",
  [tl.accounting.venuePublicIp, tl.accounting.routerReported],
  ["103.248.87.30", true],
);
eq("entries mapped", [tl.entries[0].repeatCount, tl.entries[0].phase], [2, "authentication"]);

const act = toActivity({
  window: "24h",
  since: "a",
  until: "b",
  protections: [
    {
      key: "cloudflare_dns",
      label: "x",
      count: null,
      available: false,
      unavailable_reason: "shared",
      sentence: null,
      source: "cloudflare",
      routers_reporting: null,
      routers_total: 1,
      last_read_at: null,
      top_rules: [],
    },
  ],
  staff_changes: [
    {
      at: "t",
      action: "firewall_rule_created",
      summary: "Asha added a firewall rule.",
      description: null,
    },
  ],
  routers_total: 1,
  semantics: "s",
  generated_at: "g",
});
eq(
  "unavailable stays null, not 0",
  [act.protections[0].count, act.protections[0].unavailableReason],
  [null, "shared"],
);
eq("staff change summary mapped", act.staffChanges[0].summary, "Asha added a firewall rule.");

// --- 4. CSV + formatting ----------------------------------------------------
console.log("\ntimeline CSV and formatting");
const csv = timelineCsv(tl);
check("CSV header row", csv.startsWith("Time,Phase,Step,Detail,Times,Raw values"));
check("formula in a raw value is defused", !/,=cmd/.test(csv) && csv.includes("reason_code="), csv);
eq("bytes", [fmtBytes(999), fmtBytes(2_500_000), fmtBytes(null)], ["999 B", "2.5 MB", "—"]);
eq("duration", [fmtDuration(45), fmtDuration(600), fmtDuration(3900)], ["45s", "10 min", "1h 5m"]);

// --- 5. i18n parity -----------------------------------------------------------
console.log("\ni18n: en and hi carry the same keys");
const en = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/en/nav.json"), "utf8"));
const hi = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/hi/nav.json"), "utf8"));
const flat = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`],
  );
for (const ns of ["sessionTimeline", "securityActivity"]) {
  const a = flat(en[ns] ?? {}).sort();
  const b = flat(hi[ns] ?? {}).sort();
  check(`${ns}: en has keys`, a.length > 10, `${a.length}`);
  eq(`${ns}: hi has exactly en's keys`, b, a);
}
const hiText = JSON.stringify([hi.sessionTimeline, hi.securityActivity]);
check("hi uses मेहमान for guest", hiText.includes("मेहमान") && !hiText.includes("अतिथि"));
for (const k of Object.keys(en.securityActivity.sentence)) {
  check(
    `sentence.${k} interpolates {{n}} in both`,
    en.securityActivity.sentence[k].includes("{{n}}") &&
      hi.securityActivity.sentence[k].includes("{{n}}"),
  );
}

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
