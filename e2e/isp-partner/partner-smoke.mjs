/**
 * ISP partner console UI smoke (LEFTOVERS). Signs in as a partner user and
 * opens every partner page (and its tabs), failing a page on:
 *
 *   - a console error (browser "Failed to load resource" lines are judged by
 *     the network rule below instead),
 *   - an uncaught page error,
 *   - any /api response >= 500, or >= 400 unless the body names a feature
 *     that is switched off (`*_DISABLED`, `*_NOT_ENABLED`) -- the console probes
 *     those on purpose and hides the section,
 *   - a blank screen (no heading and almost no text in <main>) or the error
 *     boundary.
 *
 * One PNG per page goes to $OUT_DIR, plus results.json. Credentials come
 * ONLY from the environment; nothing is written to disk but screenshots.
 *
 *   PARTNER_BASE_URL=https://network-staging.wyfyguest.com \
 *   PARTNER_EMAIL=... PARTNER_PASSWORD=... OUT_DIR=./out \
 *   node e2e/isp-partner/partner-smoke.mjs
 *
 * It runs on the test box inside the official Playwright image (see
 * e2e/isp-partner/README.md), never against production.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.PARTNER_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.PARTNER_EMAIL;
const PASSWORD = process.env.PARTNER_PASSWORD;
const OUT = process.env.OUT_DIR || "./partner-smoke-out";
if (!BASE || !EMAIL || !PASSWORD) {
  console.error("Set PARTNER_BASE_URL, PARTNER_EMAIL and PARTNER_PASSWORD.");
  process.exit(2);
}
if (/(^|\.)(app|master|network)\.wyfyguest\.com$/.test(new URL(BASE).hostname)) {
  console.error("Refusing a production host; use the test box / staging.");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const tabs = (path, names) => names.map((t) => `${path}?tab=${t}`);
export const STATIC_PAGES = [
  "/partner",
  "/partner/customers",
  "/partner/subscribers",
  "/partner/subscribers/new",
  ...tabs("/partner/plans", ["groups", "packages", "coupons", "subscribers"]),
  ...tabs("/partner/billing", ["dues", "invoices", "payments", "settings"]),
  "/partner/invoices",
  ...tabs("/partner/finance", [
    "template",
    "products",
    "packages",
    "leases",
    "deposits",
    "zones",
    "automation",
    "messages",
  ]),
  "/partner/routers",
  "/partner/tr069",
  "/partner/pppoe",
  "/partner/fiber",
  "/partner/logs",
  "/partner/messaging",
  "/partner/reports",
  ...tabs("/partner/compliance", [
    "nat",
    "trace",
    "lea",
    "retention",
    "kyc",
    "caf",
    "filings",
    "reports",
    "settings",
  ]),
  ...tabs("/partner/apps", [
    "helpdesk",
    "tasks",
    "announcements",
    "discounts",
    "inventory",
    "leads",
  ]),
  "/partner/users",
  "/partner/settings",
  "/partner/settings/integrations",
  "/partner/collections",
  "/partner/incidents",
  "/partner/queued-renewals",
  "/partner/referrals",
  "/partner/revenue",
  "/partner/audit-log",
];
// Every page of the customer workspace, under the first customer's detail
// page (ids from src/components/isp-partner/customer-shell/nav.ts).
const WORKSPACE_FEATURES = [
  "dashboard",
  "alerts",
  "debugging",
  "users",
  "teams",
  "vouchers",
  "reports",
  "campaigns",
  "marketing",
  "portal",
  "business-hours",
  "devices",
  "isp-details",
  "traffic-lens",
  "policies",
  "dhcp",
  "vlans",
  "port-forwarding",
  "voip",
  "security",
  "blocking",
  "firewall",
  "whitelist",
  "mac-auth",
  "admin-logs",
  "network-activity",
  "netlogs",
  "tickets",
  "how-it-works",
  "agents",
];
// These detail pages must be reached: an account with no rows for them is a
// coverage gap, so it fails rather than passing quietly.
const MUST_REACH = /invoices|tr069|coupons/;
// first row of each list -> its detail page
const DETAIL_FROM = [
  ["/partner/customers", /^\/partner\/customers\/[0-9a-f-]{36}$/],
  ["/partner/subscribers", /^\/partner\/subscribers\/[0-9a-f-]{36}$/],
  ["/partner/invoices", /^\/partner\/invoices\/[0-9a-f-]{36}$/, "This FY"],
  ["/partner/routers", /^\/partner\/routers\/[0-9a-f-]{36}$/],
  ["/partner/tr069", /^\/partner\/tr069\/[^/?]+$/],
  ["/partner/plans?tab=coupons", /^\/partner\/plans\/coupons\/[0-9a-f-]{36}$/],
];

const OFF_CODE = /_(DISABLED|NOT_ENABLED)$/;
// Honest answers about this environment, not page faults: the test stack has
// no Cloudflare Gateway account, and a demo router that was never provisioned
// has no device credentials. The customer pages show their own state for these.
const ENVIRONMENT_PATH = /\/dns-filtering\/categories$/;
const ENVIRONMENT_ANSWER =
  /not configured on this platform yet|missing device connection credentials/i;

function slug(path) {
  return (
    path
      .replace(/^\//, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .slice(0, 80) || "root"
  );
}

async function visit(page, path, results) {
  const problems = [];
  const noted = [];
  const onConsole = (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return; // judged by the network rule
    problems.push(`console: ${t.slice(0, 300)}`);
  };
  const onPageError = (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`);
  const pending = [];
  const onResponse = (r) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith("/api/") || r.status() < 400) return;
    pending.push(
      (async () => {
        let code = "";
        let message = "";
        try {
          const body = await r.json();
          code = body?.data?.code ?? "";
          message = body?.message ?? "";
        } catch {
          /* not json */
        }
        if (r.status() < 500 && OFF_CODE.test(code)) return;
        // The body can be gone if the page moved on; this path has one known answer.
        if (ENVIRONMENT_ANSWER.test(message) || (!message && ENVIRONMENT_PATH.test(u.pathname))) {
          noted.push(`${r.status()} ${u.pathname}: ${message.slice(0, 80)}`);
          return;
        }
        problems.push(
          `http ${r.status()} ${r.request().method()} ${u.pathname} ${code} ${message.slice(0, 140)}`.trim(),
        );
      })(),
    );
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);
  const started = Date.now();
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(500);
  } catch (e) {
    problems.push(`navigation: ${String(e).slice(0, 200)}`);
  }
  await Promise.all(pending);
  const where = new URL(page.url()).pathname;
  if (where.startsWith("/partner/login")) problems.push("bounced to the login page");
  const shape = await page
    .evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const text = (main.innerText || "").trim();
      const hit = text.search(
        /this page didn.t load|something went wrong on our end|unexpected application error/i,
      );
      const generic = text.search(/something went wrong/i);
      return {
        textLength: text.length,
        heading: !!main.querySelector("h1,h2,h3"),
        boundary: hit >= 0,
        boundaryText: hit >= 0 ? text.slice(Math.max(0, hit - 60), hit + 120) : "",
        genericError: generic >= 0 ? text.slice(Math.max(0, generic - 80), generic + 80) : "",
      };
    })
    .catch(() => ({ textLength: 0, heading: false, boundary: false }));
  if (shape.boundary) problems.push(`error boundary shown: ${shape.boundaryText}`);
  if (shape.genericError) noted.push(`text: ${shape.genericError.replace(/\s+/g, " ")}`);
  if (!shape.heading && shape.textLength < 40) problems.push("blank screen");
  const shot = join(OUT, `${slug(path)}.png`);
  if (process.env.SMOKE_SHOTS !== "0") {
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  }
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);
  const row = { path, ok: problems.length === 0, ms: Date.now() - started, problems, noted, shot };
  results.push(row);
  console.log(
    `${row.ok ? "PASS" : "FAIL"} ${path}${row.ok ? "" : `\n    - ${problems.join("\n    - ")}`}`,
  );
  for (const n of noted) console.log(`    note: ${n}`);
  return row;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const results = [];

// sign in
await page.goto(`${BASE}/partner/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await Promise.all([
  page
    .waitForURL((u) => !u.pathname.startsWith("/partner/login"), { timeout: 30_000 })
    .catch(() => {}),
  page.click('button[type="submit"]'),
]);
if (new URL(page.url()).pathname.startsWith("/partner/login")) {
  await page.screenshot({ path: join(OUT, "login_failed.png") }).catch(() => {});
  console.log("FAIL sign-in (still on /partner/login)");
  writeFileSync(join(OUT, "results.json"), JSON.stringify({ signedIn: false, results }, null, 2));
  await browser.close();
  process.exit(1);
}

let customerPath = null;
for (const path of STATIC_PAGES) await visit(page, path, results);
for (const [list, re, widen] of DETAIL_FROM) {
  await page.goto(`${BASE}${list}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  if (widen) {
    // e.g. invoices default to "This month"; widen the range to find a row
    await page
      .getByRole("button", { name: widen, exact: true })
      .click()
      .catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  }
  let href = await page
    .$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))
    .then((hs) => hs.find((h) => h && re.test(h.split("?")[0])));
  if (!href) {
    // Some lists open the detail page from a row click, with no link.
    const row = page.locator("tbody tr").first();
    if (await row.count()) {
      await row.click().catch(() => {});
      await page.waitForURL((u) => re.test(u.pathname), { timeout: 8_000 }).catch(() => {});
      const u = new URL(page.url());
      if (re.test(u.pathname)) href = u.pathname;
    }
  }
  if (href) await visit(page, href.split("#")[0], results);
  else if (MUST_REACH.test(list)) {
    results.push({ path: `${list} -> detail`, ok: false, problems: ["no row to open"] });
    console.log(`FAIL ${list} -> detail\n    - no row to open`);
  } else results.push({ path: `${list} -> detail`, ok: true, skipped: "no rows", problems: [] });
  if (href && list === "/partner/customers") customerPath = href.split(/[?#]/)[0];
}
if (customerPath) {
  await page.goto(`${BASE}${customerPath}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  const location = await page
    .$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))
    .then((hs) => hs.find((h) => h && /^\/partner\/locations\/[0-9a-f-]{36}/.test(h)));
  if (location) await visit(page, location.split(/[?#]/)[0], results);
  const loc = location?.match(/locations\/([0-9a-f-]{36})/)?.[1];
  for (const feature of WORKSPACE_FEATURES) {
    const q = loc ? `?location=${loc}` : "";
    await visit(page, `${customerPath}/${feature}${q}`, results);
  }
  // SMOKE_REPEAT=blocking:5 re-opens one workspace page, to catch a flaky fault.
  const [again, times] = (process.env.SMOKE_REPEAT || ":0").split(":");
  for (let i = 0; i < Number(times); i++) {
    await visit(page, `${customerPath}/${again}${loc ? `?location=${loc}` : ""}`, results);
  }
}

const failed = results.filter((r) => !r.ok);
writeFileSync(
  join(OUT, "results.json"),
  JSON.stringify({ signedIn: true, base: BASE, results }, null, 2),
);
console.log(`\nSUMMARY ${results.length - failed.length} pass, ${failed.length} fail`);
await browser.close();
process.exit(failed.length ? 1 : 0);
