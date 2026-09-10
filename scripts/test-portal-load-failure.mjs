/**
 * The Portal editor must never present its defaults as a venue's settings.
 *
 * Run: `node scripts/test-portal-load-failure.mjs`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * `PortalPage` used to load with `loadPortal().catch(() => {})`, commented
 * "leave the form at its sensible defaults above". On this screen there is
 * no such thing as a sensible default: every control here is a claim about
 * what a venue's guests are being asked for RIGHT NOW. Mobile OTP and
 * Voucher initialise on, the review card off, the terms box empty. So a
 * failed read rendered a page that states, with no hedging anywhere on it,
 * "your guests sign in with an OTP or a voucher, you ask them for nothing
 * afterwards, and you publish no terms". For a venue whose settings really
 * are those, that is correct. For every other venue it is a lie, and the two
 * are pixel-identical.
 *
 * The reading is the smaller half. Save Configuration PATCHes what is on
 * screen, and with no `portalId` it CREATEs. An owner who opened this page
 * during a blip, saw a wrong flag and corrected it would have written six
 * defaults over their real configuration -- or created a second config row
 * for the venue. That is a data-loss path reachable from an ordinary
 * network hiccup.
 *
 * This is the same defect class already fixed on Access Rules -> Sign-in
 * Methods, a screen that was later deleted as a duplicate of this one. The
 * fix is the same one: a failed load is visibly a failed load, and nothing
 * that would write is usable until we have actually read.
 *
 * WHY A REAL BROWSER. The failure only exists after an effect runs and a
 * promise rejects. `renderToStaticMarkup` runs no effects, so a server
 * render can only ever see the initial state -- it would report this page as
 * fixed no matter what the catch block does. The real component is driven in
 * a real Chromium with the service layer replaced by a recorder, which is
 * the same harness `scripts/test-portal-voucher-walkthrough.mjs` uses.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. A FAILED LOAD CANNOT WRITE. Save is not clickable, the switches are
 *      not flippable, and a click on either sends nothing. Asserted by
 *      recording every call into the service module AND wrapping
 *      fetch/XHR/sendBeacon, so a write by a route this test did not
 *      anticipate still fails it.
 *   2. A FAILED LOAD LOOKS LIKE ONE. The screen says the settings could not
 *      be read and that what is shown are defaults -- because the whole
 *      defect is that "we don't know" and "it's on" rendered identically.
 *   3. RECOVERY WORKS. Try again re-reads, and on success the lock lifts and
 *      the venue's REAL values are on screen -- not the defaults.
 *   4. THE HAPPY PATH IS UNTOUCHED. A successful load leaves the editor
 *      usable and shows no banner. A guard that also breaks the working case
 *      is not a fix.
 *   5. A REFRESH THAT FAILS RE-LOCKS. After it, the form holds values this
 *      page can no longer vouch for, so it stops claiming to.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "portal-load-failure-"));

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Stubs. Only the seams this page does not own.
// ---------------------------------------------------------------------------

/** The venue's REAL saved configuration -- deliberately the opposite of this
 * page's defaults on every field the test looks at, so "the form shows the
 * stored value" and "the form shows its default" can never be confused. */
const STORED_PORTAL = {
  id: "portal-1",
  locationId: "loc-1",
  locationName: "Grand Hotel — Lobby",
  branding: { primaryColor: "#0f172a" },
  seo: { pageTitle: "Welcome to the Grand", metaDescription: "Enjoy the WiFi" },
  // Defaults are ["mobile_otp", "voucher"]. The real venue uses neither.
  loginMethods: ["email_otp"],
  login: { redirectUrl: "", postLoginHtml: "" },
  languages: ["en"],
  consent: { termsText: "Our house rules." },
  content: { mode: "login", heading: "", body: "", imageUrl: "", survey: null },
  postConnect: {
    collectGuestName: true,
    collectGuestEmail: false,
    reviewUrl: "",
    reviewCardEnabled: false,
    guestFeedbackEnabled: false,
    feedbackDwellMinutes: 30,
  },
};

writeFileSync(
  join(work, "portal-service-stub.js"),
  `const record = (name, args) => { (globalThis.__calls ||= []).push({ name, args }); };
   const STORED = ${JSON.stringify(STORED_PORTAL)};
   export const portalService = {
     async list(args) {
       record("list", args);
       if (globalThis.__failList) {
         const err = new Error("network down");
         err.isAxiosError = false;
         throw err;
       }
       return { items: [STORED], total: 1 };
     },
     async update(id, patch, org) { record("update", { id, patch, org }); return STORED; },
     async create(payload) { record("create", payload); return STORED; },
   };`,
);

writeFileSync(
  join(work, "customer-service-stub.js"),
  `export async function resolveOrgId() { return "org-1"; }
   export function isDemo() { return false; }`,
);

// Branding is a separate, independently-failing read. It resolves to
// "nothing uploaded" so it can never be the reason a check goes red.
writeFileSync(
  join(work, "brand-asset-stub.js"),
  `export const brandAssetService = {
     async getBranding() { return { logoIsUploaded: false, logoUrl: null, hasBackgroundImage: false }; },
     async fetchLogoBlobUrl() { return null; },
     async fetchBackgroundImageBlobUrl() { return null; },
     async uploadLogo() { throw new Error("not used"); },
   };`,
);

writeFileSync(
  join(work, "hooks-stub.js"),
  `export function useIsDemo() { return false; }
   export function useDataMasking() { return { masked: false }; }
   export function useCustomerLocations() { return { data: [], isLoading: false }; }`,
);

writeFileSync(
  join(work, "router-stub.js"),
  `import { createElement } from "react";
   export function Link({ to, children, ...rest }) {
     return createElement("a", { ...rest, href: typeof to === "string" ? to : "#" }, children);
   }
   export function useNavigate() { return (opts) => { (globalThis.__nav ||= []).push(opts); }; }
   export function useSearch() { return {}; }
   export function useParams() { return {}; }
   export function useRouterState() { return {}; }
   export function createFileRoute() { return () => ({}); }`,
);

writeFileSync(
  join(work, "sonner-stub.js"),
  `const push = (level) => (msg) => { (globalThis.__toasts ||= []).push({ level, msg: String(msg) }); };
   export const toast = Object.assign(push("default"), {
     info: push("info"), success: push("success"), error: push("error"), warning: push("warning"),
   });
   export function Toaster() { return null; }`,
);

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { PortalPage } from "@/components/features/PortalPage";

   let root = null;
   globalThis.__mount = (fail) => {
     globalThis.__failList = !!fail;
     globalThis.__calls = [];
     globalThis.__toasts = [];
     globalThis.__net = [];
     if (root) { root.unmount(); root = null; }
     const host = document.getElementById("root");
     host.innerHTML = "";
     root = createRoot(host);
     root.render(
       <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
         <PortalPage locationId="loc-1" />
       </QueryClientProvider>,
     );
   };
   globalThis.__setFail = (v) => { globalThis.__failList = !!v; };
   globalThis.__ready = true;`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  // Vite's `import.meta.env` does not exist outside Vite; `services/api.ts`
  // reads it at import time and would throw before anything renders.
  define: {
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "/api/v1",
    }),
    "process.env.NODE_ENV": '"production"',
  },
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "portal-page-aliases",
      setup(b) {
        const map = {
          "@/services/portal.service": "portal-service-stub.js",
          "@/services/customer.service": "customer-service-stub.js",
          "@/services/brand-asset.service": "brand-asset-stub.js",
          "@/hooks/useCustomerDashboard": "hooks-stub.js",
          "@tanstack/react-router": "router-stub.js",
          sonner: "sonner-stub.js",
        };
        for (const [from, to] of Object.entries(map)) {
          b.onResolve({ filter: new RegExp(`^${from.replace(/[/.@]/g, "\\$&")}$`) }, () => ({
            path: join(work, to),
          }));
        }
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const cand of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
            if (existsSync(cand) && extname(cand)) return { path: cand };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8>
   <title>Portal editor load-failure harness</title>
   <style>body { font-family: system-ui, sans-serif; margin: 16px; }</style>
   <script>
     // THE BACKSTOP. The service stub records the calls this page is known
     // to have; this records a request by ANY other route out of the page.
     (function () {
       const log = (kind, url) => { (globalThis.__net ||= []).push({ kind, url: String(url) }); };
       const f = window.fetch;
       window.fetch = function (input) {
         log("fetch", typeof input === "string" ? input : (input && input.url) || input);
         return f.apply(this, arguments);
       };
       const open = XMLHttpRequest.prototype.open;
       XMLHttpRequest.prototype.open = function (method, url) { log("xhr", url); return open.apply(this, arguments); };
       if (navigator.sendBeacon) {
         const b = navigator.sendBeacon.bind(navigator);
         navigator.sendBeacon = function (url) { log("beacon", url); return b.apply(this, arguments); };
       }
     })();
   </script>
   <div id=root></div>
   <script type=module src="./bundle.js"></script>`,
);

const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = join(work, name);
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const mount = async (fail) => {
  await page.goto(`${origin}/index.html`);
  await page.waitForFunction(() => globalThis.__ready === true);
  await page.evaluate((f) => globalThis.__mount(f), fail);
  await page.waitForSelector("#root *");
  // The load is a promise chain off an effect; give it a turn to settle.
  await page.waitForFunction(() => (globalThis.__calls ?? []).some((c) => c.name === "list"));
  await page.waitForTimeout(150);
};

const saveButton = () => page.getByRole("button", { name: "Save Configuration" }).first();
const otpSwitch = () => page.getByRole("switch", { name: "Mobile OTP" }).first();
const state = () =>
  page.evaluate(() => ({
    calls: globalThis.__calls ?? [],
    toasts: globalThis.__toasts ?? [],
    net: globalThis.__net ?? [],
  }));

/** Every wait here is an assertion in disguise: when the thing under test
 * breaks, the wait is what stops happening. Kept soft so the check that
 * depended on it reports by name, and the checks after it still run. */
const soft = async (fn) => {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
};

try {
  // =====================================================================
  console.log("\n1. a failed load cannot write");
  // =====================================================================
  await mount(true);

  const bannerVisible = await soft(() =>
    page.getByText("saved portal settings could not be read").first().waitFor({ timeout: 3000 }),
  );
  check("the failure is on screen", bannerVisible, "the page still looks like a loaded page");

  check("Save Configuration is disabled", await saveButton().isDisabled());
  check("the Mobile OTP switch is disabled", await otpSwitch().isDisabled());

  const otpBefore = await otpSwitch().getAttribute("data-state");
  await otpSwitch()
    .click({ force: true })
    .catch(() => {});
  await saveButton()
    .click({ force: true })
    .catch(() => {});
  await page.waitForTimeout(200);
  const afterClicks = await state();

  check(
    "clicking the disabled switch changes nothing",
    (await otpSwitch().getAttribute("data-state")) === otpBefore,
    `${otpBefore} -> ${await otpSwitch().getAttribute("data-state")}`,
  );
  check(
    "no update was sent",
    !afterClicks.calls.some((c) => c.name === "update"),
    JSON.stringify(afterClicks.calls.map((c) => c.name)),
  );
  check(
    "and no config row was CREATED either",
    !afterClicks.calls.some((c) => c.name === "create"),
    "with no portalId a save creates a second config for the venue",
  );
  check(
    "no request left the page by any other route",
    afterClicks.net.length === 0,
    JSON.stringify(afterClicks.net),
  );
  check(
    "and nothing told the owner their configuration was saved",
    !afterClicks.toasts.some((t) => /saved/i.test(t.msg)),
    JSON.stringify(afterClicks.toasts),
  );

  // =====================================================================
  console.log("\n2. a failed load looks like one, and says what is on screen");
  // =====================================================================
  const bodyText = await page.locator("#root").innerText();
  check(
    "it says these are defaults, not the venue's settings",
    /defaults, not your settings/i.test(bodyText),
    "the whole defect is that 'we don't know' and 'it's on' rendered identically",
  );
  check(
    "it says saving would overwrite what is really stored",
    /write those defaults over/i.test(bodyText),
  );
  check(
    "it reassures that guests are unaffected",
    /guests are unaffected/i.test(bodyText),
    "an owner reading a red banner about their WiFi needs to know whether it is down",
  );
  check("it offers a retry", await page.getByRole("button", { name: "Try again" }).isVisible());

  // =====================================================================
  console.log("\n3. recovery works, and brings the venue's real values");
  // =====================================================================
  await page.evaluate(() => globalThis.__setFail(false));
  await page.getByRole("button", { name: "Try again" }).click();
  const recovered = await soft(() =>
    page.getByText("saved portal settings could not be read").first().waitFor({
      state: "detached",
      timeout: 4000,
    }),
  );
  check("the failure banner goes away", recovered);
  check("Save Configuration is usable again", await saveButton().isEnabled());
  check("the Mobile OTP switch is usable again", await otpSwitch().isEnabled());

  const recoveredText = await page.locator("#root").innerText();
  check(
    "the form now holds the venue's stored headline, not a default",
    recoveredText.includes("Welcome to the Grand"),
    "a lock that lifts without loading anything is the original bug with a delay",
  );
  {
    // A textarea's text is its `value`, not its innerText -- React never
    // writes it into the DOM as a child node.
    const textareaValues = await page
      .locator("textarea")
      .evaluateAll((els) => els.map((e) => e.value));
    check(
      "and its stored terms text",
      textareaValues.join(" ").includes("Our house rules."),
      JSON.stringify(textareaValues),
    );
  }
  check(
    "the stored sign-in method is on",
    (await page.getByRole("switch", { name: "Email OTP" }).first().getAttribute("data-state")) ===
      "checked",
  );
  check(
    "and this page's default sign-in method is off, because the venue does not use it",
    (await otpSwitch().getAttribute("data-state")) === "unchecked",
    "if this reads `checked` the page is still showing its own defaults",
  );

  // =====================================================================
  console.log("\n4. the happy path is untouched");
  // =====================================================================
  await mount(false);
  const happyText = await page.locator("#root").innerText();
  check(
    "a successful load shows no failure banner",
    !/could not be read/i.test(happyText),
    "a guard that also breaks the working case is not a fix",
  );
  check("Save Configuration is enabled", await saveButton().isEnabled());
  check("the switches are enabled", await otpSwitch().isEnabled());
  check("the stored headline is shown", happyText.includes("Welcome to the Grand"));

  // And a save from the happy path really does go out -- otherwise every
  // "no write happened" check above is satisfiable by a page that can never
  // write at all.
  await saveButton().click();
  await page.waitForTimeout(250);
  const afterSave = await state();
  check(
    "positive control: a save on a loaded page IS sent",
    afterSave.calls.some((c) => c.name === "update"),
    JSON.stringify(afterSave.calls.map((c) => c.name)),
  );

  // =====================================================================
  console.log("\n5. a refresh that fails re-locks the editor");
  // =====================================================================
  await mount(false);
  check("starts unlocked", await saveButton().isEnabled());
  await page.evaluate(() => globalThis.__setFail(true));
  await page.getByRole("button", { name: "Refresh" }).first().click();
  const relocked = await soft(() =>
    page.getByText("saved portal settings could not be read").first().waitFor({ timeout: 4000 }),
  );
  check(
    "a failed refresh puts the failure back on screen",
    relocked,
    "after it the form holds values this page can no longer vouch for",
  );
  check("and locks Save again", await saveButton().isDisabled());

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
