/**
 * The Aruba access point alert switch on the customer Alerts page, rendered for
 * real in Chromium against a recorded API. MikroTik and Omada venues must show
 * no switch and make no alert-rule request.
 *
 * Run: node scripts/test-aruba-silence-alert.mjs
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "aruba-silence-"));
let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

writeFileSync(
  join(work, "api-stub.js"),
  `const rule = (over) => ({ id: "rule-1", name: "r", description: null, organization_id: "org-1",
     trigger_type: "health_status_change", target_component: "access_point_silent",
     condition_config: { expected_status: "silent" }, severity: "warning", is_active: true,
     notification_channel_ids: [], created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-02T00:00:00Z", ...over });
   const record = (method, path, body) => window.__calls.push({ method, path, body: body ?? null });
   export const api = {
     async get(path) {
       record("GET", path);
       if (path === "/me/organizations") return { data: [{ organization_id: "org-1", status: "active" }] };
       if (path === "/alerts") return { data: { items: [] } };
       if (path === "/alerts/rules") {
         if (window.__mode === "fail") throw new Error("boom");
         const items = window.__mode === "inactive" ? [rule({ is_active: false })]
           : window.__mode === "active" ? [rule()]
           : [rule({ id: "other", target_component: "isp_link" })];
         return { data: { items, page: 1, page_size: 100, total_items: items.length, total_pages: 1, has_next: false, has_previous: false } };
       }
       return { data: {} };
     },
     async post(path, body) {
       record("POST", path, body);
       if (window.__mode === "savefail") throw new Error("boom");
       return { data: rule({ is_active: body.is_active }) };
     },
     async put(path, body) { record("PUT", path, body); return { data: rule({ is_active: body.is_active }) }; },
     async delete(path) { record("DELETE", path); return { data: {} }; },
   };
   export function crossOrganizationHeaders() { return undefined; }
   export const TOKEN_STORAGE_KEY = "t";
   export const REFRESH_TOKEN_STORAGE_KEY = "r";
   export const USER_STORAGE_KEY = "u";
   export const ROLES_STORAGE_KEY = "ro";
   export const ORGS_STORAGE_KEY = "og";
   export const ACTIVE_ORG_STORAGE_KEY = "o";
   export const ORG_HEADER = "X-Organization-Id";
   export const ORG_SCOPE_HEADER = "X-Organization-Scope";
   export const ALL_ORGANIZATIONS = "all";
   export function toAppError(e) { return e; }
   export function isAppError() { return false; }
   export function requestErrorOf() { return null; }
   export function requestErrorMessage(_, fallback) { return fallback; }
   export function getAbsoluteApiBase() { return ""; }
   export function resolveOrganizationScope() { return null; }
   export function setOrganizationScope() {}
   export function resolveActiveOrganizationId() { return "org-1"; }
   export function setActiveOrganizationId() {}
   export default api;`,
);
writeFileSync(
  join(work, "entry.tsx"),
  `import { createRoot } from "react-dom/client";
   import { Toaster } from "sonner";
   import { AlertsView } from "@/components/features/AlertsView";
   import { deriveLocationLiveness } from "@/lib/location-liveness";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { useCustomerStore } from "@/stores/customerStore";
   const vendor = window.__vendor;
   const liveness = deriveLocationLiveness([
     { id: "r1", name: "D", vendor, status: vendor === "mikrotik" ? "online" : "pending_provisioning" },
   ]);
   useCustomerStore.getState().setActiveLocation("loc-1", { id: "loc-1", name: "Office", liveness });
   createRoot(document.getElementById("root")).render(<QueryClientProvider client={new QueryClient()}><><AlertsView /><Toaster /></></QueryClientProvider>);`,
);
await build({
  entryPoints: [join(work, "entry.tsx")],
  bundle: true,
  format: "esm",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  logLimit: 0,
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  jsx: "automatic",
  define: {
    "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: true }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: { "@/services/api": join(work, "api-stub.js"), "@": join(ROOT, "src") },
  plugins: [
    {
      name: "stub-relative-api",
      setup(b) {
        b.onResolve({ filter: /^\.\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".css": "empty" },
});
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><script>window.__calls=[];
      window.__vendor=${JSON.stringify(url.searchParams.get("vendor"))};
      window.__mode=${JSON.stringify(url.searchParams.get("mode"))};</script>
      <div id=root></div><script type=module src="./bundle.js"></script>`);
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
async function open(vendor, mode = "off") {
  const page = await browser.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/?vendor=${vendor}&mode=${mode}`);
  await page.getByText("Recent alerts").waitFor({ timeout: 15_000 });
  return page;
}
const NAME = "Alert me when access points stop reporting";
const toggle = (page) => page.getByRole("switch", { name: NAME });
const writes = (page) => page.evaluate(() => window.__calls.filter((c) => c.method !== "GET"));

console.log("\n1. MikroTik and Omada: no switch, no alert-rule request");
for (const vendor of ["mikrotik", "tplink_omada"]) {
  const page = await open(vendor);
  await page.waitForTimeout(500);
  check(`${vendor}: no card`, (await page.getByTestId("aruba-silence-alert").count()) === 0);
  const calls = await page.evaluate(() => window.__calls.map((c) => c.path));
  check(`${vendor}: no /alerts/rules request`, !calls.includes("/alerts/rules"), calls.join());
  check(
    `${vendor}: alerts copy still names routers`,
    (await page.locator("#root").innerText()).includes("your routers, internet lines"),
  );
  check(`${vendor}: no page error`, page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

console.log("\n2. Aruba: off until turned on, and turning on writes the rule once");
{
  const page = await open("aruba_instant_on");
  await toggle(page).waitFor();
  check("starts off", (await toggle(page).getAttribute("aria-checked")) === "false");
  check("no write just from opening the page", (await writes(page)).length === 0);
  check(
    "alerts copy names access points, not routers",
    (await page.locator("#root").innerText()).includes("your access points and WiFi login page") &&
      !/\brouters?\b/i.test(await page.locator("#root").innerText()),
  );
  const text = await page.getByTestId("aruba-silence-alert").innerText();
  check("never claims offline or down", !/\b(offline|down)\b/i.test(text), text);
  check("says a quiet venue raises nothing", text.includes("a quiet venue does not raise"));
  await toggle(page).click();
  await page.getByText("Access point alert is on.").waitFor();
  const calls = await writes(page);
  check("one POST", calls.length === 1 && calls[0].path === "/alerts/rules", JSON.stringify(calls));
  const body = calls[0]?.body ?? {};
  check(
    "right target and org",
    body.target_component === "access_point_silent" && body.organization_id === "org-1",
  );
  check(
    "backend's required shape",
    body.condition_config?.expected_status === "silent" &&
      body.trigger_type === "health_status_change",
  );
  check("Open Hours stay off", body.condition_config?.use_open_hours === undefined);
  check("now on", (await toggle(page).getAttribute("aria-checked")) === "true");
  await toggle(page).click();
  await page.getByText("Access point alert is off.").waitFor();
  const after = await writes(page);
  check(
    "turning off updates the same rule, not a delete",
    after[1]?.method === "PUT" &&
      after[1]?.path === "/alerts/rules/rule-1" &&
      after[1]?.body.is_active === false,
    JSON.stringify(after),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

console.log("\n3. Aruba: an existing rule is reused");
{
  const page = await open("aruba_instant_on", "inactive");
  await toggle(page).waitFor();
  await toggle(page).click();
  await page.getByText("Access point alert is on.").waitFor();
  const calls = await writes(page);
  check(
    "PUT, no second rule",
    calls.length === 1 && calls[0].method === "PUT",
    JSON.stringify(calls),
  );
  await page.close();
}

console.log("\n4. Aruba: failures are not shown as off");
{
  const page = await open("aruba_instant_on", "fail");
  await page.getByText("Could not check whether this alert is on").waitFor();
  check("failed read shows no switch", (await toggle(page).count()) === 0);
  await page.close();
}
{
  const page = await open("aruba_instant_on", "savefail");
  await toggle(page).waitFor();
  await toggle(page).click();
  await page.getByText("Could not change this alert").waitFor();
  check("failed save stays off", (await toggle(page).getAttribute("aria-checked")) === "false");
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`aruba silence alert: ${failures} FAILED`);
  process.exit(1);
}
console.log("aruba silence alert: all checks passed");
