/**
 * Rendered checks for Aruba screens that only had source checks. The real
 * components in Chromium; only `@/services/api` and the router are substituted.
 *
 * Run: node scripts/test-aruba-rendered-gaps.mjs
 *
 *   1. Fix a Problem at Aruba: status card, guest lookup, help steps, and a
 *      failed access point read. MikroTik keeps its verdict and site check.
 *   2. OTP report: status, attempts, time to verify and provider columns; an
 *      old row with no provider data shows a dash.
 *   3. Usage reports at Aruba: unreported bytes show a dash and real bytes stay.
 *      MikroTik keeps its 0.
 *   4. Blocked Guests: the cloud-control notice shows when off, not when on.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "aruba-rendered-gaps-"));

let ran = 0;
let failed = 0;
function check(name, ok, detail = "") {
  ran += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` -- ${String(detail).slice(0, 500)}` : ""}`);
  }
}

const LOC = "loc-1";
const ORG = "org-1";
const NOW = new Date().toISOString();
const TODAY = NOW.slice(0, 10);
const NEEDS_CLOUD = "Keeping this device itself off the WiFi needs Instant On cloud control";

writeFileSync(
  join(work, "api-stub.js"),
  `
const QS = new URLSearchParams(location.search);
const VENDOR = QS.get("vendor");
const LOC = ${JSON.stringify(LOC)};
const ORG = ${JSON.stringify(ORG)};
const NOW = ${JSON.stringify(NOW)};
const page = (items) => ({ items, page: 1, page_size: 100, total_items: items.length, total_pages: 1, has_next: false, has_previous: false });
const ROUTERS = [{ id: "r1", name: "Device", status: "online", last_seen_at: VENDOR === "mikrotik" ? NOW : null, vendor: VENDOR, location_id: LOC, organization_id: ORG }];
const session = (id, guest, down) => ({
  id, status: "active", is_online: true, started_at: NOW, ended_at: null, last_activity_at: NOW,
  ip_address: "10.0.0.2", router_id: "r1", location_id: LOC, organization_id: ORG, device_id: null,
  device_mac: "11:11:11:11:11:" + id.slice(-2), guest_id: guest, bytes_downloaded: down, bytes_uploaded: 0,
  user_agent: "Android", data_limit_mb: null, session_timeout_minutes: 60,
});
const guest = (id, phone) => ({
  id, organization_id: ORG, location_id: LOC, identifier: phone, display_name: "Guest " + id,
  mac_addresses: [], device_count: 1, first_seen_at: NOW, last_seen_at: NOW, total_visit_count: 1,
  is_blocked: false, blocked_reason: null, created_at: NOW, updated_at: NOW,
});
const SESSIONS = [session("s-01", "g1", 0), session("s-02", "g2", 5000000)];
const OTP = [
  { id: "o1", identifier: "+919876500001", channel: "sms", purpose: "guest_login", created_at: NOW,
    expires_at: NOW, verified_at: new Date(Date.parse(NOW) + 42000).toISOString(), attempt_count: 1,
    max_attempts: 5, is_consumed: true, provider_outcome: "accepted", provider_response_ms: 321 },
  { id: "o2", identifier: "+919876500002", channel: "sms", purpose: "guest_login", created_at: NOW,
    expires_at: new Date(Date.parse(NOW) - 60000).toISOString(), verified_at: null, attempt_count: 0,
    max_attempts: 5, is_consumed: false, provider_outcome: null, provider_response_ms: null },
  { id: "o3", identifier: "+919876500003", channel: "sms", purpose: "guest_login", created_at: NOW,
    expires_at: new Date(Date.parse(NOW) + 600000).toISOString(), verified_at: null, attempt_count: 5,
    max_attempts: 5, is_consumed: false, provider_outcome: "accepted", provider_response_ms: 90 },
];
function body(url) {
  if (url === "/auth/me") return { id: "u1", email: "owner@example.com", full_name: "Owner", is_active: true };
  if (url === "/me/permissions") return { user_id: "u1", permissions: ["*"] };
  if (url === "/me/organizations") return [{ id: "m1", organization_id: ORG, status: "active" }];
  if (url === "/organizations") return page([{ id: ORG, name: "Acme", slug: "acme", status: "active" }]);
  if (/^\\/organizations\\/[^/]+\\/locations$/.test(url)) return page([{ id: LOC, name: "Front Desk", city: "Mumbai", property_type: "hotel" }]);
  if (url === "/locations/" + LOC + "/routers") return page(ROUTERS);
  if (url === "/routers/r1") return ROUTERS[0];
  if (url === "/locations/" + LOC + "/access-points") {
    if (QS.get("apfail")) throw Object.assign(new Error("500"), { status: 500 });
    return { location_id: LOC, applicable: true, as_of: NOW, unattributed_clients_now: 0, items: [
      { id: "ap1", name: "Lobby", mac: "aa:bb:cc:00:00:01", model: "AP21", clients_now: 2, sessions_today: 4,
        download_bytes_today: 2000000, upload_bytes_today: 1000000, last_seen_at: NOW, status: "online", status_source: "radius" },
    ] };
  }
  if (url === "/guest-sessions") return page(SESSIONS);
  if (url === "/guest-session-groups") return page([]);
  if (url === "/guests") return page([guest("g1", "+919876500001"), guest("g2", "+919876500002")]);
  if (url === "/guests/g1") return guest("g1", "+919876500001");
  if (url === "/otp/requests") return page(OTP);
  if (/\\/speed-control$/.test(url)) return { per_guest_speed: false, instant_on_cloud_control: QS.get("cloud") === "1" };
  return page([]);
}
const settle = (fn) => new Promise((res, rej) => setTimeout(() => { try { res({ data: fn() }); } catch (e) { rej(e); } }, 5));
export const api = {
  get: async (url) => settle(() => body(url)),
  post: async () => settle(() => ({})),
  put: async () => settle(() => ({})),
  patch: async () => settle(() => ({})),
  delete: async () => settle(() => ({})),
  interceptors: { request: { use() {} }, response: { use() {} } },
  defaults: { headers: { common: {} } },
};
export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const REFRESH_TOKEN_STORAGE_KEY = "cloudguest_refresh_token";
export const USER_STORAGE_KEY = "cloudguest_user";
export const ROLES_STORAGE_KEY = "cloudguest_roles";
export const ORGS_STORAGE_KEY = "cloudguest_organizations";
export const ACTIVE_ORG_STORAGE_KEY = "cg.activeOrgId";
export const ORG_HEADER = "X-Organization-Id";
export const ORG_SCOPE_HEADER = "X-Organization-Scope";
export const ALL_ORGANIZATIONS = "all";
export function toAppError(e) { return { message: String(e), status: 0 }; }
export function getAbsoluteApiBase() { return "http://localhost/api/v1"; }
export function resolveActiveOrganizationId() { return null; }
export function setActiveOrganizationId() {}
export function isAppError(v) { return !!v && typeof v === "object" && "message" in v && "status" in v; }
export function requestErrorOf() { return null; }
export function requestErrorMessage(_v, fallback) { return fallback; }
export function resolveOrganizationScope() { return null; }
export function setOrganizationScope() {}
export function crossOrganizationHeaders() { return undefined; }
export default api;
`,
);
writeFileSync(
  join(work, "router-stub.js"),
  `import { createElement } from "react";
export function createFileRoute() { return (o) => o; }
export function createRootRoute() { return {}; }
export function useNavigate() { return () => {}; }
export function useRouter() { return { navigate: () => {} }; }
export function useRouterState() { return { location: { pathname: "/" } }; }
export function useParams() { return {}; }
export function useSearch() { return {}; }
export function redirect(o) { return o; }
export function Link({ children }) { return createElement("a", { href: "#" }, children); }
export function Outlet() { return null; }
`,
);
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import { deriveLocationLiveness } from "@/lib/location-liveness";
import { FixAProblem } from "@/components/customer/FixAProblem";
import UserReports from "@/components/features/UserReports";
import BlockUsers from "@/components/features/BlockUsers";
import { Toaster } from "sonner";

const QS = new URLSearchParams(location.search);
const VENDOR = QS.get("vendor");
const LOC = ${JSON.stringify(LOC)};
const ORG = ${JSON.stringify(ORG)};
localStorage.setItem("cloudguest_token", "a-real-looking-token");
localStorage.setItem("cloudguest_user", JSON.stringify({ id: "u1", email: "owner@example.com", fullName: "Owner" }));
localStorage.setItem("cloudguest_roles", JSON.stringify([
  { roleName: "organization-owner", roleSlug: "organization-owner", scopeType: "organization", organizationId: ORG, locationId: null },
]));
localStorage.setItem("cloudguest_organizations", JSON.stringify([
  { organizationId: ORG, organizationName: "Acme", status: "active" },
]));
localStorage.setItem("cg_login_role", "owner");
const liveness = deriveLocationLiveness(
  [{ id: "r1", name: "Device", status: "online", last_seen_at: VENDOR === "mikrotik" ? new Date().toISOString() : null, vendor: VENDOR }],
  new Date(),
);
useCustomerStore.setState({
  activeLocationId: LOC,
  activeLocation: {
    id: LOC, name: "Front Desk", city: "Mumbai", organizationId: ORG, organizationName: "Acme",
    onlineUsers: 0, bandwidth: "0 MB", isp: "Active", lastSync: "Just now", sessionsActive: 0,
    sessionsTotal: 0, routersOnline: liveness.routersOnline, routersTotal: liveness.routersTotal,
    status: "online", liveness,
  },
});
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const which = QS.get("page");
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={client}>
    <AuthProvider>
      <TooltipProvider>
        {which === "fix" ? (
          <FixAProblem locationId={LOC} masked={false} />
        ) : which === "reports" ? (
          <UserReports masked={false} />
        ) : (
          <BlockUsers locationId={LOC} />
        )}
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
`,
);
await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  nodePaths: [join(ROOT, "node_modules")],
  absWorkingDir: ROOT,
  loader: {
    ".css": "empty",
    ".svg": "dataurl",
    ".png": "dataurl",
    ".jpg": "dataurl",
    ".webp": "dataurl",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env": JSON.stringify({ MODE: "production", DEV: false, PROD: true }),
  },
  alias: { "@": join(ROOT, "src") },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
        b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: join(work, "router-stub.js"),
        }));
        b.onResolve({ filter: /^\.\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
      },
    },
  ],
});
writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8><div id=root></div><script type=module src="/bundle.js"></script>`,
);
const server = createServer((req, res) => {
  const name = req.url.split("?")[0].slice(1) || "index.html";
  try {
    const file = readFileSync(join(work, name));
    res.writeHead(200, {
      "content-type": extname(name) === ".js" ? "text/javascript" : "text/html",
    });
    res.end(file);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import("playwright");
const browser = await chromium.launch();

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/?${query}`);
  return page;
}
const rootText = (page) => page.locator("#root").innerText();

async function runReport(page, tab, reportLabel) {
  await page.getByRole("tab", { name: tab }).click();
  await page.locator("#ur-bu option", { hasText: "Front Desk" }).waitFor({ state: "attached" });
  await page.locator("button[role=combobox]").click();
  await page.getByRole("option", { name: new RegExp(reportLabel) }).click();
  await page.selectOption("#ur-bu", { label: "Front Desk" });
  await page.fill("#ur-fr", TODAY);
  await page.fill("#ur-to", TODAY);
  await page.getByRole("button", { name: /^Search$/ }).click();
  await page.locator("table tbody tr").first().waitFor({ timeout: 10_000 });
}
const cells = async (row) => (await row.locator("td").allInnerTexts()).map((t) => t.trim());

console.log("\n1. Fix a Problem at Aruba");
{
  const page = await open("page=fix&vendor=aruba_instant_on");
  await page.getByTestId("aruba-fix-status").waitFor({ timeout: 15_000 });
  await page.getByTestId("aruba-fix-aps").getByText("1 active").waitFor({ timeout: 10_000 });
  check("status: guest WiFi is active", (await rootText(page)).includes("Guest WiFi is active"));
  check(
    "status: access points fact",
    (await page.getByTestId("aruba-fix-aps").innerText()) === "1 active",
  );
  check(
    "status: guests online fact is a number",
    /^\d+$/.test(await page.getByTestId("aruba-fix-guests").innerText()),
  );
  check(
    "status: says where the reading comes from",
    (await rootText(page)).includes("not from the access point itself"),
  );
  check(
    "lookup is on the page",
    (await page.getByPlaceholder("98765 43210 or name@example.com").count()) === 1,
  );
  const help = page.getByTestId("aruba-fix-help");
  check("help: six complaints", (await help.locator("details").count()) === 6);
  check(
    "help: copy resolves, not raw keys",
    !(await help.innerText()).includes("aruba.help") &&
      (await help.innerText()).includes("The guest can't see the WiFi"),
    await help.innerText(),
  );
  await help.locator("summary").first().click();
  check(
    "help: a complaint opens to its steps",
    (await help.locator("details").first().locator("li").count()) === 2,
  );
  const t = await rootText(page);
  check("no router verdict sentence", !t.includes("no reading to show"));
  check("no site check at this venue", !t.includes("A guest can't open one particular site?"));
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}
{
  const page = await open("page=fix&vendor=aruba_instant_on&apfail=1");
  await page.getByText("Access point status is unavailable right now").waitFor({ timeout: 15_000 });
  const aps = await page.getByTestId("aruba-fix-aps").innerText();
  check("failed AP read: no stand-in count", !/\d/.test(aps), aps);
  check(
    "failed AP read: lookup still works",
    (await page.getByPlaceholder("98765 43210 or name@example.com").count()) === 1,
  );
  check("failed AP read: no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}
{
  const page = await open("page=fix&vendor=mikrotik");
  await page.getByText("A guest can't open one particular site?").waitFor({ timeout: 15_000 });
  check("MikroTik: no Aruba card", (await page.getByTestId("aruba-fix-status").count()) === 0);
  check("MikroTik: no Aruba help", (await page.getByTestId("aruba-fix-help").count()) === 0);
  check(
    "MikroTik: lookup still there",
    (await page.getByPlaceholder("98765 43210 or name@example.com").count()) === 1,
  );
  check("MikroTik: no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

console.log("\n2. OTP report columns");
{
  const page = await open("page=reports&vendor=aruba_instant_on");
  await runReport(page, "OTP & SMS Delivery Report", "OTP Requests & Verification");
  const heads = (await page.locator("table thead th").allInnerTexts()).map((h) => h.trim());
  for (const h of [
    "OTP Status",
    "Attempts",
    "Time To Verify",
    "Sent to provider",
    "Provider response time",
  ]) {
    check(
      `column: ${h}`,
      heads.some((x) => x.includes(h)),
      heads.join(" | "),
    );
  }
  const col = (h) => heads.findIndex((x) => x.includes(h));
  const rowFor = async (suffix) =>
    cells(page.locator("table tbody tr").filter({ hasText: suffix }).first());
  const v = await rowFor("500001");
  check("verified: status", v[col("OTP Status")] === "Verified", v.join(" | "));
  check("verified: time to verify", v[col("Time To Verify")] === "42s", v.join(" | "));
  check("verified: provider time", v[col("Provider response time")] === "321 ms", v.join(" | "));
  check("verified: attempts", v[col("Attempts")] === "1", v.join(" | "));
  const old = await rowFor("500002");
  check("old row: expired", old[col("OTP Status")] === "Expired", old.join(" | "));
  check("old row: provider shows a dash", old[col("Sent to provider")] === "—", old.join(" | "));
  check("old row: time shows a dash", old[col("Provider response time")] === "—", old.join(" | "));
  check("old row: no time to verify", old[col("Time To Verify")] === "—", old.join(" | "));
  const spent = await rowFor("500003");
  check("attempts used up: Failed", spent[col("OTP Status")] === "Failed", spent.join(" | "));
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

console.log("\n3. Usage reports with unreported bytes");
async function usage(vendor) {
  const page = await open(`page=reports&vendor=${vendor}`);
  await runReport(page, "Guest Activity Report", "Guest Data Usage By Date Range");
  const heads = (await page.locator("table thead th").allInnerTexts()).map((h) => h.trim());
  const dataCol = heads.findIndex((x) => /data/i.test(x));
  const zero = await cells(page.locator("table tbody tr").filter({ hasText: "Guest g1" }).first());
  const real = await cells(page.locator("table tbody tr").filter({ hasText: "Guest g2" }).first());
  const text = await rootText(page);
  const errors = page.__errors;
  const note = await page.getByTestId("aruba-usage-note").count();
  await page.close();
  return { dataCol, zero, real, text, errors, note, heads };
}
{
  const a = await usage("aruba_instant_on");
  check("Aruba: unreported bytes show a dash", a.zero[a.dataCol] === "—", a.zero.join(" | "));
  check("Aruba: real bytes stay", /5/.test(a.real[a.dataCol] ?? ""), a.real.join(" | "));
  check("Aruba: the note explains the dash", a.note === 1);
  check("Aruba: no page error", a.errors.length === 0, a.errors.join(" | "));
  const m = await usage("mikrotik");
  check(
    "MikroTik: keeps its 0",
    m.zero[m.dataCol] !== "—" && /0/.test(m.zero[m.dataCol] ?? ""),
    m.zero.join(" | "),
  );
  check("MikroTik: no Aruba note", m.note === 0);
  check("MikroTik: no page error", m.errors.length === 0, m.errors.join(" | "));
}

console.log("\n4. Blocked Guests notice");
{
  const off = await open("page=block&vendor=aruba_instant_on");
  await off.getByText("Blocked Guests", { exact: false }).first().waitFor({ timeout: 15_000 });
  await off.getByText(NEEDS_CLOUD, { exact: false }).waitFor({ timeout: 10_000 });
  check("cloud control off: the notice says so", true);
  check("off: no page error", off.__errors.length === 0, off.__errors.join(" | "));
  await off.close();
  const on = await open("page=block&vendor=aruba_instant_on&cloud=1");
  await on.getByText("Blocked Guests", { exact: false }).first().waitFor({ timeout: 15_000 });
  await on.waitForTimeout(1500);
  check(
    "cloud control on: the notice is gone",
    !(await rootText(on)).includes(NEEDS_CLOUD),
    await rootText(on),
  );
  check("on: no page error", on.__errors.length === 0, on.__errors.join(" | "));
  await on.close();
  const mt = await open("page=block&vendor=mikrotik");
  await mt.getByText("Blocked Guests", { exact: false }).first().waitFor({ timeout: 15_000 });
  await mt.waitForTimeout(1000);
  check("MikroTik: no Instant On notice", !(await rootText(mt)).includes("Instant On"));
  check("MikroTik: no page error", mt.__errors.length === 0, mt.__errors.join(" | "));
  await mt.close();
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failed) {
  console.log(`aruba rendered gaps: ${failed} FAILED`);
  process.exit(1);
}
console.log("aruba rendered gaps: all checks passed");
