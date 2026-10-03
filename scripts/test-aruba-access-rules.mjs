/**
 * Access Rules at an Aruba Instant On venue (customer dashboard).
 *
 * Run: node scripts/test-aruba-access-rules.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * An Instant On access point is a RADIUS NAS and nothing else -- no router
 * API, no controller API, no CoA into the venue's NAT. A rule reaches a guest
 * there only at the portal sign-in and in the RADIUS reply (Accept/Reject,
 * Session-Timeout, Idle-Timeout). Spec: ~/wyfy-ops/aruba-ap21/PM_SPEC.md §3.1
 * and §4; backend half: cloud-guest `tests/unit/test_aruba_access_rules.py`.
 *
 * Two halves:
 *
 *   1. PURE. `lib/nas-only-access-rules.ts` verdicts and copy, and that every
 *      vendor that is not NAS-only -- MikroTik, Omada, mixed, unreadable --
 *      gets `available` with a null reason for every id (renders nothing).
 *   2. RENDERED. The REAL `LocationPolicies` (Access Rules -> Guest WiFi
 *      Limits) mounted in Chromium against a recorded API, at an Aruba venue,
 *      a MikroTik venue and an Omada venue:
 *        - Aruba: data limit live with the V3 caveat (usage measured); idle / daily / session
 *          timeout live with their caveats; speed greyed with U1; footer and
 *          save toast say "next time each guest signs in"; and a save writes
 *          BACK the data cap and the speed the location already holds --
 *          a greyed control never writes "no limit".
 *        - MikroTik and Omada: none of the NAS-only notices render, the data
 *          limit opens, and the footer/toast are the pre-existing ones.
 *   3. WIRING. Source checks for the screens that are not rendered here:
 *      Access Tiers' held speed, Guest Allow-list's caveat, the Blocking
 *      toast.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "aruba-access-rules-"));
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const abs = (p) => join(ROOT, p).replace(/\\/g, "/");

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
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const ARUBA = "aruba_instant_on";
const OMADA = "tplink_omada";

// PM_SPEC §4, verbatim.
const U1 =
  "Speed limits for Aruba Instant On are set in the Instant On app, on the guest network. Wyfy can't change them.";
// U3a ("aren't available yet") retired: V3 usage reporting MEASURED on the
// AP21 (~/wyfy-ops/aruba-ap21/ACCESS_RULES.md sections 2-3).
const U3A_RETIRED = "Data limits aren't available on Aruba Instant On yet.";

// ---------------------------------------------------------------------------
console.log("1. Verdicts and copy (pure)");
// ---------------------------------------------------------------------------
await build({
  entryPoints: [abs("src/lib/nas-only-access-rules.ts")],
  outfile: join(work, "rules.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const R = await import(pathToFileURL(join(work, "rules.mjs")).href);
const IDS = ["data-limit", "idle-timeout", "daily-limit", "devices", "allow-list"];

for (const vendor of ["mikrotik", OMADA, null, undefined, ""]) {
  check(
    `${JSON.stringify(vendor)}: every limit is available with no sentence`,
    IDS.every((id) => {
      const v = R.nasOnlyLimitVerdict(id, vendor);
      return v.availability === "available" && v.reason === null && v.control === id;
    }),
  );
}
const at = (id) => R.nasOnlyLimitVerdict(id, ARUBA);
eq("Aruba: data limit is live with a caveat", at("data-limit").availability, "qualified");
check(
  "Aruba: data-limit caveat claims the measured half only",
  /Usage is counted/.test(at("data-limit").reason) &&
    /can't sign in again/.test(at("data-limit").reason) &&
    /stay online\s+until their session ends/.test(at("data-limit").reason) &&
    at("data-limit").reason !== U3A_RETIRED,
);
eq("Aruba: devices per user is plainly supported", at("devices").availability, "available");
eq("Aruba: idle timeout is live with a caveat", at("idle-timeout").availability, "qualified");
eq("Aruba: daily limit is live with a caveat", at("daily-limit").availability, "qualified");
eq("Aruba: allow-list is live with a caveat", at("allow-list").availability, "qualified");
eq(
  "vendor match is case-insensitive",
  R.nasOnlyLimitVerdict("data-limit", "ARUBA_INSTANT_ON").availability,
  "qualified",
);
const copy = [
  R.NAS_ONLY_DATA_LIMIT,
  R.NAS_ONLY_IDLE_TIMEOUT,
  R.NAS_ONLY_DAILY_LIMIT,
  R.NAS_ONLY_ALLOW_LIST,
  R.NAS_ONLY_LIMITS_FOOTER,
];
check(
  "customer copy never says RADIUS, NAS, CoA, tunnel or controller",
  copy.every((s) => !/RADIUS|\bNAS\b|CoA|tunnel|controller/i.test(s)),
);
check(
  "customer copy names the product",
  copy.every((s) => s.includes("Aruba Instant On")),
);
check(
  "the daily-limit caveat promises the sign-in half and hedges the live half",
  /can't sign\s+in again/.test(R.NAS_ONLY_DAILY_LIMIT) &&
    /hasn't been confirmed/.test(R.NAS_ONLY_DAILY_LIMIT),
);

const KBPS = { "10 Mbps": 10240, "20 Mbps": 20480 };
eq("held speed: a picker label", R.heldKbpsFromLabel("20 Mbps", KBPS), 20480);
eq("held speed: an off-picker rate survives", R.heldKbpsFromLabel("5120 Kbps", KBPS), 5120);
eq("held speed: Unlimited is 0", R.heldKbpsFromLabel("Unlimited", KBPS), 0);
eq("held speed: blank is 0", R.heldKbpsFromLabel("", KBPS), 0);

// ---------------------------------------------------------------------------
// The bundle: the REAL LocationPolicies, with the network and the venue
// stubbed at the module boundary.
// ---------------------------------------------------------------------------
writeFileSync(
  join(work, "api-stub.js"),
  `const json = (x) => JSON.parse(JSON.stringify(x));
   function record(method, path, body) { (window.__calls ||= []).push({ method, path, body: body === undefined ? null : json(body) }); }
   const listFor = (type) => ({ items: (window.__policies[type] || []).map((p) => ({ id: p.id })), page: 1, page_size: 100, total_items: 1, total_pages: 1, has_next: false, has_previous: false });
   const byId = (id) => Object.values(window.__policies).flat().find((p) => p.id === id);
   export const api = {
     async get(path, cfg) {
       record("GET", path);
       if (path === "/policies") return { data: listFor(cfg.params.policy_type) };
       const m = /^\\/policies\\/([^/]+)$/.exec(path);
       if (m) return { data: byId(m[1]) || { id: m[1], name: "x", is_active: true, versions: [] } };
       throw new Error("unexpected GET " + path);
     },
     async post(path, body) {
       record("POST", path, body);
       if (path === "/policies") return { data: { id: "new-" + body.policy_type } };
       if (/\\/versions$/.test(path)) return { data: { id: "v-new", rules: body.rules } };
       return { data: {} };
     },
     async put(path, body) { record("PUT", path, body); return { data: {} }; },
     async delete(path) { record("DELETE", path); return { data: {} }; },
   };
   export function crossOrganizationHeaders() { return undefined; }`,
);
writeFileSync(
  join(work, "bandwidth-stub.js"),
  `export const bandwidthPolicyService = {
     async list() { return window.__bandwidth; },
     async save(input) { (window.__calls ||= []).push({ method: "SAVE-BANDWIDTH", body: JSON.parse(JSON.stringify(input)) }); return { ...input, id: input.id || "bw-new" }; },
     async mapToLocation(policyId, locationId) { (window.__calls ||= []).push({ method: "MAP", body: { policyId, locationId } }); return "a-1"; },
     async remove() {},
   };`,
);
writeFileSync(
  join(work, "customer-stub.js"),
  `export async function resolveOrgId() { return "org-1"; }`,
);
writeFileSync(
  join(work, "dashboard-stub.js"),
  `export function useIsDemo() { return false; }
   // One array for the life of the page, as react-query's cached data is: a
   // fresh array per render re-runs the screen's load effect on every render.
   const LOCATIONS = [{ id: "loc-1", name: "Office" }];
   export function useCustomerLocations() { return { data: LOCATIONS }; }`,
);
writeFileSync(
  join(work, "client-controls-stub.js"),
  `import { clientControlVerdict, deviceActionVerdict } from "${abs("src/lib/omada-client-controls.ts")}";
   export function useClientControls() {
     const vendor = window.__vendor;
     const facts = { controllerManaged: vendor != null, vendor, capabilities: null, controller: null };
     return {
       controllerManaged: facts.controllerManaged, vendor, capabilities: null, controller: null, loading: false,
       verdict: (c) => clientControlVerdict(c, facts),
       deviceVerdict: (a) => deviceActionVerdict(a, facts),
     };
   }`,
);
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import LocationPolicies from "${abs("src/components/features/LocationPolicies.tsx")}";
   createRoot(document.getElementById("root")).render(<LocationPolicies locationId="loc-1" />);`,
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
    "@/services/customer.service": join(work, "customer-stub.js"),
    "@/hooks/useCustomerDashboard": join(work, "dashboard-stub.js"),
    "@/hooks/useClientControls": join(work, "client-controls-stub.js"),
    "@": join(ROOT, "src"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

// The location "Office" already holds: 5120 kbps (off the picker), a 2 GB
// daily data cap, 4 h sessions, 15 min idle, 3 devices.
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
const policy = (id, type, rules) => ({
  id,
  organization_id: "org-1",
  policy_type: type,
  name: "Office",
  description: null,
  is_active: true,
  current_version_id: "v1",
  created_by_user_id: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  versions: version(rules),
});
const POLICIES = {
  device: [policy("dev-1", "device", { max_devices_per_guest: 3 })],
  session: [policy("ses-1", "session", { session_timeout_minutes: 240, idle_timeout_minutes: 15 })],
  fup: [
    policy("fup-1", "fup", {
      daily_time_limit_minutes: null,
      daily_data_limit_mb: 2048,
      weekly_data_limit_mb: null,
      monthly_data_limit_mb: null,
    }),
  ],
};
const BANDWIDTH = [
  {
    id: "bw-1",
    name: "Office",
    status: "active",
    downloadRateKbps: 5120,
    uploadRateKbps: 5120,
    sessionTimeoutMinutes: null,
    idleTimeoutMinutes: null,
    dailyLimitMinutes: null,
    dataLimit: null,
  },
];

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><meta charset=utf-8><title>access rules harness</title>
       <script>
         window.__vendor = ${JSON.stringify(url.searchParams.get("vendor") || null)};
         window.__policies = ${JSON.stringify(url.searchParams.get("empty") ? {} : POLICIES)};
         window.__bandwidth = ${JSON.stringify(url.searchParams.get("empty") ? [] : BANDWIDTH)};
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

async function open(vendor, { empty = false } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/?vendor=${vendor ?? ""}${empty ? "&empty=1" : ""}`);
  await page.getByRole("button", { name: "Edit Office" }).waitFor({ timeout: 10_000 });
  page.__errors = errors;
  return page;
}
const notice = (page, id) => page.getByTestId(`controller-control-${id}`);
const noticeText = async (page, id) =>
  (await notice(page, id).count()) ? (await notice(page, id).innerText()).trim() : null;
const dataLimitButton = (page) => page.getByRole("button", { name: /Add a data limit/ });
async function editAndSave(page) {
  // DOM click: handleEdit smooth-scrolls the window, which Playwright's
  // actionability wait can sit on for the whole timeout.
  await page.getByRole("button", { name: "Edit Office" }).evaluate((b) => b.click());
  await page.getByText("Edit Guest WiFi Limits — Office").waitFor({ timeout: 10_000 });
  await page.selectOption("#st", "1 hr");
  await page.selectOption("#it", "15 min");
  await page.selectOption("#dp", "2");
  await page.evaluate(() => (window.__calls = []));
  await page.getByRole("button", { name: "Save changes" }).evaluate((b) => b.click());
  await page.getByText(/Limits saved for Office/).waitFor({ timeout: 10_000 });
  return page.evaluate(() => window.__calls);
}
const fupRulesWritten = (calls) =>
  calls.find((c) => c.method === "POST" && c.path === "/policies/fup-1/versions")?.body?.rules;
const sessionRulesWritten = (calls) =>
  calls.find((c) => c.method === "POST" && c.path === "/policies/ses-1/versions")?.body?.rules;
const bandwidthWritten = (calls) => calls.find((c) => c.method === "SAVE-BANDWIDTH")?.body;

// ---------------------------------------------------------------------------
console.log("\n2a. Guest WiFi Limits at an Aruba Instant On venue (rendered)");
// ---------------------------------------------------------------------------
{
  const page = await open(ARUBA);
  const root = () => page.locator("#root").innerText();

  check("the data limit can be opened", !(await dataLimitButton(page).isDisabled()));
  eq(
    "the data limit carries its caveat",
    await noticeText(page, "data-limit"),
    R.NAS_ONLY_DATA_LIMIT,
  );
  eq(
    "the data-limit notice is the live-with-caveat kind",
    await notice(page, "data-limit").getAttribute("data-availability"),
    "qualified",
  );
  check(
    "the controller-venue 'signed out' paragraph is not shown at Aruba",
    !(await page.locator("#root").innerText()).includes("the controller cuts the device off"),
  );
  check("no speed input at all (not a greyed one)", (await page.locator("#bw").count()) === 0);
  eq("speed says U1", await noticeText(page, "speed-limit"), U1);
  check("idle timeout stays live", !(await page.locator("#it").isDisabled()));
  eq(
    "idle timeout carries its caveat",
    await noticeText(page, "idle-timeout"),
    R.NAS_ONLY_IDLE_TIMEOUT,
  );
  check("daily limit stays live", !(await page.locator("#dl").isDisabled()));
  eq(
    "daily limit carries its caveat",
    await noticeText(page, "daily-limit"),
    R.NAS_ONLY_DAILY_LIMIT,
  );
  check(
    "session timeout carries the V1 caveat",
    /hasn't been confirmed/.test((await noticeText(page, "session-timeout")) ?? ""),
  );
  check("devices per user has no notice", (await notice(page, "devices").count()) === 0);
  check("devices per user stays live", !(await page.locator("#dp").isDisabled()));
  check("the footer is the NAS-only sentence", (await root()).includes(R.NAS_ONLY_LIMITS_FOOTER));
  check(
    "the footer does not promise a data limit can sign someone out",
    !(await root()).includes("can sign someone out within minutes"),
  );
  check(
    "the table has no Bandwidth column and shows the saved data cap",
    (await page.getByRole("columnheader", { name: "Bandwidth" }).count()) === 0 &&
      (await page.getByRole("columnheader", { name: "Data Limit" }).count()) === 1 &&
      (await root()).includes("2 GB / Daily"),
  );
  eq(
    "the preselected location's saved session length is prefilled",
    await page.locator("#st").inputValue(),
    "4 hr",
  );
  eq("the saved idle timeout is prefilled", await page.locator("#it").inputValue(), "15 min");
  eq("the saved device count is prefilled", await page.locator("#dp").inputValue(), "3");
  check(
    "a saved row can be deleted",
    (await page.getByRole("button", { name: "Delete Office" }).count()) === 1,
  );

  const calls = await editAndSave(page);
  const fup = fupRulesWritten(calls);
  eq("save keeps the 2 GB daily cap the open panel shows", fup?.daily_data_limit_mb, 2048);
  eq("save leaves the daily time limit as chosen (No Limit)", fup?.daily_time_limit_minutes, null);
  eq(
    "save writes the chosen session length",
    sessionRulesWritten(calls)?.session_timeout_minutes,
    60,
  );
  const bw = bandwidthWritten(calls);
  check(
    "save writes the held speed back (5120 kbps), not 0",
    bw?.downloadRateKbps === 5120 && bw?.uploadRateKbps === 5120,
    JSON.stringify(bw),
  );
  check(
    "the toast says 'next time each guest signs in', and nothing about guests online now",
    (await root()).includes("they take effect the next time each guest signs in") &&
      !(await root()).includes("applies to guests online now"),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n2a'. Aruba venue with nothing saved yet: defaults, not 'No policies yet'");
// ---------------------------------------------------------------------------
{
  const page = await open(ARUBA, { empty: true });
  const root = () => page.locator("#root").innerText();
  check("the table is not empty", !(await root()).includes("No policies yet"));
  check(
    "the location's row is marked Default",
    (await page.getByRole("row", { name: /Office\s*Default/ }).count()) === 1,
  );
  check(
    "the default row shows what guests really get (4 hr / 30 min / 3)",
    /4 hr\s+30 min\s+No Limit\s+3/.test(
      await page.getByRole("row", { name: /Office/ }).innerText(),
    ),
  );
  check(
    "a default row has nothing to delete",
    (await page.getByRole("button", { name: "Delete Office" }).count()) === 0,
  );
  eq(
    "session timeout opens on the 4 hr default, not 'Choose…'",
    await page.locator("#st").inputValue(),
    "4 hr",
  );
  eq(
    "devices per user opens on the default 3, not 'Choose…'",
    await page.locator("#dp").inputValue(),
    "3",
  );
  eq("idle timeout opens on 30 min", await page.locator("#it").inputValue(), "30 min");

  // A stale cross-field error clears when the field that caused it changes.
  await page.selectOption("#st", "30 min");
  await page.selectOption("#it", "1 hr");
  await page.getByRole("button", { name: "Update policies" }).evaluate((b) => b.click());
  await page.getByText("Must not be longer than the session timeout.").waitFor({ timeout: 5_000 });
  await page.selectOption("#st", "2 hr");
  check(
    "the idle-vs-session error clears when the session length is changed",
    (await page.getByText("Must not be longer than the session timeout.").count()) === 0,
  );

  // Save straight away: every required field already holds a real value.
  await page.selectOption("#st", "4 hr");
  await page.selectOption("#it", "30 min");
  await page.evaluate(() => (window.__calls = []));
  await page.getByRole("button", { name: "Update policies" }).evaluate((b) => b.click());
  await page.getByText(/Limits saved for Office/).waitFor({ timeout: 10_000 });
  const calls = await page.evaluate(() => window.__calls);
  const created = (type) =>
    calls.find(
      (c) => c.method === "POST" && c.path === "/policies" && c.body?.policy_type === type,
    );
  check("save creates the DEVICE policy", !!created("device"));
  check("save creates the SESSION policy", !!created("session"));
  const sessionVersion = calls.find(
    (c) => c.method === "POST" && c.path === "/policies/new-session/versions",
  )?.body?.rules;
  eq("the session policy holds 240 min", sessionVersion?.session_timeout_minutes, 240);
  eq(
    "the device policy holds 3",
    calls.find((c) => c.method === "POST" && c.path === "/policies/new-device/versions")?.body
      ?.rules?.max_devices_per_guest,
    3,
  );
  check(
    "save assigns to the location",
    calls.some((c) => c.method === "MAP" && c.body.locationId === "loc-1"),
  );
  await page
    .getByRole("button", { name: "Delete Office" })
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  check(
    "after the save the row is the saved one, no longer Default",
    (await page.getByRole("row", { name: /Office\s*Default/ }).count()) === 0 &&
      (await page.getByRole("button", { name: "Delete Office" }).count()) === 1,
    (await page.getByRole("table").innerText()).replace(/\s+/g, " "),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n2b. The same screen at a MikroTik venue: unchanged");
// ---------------------------------------------------------------------------
{
  const page = await open(null);
  const root = () => page.locator("#root").innerText();
  check(
    "no controller or NAS-only notice renders at all",
    (await page.locator('[data-testid^="controller-control-"]').count()) === 0,
  );
  check("the data limit opens", !(await dataLimitButton(page).isDisabled()));
  check("speed is live", !(await page.locator("#bw").isDisabled()));
  check(
    "MikroTik keeps its Bandwidth and Data Limit columns",
    (await page.getByRole("columnheader", { name: "Bandwidth" }).count()) === 1 &&
      (await page.getByRole("columnheader", { name: "Data Limit" }).count()) === 1,
  );
  check(
    "the pre-existing footer",
    (await root()).includes("can sign someone out within minutes") &&
      !(await root()).includes(R.NAS_ONLY_LIMITS_FOOTER),
  );
  check("the table shows the cap", (await root()).includes("2 GB / Daily"));
  const calls = await editAndSave(page);
  eq("save keeps the cap the open panel shows", fupRulesWritten(calls)?.daily_data_limit_mb, 2048);
  check(
    "the pre-existing data-limit toast",
    (await root()).includes("the data limit applies to guests online now"),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n2c. The same screen at an Omada venue: no NAS-only sentence");
// ---------------------------------------------------------------------------
{
  const page = await open(OMADA);
  const root = () => page.locator("#root").innerText();
  for (const id of ["data-limit", "idle-timeout", "daily-limit"]) {
    check(`no "${id}" notice`, (await notice(page, id).count()) === 0);
  }
  check("the data limit opens", !(await dataLimitButton(page).isDisabled()));
  check("the pre-existing footer", (await root()).includes("can sign someone out within minutes"));
  check(
    "the controller ladder still answers speed (unchanged, not U1)",
    (await noticeText(page, "speed-limit")) !== U1 &&
      (await notice(page, "speed-limit").count()) === 1,
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

await browser.close();
server.close();

// ---------------------------------------------------------------------------
console.log("\n3. Wiring of the screens not rendered here");
// ---------------------------------------------------------------------------
const tiers = src("src/components/features/CreateGroup.tsx");
check(
  "Access Tiers: a greyed speed writes back the tier's held rate at a NAS-only venue only",
  /nasOnlyVenue\s*\?\s*heldKbpsFromLabel\(bw, BANDWIDTH_KBPS\)\s*:\s*\(BANDWIDTH_KBPS\[bw\] \?\? 0\)/.test(
    tiers,
  ),
);
check(
  "Access Tiers: the idle timeout carries the NAS-only caveat",
  /nasOnlyLimitVerdict\("idle-timeout", clientControls\.vendor\)/.test(tiers) &&
    /<ControllerControlNotice verdict=\{tierIdleTimeoutVerdict\} \/>/.test(tiers),
);
const featurePage = src("src/components/customer/CustomerFeaturePage.tsx");
check(
  "Guest Allow-list: mounted with the NAS-only caveat above it",
  /nasOnlyLimitVerdict\("allow-list", controllerVendor\)/.test(featurePage) &&
    /feature === "whitelist" && !controllerGated/.test(featurePage),
);
const blocking = src("src/components/features/BlockUsers.tsx");
check(
  "Blocking: at a NAS-only venue the saved-but-online toast is copy U2, not 'check'",
  /isNasOnlyVendor\(clientControls\.vendor\)\s*\?\s*`Saved\. \$\{NAS_ONLY_BLOCK_SIGNIN\}`/.test(
    blocking,
  ),
);
const limits = src("src/components/features/LocationPolicies.tsx");
check(
  "Guest WiFi Limits: the idle timeout select is never disabled (session-rules guard)",
  !/id="it"[\s\S]{0,200}disabled=/.test(limits),
);

console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "aruba access rules: all checks passed"
    : `aruba access rules: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
