/**
 * Voucher session timeout on the customer's Generate form.
 *
 * Run: node scripts/test-voucher-session-timeout.mjs
 * The REAL VouchersPage in Chromium against a recorded API stub, at an Aruba
 * Instant On venue and at a MikroTik venue (which must not change).
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "voucher-timeout-"));
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
  `const record = (method, path, body) => window.__calls.push({ method, path, body: body ?? null });
   const batch = (b) => ({ id: "b1", organization_id: "org-1", location_id: "loc-1", plan_id: null,
     series_id: null, code_length: 8, code_prefix: null, batch_expires_at: null, status: "active",
     created_by_user_id: null, approved_by_user_id: null, notes: null, created_at: "2026-11-02T00:00:00Z",
     updated_at: "2026-11-02T00:00:00Z", ...b });
   export const api = {
     async get(path) {
       record("GET", path);
       if (path === "/me/organizations") return { data: [{ organization_id: "org-1", status: "active" }] };
       return { data: { items: [], page: 1, page_size: 100, total_items: 0, total_pages: 1, has_next: false, has_previous: false } };
     },
     async post(path, body) { record("POST", path, body); return { data: batch(body) }; },
     async put(path, body) { record("PUT", path, body); return { data: {} }; },
     async delete(path) { record("DELETE", path); return { data: {} }; },
   };
   export function crossOrganizationHeaders() { return undefined; }
   export const TOKEN_STORAGE_KEY = "t";
   export const REFRESH_TOKEN_STORAGE_KEY = "r";
   export const USER_STORAGE_KEY = "u";
   export const ACTIVE_ORG_STORAGE_KEY = "o";
   export const ROLES_STORAGE_KEY = "ro";
   export const ORGS_STORAGE_KEY = "og";
   export const ORG_HEADER = "X-Organization-Id";
   export const ORG_SCOPE_HEADER = "X-Organization-Scope";
   export const ALL_ORGANIZATIONS = "all";
   export function resolveActiveOrganizationId() { return "org-1"; }
   export function setActiveOrganizationId() {}
   export function toAppError(e) { return e; }
   export function isAppError() { return false; }
   export function requestErrorOf() { return null; }
   export function requestErrorMessage(_, fallback) { return fallback; }
   export function getAbsoluteApiBase() { return ""; }
   export function resolveOrganizationScope() { return null; }
   export function setOrganizationScope() {}
   export default api;`,
);
writeFileSync(
  join(work, "entry.tsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { Toaster } from "sonner";
   import { VouchersPage } from "@/components/features/VouchersPage";
   import { deriveLocationLiveness } from "@/lib/location-liveness";
   import { useCustomerStore } from "@/stores/customerStore";
   const vendor = new URLSearchParams(location.search).get("vendor");
   const liveness = deriveLocationLiveness([{ id: "r1", name: "R1", vendor, status: "online" }]);
   useCustomerStore.getState().setActiveLocation("loc-1", { id: "loc-1", name: "Office", liveness });
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={new QueryClient()}>
       <VouchersPage locationId="loc-1" />
       <Toaster />
     </QueryClientProvider>,
   );`,
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
    return res.end(`<!doctype html><script>window.__calls=[]</script>
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

async function openForm(vendor) {
  const page = await browser.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/?vendor=${vendor}`);
  await page.getByRole("button", { name: "Generate" }).first().click({ timeout: 15_000 });
  await page.locator("#voucher-max-uses").waitFor();
  return page;
}
const generate = (page) => page.getByRole("button", { name: /^Generate \d+/ });
const posted = (page) =>
  page.evaluate(() =>
    window.__calls.filter((c) => c.method === "POST" && c.path.includes("batch")),
  );
const field = (page) => page.locator("#voucher-session-timeout");

console.log("\n1. Aruba: the field exists and reaches the backend");
{
  const page = await openForm("aruba_instant_on");
  check("the field is shown", (await field(page).count()) === 1);
  check(
    "the hint names Max Uses",
    (await page.getByRole("dialog").innerText()).includes("Max Uses"),
  );
  await page.locator("#voucher-batch-name").fill("Week pass");
  await page.locator("#voucher-valid-min, input[max='43200']").first().fill("10080");
  await field(page).fill("20000");
  check("above the validity is refused", await generate(page).isDisabled());
  await field(page).fill("120");
  check("within the validity is allowed", await generate(page).isEnabled());
  await generate(page).click();
  await page
    .getByRole("dialog")
    .waitFor({ state: "hidden" })
    .catch(() => {});
  const calls = await posted(page);
  check(
    "sends session_timeout_minutes",
    calls[0]?.body.session_timeout_minutes === 120,
    JSON.stringify(calls),
  );
  check("keeps the validity", calls[0]?.body.validity_minutes === 10080);
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}
{
  const page = await openForm("aruba_instant_on");
  await page.locator("#voucher-batch-name").fill("Plain");
  await generate(page).click();
  await page
    .getByRole("dialog")
    .waitFor({ state: "hidden" })
    .catch(() => {});
  const calls = await posted(page);
  check(
    "blank sends no field",
    calls[0] && !("session_timeout_minutes" in calls[0].body),
    JSON.stringify(calls),
  );
  await page.close();
}

console.log("\n2. MikroTik: no field, and nothing new in the request");
{
  const page = await openForm("mikrotik");
  check("the field is not shown", (await field(page).count()) === 0);
  check("no hint", !(await page.getByRole("dialog").innerText()).includes("Session timeout"));
  await page.locator("#voucher-batch-name").fill("Plain");
  await generate(page).click();
  await page
    .getByRole("dialog")
    .waitFor({ state: "hidden" })
    .catch(() => {});
  const calls = await posted(page);
  check(
    "no session_timeout_minutes sent",
    calls[0] && !("session_timeout_minutes" in calls[0].body),
    JSON.stringify(calls),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`voucher session timeout: ${failures} FAILED`);
  process.exit(1);
}
console.log("voucher session timeout: all checks passed");
