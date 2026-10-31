/**
 * Render check: the Internet Connection page (`IspDetailsView`) and the
 * Overview's Internet Connection card (`WanStatusCardView`), mounted for
 * real in Chromium against a recording fake of `@/services/api`.
 *
 * Run: `node scripts/test-isp-page-render.mjs`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * Same harness shape as `test-network-page-fetch-count.mjs`: esbuild bundles
 * the shipping components; only `@/services/api` (recording fake) and
 * `@/services/customer.service` (`isDemo()` reads the token, `resolveOrgId`
 * delegates to the real shared resolver) are substituted.
 *
 * WHAT IT LOCKS DOWN
 *   - every state renders without a page error: dual ISP on backup, single
 *     ISP, no ISP, no router, health checks never ran, controller venue, a
 *     wrong-shaped history body, and the demo session;
 *   - the failover state is said once and prominently ("On backup since");
 *   - NO FAKE DATA IN REAL SESSIONS: a real-token mount never shows a demo
 *     fixture (router DEMO-EDGE-01, `isp-demo-*` ids), and the demo session
 *     makes no `/isp` request at all;
 *   - the page's reads: routers once, `/isp/links` once, and one recent-checks
 *     + one summary read per link -- the two reads the old per-row timeline
 *     and history dialog made, nothing new.
 *
 * Optional screenshots: set ISP_RENDER_CSS to a URL serving the compiled app
 * CSS (e.g. a running `vite dev`'s `/src/styles.css?direct`) and
 * ISP_RENDER_SHOTS to an output directory.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "isp-page-render-"));

const failures = [];
let passed = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name} -- ${detail}`);
  }
};

const API_STUB = `
const CASE = new URLSearchParams(location.search).get("case") || "";
const NOW = Date.now();
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const MIN = 60000, HOUR = 3600000;
const page = (items, extra = {}) => ({
  items, page: 1, page_size: 25, total_items: items.length, total_pages: 1,
  has_next: false, has_previous: false, ...extra,
});
const ROUTER = (vendor) => ({
  id: "r1", location_id: "loc-1", organization_id: "org-1", name: "EDGE-HALL",
  serial_number: "SN1", mac_address: "00:11:22:33:44:55", model: "hEX S",
  vendor, routeros_version: "7.18", management_ip_address: null,
  public_ip_address: null, status: "online", last_seen_at: iso(MIN),
  last_health_check_at: iso(MIN), health_status: "healthy",
  has_api_credentials: true, settings: {}, created_at: iso(90 * 24 * HOUR),
  updated_at: iso(MIN),
});
const LINK = (o) => ({
  router_id: "r1", organization_id: "org-1", location_id: "loc-1",
  link_type: "fiber", connection_mode: "dhcp", is_enabled: true, priority: 0,
  interface: "ether1", gateway_ip_address: null, dns_primary: "1.1.1.1",
  dns_secondary: null, download_bandwidth_mbps: 300, upload_bandwidth_mbps: 100,
  health_status: "healthy", health_status_source: "automated",
  unhealthy_since: null, latency_ms: 9, packet_loss_percentage: 0,
  current_download_mbps: 40, current_upload_mbps: 9, last_checked_at: iso(MIN),
  consecutive_unhealthy_count: 0, created_at: iso(30 * 24 * HOUR),
  auto_failback: true, is_active_uplink: true, role: "primary", ...o,
});
const PRIMARY_DOWN = LINK({
  id: "L1", provider_name: "ACT Fibernet", role: "primary", is_active_uplink: false,
  health_status: "unhealthy", unhealthy_since: iso(42 * MIN), latency_ms: null,
  packet_loss_percentage: 100, current_download_mbps: null, current_upload_mbps: null,
  consecutive_unhealthy_count: 40,
});
const BACKUP_ON = LINK({
  id: "L2", provider_name: "Jio AirFiber", role: "backup", priority: 1,
  interface: "ether2", is_active_uplink: true, latency_ms: 31, current_download_mbps: 22,
  download_bandwidth_mbps: 100, upload_bandwidth_mbps: 50,
});
const SINGLE = LINK({ id: "S1", provider_name: "Airtel Xstream" });

function linksFor() {
  if (CASE === "dual-failover" || CASE === "no-checks" || CASE === "bad-shape") return [PRIMARY_DOWN, BACKUP_ON];
  if (CASE === "single" || CASE === "controller") return [SINGLE];
  return [];
}
function checksFor(id) {
  if (CASE === "no-checks") return [];
  return Array.from({ length: 30 }, (_, i) => ({
    id: id + "-c" + i, isp_link_id: id, checked_at: iso(i * MIN),
    status: id === "L1" ? (i < 42 ? "unhealthy" : "healthy") : "healthy",
    source: "automated", latency_ms: id === "L1" ? null : 30 + (i % 5),
    packet_loss_percentage: id === "L1" ? 100 : 0, error_message: null,
    download_mbps: id === "L1" ? null : 20 + i, upload_mbps: id === "L1" ? null : 5,
  }));
}
function summaryFor(id) {
  if (CASE === "bad-shape") return "<html>gateway timeout</html>";
  const end = Math.floor(NOW / HOUR) * HOUR;
  const buckets = CASE === "no-checks" ? [] : Array.from({ length: 24 }, (_, k) => {
    const ago = 23 - k;
    const down = id === "L1" && ago === 0;
    return {
      bucket_start: new Date(end - ago * HOUR).toISOString(), total_checks: 60,
      healthy_count: down ? 18 : 60, degraded_count: 0, unhealthy_count: down ? 42 : 0,
      uptime_percentage: down ? 30 : 100, avg_latency_ms: down ? null : 12,
      avg_packet_loss_percentage: down ? 70 : 0, avg_download_mbps: down ? null : 50,
      avg_upload_mbps: down ? null : 10, max_download_mbps: null,
    };
  });
  return { bucket_unit: "hour", start: new Date(end - 23 * HOUR).toISOString(), end: new Date(NOW).toISOString(), buckets };
}

window.__CALLS__ = [];
function record(method, url, config) {
  window.__CALLS__.push({ method, url, params: config?.params ?? null });
}
function body(url) {
  if (url === "/me/organizations") return [{ id: "m1", organization_id: "org-1", status: "active" }];
  if (/^\\/locations\\/[^/]+\\/routers$/.test(url)) {
    if (CASE === "no-router") return page([]);
    return page([ROUTER(CASE === "controller" ? "tplink_omada" : "MikroTik")]);
  }
  if (url === "/isp/links") return page(linksFor());
  let m = url.match(/^\\/isp\\/links\\/([^/]+)\\/health-checks$/);
  if (m) return page(checksFor(m[1]), { availability_percentage: null });
  m = url.match(/^\\/isp\\/links\\/([^/]+)\\/health-checks\\/summary$/);
  if (m) return summaryFor(m[1]);
  if (url === "/isp-routing/rules") return page([]);
  return { items: [] };
}
export const api = {
  get: async (url, config) => { record("get", url, config); return { data: body(url) }; },
  post: async (url, _b, config) => { record("post", url, config); return { data: {} }; },
  put: async (url, _b, config) => { record("put", url, config); return { data: {} }; },
  delete: async (url, config) => { record("delete", url, config); return { data: {} }; },
};
export const DEMO_ACCESS_TOKEN = "demo-access-token";
export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const REFRESH_TOKEN_STORAGE_KEY = "cloudguest_refresh_token";
export const USER_STORAGE_KEY = "cloudguest_user";
export const ROLES_STORAGE_KEY = "cloudguest_roles";
export const ORGS_STORAGE_KEY = "cloudguest_organizations";
export function resolveActiveOrganizationId() { return null; }
export default api;
`;
writeFileSync(join(work, "api-stub.js"), API_STUB);

writeFileSync(
  join(work, "customer-service-stub.js"),
  `import { resolveOrganizationId } from "@/services/organization-id";
   export function isDemo() {
     return localStorage.getItem("cloudguest_token") === "demo-access-token";
   }
   export function resolveOrgId() { return resolveOrganizationId(); }
   export const customerService = {};
`,
);

writeFileSync(
  join(work, "entry.jsx"),
  `import "@/lib/i18n";
   import { createRoot } from "react-dom/client";
   import { IspDetailsView } from "@/components/customer/isp/IspDetailsView";
   import { WanStatusCardView } from "@/components/customer/dashboard/WanStatusCard";
   import { DEMO_WAN_LINK, DEMO_WAN_BACKUP_LINK, DEMO_WAN_CHECKS } from "@/components/customer/dashboard/dashboard.types";

   const which = new URLSearchParams(location.search).get("case");
   const dark = new URLSearchParams(location.search).get("dark") === "1";
   if (dark) document.documentElement.classList.add("dark");
   localStorage.setItem("cloudguest_token", which === "demo" ? "demo-access-token" : "a-real-looking-token");

   const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
   let body;
   if (which && which.startsWith("card-")) {
     let wan;
     if (which === "card-empty") wan = { status: "empty" };
     else if (which === "card-failover") {
       const primary = { ...DEMO_WAN_LINK, isActiveUplink: false, healthStatus: "unhealthy", unhealthySince: ago(42), latencyMs: null, packetLossPercentage: 100, currentDownloadMbps: null, currentUploadMbps: null };
       const backup = { ...DEMO_WAN_BACKUP_LINK, isActiveUplink: true, currentDownloadMbps: 64, currentUploadMbps: 12 };
       wan = { status: "ready", links: [backup, primary], checks: { [backup.id]: DEMO_WAN_CHECKS, [primary.id]: DEMO_WAN_CHECKS.map((c) => ({ ...c, status: "unhealthy", latencyMs: null })) } };
     } else wan = { status: "ready", links: [DEMO_WAN_LINK, DEMO_WAN_BACKUP_LINK], checks: { [DEMO_WAN_LINK.id]: DEMO_WAN_CHECKS, [DEMO_WAN_BACKUP_LINK.id]: DEMO_WAN_CHECKS } };
     body = <div style={{ maxWidth: 560 }}><WanStatusCardView wan={wan} onManage={() => {}} /></div>;
   } else {
     body = <IspDetailsView locationId="loc-1" />;
   }
   createRoot(document.getElementById("root")).render(
     <div className="wy-console" style={{ background: "var(--wy-bg)", padding: 24, minHeight: "100vh" }}>{body}</div>,
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
  nodePaths: [resolve(ROOT, "node_modules")],
  loader: { ".css": "empty", ".svg": "dataurl", ".png": "dataurl" },
  define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, MODE: "test" }) },
  plugins: [
    {
      name: "isp-page-aliases",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
        b.onResolve({ filter: /^@\/services\/customer\.service$/ }, () => ({
          path: join(work, "customer-service-stub.js"),
        }));
        b.onResolve({ filter: /^\.\.?\// }, (args) => {
          const target = resolve(args.resolveDir, args.path);
          if (target === join(ROOT, "src", "services", "api")) return { path: join(work, "api-stub.js") };
          if (target === join(ROOT, "src", "services", "customer.service")) {
            return { path: join(work, "customer-service-stub.js") };
          }
          return null;
        });
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          const probes = [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")];
          for (const p of probes) if (existsSync(p) && extname(p)) return { path: p };
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

let css = "";
if (process.env.ISP_RENDER_CSS) {
  try {
    css = await (await fetch(process.env.ISP_RENDER_CSS)).text();
  } catch (e) {
    console.log(`  (no CSS: ${e})`);
  }
}
writeFileSync(join(work, "app.css"), css);
writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8><title>ISP page render harness</title>
   <link rel=stylesheet href="./app.css"><div id=root></div>
   <script type=module src="./bundle.js"></script>`,
);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const file = readFileSync(join(work, name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(file);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const SHOTS = process.env.ISP_RENDER_SHOTS;

async function mount(which, { width = 1280, dark = false, shot } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/index.html?case=${which}${dark ? "&dark=1" : ""}`);
  await page.waitForFunction(() => Array.isArray(window.__CALLS__), null, { timeout: 10_000 });
  await page.waitForTimeout(1500);
  const calls = await page.evaluate(() => window.__CALLS__);
  const text = await page.evaluate(() => document.body.innerText);
  const html = await page.evaluate(() => document.body.innerHTML);
  if (SHOTS && shot && css) await page.screenshot({ path: join(SHOTS, shot), fullPage: true });
  return { page, calls, text, html, errors };
}
const count = (calls, re) => calls.filter((c) => re.test(c.url)).length;
const noDemo = (r) => !/DEMO-EDGE-01|isp-demo-|Demo Location/.test(r.html);

console.log("\nInternet Connection page");

{
  const r = await mount("dual-failover", { shot: "render-isp-failover.png" });
  check("dual-failover renders", r.errors.length === 0, r.errors.join(" | "));
  check("dual-failover banner is on-backup", (await r.page.locator('[data-wy="failover-banner"][data-kind="on-backup"]').count()) === 1);
  check("dual-failover says 'On backup since'", /On backup since/.test(r.text), r.text.slice(0, 300));
  check("dual-failover headline", /Online on backup/.test(r.text));
  check("dual-failover shows both ISPs", /ACT Fibernet/.test(r.text) && /Jio AirFiber/.test(r.text));
  check("dual-failover two link cards", (await r.page.locator('[data-wy="isp-card"]').count()) === 2);
  check("dual-failover down-for on the primary", /Down for 4\dm/.test(r.text));
  check("dual-failover incident chip from summary", (await r.page.locator('[data-wy="incident-chip"]').count()) >= 1);
  await r.page.locator('[data-wy="incident-chip"]').first().click();
  check("clicking an incident pins its window", (await r.page.locator('[data-wy="incident-readout"]').count()) === 1);
  if (SHOTS && css) {
    const box = await r.page.locator('[data-wy="isp-history"] .recharts-surface').first().boundingBox();
    if (box) {
      await r.page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await r.page.waitForTimeout(400);
      await r.page.screenshot({ path: join(SHOTS, "render-isp-tooltip-pinned.png"), fullPage: true });
    }
  }
  check("real session shows no demo fixture", noDemo(r));
  check("routers read once", count(r.calls, /^\/locations\/[^/]+\/routers$/) === 1);
  check("links read once", count(r.calls, /^\/isp\/links$/) === 1, JSON.stringify(r.calls.map((c) => c.url)));
  check("recent checks: one read per link", count(r.calls, /^\/isp\/links\/[^/]+\/health-checks$/) === 2);
  check("summary: one read per link", count(r.calls, /\/health-checks\/summary$/) === 2);
  check(
    "recent checks ask for 30 rows",
    r.calls.filter((c) => /\/health-checks$/.test(c.url)).every((c) => c.params?.page_size === 30),
  );
  await r.page.close();
}
{
  const r = await mount("single", { shot: "render-isp-single.png" });
  check("single renders", r.errors.length === 0, r.errors.join(" | "));
  check("single: one card + backup prompt", (await r.page.locator('[data-wy="isp-card"]').count()) === 1 && /One line, no failover/.test(r.text));
  check("single: no failover banner", (await r.page.locator('[data-wy="failover-banner"]').count()) === 0);
  check("single real session shows no demo fixture", noDemo(r));
  await r.page.close();
}
{
  const r = await mount("none");
  check("no ISP renders", r.errors.length === 0, r.errors.join(" | "));
  check("no ISP: honest empty state", /No internet line added yet/.test(r.text));
  check("no ISP: no history reads", count(r.calls, /health-checks/) === 0);
  await r.page.close();
}
{
  const r = await mount("no-router");
  check("no router renders", r.errors.length === 0, r.errors.join(" | "));
  check("no router: honest empty state", /No router at this location yet/.test(r.text));
  check("no router: no /isp reads", count(r.calls, /^\/isp/) === 0);
  await r.page.close();
}
{
  const r = await mount("no-checks", { shot: "render-isp-no-checks.png" });
  check("health checks missing renders", r.errors.length === 0, r.errors.join(" | "));
  check("health checks missing: says so", /No health checks in this range/.test(r.text) && /No health checks yet/.test(r.text));
  check("health checks missing: no uptime invented", !/100%/.test(r.text), "a 100% appeared with zero checks");
  await r.page.close();
}
{
  const r = await mount("controller");
  check("controller venue renders", r.errors.length === 0, r.errors.join(" | "));
  check("controller venue: note shown", (await r.page.locator('[data-wy="controller-note"]').count()) === 1);
  check("controller venue: no routing rules panel", !/Routing rules/.test(r.text));
  await r.page.close();
}
{
  const r = await mount("bad-shape");
  check("wrong-shaped history body does not crash the page", r.errors.length === 0, r.errors.join(" | "));
  check("wrong-shaped history body shows the error state", /Couldn't load the history/.test(r.text));
  check("cards still render", (await r.page.locator('[data-wy="isp-card"]').count()) === 2);
  await r.page.close();
}
{
  const r = await mount("demo");
  check("demo renders", r.errors.length === 0, r.errors.join(" | "));
  check("demo shows its fixture", /DEMO-EDGE-01/.test(r.html));
  check("demo makes no /isp or router request", count(r.calls, /^\/isp|\/routers$/) === 0, JSON.stringify(r.calls.map((c) => c.url)));
  await r.page.close();
}
if (SHOTS && css) {
  for (const [c, opts] of [
    ["dual-failover", { width: 390, shot: "render-isp-failover-mobile.png" }],
    ["dual-failover", { dark: true, shot: "render-isp-failover-dark.png" }],
  ]) {
    const r = await mount(c, opts);
    await r.page.close();
  }
}

console.log("\nOverview Internet Connection card");
{
  const r = await mount("card-failover", { shot: "render-card-failover.png" });
  check("card failover renders", r.errors.length === 0, r.errors.join(" | "));
  check("card failover banner", (await r.page.locator('[data-wy="failover-banner"][data-kind="on-backup"]').count()) === 1);
  check("card failover rows", (await r.page.locator('[data-wy="wan-row"]').count()) === 2);
  check("card makes no request", r.calls.length === 0, JSON.stringify(r.calls));
  await r.page.close();
}
{
  const r = await mount("card-dual", { shot: "render-card-dual.png" });
  check("card dual renders", r.errors.length === 0, r.errors.join(" | "));
  check("card dual headline", /All 2 ISPs online/.test(r.text));
  check("card dual: no banner when calm", (await r.page.locator('[data-wy="failover-banner"]').count()) === 0);
  check("card dual: plan meters", (await r.page.locator('[role="meter"]').count()) >= 3);
  await r.page.close();
}
{
  const r = await mount("card-empty");
  check("card empty renders", r.errors.length === 0 && /No WAN link configured/.test(r.text), r.errors.join(" | "));
  await r.page.close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
