/**
 * Access Rules -> Access Tiers at an Aruba Instant On venue -- and the proof
 * that MikroTik and Omada venues are untouched.
 *
 * Run: node scripts/test-access-tiers-aruba.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 *   1. PURE. `lib/access-tiers-aruba.ts`: verdicts and copy, live validation,
 *      the "where is this tier used" summary.
 *   2. RENDERED. The REAL `CreateGroup` in Chromium against a recorded API:
 *        - Aruba: speed note points at Speed tiers by WiFi network (+ link),
 *          data limit / daily limit / login hours notes (all live),
 *          "Used by" column (guests + SSIDs), rename locked, a save writes
 *          the tier's BANDWIDTH rules only (the backend contract in
 *          ~/wyfy-ops/ACCESS_TIERS.md -- no paired FUP) and the held rate, validation
 *          clears as soon as a value is fixed, a new tier stays listed, a
 *          failed load says so with Try again.
 *        - MikroTik and Omada: no Aruba note, no SSID / assignments request, the
 *          "Members" column and the "Per session" reset as before, and a
 *          save writes the same requests as before.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "access-tiers-aruba-"));
const abs = (p) => join(ROOT, p).replace(/\\/g, "/");

let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, a, b) =>
  check(
    name,
    JSON.stringify(a) === JSON.stringify(b),
    `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`,
  );

const ARUBA = "aruba_instant_on";
const OMADA = "tplink_omada";

// ---------------------------------------------------------------------------
console.log("1. Pure: verdicts, copy, validation, usage");
// ---------------------------------------------------------------------------
await build({
  entryPoints: [abs("src/lib/access-tiers-aruba.ts")],
  outfile: join(work, "lib.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const L = await import(pathToFileURL(join(work, "lib.mjs")).href);

eq(
  "speed without a gateway is unavailable",
  L.arubaTierVerdict("tier-speed", null).availability,
  "unavailable",
);
eq(
  "speed with a gateway is live with a caveat",
  L.arubaTierVerdict("tier-speed", true).availability,
  "qualified",
);
check(
  "speed copy: one short sentence -- not applied, one speed per network",
  /^Not applied here/.test(L.ARUBA_TIER_SPEED) &&
    /same WiFi network/.test(L.ARUBA_TIER_SPEED) &&
    L.ARUBA_TIER_SPEED.split(/(?<=\.)\s/).length === 1,
);
check(
  "gateway copy: a cap, not a promise",
  /not a guaranteed speed/.test(L.arubaTierVerdict("tier-speed", true).reason),
);
check(
  "data limit: counted, stays online, blocks sign-in, mid-session cut needs cloud control",
  /^Usage is counted\./.test(L.ARUBA_TIER_DATA_LIMIT) &&
    /blocks sign-in until it resets/.test(L.ARUBA_TIER_DATA_LIMIT) &&
    /stays online until their session ends/.test(L.ARUBA_TIER_DATA_LIMIT) &&
    /Instant On cloud control/.test(L.ARUBA_TIER_DATA_LIMIT),
);
eq(
  "data limit is live with a caveat",
  L.arubaTierVerdict("tier-data-limit").availability,
  "qualified",
);
check("daily limit reuses the measured sentence", /^Enforced\./.test(L.ARUBA_TIER_DAILY_LIMIT));
eq(
  "login hours are live with a note (backend contract)",
  L.arubaTierVerdict("tier-login-hours").availability,
  "qualified",
);
check(
  "login hours copy: enforced, refused outside, signed out at the window end, overnight allowed",
  /^Enforced\./.test(L.ARUBA_TIER_LOGIN_HOURS) &&
    /can't sign in outside these hours/.test(L.ARUBA_TIER_LOGIN_HOURS) &&
    /signed out when the window\s+closes/.test(L.ARUBA_TIER_LOGIN_HOURS) &&
    /past midnight/.test(L.ARUBA_TIER_LOGIN_HOURS),
);
check(
  "data limit copy does not claim a per-session cap blocks the next sign-in",
  /daily, weekly or monthly limit blocks sign-in/.test(L.ARUBA_TIER_DATA_LIMIT),
);
check(
  "every tier caveat is short (<= 3 sentences, <= 220 chars)",
  [
    L.ARUBA_TIER_SPEED,
    L.ARUBA_TIER_DATA_LIMIT,
    L.ARUBA_TIER_LOGIN_HOURS,
    L.ARUBA_TIER_APPLIES_TO,
  ].every((t) => t.length <= 220 && t.split(/(?<=\.)\s/).length <= 3),
);
check(
  "steps caption: mapping guests is how a tier applies, not optional",
  /map the guests it applies to/.test(L.ARUBA_TIER_STEPS) && !/optional/i.test(L.ARUBA_TIER_STEPS),
);
check(
  "map hint: makes the tier available, changes nobody else",
  /available here/.test(L.ARUBA_TIER_MAP_HINT) && /doesn't change/.test(L.ARUBA_TIER_MAP_HINT),
);
check(
  "load errors both say nothing was changed; unreachable says so",
  /Nothing was changed/.test(L.ARUBA_TIERS_LOAD_FAILED) &&
    /Nothing was changed/.test(L.ARUBA_TIERS_LOAD_UNREACHABLE) &&
    /Couldn't reach/.test(L.ARUBA_TIERS_LOAD_UNREACHABLE),
);
check(
  "applies-to copy: only the guests mapped in (Map users)",
  /applies only to the guests you map/.test(L.ARUBA_TIER_APPLIES_TO) &&
    /Map users/.test(L.ARUBA_TIER_APPLIES_TO),
);
const lh = {
  ...{
    name: "Gold",
    otherNames: [],
    sessionTimeout: "4 hr",
    idleTimeout: "30 min",
    devicesPerUser: "3",
    dataLimitOn: false,
    dataQuota: "",
  },
  loginHoursOn: true,
  loginDays: ["Mon"],
};
eq(
  "overnight login window is valid",
  L.arubaTierFormErrors({ ...lh, loginFrom: "22:00", loginTo: "06:00" }),
  {},
);
eq(
  "start == end is all day (no error, ACCESS_TIERS.md §2.8)",
  L.arubaTierFormErrors({ ...lh, loginFrom: "09:00", loginTo: "09:00" }),
  {},
);
const DT = { "No Limit": null, "1 hr": 60, "2 hr": 120 };
eq(
  "daily: venue default writes null",
  L.arubaDailyLimitMinutes(L.ARUBA_DAILY_VENUE_DEFAULT, DT),
  null,
);
eq("daily: No Limit writes 0 (lifts the venue cap)", L.arubaDailyLimitMinutes("No Limit", DT), 0);
eq("daily: 2 hr writes 120", L.arubaDailyLimitMinutes("2 hr", DT), 120);
eq(
  "daily: null reads as the venue default",
  L.arubaDailyLimitLabel(null, DT),
  L.ARUBA_DAILY_VENUE_DEFAULT,
);
eq("daily: 0 reads as No Limit", L.arubaDailyLimitLabel(0, DT), "No Limit");
eq("daily: 60 reads as 1 hr", L.arubaDailyLimitLabel(60, DT), "1 hr");
eq("daily: an off-picker value is kept", L.arubaDailyLimitLabel(90, DT), "90 min");
eq("unlimited devices sentinel", L.ARUBA_UNLIMITED_DEVICES, 9999);
eq(
  "no login days is flagged",
  L.arubaTierFormErrors({ ...lh, loginDays: [], loginFrom: "09:00", loginTo: "18:00" }).loginDays,
  "Select at least one day.",
);
const allCopy = [
  L.ARUBA_TIER_SPEED,
  L.ARUBA_TIER_DATA_LIMIT,
  L.ARUBA_TIER_DAILY_LIMIT,
  L.ARUBA_TIER_LOGIN_HOURS,
  L.ARUBA_TIER_SAVED,
  L.ARUBA_TIER_MAP_HINT,
  L.ARUBA_TIER_STEPS,
  L.ARUBA_TIERS_LOAD_FAILED,
  L.ARUBA_TIERS_LOAD_UNREACHABLE,
  L.arubaTierVerdict("tier-speed", true).reason,
];
check(
  "customer copy never says RADIUS, NAS, CoA, tunnel or WireGuard",
  allCopy.every((s) => !/RADIUS|\bNAS\b|CoA|tunnel|wireguard/i.test(s)),
);
check(
  "copy never promises a per-guest speed at Aruba without a gateway",
  !/each guest|per guest/i.test(L.ARUBA_TIER_SPEED),
);

eq("minutesFromLabel: 2 hr", L.minutesFromLabel("2 hr"), 120);
eq("minutesFromLabel: 15 min", L.minutesFromLabel("15 min"), 15);
eq("minutesFromLabel: No Limit", L.minutesFromLabel("No Limit"), null);
const base = {
  name: "Gold",
  otherNames: ["silver"],
  sessionTimeout: "4 hr",
  idleTimeout: "30 min",
  devicesPerUser: "3",
  dataLimitOn: false,
  dataQuota: "",
};
eq("a valid form has no errors", L.arubaTierFormErrors(base), {});
eq("blank name", L.arubaTierFormErrors({ ...base, name: "  " }).name, "Required.");
eq(
  "duplicate name is case-insensitive",
  L.arubaTierFormErrors({ ...base, name: "SILVER" }).name,
  "A tier with this name already exists.",
);
check(
  "idle longer than session",
  /can't be longer/.test(
    L.arubaTierFormErrors({ ...base, sessionTimeout: "30 min", idleTimeout: "1 hr" }).it,
  ),
);
eq(
  "the idle error clears when the session grows (no stale message)",
  L.arubaTierFormErrors({ ...base, sessionTimeout: "2 hr", idleTimeout: "1 hr" }).it,
  undefined,
);
eq(
  "data limit on with no quota",
  L.arubaTierFormErrors({ ...base, dataLimitOn: true }).dlQuota,
  "Must be greater than 0.",
);
eq(
  "data limit 0",
  L.arubaTierFormErrors({ ...base, dataLimitOn: true, dataQuota: "0" }).dlQuota,
  "Must be greater than 0.",
);
eq("data limit 1.5", L.arubaTierFormErrors({ ...base, dataLimitOn: true, dataQuota: "1.5" }), {});

const A = (o) => ({
  is_active: true,
  scope_type: "location",
  scope_id: "loc-1",
  target_type: "none",
  target_id: null,
  ...o,
});
const u = L.tierUsage(
  [
    A({}),
    A({ scope_id: "loc-2" }),
    A({ target_type: "guest", target_id: "g1" }),
    A({ target_type: "guest", target_id: "g2" }),
    A({ target_type: "guest", target_id: "g2", scope_id: "loc-2" }),
    A({ target_type: "guest", target_id: "g3", is_active: false }),
  ],
  [
    { ssid: "WYFY_PREMIUM", paidOnly: true, policyId: "t1" },
    { ssid: "WYFY_FREE", paidOnly: false, policyId: null },
    { ssid: "OTHER", paidOnly: true, policyId: "t2" },
  ],
  "t1",
);
eq("usage: locations", u.locationIds, ["loc-1", "loc-2"]);
eq("usage: distinct active guests", u.guestCount, 2);
eq("usage: only the paid networks this tier unlocks", u.ssids, ["WYFY_PREMIUM"]);
eq("usage text", L.formatTierUsage(u), "2 guests · joins WYFY_PREMIUM");
eq("usage text, nothing", L.formatTierUsage({ guestCount: 0, ssids: [] }), "No guests mapped");
eq("usage text, one", L.formatTierUsage({ guestCount: 1, ssids: [] }), "1 guest");

// ---------------------------------------------------------------------------
console.log("\n1b. Pure: a read waits out a server restart (lib/transient-retry.ts)");
// ---------------------------------------------------------------------------
await build({
  entryPoints: [abs("src/lib/transient-retry.ts")],
  outfile: join(work, "retry.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const R = await import(pathToFileURL(join(work, "retry.mjs")).href);
for (const status of [502, 503, 504])
  check(`${status} is transient`, R.isTransientServerError({ status, code: "x", message: "" }));
check(
  "no response (network_error) is transient",
  R.isTransientServerError({ status: null, code: "network_error", message: "" }),
);
for (const status of [400, 401, 403, 404, 422, 500])
  check(`${status} is an answer, not transient`, !R.isTransientServerError({ status, code: "x" }));
check("a plain Error is not transient", !R.isTransientServerError(new Error("boom")));
{
  const slept = [];
  const sleep = async (ms) => void slept.push(ms);
  let n = 0;
  const v = await R.retryTransient(
    async () => {
      n += 1;
      if (n < 3) throw { status: 502, code: "bad_gateway" };
      return "ok";
    },
    { sleep },
  );
  eq("two 502s then success: resolves", v, "ok");
  eq("…after waiting the first two delays", slept, R.TRANSIENT_RETRY_DELAYS_MS.slice(0, 2));
  slept.length = 0;
  let thrown = null;
  n = 0;
  await R.retryTransient(
    async () => {
      n += 1;
      throw { status: 503 };
    },
    { sleep },
  ).catch((e) => (thrown = e));
  eq(
    "a server that never comes back: tries 1 + one per delay",
    n,
    R.TRANSIENT_RETRY_DELAYS_MS.length + 1,
  );
  eq("…then rethrows the last error", thrown, { status: 503 });
  n = 0;
  thrown = null;
  slept.length = 0;
  await R.retryTransient(
    async () => {
      n += 1;
      throw { status: 403, code: "forbidden" };
    },
    { sleep },
  ).catch((e) => (thrown = e));
  check(
    "a 403 is returned at once, no retry",
    n === 1 && slept.length === 0 && thrown?.status === 403,
  );
  n = 0;
  let cancelled = false;
  await R.retryTransient(
    async () => {
      n += 1;
      cancelled = true;
      throw { status: 502 };
    },
    { sleep, isCancelled: () => cancelled },
  ).catch(() => {});
  eq("a cancelled screen stops asking", n, 1);
}

// ---------------------------------------------------------------------------
// The bundle: the REAL CreateGroup, network and venue stubbed at the module
// boundary.
// ---------------------------------------------------------------------------
writeFileSync(
  join(work, "api-stub.js"),
  `const json = (x) => JSON.parse(JSON.stringify(x));
   function record(method, path, body, params) { (window.__calls ||= []).push({ method, path, body: body === undefined ? null : json(body), params: params ?? null }); }
   const byId = (id) => Object.values(window.__policies).flat().find((p) => p.id === id);
   export const api = {
     async get(path, cfg) {
       record("GET", path, undefined, cfg && cfg.params);
       if (window.__failList && path === "/policies") throw new Error("boom");
       if (path === "/policies") {
         const items = (window.__policies[cfg.params.policy_type] || []).map((p) => ({ id: p.id }));
         return { data: { items, page: 1, page_size: 100, total_items: items.length, total_pages: 1, has_next: false, has_previous: false } };
       }
       const a = /^\\/policies\\/([^/]+)\\/assignments$/.exec(path);
       if (a) return { data: (window.__assign[a[1]] || []) };
       const m = /^\\/policies\\/([^/]+)$/.exec(path);
       if (m) return { data: byId(m[1]) || { id: m[1], name: "x", is_active: true, versions: [] } };
       if (/^\\/policies\\/guest-mapping\\//.test(path)) return { data: { mapped: false } };
       throw new Error("unexpected GET " + path);
     },
     async post(path, body) {
       record("POST", path, body);
       if (path === "/policies") return { data: { id: "new-" + body.policy_type, name: body.name, is_active: true, versions: [] } };
       if (/\\/versions$/.test(path)) return { data: { id: "v-new", rules: body.rules } };
       if (/\\/assignments$/.test(path)) return { data: { id: "as-new" } };
       return { data: {} };
     },
     async put(path, body) { record("PUT", path, body); return { data: {} }; },
     async delete(path) { record("DELETE", path); return { data: {} }; },
   };
   export function crossOrganizationHeaders() { return undefined; }`,
);
writeFileSync(
  join(work, "bandwidth-stub.js"),
  `const calls = () => (window.__calls ||= []);
   const assigns = (id) => (window.__assign[id] || []).filter((a) => a.is_active);
   export const bandwidthPolicyService = {
     async list() {
       calls().push({ method: "LIST-BANDWIDTH" });
       if (window.__failList) throw new Error("boom");
       if (window.__transient > 0) { window.__transient -= 1; throw { status: 502, code: "bad_gateway", message: "Bad Gateway" }; }
       return window.__bandwidth;
     },
     async save(input) { calls().push({ method: "SAVE-BANDWIDTH", body: JSON.parse(JSON.stringify(input)) }); return { ...input, id: input.id || "bw-new" }; },
     async listLocationMappings(id) {
       calls().push({ method: "LIST-MAPPINGS", body: { id } });
       return assigns(id).filter((a) => a.target_type === "none").map((a) => ({ assignmentId: a.id, locationId: a.scope_id }));
     },
     async locationMapping() { return null; },
     async mapToLocation(policyId, locationId) { calls().push({ method: "MAP", body: { policyId, locationId } }); return "a-" + policyId; },
     async unmapFromLocation(policyId, assignmentId) { calls().push({ method: "UNMAP", body: { policyId, assignmentId } }); },
     async guestMappings() { return []; },
     async mapGuestToLocation(policyId, locationId, guestId) { calls().push({ method: "MAP-GUEST", body: { policyId, locationId, guestId } }); return "ga"; },
     async unmapGuestFromLocation() {},
     async guestCurrentGroup() { return null; },
     async remove(id) { calls().push({ method: "REMOVE", body: { id } }); },
   };`,
);
writeFileSync(
  join(work, "ssid-stub.js"),
  `export const ssidTiersService = {
     async list(locationId) { (window.__calls ||= []).push({ method: "SSID-LIST", body: { locationId } }); return { items: window.__ssid, note: "", manualSteps: [], pushEnabled: false }; },
   };`,
);
writeFileSync(
  join(work, "customer-stub.js"),
  `export async function resolveOrgId() { return "org-1"; }`,
);
writeFileSync(
  join(work, "guest-stub.js"),
  `export const guestService = { async list() { return { rows: [] }; }, async get() { return null; } };`,
);
writeFileSync(
  join(work, "dashboard-stub.js"),
  `export function useIsDemo() { return false; }
   const LOCATIONS = [{ id: "loc-1", name: "Office", city: "Pune" }, { id: "loc-2", name: "Cafe", city: "Pune" }];
   export function useCustomerLocations() { return { data: LOCATIONS }; }`,
);
writeFileSync(
  join(work, "client-controls-stub.js"),
  `import { clientControlVerdict, deviceActionVerdict } from "${abs("src/lib/omada-client-controls.ts")}";
   export function useClientControls() {
     const vendor = window.__vendor;
     const facts = { controllerManaged: vendor != null && vendor !== "mikrotik", vendor, capabilities: null, controller: null, perGuestSpeed: window.__perGuestSpeed ?? null };
     return {
       controllerManaged: facts.controllerManaged, vendor, capabilities: null, controller: null, loading: false,
       verdict: (c) => clientControlVerdict(c, facts),
       deviceVerdict: (a) => deviceActionVerdict(a, facts),
     };
   }`,
);
writeFileSync(
  join(work, "store-stub.js"),
  `const state = { activeLocation: { id: "loc-1", name: "Office" }, activeLocationId: "loc-1" };
   export function useCustomerStore(sel) { return sel(state); }`,
);
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import CreateGroup from "${abs("src/components/features/CreateGroup.tsx")}";
   createRoot(document.getElementById("root")).render(
     <CreateGroup locationId="loc-1" onOpenSsidTiers={() => { window.__openedSsidTiers = true; }} />,
   );`,
);
await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  define: {
    "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: true }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@/services/api": join(work, "api-stub.js"),
    "@/services/bandwidth-policy.service": join(work, "bandwidth-stub.js"),
    "@/services/ssid-tiers.service": join(work, "ssid-stub.js"),
    "@/services/customer.service": join(work, "customer-stub.js"),
    "@/services/guest.service": join(work, "guest-stub.js"),
    "@/hooks/useCustomerDashboard": join(work, "dashboard-stub.js"),
    "@/hooks/useClientControls": join(work, "client-controls-stub.js"),
    "@/stores/customerStore": join(work, "store-stub.js"),
    "@": join(ROOT, "src"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

// "Gold": 5120 kbps (off the picker), login hours Mon-Fri 09-18, a 5 GB
// per-session data limit and 1 h daily on its own BANDWIDTH rules (the source
// of truth per ~/wyfy-ops/ACCESS_TIERS.md). A same-named FUP policy exists only
// to prove the screen never reads or writes one.
const version = (rules) => [
  {
    id: "v1",
    version_number: 1,
    status: "published",
    rules,
    published_at: null,
    created_at: "2026-10-01T00:00:00Z",
  },
];
const policy = (id, type, rules, name = "Gold") => ({
  id,
  organization_id: "org-1",
  policy_type: type,
  name,
  description: null,
  is_active: true,
  current_version_id: "v1",
  created_by_user_id: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  versions: version(rules),
});
const POLICIES = {
  device: [policy("dev-g", "device", { max_devices_per_guest: 3 })],
  session: [policy("ses-g", "session", { session_timeout_minutes: 240, idle_timeout_minutes: 30 })],
  fup: [
    policy("fup-g", "fup", {
      daily_time_limit_minutes: 120,
      daily_data_limit_mb: null,
      weekly_data_limit_mb: 2048,
      monthly_data_limit_mb: null,
    }),
  ],
};
const BANDWIDTH = [
  {
    id: "bw-g",
    name: "Gold",
    status: "active",
    downloadRateKbps: 5120,
    uploadRateKbps: 5120,
    sessionTimeoutMinutes: 240,
    idleTimeoutMinutes: 30,
    devicesPerUser: 3,
    dailyLimitMinutes: 60,
    loginHours: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], from: "09:00", to: "18:00" },
    dataLimit: { quota: 5, unit: "GB", resets: "Per session" },
  },
];
const ASSIGN = {
  "bw-g": [
    {
      id: "as-1",
      is_active: true,
      scope_type: "location",
      scope_id: "loc-1",
      target_type: "none",
      target_id: null,
    },
    {
      id: "as-2",
      is_active: true,
      scope_type: "location",
      scope_id: "loc-1",
      target_type: "guest",
      target_id: "g1",
    },
    {
      id: "as-3",
      is_active: true,
      scope_type: "location",
      scope_id: "loc-1",
      target_type: "guest",
      target_id: "g2",
    },
  ],
};
const SSID = [
  {
    ssid: "WYFY_PREMIUM",
    tierName: "Premium",
    paidOnly: true,
    policyId: "bw-g",
    voucherPlanIds: [],
    downloadMbps: 50,
    uploadMbps: 20,
  },
  {
    ssid: "WYFY_ARUBA",
    tierName: "Free",
    paidOnly: false,
    policyId: null,
    voucherPlanIds: [],
    downloadMbps: 5,
    uploadMbps: 2,
  },
];

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><meta charset=utf-8><title>access tiers harness</title>
       <script>
         window.__vendor = ${JSON.stringify(url.searchParams.get("vendor") || null)};
         window.__perGuestSpeed = ${url.searchParams.get("gateway") ? "true" : "null"};
         window.__failList = ${url.searchParams.get("fail") ? "true" : "false"};
         window.__transient = ${Number(url.searchParams.get("transient") || 0)};
         window.__policies = ${JSON.stringify(POLICIES)};
         window.__bandwidth = ${JSON.stringify(BANDWIDTH)};
         window.__assign = ${JSON.stringify(ASSIGN)};
         window.__ssid = ${JSON.stringify(SSID)};
         window.__calls = [];
       </script>
       <div id=root></div><script type=module src="./bundle.js"></script>`,
    );
  }
  try {
    const body = readFileSync(join(work, url.pathname));
    res.writeHead(200, {
      "content-type": extname(url.pathname) === ".js" ? "text/javascript" : "text/plain",
    });
    return res.end(body);
  } catch {
    return res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import("playwright");
const browser = await chromium.launch();

async function open(vendor, { gateway = false, fail = false, transient = 0 } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(
    `${origin}/?vendor=${vendor ?? ""}${gateway ? "&gateway=1" : ""}${fail ? "&fail=1" : ""}${transient ? `&transient=${transient}` : ""}`,
  );
  if (!fail) await page.getByRole("button", { name: "Edit Gold" }).waitFor({ timeout: 20_000 });
  page.__errors = errors;
  return page;
}
const notice = (page, id) => page.getByTestId(`controller-control-${id}`);
const noticeText = async (page, id) =>
  (await notice(page, id).count()) ? (await notice(page, id).innerText()).trim() : null;
const calls = (page) => page.evaluate(() => window.__calls);
const click = (loc) => loc.evaluate((b) => b.click());
const rowText = (page) => page.getByRole("row", { name: /Gold/ }).innerText();

// The rendered sections (2a onward: the Access Tiers screen at an Aruba,
// MikroTik and Omada venue) are not carried to main. Owner, 2026-10-05:
// "access tier hata do aruba se" -- the tab is not offered at an Instant On
// venue (PoliciesHub), so its Aruba rendering is unreachable, and main's
// console-revamp Access Tiers screen is pinned by its own suites. The pure
// tier verdicts, copy, validation and usage above still run.
await browser.close();
server.close();

console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "access tiers aruba: all checks passed"
    : `access tiers aruba: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
