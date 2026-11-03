/**
 * Aruba Instant On screen notes: the voucher data limit's real behaviour, the
 * banner image warning, and no Social Buttons block in the portal builder. FIRST
 * pins that MikroTik and Omada see none of it.
 *
 * Run: node scripts/test-aruba-screen-gaps.mjs
 * The REAL components in Chromium against a recorded API stub.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "aruba-screen-gaps-"));
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
const src = (p) => readFileSync(join(ROOT, p), "utf8");

writeFileSync(
  join(work, "api-stub.js"),
  `const iso = "2026-11-01T00:00:00.000Z";
   const page = (items) => ({ items, page: 1, page_size: 50, total_items: items.length, total_pages: 1, has_next: false, has_previous: false });
   const campaign = { id: "banner-1", name: "Weekend", campaign_type: "banner", status: "draft",
     organization_id: "org-1", location_id: "loc-1", starts_at: iso, ends_at: null, display_rule: "every_login",
     display_interval_days: null, target_networks: [], is_skippable: true, created_at: iso, updated_at: iso };
   export const api = {
     async get(path) {
       window.__calls.push(path);
       if (path === "/me/organizations") return { data: [{ organization_id: "org-1", status: "active" }] };
       if (path === "/campaigns") return { data: page([campaign]) };
       if (path.endsWith("/assets") || path.endsWith("/questions")) return { data: [] };
       if (path.endsWith("/results")) return { data: { campaign_id: "x", total_impressions: 0, total_responses: 0, questions: [] } };
       if (path.includes("routers")) return { data: page([{ id: "r1", name: "R", status: "online", vendor: window.__vendor, organization_id: "org-1", location_id: "loc-1", mac_address: "aa:bb:cc:dd:ee:ff" }]) };
       if (path.includes("voucher")) return { data: page([]) };
       return { data: {} };
     },
     async post() { return { data: {} }; },
     async put() { return { data: {} }; },
     async delete() { return { data: {} }; },
   };
   export function crossOrganizationHeaders() { return undefined; }
   export const TOKEN_STORAGE_KEY = "t";
   export const REFRESH_TOKEN_STORAGE_KEY = "r";
   export const USER_STORAGE_KEY = "u";
   export const ACTIVE_ORG_STORAGE_KEY = "o";
   export function resolveActiveOrganizationId() { return "org-1"; }
   export function setActiveOrganizationId() {}
   export const ROLES_STORAGE_KEY = "ro";
   export const ORGS_STORAGE_KEY = "og";
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
   export default api;`,
);
writeFileSync(
  join(work, "entry.tsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { CampaignsPage } from "@/components/features/CampaignsPage";
   import { VouchersPage } from "@/components/features/VouchersPage";
   import { PortalBuilder } from "@/components/portals/PortalBuilder";
   import { useCustomerStore } from "@/stores/customerStore";
   import { deriveLocationLiveness } from "@/lib/location-liveness";
   const q = new URLSearchParams(location.search);
   window.__vendor = q.get("vendor");
   const liveness = deriveLocationLiveness([{ id: "r1", name: "R", status: "online", last_seen_at: null, vendor: window.__vendor }]);
   useCustomerStore.getState().setActiveLocation("loc-1", { id: "loc-1", name: "Office", liveness });
   const screen = q.get("screen");
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
       {screen === "offers" && <CampaignsPage locationId="loc-1" />}
       {screen === "vouchers" && <VouchersPage locationId="loc-1" />}
       {screen === "builder" && <PortalBuilder portal={{ id: "p1", name: "P", locationId: "loc-1", locationName: "Office", organizationId: "org-1", organizationName: "Org", components: [], ads: [], loginMethods: ["otp"], primaryLoginMethod: "otp", branding: {}, consent: {}, content: {}, login: {}, postConnect: {} }} onChange={() => {}} />}
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
    return res.end(
      `<!doctype html><script>window.__calls=[]</script><div id=root></div><script type=module src="./bundle.js"></script>`,
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

async function open(screen, vendor) {
  const page = await browser.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/?screen=${screen}&vendor=${vendor}`);
  return page;
}
async function voucherForm(vendor) {
  const page = await open("vouchers", vendor);
  await page
    .getByRole("button", { name: /Generate/ })
    .first()
    .click({ timeout: 15_000 });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return { page, dialog };
}
async function bannerEditor(vendor) {
  const page = await open("offers", vendor);
  await page.getByRole("button", { name: "Edit Weekend" }).first().click({ timeout: 15_000 });
  const dialog = page.getByRole("dialog", { name: /^Edit/ });
  await dialog.getByPlaceholder(/Image URL/).waitFor();
  return { page, dialog };
}
async function palette(vendor) {
  const page = await open("builder", vendor);
  await page
    .getByText("Voucher Input")
    .waitFor({ timeout: 15_000 })
    .catch((err) => {
      throw new Error(`builder did not render: ${page.__errors.join(" | ")} ${err.message}`);
    });
  await page.waitForResponse(() => false, { timeout: 500 }).catch(() => {});
  return page;
}
const DATA_NOTE = /Usage is counted/;

for (const vendor of ["mikrotik", "tplink_omada"]) {
  console.log(`\n${vendor}: unchanged`);
  const v = await voucherForm(vendor);
  check("voucher form: no data limit note", !DATA_NOTE.test(await v.dialog.innerText()));
  check(
    "voucher form: no speed-control read",
    !(await v.page.evaluate(() => window.__calls)).some((c) => c.includes("speed-control")),
  );
  await v.page.close();
  const b = await bannerEditor(vendor);
  check(
    "banner editor: no image note",
    (await b.dialog.getByTestId("banner-image-nas-only").count()) === 0,
  );
  await b.page.close();
  const p = await palette(vendor);
  check(
    "portal builder: keeps Social Buttons",
    (await p.getByText("Social Buttons").count()) === 1,
  );
  await p.close();
}

console.log("\nAruba Instant On");
{
  const v = await voucherForm("aruba_instant_on");
  check(
    "voucher form: says what a data limit really does",
    DATA_NOTE.test(await v.dialog.innerText()),
  );
  check("no page error", v.page.__errors.length === 0, v.page.__errors.join(" | "));
  await v.page.close();
  const b = await bannerEditor("aruba_instant_on");
  check(
    "banner editor: warns about images hosted elsewhere",
    (await b.dialog.getByTestId("banner-image-nas-only").count()) === 1,
  );
  await b.page.close();
  const p = await palette("aruba_instant_on");
  await p
    .getByText("Social Buttons")
    .waitFor({ state: "detached", timeout: 10_000 })
    .catch(() => {});
  check("portal builder: no Social Buttons", (await p.getByText("Social Buttons").count()) === 0);
  await p.close();
}

console.log("\nMaster voucher form (source)");
const master = src("src/components/vouchers/VoucherManagement.tsx");
check(
  "the speed note shows only when the chosen location is all NAS-only",
  /useLocationIsNasOnly\(form\.watch\("locationId"\), selectedOrgId\)/.test(master) &&
    /\{locationIsNasOnly && \(\s*<p[^>]*\s*data-testid="voucher-speed-nas-only"|\{locationIsNasOnly && \(\s*<p/.test(
      master,
    ),
);

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`aruba screen gaps: ${failures} FAILED`);
  process.exit(1);
}
console.log("aruba screen gaps: all checks passed");
