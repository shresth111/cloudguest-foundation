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
];
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
        try {
          code = (await r.json())?.data?.code ?? "";
        } catch {
          /* not json */
        }
        if (r.status() < 500 && OFF_CODE.test(code)) return;
        problems.push(`http ${r.status()} ${r.request().method()} ${u.pathname} ${code}`.trim());
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
      return {
        textLength: text.length,
        heading: !!main.querySelector("h1,h2,h3"),
        boundary: /something went wrong|unexpected application error/i.test(text),
      };
    })
    .catch(() => ({ textLength: 0, heading: false, boundary: false }));
  if (shape.boundary) problems.push("error boundary shown");
  if (!shape.heading && shape.textLength < 40) problems.push("blank screen");
  const shot = join(OUT, `${slug(path)}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);
  const row = { path, ok: problems.length === 0, ms: Date.now() - started, problems, shot };
  results.push(row);
  console.log(
    `${row.ok ? "PASS" : "FAIL"} ${path}${row.ok ? "" : `\n    - ${problems.join("\n    - ")}`}`,
  );
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
  const href = await page
    .$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))
    .then((hs) => hs.find((h) => h && re.test(h.split("?")[0])));
  if (href) await visit(page, href.split("#")[0], results);
  else results.push({ path: `${list} -> detail`, ok: true, skipped: "no rows", problems: [] });
}

const failed = results.filter((r) => !r.ok);
writeFileSync(
  join(OUT, "results.json"),
  JSON.stringify({ signedIn: true, base: BASE, results }, null, 2),
);
console.log(`\nSUMMARY ${results.length - failed.length} pass, ${failed.length} fail`);
await browser.close();
process.exit(failed.length ? 1 : 0);
