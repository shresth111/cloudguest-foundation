/**
 * Login Page Offers: Edit and Preview are separate buttons, a banner can be
 * edited, and the coupon's own date stays optional.
 *
 * Run: node scripts/test-campaign-edit.mjs
 * The REAL CampaignsPage in Chromium against a recorded API stub.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "campaign-edit-"));
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
  `const iso = "2026-11-01T00:00:00.000Z";
   const campaign = (id, name, type) => ({ id, name, campaign_type: type, status: "draft",
     organization_id: "org-1", location_id: "loc-1", starts_at: iso, ends_at: "2026-11-30T00:00:00.000Z",
     display_rule: "every_login", display_interval_days: null, target_networks: [], is_skippable: true,
     created_at: iso, updated_at: iso });
   const asset = (over) => ({ id: "asset-1", campaign_id: "banner-1", image_url: null, click_url: null,
     alt_text: null, locale: null, headline: "Old headline", subtext: null, coupon_code: "SAVE10",
     coupon_expires_at: "2026-11-20T00:00:00.000Z", ...over });
   const record = (method, path, body) => window.__calls.push({ method, path, body: body ?? null });
   export const api = {
     async get(path) {
       record("GET", path);
       if (path === "/me/organizations") return { data: [{ organization_id: "org-1", status: "active" }] };
       if (path === "/campaigns") return { data: { items: [campaign("banner-1", "Weekend", "banner"),
         campaign("banner-2", "Empty", "banner"), campaign("survey-1", "Feedback", "survey")],
         page: 1, page_size: 50, total_items: 3, total_pages: 1, has_next: false, has_previous: false } };
       if (path === "/campaigns/banner-1/assets") {
         if (window.__assetsFail) throw new Error("boom");
         return { data: [asset()] };
       }
       if (path.endsWith("/assets")) return { data: [] };
       if (path.endsWith("/questions")) return { data: [] };
       if (path.endsWith("/results")) return { data: { campaign_id: "x", total_impressions: 0, total_responses: 0, questions: [] } };
       return { data: {} };
     },
     async post(path, body) {
       record("POST", path, body);
       return { data: asset({ id: "asset-new", campaign_id: "banner-2", ...body }) };
     },
     async put(path, body) {
       record("PUT", path, body);
       if (path.includes("/assets")) return { data: asset(body) };
       return { data: campaign("banner-1", body.name, "banner") };
     },
     async delete(path) { record("DELETE", path); return { data: {} }; },
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
   import { Toaster } from "sonner";
   import { CampaignsPage } from "@/components/features/CampaignsPage";
   localStorage.setItem("cg_active_org_id", "org-1");
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={new QueryClient()}>
       <CampaignsPage locationId="loc-1" />
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
  // Sibling services import "./api", which the alias above does not catch.
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
    return res.end(`<!doctype html><script>window.__calls=[];window.__assetsFail=${url.searchParams.has("fail")}</script>
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
async function open(query = "") {
  const page = await browser.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/${query}`);
  await page.getByRole("button", { name: "Edit Weekend" }).first().waitFor({ timeout: 15_000 });
  return page;
}
const writes = (page) => page.evaluate(() => window.__calls.filter((c) => c.method !== "GET"));

console.log("\n1. Separate Edit and Preview buttons");
{
  const page = await open();
  for (const name of ["Weekend", "Feedback"]) {
    check(
      `${name}: has an Edit button`,
      (await page.getByRole("button", { name: `Edit ${name}` }).count()) >= 1,
    );
    check(
      `${name}: has a Preview button`,
      (await page.getByRole("button", { name: `Preview ${name} as a guest` }).count()) >= 1,
    );
  }
  await page.getByRole("button", { name: "Preview Empty as a guest" }).first().click();
  const dialog = page.getByRole("dialog", { name: /Guest Preview/ });
  await dialog.waitFor();
  check("Preview has no edit form", (await dialog.getByPlaceholder(/Headline/).count()) === 0);
  check(
    "Preview's empty state points at Edit",
    (await dialog.innerText()).includes("use Edit to add one"),
  );
  await page.close();
}

console.log("\n2. Editing an existing banner updates it");
{
  const page = await open();
  await page.getByRole("button", { name: "Edit Weekend" }).first().click();
  const dialog = page.getByRole("dialog", { name: /^Edit/ });
  const headline = dialog.getByPlaceholder(/Headline/);
  await headline.waitFor();
  check("opens on the saved headline", (await headline.inputValue()) === "Old headline");
  check(
    "opens on the saved coupon",
    (await dialog.getByPlaceholder(/Coupon code/).inputValue()) === "SAVE10",
  );
  await headline.fill("New headline");
  await dialog.getByLabel(/Coupon valid until/).fill("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "hidden" });
  const calls = await writes(page);
  const assetPut = calls.find((c) => c.path === "/campaigns/assets/asset-1");
  check(
    "the asset is updated, not added again",
    !!assetPut && !calls.some((c) => c.method === "POST"),
    JSON.stringify(calls),
  );
  check("the new headline is sent", assetPut?.body.headline === "New headline");
  check("a blank coupon date saves as no date", assetPut?.body.coupon_expires_at === null);
  check(
    "the scheduled window is kept",
    calls.some((c) => c.path === "/campaigns/banner-1" && c.body.ends_at?.startsWith("2026-11-30")),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

console.log("\n3. A banner with no content yet is added once");
{
  const page = await open();
  await page.getByRole("button", { name: "Edit Empty" }).first().click();
  const dialog = page.getByRole("dialog", { name: /^Edit/ });
  await dialog.getByPlaceholder(/Headline/).fill("First offer");
  await dialog.getByRole("button", { name: "Save" }).click();
  await dialog.waitFor({ state: "hidden" });
  const calls = await writes(page);
  check(
    "adds the asset",
    calls.some((c) => c.method === "POST" && c.path === "/campaigns/banner-2/assets"),
    JSON.stringify(calls),
  );
  await page.close();
}

console.log("\n4. A failed read never adds a second banner");
{
  const page = await open("?fail=1");
  await page.getByRole("button", { name: "Edit Weekend" }).first().click();
  const dialog = page.getByRole("dialog", { name: /^Edit/ });
  await dialog.getByText("Could not load this banner").waitFor();
  check("no Save button", (await dialog.getByRole("button", { name: "Save" }).count()) === 0);
  check("nothing written", (await writes(page)).length === 0);
  await page.close();
}

console.log("\n5. Survey Edit opens its questions");
{
  const page = await open();
  await page.getByRole("button", { name: "Edit Feedback" }).first().click();
  await page.getByRole("dialog", { name: /Manage Questions/ }).waitFor();
  check("opens Manage Questions", true);
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`campaign edit: ${failures} FAILED`);
  process.exit(1);
}
console.log("campaign edit: all checks passed");
