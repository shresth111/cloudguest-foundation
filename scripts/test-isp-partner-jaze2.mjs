/**
 * JAZE-2 network enforcement helpers (`src/lib/isp-partner/network.ts`): the
 * package policy form must send exactly what the backend's `PolicyRequest`
 * accepts (bounds, units, cross-field rules), and round-trip what it returns.
 * A wrong unit here is a wrong timeout on every subscriber of a package.
 *
 * Run: node scripts/test-isp-partner-jaze2.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-jaze2-"));
const outfile = join(outdir, "network.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/network.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const m = await import(outfile);

let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`,
  );
};

// clock maths
eq("0 -> 00:00", m.minuteToClock(0), "00:00");
eq("1439 -> 23:59", m.minuteToClock(1439), "23:59");
eq("1440 refused", m.minuteToClock(1440), "");
eq("23:00 -> 1380", m.clockToMinute("23:00"), 1380);
eq("7:05 -> 425", m.clockToMinute("7:05"), 425);
eq("24:00 refused", m.clockToMinute("24:00"), null);
eq("overnight label", m.boostWindowLabel(1380, 420), "23:00 → 07:00 (overnight)");
eq("no boost label", m.boostWindowLabel(null, null), "Off");

// The backend's defaults (PolicyRequest field defaults)
const DEFAULTS = {
  fup_limit_mb: null,
  fup_reset: "cycle",
  fup_fallback_speed_group_id: null,
  fup_exclude_upload: false,
  fup_carry_forward: false,
  boost_speed_group_id: null,
  boost_start_minute: null,
  boost_end_minute: null,
  validity_starts: "activation",
  queue_priority: null,
  mac_bind_count: 0,
  mac_restriction: false,
  ip_restriction: false,
  max_simultaneous: null,
  idle_timeout_s: null,
  hard_timeout_s: null,
};
const empty = m.formToPolicyBody(m.policyToForm(null));
eq("empty form -> backend defaults", empty, { ok: true, body: DEFAULTS });
eq(
  "body keys are exactly PolicyRequest's (extra=forbid)",
  Object.keys(empty.body).sort(),
  Object.keys(DEFAULTS).sort(),
);

// round trip of a full policy (units: idle minutes <-> seconds, hard hours <-> seconds)
const full = {
  ...DEFAULTS,
  fup_limit_mb: 102400,
  fup_reset: "month",
  fup_fallback_speed_group_id: "g-2m",
  fup_exclude_upload: true,
  fup_carry_forward: true,
  boost_speed_group_id: "g-200m",
  boost_start_minute: 1380,
  boost_end_minute: 420,
  validity_starts: "first_login",
  queue_priority: 3,
  mac_bind_count: 2,
  mac_restriction: true,
  ip_restriction: false,
  max_simultaneous: 2,
  idle_timeout_s: 900,
  hard_timeout_s: 86400,
};
const form = m.policyToForm(full);
eq("idle shown in minutes", form.idle_timeout_min, "15");
eq("hard shown in hours", form.hard_timeout_h, "24");
eq("round trip", m.formToPolicyBody(form), { ok: true, body: full });

const bad = (patch) => {
  const r = m.formToPolicyBody({ ...m.policyToForm(null), ...patch });
  return r.ok ? [] : Object.keys(r.errors).sort();
};
eq("fallback without limit refused", bad({ fup_fallback_speed_group_id: "g" }), [
  "fup_fallback_speed_group_id",
]);
eq("FUP 0 refused (ge=1)", bad({ fup_limit_mb: "0" }), ["fup_limit_mb"]);
eq("FUP 1.5 refused (int)", bad({ fup_limit_mb: "1.5" }), ["fup_limit_mb"]);
eq("boost needs all three", bad({ boost_speed_group_id: "g", boost_start: "23:00" }), [
  "boost_speed_group_id",
]);
eq(
  "boost start == end refused",
  bad({ boost_speed_group_id: "g", boost_start: "23:00", boost_end: "23:00" }),
  ["boost_end"],
);
eq("priority 9 refused (le=8)", bad({ queue_priority: "9" }), ["queue_priority"]);
eq("mac bind 17 refused (le=16)", bad({ mac_bind_count: "17" }), ["mac_bind_count"]);
eq("simultaneous 65 refused (le=64)", bad({ max_simultaneous: "65" }), ["max_simultaneous"]);
eq("idle 10081 min refused (le=7 d)", bad({ idle_timeout_min: "10081" }), ["idle_timeout_min"]);
eq("idle 1 min ok (ge=60 s)", bad({ idle_timeout_min: "1" }), []);
eq("hard 0.05 h refused (ge=300 s)", bad({ hard_timeout_h: "0.05" }), ["hard_timeout_h"]);
eq("hard 2161 h refused (le=90 d)", bad({ hard_timeout_h: "2161" }), ["hard_timeout_h"]);
eq("MAC restriction with 0 binds refused", bad({ mac_restriction: true }), ["mac_bind_count"]);
const half = m.formToPolicyBody({ ...m.policyToForm(null), hard_timeout_h: "0.5" });
eq("hard 0.5 h -> 1800 s", half.ok && half.body.hard_timeout_s, 1800);

// FUP / display
eq("used % with carry + topup", m.fupUsedPercent(1536, 1024, 512, 512), 75);
eq("used % capped", m.fupUsedPercent(5000, 1024), 100);
eq("no FUP -> null", m.fupUsedPercent(10, null), null);
eq("1024 MB -> 1 GB", m.formatMb(1024), "1 GB");
eq("1536 MB -> 1.5 GB", m.formatMb(1536), "1.5 GB");
eq("12.3 Mbps", m.formatBps(12_300_000), "12.3 Mbps");
eq("null bps", m.formatBps(null), "–");
eq("optical good tone", m.opticalTone("good"), "online");
eq("optical bad tone", m.opticalTone("bad"), "offline");
eq("event label", m.enforcementEventLabel({ kind: "fup_throttle" }).startsWith("FUP"), true);
eq("unknown event label", m.enforcementEventLabel({ kind: "new_kind" }), "new kind");
// ENFORCE-1: PPPoE refusals (detail starts "pppoe: ") read as refused logins
eq(
  "pppoe mac refusal label",
  m.enforcementEventLabel({ kind: "mac_reject", detail: "pppoe: AA:00:00:00:00:02" }),
  "PPPoE login refused: device MAC not bound",
);
eq(
  "pppoe concurrency label",
  m.enforcementEventLabel({ kind: "concurrency", detail: "pppoe: 1 live, limit 1" }),
  "PPPoE login refused: too many devices at once",
);
eq(
  "pppoe ip label",
  m.enforcementEventLabel({ kind: "ip_reject", detail: "pppoe: no static IP bound" }),
  "PPPoE login refused: no static IP assigned",
);
eq(
  "hotspot mac label unchanged",
  m.enforcementEventLabel({ kind: "mac_reject", detail: "AA:00:00:00:00:02" }),
  "Session ended: device MAC not bound",
);
eq(
  "pppoe non-refusal keeps its label",
  m.enforcementEventLabel({ kind: "mac_bound", detail: "pppoe: AA" }),
  "Device MAC bound",
);
eq(
  "string detail shown as is",
  m.enforcementEventDetail("pppoe: 1 live, limit 1"),
  "1 live, limit 1",
);
eq(
  "event detail skips objects",
  m.enforcementEventDetail({ mac: "AA", nested: { x: 1 }, n: null }),
  "mac: AA",
);

// MAC normalising (the backend accepts colon / dash / bare 12 hex)
eq("dash mac", m.normaliseMac("aa-bb-cc-dd-ee-ff"), "AA:BB:CC:DD:EE:FF");
eq("bare mac", m.normaliseMac("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
eq("short mac refused", m.normaliseMac("aa:bb:cc"), null);
eq("junk refused", m.normaliseMac("zz:bb:cc:dd:ee:ff"), null);

// summary
eq(
  "policy summary",
  m.policySummary({
    ...full,
    configured: true,
    fup_fallback_speed_group_name: "2M",
  }),
  [
    "FUP 100 GB/month → 2M",
    "Boost 23:00 → 07:00 (overnight)",
    "MAC ×2 locked",
    "2 at once",
    "Starts at first login",
  ],
);
eq("unconfigured summary empty", m.policySummary({ ...full, configured: false }), []);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
