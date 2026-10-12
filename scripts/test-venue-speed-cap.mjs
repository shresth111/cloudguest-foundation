/**
 * Total venue speed, and the form it sits on -- executed, not read for shapes.
 *
 * Guest WiFi Limits has shipped the same defect several times over: a control
 * that was accepted, stored, read back, shown as active, and either reached
 * nothing or was quietly overwritten by a later save. Every one of them was a
 * number computed inline in a click handler where no test could call it. So
 * the code that decides what "Total venue speed" writes, and what the form
 * shows for a venue that already has limits, lives in two pure modules and in
 * `bandwidthPolicyService`, and this file runs all three for real against a
 * fake backend that behaves like the policy API: a version is a WHOLE rules
 * object, and a read returns whatever the last version held.
 *
 * WHAT CAN GO WRONG, IN ORDER OF WHAT IT COSTS
 * ---------------------------------------------
 *   1. A CAP OF ZERO. On the per-guest keys 0 means unlimited. Sent on the
 *      venue keys by the same habit it would read as "this venue may use
 *      nothing". "No limit" must leave as `null`.
 *   2. THE SAVE THAT ERASES IT. Access Tiers and the bandwidth-policy manager
 *      write the same policy type through the same service and have never
 *      heard of the field. Their next unrelated save must not publish a
 *      version without it.
 *   3. THE CONTROL THAT SAVES AND DOES NOTHING. Where the venue's hardware
 *      cannot enforce a total the control is greyed and writes nothing; where
 *      the server did not keep the value the screen must say so, not show it.
 *   4. THE FORM THAT OPENS BLANK OVER SAVED LIMITS. Reported from a live
 *      venue: 40 Mbps / Unlimited devices / 24 hr saved, and the form showing
 *      "Choose bandwidth", "Choose devices per user", "Choose session
 *      timeout". Section 6 loads a policy of exactly that shape.
 *
 * Run: node scripts/test-venue-speed-cap.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

let failures = 0;
let passed = 0;
function check(name, ok, extra = "") {
  if (ok) {
    passed += 1;
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

// ---------------------------------------------------------------------------
// The fake policy backend. Reached through the stubbed `@/services/api`.
// ---------------------------------------------------------------------------
const backend = {
  policies: new Map(),
  calls: [],
  /** "keep"   stores the rules it is given, like a backend that has the field.
   *  "drop"   strips the venue keys, like a backend deployed before it.
   *  an object  is thrown from the version write, like a refusal. */
  mode: "keep",
  seq: 0,
  reset() {
    this.policies.clear();
    this.calls.length = 0;
    this.mode = "keep";
  },
  seed({ type, name, rules, active = true }) {
    const id = `pol-${++this.seq}`;
    this.policies.set(id, {
      id,
      organization_id: "org-1",
      policy_type: type,
      name,
      description: null,
      is_active: active,
      current_version_id: `${id}-v1`,
      created_by_user_id: null,
      created_at: "2026-10-11T17:36:48Z",
      updated_at: "2026-10-11T17:36:48Z",
      versions: [
        {
          id: `${id}-v1`,
          policy_id: id,
          version_number: 1,
          status: "published",
          rules,
          published_at: "2026-10-11T17:36:49Z",
          created_at: "2026-10-11T17:36:48Z",
        },
      ],
    });
    return id;
  },
  versionWrites() {
    return this.calls.filter((c) => c.method === "POST" && /\/versions$/.test(c.url));
  },
  lastRules() {
    return this.versionWrites().at(-1)?.body?.rules;
  },
};
globalThis.__venueCapBackend = backend;
globalThis.__venueCapApi = {
  async get(url, config) {
    backend.calls.push({ method: "GET", url });
    if (url === "/policies") {
      const type = config?.params?.policy_type;
      const items = [...backend.policies.values()].filter((p) => p.policy_type === type);
      return { data: { items, page: 1, page_size: 100, total_items: items.length } };
    }
    const one = url.match(/^\/policies\/([^/]+)$/);
    if (one) return { data: structuredClone(backend.policies.get(one[1])) };
    throw new Error(`fake backend: unhandled GET ${url}`);
  },
  async post(url, body) {
    backend.calls.push({ method: "POST", url, body: structuredClone(body ?? null) });
    if (url === "/policies") {
      const id = backend.seed({ type: body.policy_type, name: body.name, rules: {} });
      backend.policies.get(id).versions = [];
      return { data: structuredClone(backend.policies.get(id)) };
    }
    const version = url.match(/^\/policies\/([^/]+)\/versions$/);
    if (version) {
      if (typeof backend.mode === "object") throw backend.mode;
      const policy = backend.policies.get(version[1]);
      const rules = structuredClone(body.rules);
      if (backend.mode === "drop") {
        delete rules.venue_download_rate_kbps;
        delete rules.venue_upload_rate_kbps;
      }
      const v = {
        id: `${policy.id}-v${policy.versions.length + 1}`,
        policy_id: policy.id,
        version_number: policy.versions.length + 1,
        status: "draft",
        rules,
        published_at: null,
        created_at: "2026-10-12T05:00:00Z",
      };
      policy.versions.push(v);
      return { data: structuredClone(v) };
    }
    if (/\/publish$/.test(url) || /\/deactivate$/.test(url)) return { data: null };
    throw new Error(`fake backend: unhandled POST ${url}`);
  },
};

// ---------------------------------------------------------------------------
// Bundle the real modules.
// ---------------------------------------------------------------------------
const outdir = mkdtempSync(join(tmpdir(), "venue-speed-cap-"));
const entry = join(outdir, "entry.mjs");
const from = (rel) => JSON.stringify(join(ROOT, rel).replace(/\\/g, "/"));
writeFileSync(
  entry,
  [
    `export * from ${from("src/lib/venue-speed-cap.ts")};`,
    `export * from ${from("src/lib/guest-wifi-limits.ts")};`,
    `export { bandwidthPolicyService } from ${from("src/services/bandwidth-policy.service.ts")};`,
    `export { latestVersion } from ${from("src/services/policy-engine.ts")};`,
    `export { clientControlVerdict, CLIENT_CONTROL_IDS } from ${from("src/lib/omada-client-controls.ts")};`,
    `export { ARUBA_INSTANT_ON_VENDOR } from ${from("src/lib/router-vendors.ts")};`,
  ].join("\n"),
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      // The services import the axios client. It is replaced by a thin object
      // that forwards to the fake backend above, so the REAL service code
      // builds the REAL request and this file reads what was sent. `@/` is the
      // repo's alias; esbuild does not read tsconfig paths through a synthetic
      // entry point, so it is mapped here.
      name: "fake-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({
          path: "fake-api",
          namespace: "fake",
        }));
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          const hit = ["", ".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(isFile);
          return hit ? { path: hit } : undefined;
        });
        b.onLoad({ filter: /.*/, namespace: "fake" }, () => ({
          contents: [
            "export const api = {",
            "  get: (...a) => globalThis.__venueCapApi.get(...a),",
            "  post: (...a) => globalThis.__venueCapApi.post(...a),",
            "};",
            "export const crossOrganizationHeaders = () => undefined;",
          ].join("\n"),
          loader: "js",
        }));
      },
    },
  ],
});
const m = await import(`file://${outfile}`);
const svc = m.bandwidthPolicyService;

// The object `LocationPolicies.handleSave` passes to the service, built the
// way it builds it: `speedsToWrite()` for the two speeds, the form's label
// tables for the rest. `venueUsable: false` is the greyed control.
function saveInput({ id, name, bandwidth, venueChoice, heldRates, heldVenue, venueUsable = true }) {
  const rates = m.bandwidthRatesForChoice(bandwidth, heldRates);
  const venue = venueUsable ? m.venueRatesForChoice(venueChoice, heldVenue) : undefined;
  return {
    id,
    name,
    status: "active",
    downloadRateKbps: rates.down,
    uploadRateKbps: rates.up,
    venueDownloadRateKbps: venue?.down,
    venueUploadRateKbps: venue?.up,
    sessionTimeoutMinutes: 1440,
    idleTimeoutMinutes: 30,
    dailyLimitMinutes: null,
    dataLimit: null,
  };
}

// ---------------------------------------------------------------------------
console.log("\n1. the choices are the Bandwidth dropdown's, plus tiers for a whole venue");
// ---------------------------------------------------------------------------
eq("the default and first option is No limit", m.VENUE_SPEED_OPTIONS[0], "No limit");
eq("a blank form starts on No limit", m.blankLimitsForm().venueSpeed, "No limit");
for (const [label, kbps] of Object.entries(m.BANDWIDTH_KBPS)) {
  check(
    `per-guest preset ${label} is offered for the venue at the same rate`,
    m.VENUE_SPEED_KBPS[label] === kbps,
    `venue has ${m.VENUE_SPEED_KBPS[label]}, per-guest has ${kbps}`,
  );
}
check(
  "and there are tiers above the largest per-guest preset",
  Math.max(...Object.values(m.VENUE_SPEED_KBPS)) > Math.max(...Object.values(m.BANDWIDTH_KBPS)),
);
check(
  "every preset is inside the range the server accepts",
  Object.values(m.VENUE_SPEED_KBPS).every(
    (k) => k >= m.VENUE_SPEED_MIN_KBPS && k <= m.VENUE_SPEED_MAX_KBPS,
  ),
);

// ---------------------------------------------------------------------------
console.log("\n2. what a choice writes");
// ---------------------------------------------------------------------------
eq("No limit is null both ways, never 0", m.venueRatesForChoice("No limit", undefined), {
  down: null,
  up: null,
});
eq("a preset sets both directions", m.venueRatesForChoice("100 Mbps", undefined), {
  down: 102400,
  up: 102400,
});
const lopsided = { down: 204800, up: 102400 };
eq(
  "a stored pair that differs up/down shows its DOWNLOAD value",
  m.venueSpeedLabel(lopsided),
  "200 Mbps",
);
eq(
  "...and a save that leaves the dropdown there writes the pair back as held",
  m.venueRatesForChoice("200 Mbps", lopsided),
  lopsided,
);
eq("...while a different choice sets both", m.venueRatesForChoice("300 Mbps", lopsided), {
  down: 307200,
  up: 307200,
});
const custom = { down: 123456, up: 123456 };
eq("a stored rate that is not a preset is shown in Kbps", m.venueSpeedLabel(custom), "123456 Kbps");
check(
  "...and is offered as an option, so the select is not blank over a live cap",
  m.venueSpeedOptions(custom).includes("123456 Kbps"),
);
eq("...and survives an unrelated save", m.venueRatesForChoice("123456 Kbps", custom), custom);
check(
  "a venue with no stored cap gets exactly the presets",
  m.venueSpeedOptions(undefined).length === m.VENUE_SPEED_OPTIONS.length,
);
const uploadOnly = { down: null, up: 51200 };
eq(
  "a pair that caps upload only reads No limit, by the download convention",
  m.venueSpeedLabel(uploadOnly),
  "No limit",
);
eq(
  "...and saving No limit clears it rather than keeping a cap nobody can see",
  m.venueRatesForChoice("No limit", uploadOnly),
  { down: null, up: null },
);
eq("a 0 from the wire reads as no cap", m.venueRates(0, 0), { down: null, up: null });

// ---------------------------------------------------------------------------
console.log("\n3. the request the screen sends, and the answer it reads");
// ---------------------------------------------------------------------------
backend.reset();
let saved = await svc.save(
  saveInput({ name: "Sector 37", bandwidth: "40 Mbps", venueChoice: "100 Mbps" }),
  "org-1",
);
let rules = backend.lastRules();
console.log(`       POST /policies/{id}/versions  ${JSON.stringify({ rules })}`);
eq(
  "the venue total goes out on both keys",
  [rules.venue_download_rate_kbps, rules.venue_upload_rate_kbps],
  [102400, 102400],
);
eq(
  "beside the per-guest speed, untouched",
  [rules.download_rate_kbps, rules.upload_rate_kbps],
  [40960, 40960],
);
eq(
  "the read after the write returns it",
  [saved.venueDownloadRateKbps, saved.venueUploadRateKbps],
  [102400, 102400],
);
const policyId = saved.id;
const listed = (await svc.list("org-1")).find((p) => p.id === policyId);
eq(
  "and so does a fresh list, as the screen loads it",
  [listed.venueDownloadRateKbps, listed.venueUploadRateKbps],
  [102400, 102400],
);

saved = await svc.save(
  saveInput({
    id: policyId,
    name: "Sector 37",
    bandwidth: "40 Mbps",
    venueChoice: "No limit",
    heldRates: { down: 40960, up: 40960 },
    heldVenue: { down: 102400, up: 102400 },
  }),
  "org-1",
);
rules = backend.lastRules();
check(
  "No limit is sent as null -- the keys are present, and not 0",
  "venue_download_rate_kbps" in rules &&
    "venue_upload_rate_kbps" in rules &&
    rules.venue_download_rate_kbps === null &&
    rules.venue_upload_rate_kbps === null,
  JSON.stringify(rules),
);
eq(
  "and reads back as no cap",
  [saved.venueDownloadRateKbps, saved.venueUploadRateKbps],
  [null, null],
);

saved = await svc.save(
  {
    ...saveInput({
      id: policyId,
      name: "Sector 37",
      bandwidth: "40 Mbps",
      venueChoice: "No limit",
    }),
    venueDownloadRateKbps: 0,
    venueUploadRateKbps: 0,
  },
  "org-1",
);
rules = backend.lastRules();
eq(
  "a 0 handed to the service still leaves as null",
  [rules.venue_download_rate_kbps, rules.venue_upload_rate_kbps],
  [null, null],
);

// ---------------------------------------------------------------------------
console.log("\n4. a save that has no opinion does not erase it");
// ---------------------------------------------------------------------------
backend.reset();
const tierId = backend.seed({
  type: "bandwidth",
  name: "Sector 37",
  rules: {
    download_rate_kbps: 40960,
    upload_rate_kbps: 40960,
    venue_download_rate_kbps: 204800,
    venue_upload_rate_kbps: 102400,
  },
});
// The shape every other writer passes (CreateGroup.tsx, the bandwidth policy
// manager): no venue fields at all.
await svc.save(
  {
    id: tierId,
    name: "Sector 37",
    status: "active",
    downloadRateKbps: 20480,
    uploadRateKbps: 20480,
  },
  "org-1",
);
rules = backend.lastRules();
eq(
  "a writer that never heard of the field carries the stored pair forward",
  [rules.venue_download_rate_kbps, rules.venue_upload_rate_kbps],
  [204800, 102400],
);
eq("while its own change still lands", rules.download_rate_kbps, 20480);
check(
  "it read the policy before writing it",
  backend.calls.findIndex((c) => c.method === "GET" && c.url === `/policies/${tierId}`) <
    backend.calls.findIndex((c) => c.method === "POST" && /\/versions$/.test(c.url)),
);
// The greyed control on Guest WiFi Limits is the same case.
await svc.save(
  saveInput({
    id: tierId,
    name: "Sector 37",
    bandwidth: "20 Mbps",
    venueChoice: "No limit",
    venueUsable: false,
  }),
  "org-1",
);
rules = backend.lastRules();
eq(
  "a greyed control writes nothing: the stored pair stands",
  [rules.venue_download_rate_kbps, rules.venue_upload_rate_kbps],
  [204800, 102400],
);

backend.reset();
await svc.save(
  { name: "Gold tier", status: "active", downloadRateKbps: 20480, uploadRateKbps: 20480 },
  "org-1",
);
rules = backend.lastRules();
check(
  "a NEW policy from such a writer simply has no venue keys",
  !("venue_download_rate_kbps" in rules) && !("venue_upload_rate_kbps" in rules),
  JSON.stringify(rules),
);

// ---------------------------------------------------------------------------
console.log("\n5. when the server does not keep it, or refuses it");
// ---------------------------------------------------------------------------
backend.reset();
backend.mode = "drop";
const wanted = m.venueRatesForChoice("100 Mbps", undefined);
saved = await svc.save(
  saveInput({ name: "Sector 37", bandwidth: "40 Mbps", venueChoice: "100 Mbps" }),
  "org-1",
);
const stored = m.venueRates(saved.venueDownloadRateKbps, saved.venueUploadRateKbps);
check(
  "a server that drops the keys is caught by comparing the read to the request",
  !m.venueRatesEqual(wanted, stored),
);
eq(
  "and what the row then shows is what is stored, not what was chosen",
  m.venueSpeedLabel(stored),
  "No limit",
);
check("a kept value compares equal", m.venueRatesEqual(wanted, { down: 102400, up: 102400 }));

backend.reset();
backend.mode = {
  status: 422,
  code: "validation_error",
  message: "Validation failed",
  fieldErrors: { venue_download_rate_kbps: "Venue rate must be at least the per-guest rate." },
};
let thrown = null;
try {
  await svc.save(
    saveInput({ name: "Sector 37", bandwidth: "40 Mbps", venueChoice: "20 Mbps" }),
    "org-1",
  );
} catch (err) {
  thrown = err;
}
check("a refusal reaches the caller", thrown !== null);
eq(
  "the field's own message is what gets shown",
  m.venueSpeedServerError(thrown),
  "Venue rate must be at least the per-guest rate.",
);
eq(
  "a refusal reported against the whole rules object is still recognised",
  m.venueSpeedServerError({
    status: 422,
    message: "x",
    fieldErrors: { rules: "venue_upload_rate_kbps must be >= upload_rate_kbps" },
  }),
  "venue_upload_rate_kbps must be >= upload_rate_kbps",
);
eq(
  "so is one carried only in the message",
  m.venueSpeedServerError({ status: 400, message: "Venue speed is below the per-guest speed." }),
  "Venue speed is below the per-guest speed.",
);
eq(
  "a refusal about something else is not blamed on this field",
  m.venueSpeedServerError({
    status: 422,
    message: "Validation failed",
    fieldErrors: { name: "Required" },
  }),
  null,
);
eq(
  "nor is a dropped connection",
  m.venueSpeedServerError({
    status: null,
    code: "network_error",
    message: "Unable to reach the server",
  }),
  null,
);

eq(
  "below the per-guest speed is caught before the click",
  m.venueSpeedProblem({ down: 20480, up: 20480 }, { down: 40960, up: 40960 }),
  { code: "belowPerGuest", perGuest: "40 Mbps" },
);
eq(
  "equal to it is allowed",
  m.venueSpeedProblem({ down: 40960, up: 40960 }, { down: 40960, up: 40960 }),
  null,
);
eq(
  "an unlimited per-guest speed constrains nothing",
  m.venueSpeedProblem({ down: 10240, up: 10240 }, { down: 0, up: 0 }),
  null,
);
eq(
  "No limit is always allowed",
  m.venueSpeedProblem({ down: null, up: null }, { down: 81920, up: 81920 }),
  null,
);
eq(
  "each direction is checked on its own",
  m.venueSpeedProblem({ down: 102400, up: 10240 }, { down: 40960, up: 40960 }),
  { code: "belowPerGuest", perGuest: "40 Mbps" },
);
eq(
  "a stored value outside the server's range is named as that",
  m.venueSpeedProblem({ down: 512, up: 512 }, { down: 0, up: 0 }),
  { code: "range" },
);

// ---------------------------------------------------------------------------
console.log("\n6. the form opens on the venue's saved limits");
// ---------------------------------------------------------------------------
// The policies that were live at the venue the blank form was reported from.
backend.reset();
backend.seed({
  type: "bandwidth",
  name: "sector 37 d",
  rules: {
    priority: null,
    data_limit: null,
    login_hours: null,
    devices_per_user: null,
    upload_rate_kbps: 40960,
    burst_upload_kbps: null,
    burst_time_seconds: null,
    download_rate_kbps: 40960,
    burst_download_kbps: null,
    daily_limit_minutes: null,
    burst_threshold_kbps: null,
    idle_timeout_minutes: 30,
    session_timeout_minutes: 1440,
  },
});
const deviceId = backend.seed({
  type: "device",
  name: "sector 37 d",
  rules: { require_known_device: false, max_devices_per_guest: 9999 },
});
const sessionId = backend.seed({
  type: "session",
  name: "sector 37 d",
  rules: {
    idle_timeout_minutes: 30,
    session_timeout_minutes: 1440,
    max_concurrent_sessions_per_guest: 20,
  },
});
const bw = (await svc.list("org-1"))[0];
const deviceRules = m.latestVersion(backend.policies.get(deviceId)).rules;
const sessionRules = m.latestVersion(backend.policies.get(sessionId)).rules;
// Exactly the arguments the screen's load effect passes.
const row = m.limitsRowFromSaved({
  id: bw.id,
  name: bw.name,
  downloadRateKbps: bw.downloadRateKbps,
  venue: m.venueRates(bw.venueDownloadRateKbps, bw.venueUploadRateKbps),
  sessionTimeoutMinutes: sessionRules.session_timeout_minutes ?? bw.sessionTimeoutMinutes,
  idleTimeoutMinutes: sessionRules.idle_timeout_minutes ?? bw.idleTimeoutMinutes,
  dailyLimitMinutes: bw.dailyLimitMinutes,
  maxDevices: deviceRules.max_devices_per_guest,
  dataLimit: null,
});
const decision = m.prefillDecision({ location: "sector 37 d", rows: [row], shownFor: null });
eq("choosing a venue that has limits fills the form", decision.kind, "fill");
const form = m.limitsFormFromRow(decision.row);
eq("Bandwidth shows 40 Mbps", form.bandwidth, "40 Mbps");
eq("Devices Per User shows Unlimited", form.devicesPerUser, "Unlimited");
eq("Session Timeout shows 24 hr", form.sessionTimeout, "24 hr");
eq("Idle Timeout shows 30 min", form.idleTimeout, "30 min");
eq("Maximum Daily Session Limit shows No Limit", form.dailyLimit, "No Limit");
eq("Total venue speed shows No limit", form.venueSpeed, "No limit");
for (const [control, value, options] of [
  ["Bandwidth", form.bandwidth, m.optionsWithCurrent(m.BANDWIDTH, form.bandwidth)],
  ["Devices Per User", form.devicesPerUser, m.optionsWithCurrent(m.DEVICES, form.devicesPerUser)],
  ["Session Timeout", form.sessionTimeout, m.SESSION_TIMEOUT],
  ["Idle Timeout", form.idleTimeout, m.IDLE_TIMEOUT],
  ["Maximum Daily Session Limit", form.dailyLimit, m.DAILY_LIMIT],
  ["Total venue speed", form.venueSpeed, m.venueSpeedOptions(undefined)],
]) {
  check(`${control}'s dropdown lists the value it is showing`, options.includes(value), value);
}
const blank = m.blankLimitsForm("sector 37 d");
check(
  "the blank form is what used to be shown instead: three required fields empty",
  blank.bandwidth === "" && blank.devicesPerUser === "" && blank.sessionTimeout === "",
);
check(
  "...and two that only LOOKED loaded, because the defaults matched this venue",
  blank.idleTimeout === form.idleTimeout && blank.dailyLimit === form.dailyLimit,
);
// A venue whose saved values are NOT the defaults is the one that would have
// been silently overwritten.
const other = m.limitsRowFromSaved({
  id: "pol-x",
  name: "Delhi",
  downloadRateKbps: 20480,
  venue: { down: 204800, up: 204800 },
  sessionTimeoutMinutes: 240,
  idleTimeoutMinutes: 10,
  dailyLimitMinutes: 120,
  maxDevices: 3,
  dataLimit: { quota: 2, unit: "GB", resets: "Daily" },
});
const otherForm = m.limitsFormFromRow(
  m.prefillDecision({ location: "Delhi", rows: [row, other], shownFor: m.prefillKey(row) }).row,
);
eq(
  "switching venue shows the other venue's own values",
  [
    otherForm.bandwidth,
    otherForm.venueSpeed,
    otherForm.sessionTimeout,
    otherForm.idleTimeout,
    otherForm.dailyLimit,
    otherForm.devicesPerUser,
  ],
  ["20 Mbps", "200 Mbps", "4 hr", "10 min", "2 hr", "3"],
);
eq("...including its data limit, which starts in a closed panel", otherForm.dataLimit, {
  quota: 2,
  unit: "GB",
  resets: "Daily",
});
eq(
  "a re-render does not refill over an edit in progress",
  m.prefillDecision({ location: "sector 37 d", rows: [row], shownFor: m.prefillKey(row) }).kind,
  "keep",
);
eq(
  "a venue with no limits does not inherit the last venue's",
  m.prefillDecision({ location: "Mumbai", rows: [row], shownFor: m.prefillKey(row) }).kind,
  "clear",
);
eq(
  "but the owner's own typing for a new venue is left alone",
  m.prefillDecision({ location: "Mumbai", rows: [row], shownFor: null }).kind,
  "keep",
);
eq(
  "a saved row replaced under a new id is shown again",
  m.prefillDecision({
    location: "sector 37 d",
    rows: [{ ...row, id: "pol-new" }],
    shownFor: m.prefillKey(row),
  }).kind,
  "fill",
);

eq(
  "a preset Bandwidth choice sets both directions",
  m.bandwidthRatesForChoice("40 Mbps", undefined),
  { down: 40960, up: 40960 },
);
eq(
  "Unlimited is 0 on the per-guest keys",
  m.bandwidthRatesForChoice("Unlimited", { down: 40960, up: 40960 }),
  { down: 0, up: 0 },
);
eq(
  "an untouched Bandwidth keeps an upload that differs",
  m.bandwidthRatesForChoice("40 Mbps", { down: 40960, up: 10240 }),
  { down: 40960, up: 10240 },
);
eq(
  "a stored rate outside the presets is no longer written as 0",
  m.bandwidthRatesForChoice("512 Kbps", { down: 512, up: 512 }),
  { down: 512, up: 512 },
);

// ---------------------------------------------------------------------------
console.log("\n7. where it can be offered");
// ---------------------------------------------------------------------------
const capability = (supported) => ({ supported, reason: null });
const caps = (venueRateLimit) => ({
  setRateLimit: capability(true),
  clearRateLimit: capability(true),
  block: capability(true),
  unblock: capability(true),
  listBlocked: capability(false),
  disconnect: capability(true),
  clientStats: capability(true),
  ...(venueRateLimit === undefined ? {} : { venueRateLimit: capability(venueRateLimit) }),
});
const verdict = (facts) => m.clientControlVerdict("venue-speed-limit", facts);
check("the control is one of the ladder's own", m.CLIENT_CONTROL_IDS.includes("venue-speed-limit"));
eq(
  "a router venue: available, nothing rendered beside it",
  verdict({ controllerManaged: false, vendor: null, capabilities: null, controller: null }),
  {
    control: "venue-speed-limit",
    availability: "available",
    reason: null,
  },
);
eq(
  "a controller venue that declares it: available",
  verdict({ controllerManaged: true, vendor: "omada", capabilities: caps(true), controller: null })
    .availability,
  "available",
);
const refusedVerdict = verdict({
  controllerManaged: true,
  vendor: "omada",
  capabilities: caps(false),
  controller: null,
});
eq(
  "a controller venue that declares it unsupported: greyed, one line",
  [refusedVerdict.availability, refusedVerdict.reason],
  ["unavailable", m.VENUE_SPEED_UNAVAILABLE],
);
eq(
  "a backend that does not send the capability at all: greyed, not live",
  verdict({
    controllerManaged: true,
    vendor: "omada",
    capabilities: caps(undefined),
    controller: null,
  }).availability,
  "unavailable",
);
eq(
  "a controller we could not ask: greyed",
  verdict({ controllerManaged: true, vendor: "omada", capabilities: null, controller: null })
    .availability,
  "unavailable",
);
eq(
  "a controller that is not answering: greyed even if it declared it",
  verdict({
    controllerManaged: true,
    vendor: "omada",
    capabilities: caps(true),
    controller: { reachable: false, checkedAt: null, reason: null },
  }).availability,
  "unavailable",
);
eq(
  "an access-point-only venue: greyed",
  verdict({
    controllerManaged: true,
    vendor: m.ARUBA_INSTANT_ON_VENDOR,
    capabilities: null,
    controller: null,
  }).availability,
  "unavailable",
);
check(
  "the capability is read off the wire under its own name",
  /venueRateLimit: toCapability\(body\.venue_rate_limit\)/.test(
    read("src/services/omada-client-controls.service.ts"),
  ),
);

// ---------------------------------------------------------------------------
console.log("\n8. the screen is wired to all of the above");
// ---------------------------------------------------------------------------
const stripComments = (src) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const screen = stripComments(read("src/components/features/LocationPolicies.tsx"));
const venueSelect = screen.match(/<Select\s+id="vs"[\s\S]*?\/>/)?.[0] ?? "";
check(
  "there is one Total venue speed dropdown",
  (screen.match(/<Select\s+id="vs"/g) ?? []).length === 1,
);
check(
  "it is greyed where the venue cannot enforce it",
  /disabled=\{!venueSpeedUsable\}/.test(venueSelect),
);
check("it is not a required field", !/\brequired\b/.test(venueSelect));
check(
  "its options include the venue's own stored value",
  /options=\{venueSpeedOptions\(savedVenueRates\[f\.businessUnit\]\)\}/.test(venueSelect),
);
check(
  "it sits in the same card as Bandwidth, after it",
  screen.indexOf('id="bw"') !== -1 &&
    screen.indexOf('id="bw"') < screen.indexOf('id="vs"') &&
    screen.indexOf('id="vs"') < screen.indexOf('id="st"'),
);
check(
  "its availability comes from the shared ladder",
  /clientControls\.verdict\("venue-speed-limit"\)/.test(screen),
);
check(
  "a greyed control passes no opinion to the service",
  /const venue = venueSpeedUsable\s*\?\s*venueRatesForChoice\(f\.venueSpeed, savedVenueRates\[f\.businessUnit\]\)\s*:\s*undefined/.test(
    screen,
  ),
);
check(
  "the save sends what was validated",
  /venueDownloadRateKbps: venue\?\.down,\s*venueUploadRateKbps: venue\?\.up/.test(screen),
);
check(
  "the row is built from the server's answer",
  /venueRates\(saved\.venueDownloadRateKbps, saved\.venueUploadRateKbps\)/.test(screen) &&
    /venueSpeed: venueSpeedLabel\(storedVenue\)/.test(screen),
);
check(
  "a value the server did not keep is reported",
  /!venueKept\s*\?\s*t\(\s*"venueSpeed\.notSaved"/.test(screen),
);
check(
  "the server's refusal lands under the field",
  /venueSpeedServerError\(err\)/.test(screen) && /venueSpeed: refused/.test(screen),
);
check(
  "the table does not restate a total nothing applies",
  /venueSpeedUsable\s*\?\s*p\.venueSpeed\s*:\s*t\("venueSpeed\.notApplied"/.test(screen),
);
check(
  "the form is filled by the chosen venue, not only by the pencil",
  /prefillDecision\(\{\s*location: f\.businessUnit,\s*rows: policies,\s*shownFor: shownFor\.current,?\s*\}\)/.test(
    screen,
  ) && /\}, \[f\.businessUnit, policies, showRow\]\);/.test(screen),
);
check("the screen builds its rows with the tested mapper", /limitsRowFromSaved\(\{/.test(screen));
check(
  "and keeps no private copy of the choice tables",
  !/const (BANDWIDTH|BANDWIDTH_KBPS|SESSION_TIMEOUT|DEVICES|DAILY_LIMIT)\b/.test(screen),
);

// ---------------------------------------------------------------------------
console.log("\n9. the words");
// ---------------------------------------------------------------------------
const en = JSON.parse(read("src/lib/i18n/locales/en/accessRules.json"));
const hi = JSON.parse(read("src/lib/i18n/locales/hi/accessRules.json"));
const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
const enFlat = Object.fromEntries(flatten(en));
const hiFlat = Object.fromEntries(flatten(hi));
eq("English and Hindi carry the same keys", Object.keys(hiFlat).sort(), Object.keys(enFlat).sort());
check(
  "no Hindi string was left as the English one",
  Object.keys(enFlat)
    .filter((k) => /^(venueSpeed\.|limitsApplyNote)/.test(k))
    .every((k) => hiFlat[k] && hiFlat[k] !== enFlat[k]),
);
const placeholders = (s) => (String(s).match(/\{\{\w+\}\}/g) ?? []).sort();
check(
  "and every placeholder survives translation",
  Object.keys(enFlat).every(
    (k) => JSON.stringify(placeholders(enFlat[k])) === JSON.stringify(placeholders(hiFlat[k])),
  ),
);
// Every `t("key", "fallback")` on the screen must have that key, saying that.
const rawScreen = read("src/components/features/LocationPolicies.tsx");
const used = [...rawScreen.matchAll(/\bt\(\s*"([\w.]+)",\s*"((?:[^"\\]|\\.)*)"/g)].map((x) => [
  x[1],
  JSON.parse(`"${x[2]}"`),
]);
check("the screen asks for at least the nine new strings", used.length >= 9, String(used.length));
for (const [key, fallback] of used) {
  check(
    `"${key}" exists and matches its inline fallback`,
    enFlat[key] === fallback,
    `locale: ${JSON.stringify(enFlat[key])}`,
  );
}
for (const key of Object.keys(enFlat).filter((k) => /^(venueSpeed\.|limitsApplyNote)/.test(k))) {
  check(
    `"${key}" is used by the screen`,
    used.some(([k]) => k === key),
  );
}
check(
  "nothing an owner reads names the machinery",
  [...Object.values(enFlat), ...Object.values(hiFlat)].every(
    (s) => !/queue|mikrotik|routeros|wireguard|क्यू|माइक्रोटिक/i.test(String(s)),
  ),
);
check(
  "the caption says what the number is",
  /all guests together/.test(enFlat["venueSpeed.caption"]),
);
check(
  "the footnote no longer files speed under 'next time each guest connects'",
  /speed change reaches guests who are already online/i.test(enFlat.limitsApplyNote) &&
    !/Speed, timeouts and device count apply the next time/.test(enFlat.limitsApplyNote) &&
    !/Speed, timeouts and device count apply the next time/.test(screen),
);
check(
  "while timeouts, device count and the data limit keep their sentences",
  /Timeouts and device count apply the next time each guest connects/.test(
    enFlat.limitsApplyNote,
  ) && /A data limit is different/.test(enFlat.limitsApplyNote),
);
check(
  "the save toast agrees with the footnote about speed",
  /speed reaches guests online now/.test(screen) &&
    !/they take effect as each guest next connects/.test(screen),
);

// ---------------------------------------------------------------------------
console.log("\n10. Queue Management does not offer what nothing enforces");
// ---------------------------------------------------------------------------
const queue = stripComments(read("src/components/network/QueueManagement.tsx"));
const unenforced =
  queue.match(/UNENFORCED_TARGET_TYPES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
for (const target of ["organization", "location", "router"]) {
  check(`a new ${target} assignment is marked unenforced`, unenforced.includes(`"${target}"`));
}
check(
  "those options are disabled in the list",
  /disabled=\{UNENFORCED_TARGET_TYPES\.has\(t\)\}/.test(queue),
);
check(
  "the create button refuses them, default target included",
  /UNENFORCED_TARGET_TYPES\.has\(targetType\)\s*\}/.test(queue),
);
check(
  "and so does the submit itself",
  /async function submit\(\) \{\s*if \(UNENFORCED_TARGET_TYPES\.has\(targetType\)\) return;/.test(
    queue,
  ),
);
check(
  "the reason is on screen",
  /NOT_SUPPORTED_YET = "Not supported yet"/.test(queue) && /role="note"/.test(queue),
);
check(
  "existing assignments are still listed",
  /assignments\?\.rows\.map\(|assignments\.rows\.map\(/.test(queue),
);

console.log("");
if (failures) {
  console.log(`FAIL: ${failures} venue-speed-cap check(s) failed (${passed} passed).`);
  process.exit(1);
}
console.log(`PASS: all venue-speed-cap checks passed (${passed}).`);
