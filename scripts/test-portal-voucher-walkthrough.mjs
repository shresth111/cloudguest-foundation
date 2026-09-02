/**
 * Render-level regression test for the VOUCHER step of the guest
 * walkthrough, and for the real voucher sign-in it must not disturb.
 *
 * Run: `npm run test:voucher-walkthrough`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * Voucher is the one sign-in method whose submit does not live in
 * `useGuestSignIn`. It is a separate ROUTE (`/portal/auth/voucher`), and a
 * real guest reaches it by a real router `<Link>`. That link is the single
 * way a simulated surface can escape into a REAL login: followed from the
 * operator's Portal Preview or from the guest walkthrough it lands on the
 * LIVE guest portal for that venue's own organization/location, where
 * `portalRuntimeService.loginWithVoucher` creates a REAL `GuestSession`,
 * against a real venue, from what everyone on screen believes is a demo.
 *
 * The affordance is therefore never a link on a simulated surface. The
 * cost used to be that a VOUCHER-ONLY venue had no runnable walkthrough at
 * all -- no OTP, no password, so the demo of the whole guest journey
 * stopped dead on its first screen. It now opens the real `VoucherForm`
 * INLINE, in the same provider, with no navigation, accepting any code the
 * way the demo OTP accepts any six digits.
 *
 * Two opposite things both have to stay true, and neither is visible to
 * `tsc`, to eslint, or to a source-text grep:
 *
 *   1. THE WALKTHROUGH MUST WRITE NOTHING. No `loginWithVoucher`, no
 *      `GuestSession`, no consent, no navigation to `/portal/success`
 *      (the only place the NAS hotspot POST is fired), and no network of
 *      any kind. Asserted by driving the real components in a real
 *      Chromium with the service module replaced by a recorder, the
 *      router replaced by a recorder, and `fetch`/`XHR`/`sendBeacon`
 *      wrapped -- so a call reaching ANY of them fails this suite rather
 *      than quietly billing a real venue for a demo.
 *   2. A REAL GUEST'S VOUCHER SIGN-IN MUST BE UNCHANGED. The same
 *      `VoucherForm`, mounted with neither flag set, must still call
 *      `loginWithVoucher` exactly once with exactly the arguments it
 *      always did. A guard that also breaks the real path is not a fix,
 *      and "the demo is safe" is trivially satisfiable by breaking
 *      everything.
 *
 * MUTATIONS VERIFIED (each one applied to the real source, this suite
 * re-run, all five caught -- exit 1, and the named checks below red):
 *
 *   M1  `VoucherForm`'s `if (demoMode)` branch deleted
 *       -> "NO portalRuntimeService call was made" fails, WITH the real
 *          `loginWithVoucher({identifier, code, organizationId, ...})`
 *          printed in the detail. 12 checks red.
 *   M2  `AuthTabSwitcher`'s guard weakened to `if (previewMode)`
 *       -> "it is a BUTTON, never a router link out to the live voucher
 *          route" fails (1 voucher link rendered), and the walkthrough
 *          stops dead on its sign-in screen again. 17 checks red.
 *   M3  the voucher step's `DemoNotice` removed
 *       -> the three honesty checks fail; nothing else does, which is the
 *          point: a screen can go silently dishonest while working.
 *   M4  the connected screen's voucher-specific notice reverted to the
 *       generic one -> "says no real voucher was checked" fails.
 *   M5  the demo branch's flag dropped (`if (true)`), i.e. the demo path
 *       leaking into the REAL one
 *       -> "a real guest's submit still calls loginWithVoucher exactly
 *          once" fails, and "no demo session is ever handed to a real
 *          guest's onLoggedIn" prints the fake session it got. Both
 *          directions are load-bearing.
 *
 * The components under test are the real `DemoPortalFlow`,
 * `GuestSignInCard`, `AuthTabSwitcher` and `VoucherForm`, inside the real
 * `PortalRuntimeProvider`, bundled with esbuild. Only the edges are
 * substituted: the runtime service (the network), the campaign portal
 * service (the network), and `@tanstack/react-router` (there is no router
 * in this harness -- and a stub is also how a navigation gets *recorded*
 * rather than silently working).
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "voucher-walkthrough-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}${detail ? `: ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
  }
};

// ---------------------------------------------------------------------------
// Stubs -- the network edges and the router, and nothing else.
// ---------------------------------------------------------------------------

// Every method records and then REJECTS. Rejecting rather than resolving
// is deliberate: if a simulated path ever did reach one of these, a
// resolved promise could carry the flow onward and look like it worked.
const SERVICE_STUB = `
const record = (name) => (...args) => {
  (globalThis.__calls ||= []).push({ service: "portalRuntimeService", name, args });
  return Promise.reject(new Error("portalRuntimeService." + name + " must not be called here"));
};
export const portalRuntimeService = new Proxy({}, { get: (_t, name) => record(String(name)) });
`;
writeFileSync(join(work, "service-stub.js"), SERVICE_STUB);

const CAMPAIGN_STUB = `
const record = (name) => (...args) => {
  (globalThis.__calls ||= []).push({ service: "campaignPortalService", name, args });
  return Promise.reject(new Error("campaignPortalService." + name + " must not be called here"));
};
export const campaignPortalService = new Proxy({}, { get: (_t, name) => record(String(name)) });
`;
writeFileSync(join(work, "campaign-stub.js"), CAMPAIGN_STUB);

// The router. `Link` renders a REAL anchor so the test can tell a link
// apart from a button -- that distinction is the whole guard.
const ROUTER_STUB = `
import { createElement } from "react";
export function Link({ to, params, search, children, ...rest }) {
  const href = typeof to === "string" ? to.replace("$method", params?.method ?? "") : "#";
  return createElement("a", { ...rest, href, "data-router-link": "true" }, children);
}
export function useNavigate() {
  return (opts) => { (globalThis.__nav ||= []).push(opts); };
}
export function useSearch() { return {}; }
export function useParams() { return {}; }
export function createFileRoute() { return () => ({}); }
`;
writeFileSync(join(work, "router-stub.js"), ROUTER_STUB);

const SONNER_STUB = `
const push = (level) => (msg) => { (globalThis.__toasts ||= []).push({ level, msg: String(msg) }); };
export const toast = Object.assign(push("default"), {
  info: push("info"), success: push("success"), error: push("error"), warning: push("warning"),
});
export function Toaster() { return null; }
`;
writeFileSync(join(work, "sonner-stub.js"), SONNER_STUB);

// ---------------------------------------------------------------------------
// The harness. Three scenarios, one bundle.
// ---------------------------------------------------------------------------

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";
   import { DemoPortalFlow } from "@/components/portal-runtime/DemoPortalFlow";
   import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
   import { PortalShell } from "@/components/portal-runtime/PortalShell";
   import { VoucherForm } from "@/components/portal-runtime/AuthMethodForms";

   // A voucher-ONLY venue: the configuration that had no runnable
   // walkthrough at all before this. Every other method is off.
   const VOUCHER_ONLY_CONFIG = {
     id: "cfg-voucher-only",
     name: "The Test Venue",
     theme: "light",
     logoUrl: null,
     backgroundImageUrl: null,
     primaryColor: "#6366f1",
     secondaryColor: "#4f46e5",
     defaultLanguage: "en",
     supportedLanguages: ["en"],
     advertisementBannerUrl: null,
     advertisementBannerLink: null,
     termsAndConditionsText: null,
     termsAndConditionsUrl: null,
     privacyPolicyText: null,
     privacyPolicyUrl: null,
     splashHeadline: null,
     splashWelcomeMessage: null,
     redirectUrl: null,
     postLoginHtml: null,
     contentMode: "login",
     contentHeading: null,
     contentBody: null,
     contentImageUrl: null,
     survey: null,
     otpSmsEnabled: false,
     otpEmailEnabled: false,
     otpWhatsappEnabled: false,
     usernamePasswordEnabled: false,
     voucherEnabled: true,
     pinLoginEnabled: false,
     resolvedViaLocationOverride: false,
     isOpenNow: true,
     businessHoursClosedMessage: null,
     guestFontChoice: "system",
     backgroundOverlayStrength: 55,
     backgroundFocalX: 50,
     backgroundFocalY: 25,
     backgroundLuminance: null,
     backgroundTopLuminance: null,
     backgroundEntropy: null,
     locationCountry: "IN",
   };

   function Scenario({ kind }) {
     // The walkthrough and the static preview differ ONLY in these two
     // flags -- exactly as preview.portal.$locationId.tsx sets them.
     const previewMode = kind === "preview";
     const demoMode = kind === "demo";
     return (
       <PortalRuntimeProvider
         organizationId="org-1"
         locationId="loc-1"
         routerId="preview"
         previewMode={previewMode}
         demoMode={demoMode}
         presetConfig={VOUCHER_ONLY_CONFIG}
         presetConfigLoading={false}
       >
         {kind === "demo" ? (
           <DemoPortalFlow constrained />
         ) : kind === "real-form" ? (
           // The REAL guest's own voucher form, mounted the way
           // /portal/auth/voucher mounts it: no previewMode, no demoMode.
           <PortalShell constrained>
             <VoucherForm
               organizationId="org-1"
               locationId="loc-1"
               routerId="router-1"
               onLoggedIn={(s) => { (globalThis.__loggedIn ||= []).push(s); }}
             />
           </PortalShell>
         ) : (
           <PortalShell constrained>
             <GuestSignInCard />
           </PortalShell>
         )}
       </PortalRuntimeProvider>
     );
   }

   let root = null;
   globalThis.__mount = (kind) => {
     globalThis.__calls = [];
     globalThis.__nav = [];
     globalThis.__toasts = [];
     globalThis.__loggedIn = [];
     globalThis.__net = [];
     try { window.sessionStorage.clear(); } catch {}
     if (root) { root.unmount(); root = null; }
     const host = document.getElementById("root");
     host.innerHTML = "";
     root = createRoot(host);
     root.render(
       <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
         <Scenario kind={kind} />
       </QueryClientProvider>,
     );
   };
   globalThis.__ready = true;`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  // Vite's `import.meta.env` does not exist outside Vite; any module that
  // reads it at import time would throw before a single component renders.
  define: {
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "/api/v1",
    }),
  },
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "portal-aliases",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/portal-runtime\.service$/ }, () => ({
          path: join(work, "service-stub.js"),
        }));
        b.onResolve({ filter: /^@\/services\/campaign-portal\.service$/ }, () => ({
          path: join(work, "campaign-stub.js"),
        }));
        b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: join(work, "router-stub.js"),
        }));
        b.onResolve({ filter: /^sonner$/ }, () => ({ path: join(work, "sonner-stub.js") }));
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
            if (existsSync(p) && extname(p)) return { path: p };
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
   <title>Voucher walkthrough harness</title>
   <style>
     :root { --pg-type-scale: 1; --pg-border: #E2E8F0; --pg-surface: #fff;
             --pg-ink: #0F172A; --pg-ink-muted: #475569; }
     body { font-family: -apple-system, "Segoe UI", Roboto, ui-sans-serif, sans-serif; margin: 16px; }
     .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
   </style>
   <script>
     // THE BACKSTOP. The module stubs above record calls to the two
     // services this code is known to have; this records a request by ANY
     // route out of the page, including one nothing here anticipated.
     (function () {
       const log = (kind, url) => { (globalThis.__net ||= []).push({ kind, url: String(url) }); };
       const f = window.fetch;
       window.fetch = function (input, init) {
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

// --- serve it ----------------------------------------------------------
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

const mount = async (kind) => {
  await page.goto(`${origin}/index.html`);
  await page.waitForFunction(() => globalThis.__ready === true);
  await page.evaluate((k) => globalThis.__mount(k), kind);
  await page.waitForSelector("#root *");
};
const state = () =>
  page.evaluate(() => ({
    calls: globalThis.__calls ?? [],
    nav: globalThis.__nav ?? [],
    toasts: globalThis.__toasts ?? [],
    loggedIn: globalThis.__loggedIn ?? [],
    net: globalThis.__net ?? [],
    storedSession: (() => {
      try {
        return window.sessionStorage.getItem("cloudguest_portal_session");
      } catch {
        return null;
      }
    })(),
  }));

/** Every wait here is an assertion in disguise: when the thing under test
 * breaks, the wait is what stops happening. Throwing out of the script
 * turns "loginWithVoucher was called from a demo" into a bare Playwright
 * timeout with no named check attached, so waits are soft -- the check
 * that depended on them fails and reports, and the checks AFTER it still
 * run and report what actually went wrong. */
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
  // 1. THE WALKTHROUGH (demoMode) on a voucher-only venue.
  // =====================================================================
  console.log("\n-- walkthrough (demoMode), voucher-only venue --");
  await mount("demo");

  const affordance = page.getByRole("button", { name: /redeem|voucher/i }).first();
  check(
    "the voucher affordance is on the walkthrough's sign-in step",
    await soft(() => affordance.waitFor({ timeout: 5000 })),
  );
  const voucherLinks = () => page.locator('a[data-router-link][href*="voucher"]');
  check(
    "it is a BUTTON, never a router link out to the live voucher route",
    (await voucherLinks().count()) === 0,
    `${await voucherLinks().count()} voucher links rendered`,
  );
  check(
    "the voucher fields are not mounted until it is used",
    (await page.locator('input[placeholder="ABCD-1234"]').count()) === 0,
  );

  const codeField = page.locator('input[placeholder="ABCD-1234"]');
  const opened =
    (await soft(() => affordance.click({ timeout: 5000 }))) &&
    (await soft(() => codeField.waitFor({ timeout: 5000 })));
  check("using it opens the real VoucherForm inline", opened);
  check(
    "...with no navigation of any kind",
    (await state()).nav.length === 0,
    JSON.stringify((await state()).nav),
  );
  check("...and still no link out to the live voucher route", (await voucherLinks().count()) === 0);

  const bodyText = () => page.locator("#root").innerText();
  const openText = await bodyText();
  check(
    "the step says any code is accepted",
    /any code is accepted/i.test(openText),
    JSON.stringify(openText.slice(0, 400)),
  );
  check(
    "the step says nothing is redeemed or marked used",
    /redeemed or marked as used/i.test(openText),
  );
  check("the step names itself a demonstration", /demonstration/i.test(openText));
  check(
    "the step never claims a voucher was validated",
    !/(voucher (accepted|valid|verified|applied))/i.test(openText),
    JSON.stringify(openText.slice(0, 400)),
  );

  // Validation still runs -- the demo branch sits behind the resolver, so
  // an empty code cannot walk past it into the connected screen.
  const identifierField = page.locator('input[placeholder="you@example.com or +1 555 010 2200"]');
  await soft(() => identifierField.fill("guest@example.com", { timeout: 5000 }));
  await soft(() => page.getByRole("button", { name: /submit/i }).click({ timeout: 5000 }));
  await page.waitForTimeout(400);
  check(
    "an empty code is still rejected by the real validation",
    (await page.locator('input[placeholder="ABCD-1234"]').count()) === 1,
    "the form advanced without a code",
  );
  check("...and nothing was recorded for it", (await state()).calls.length === 0);

  // Any code is accepted, exactly as any 6-digit demo OTP is.
  await soft(() => codeField.fill("NOT-A-REAL-VOUCHER", { timeout: 5000 }));
  await soft(() => page.getByRole("button", { name: /submit/i }).click({ timeout: 5000 }));
  const reachedConnected = await soft(() =>
    page.waitForFunction(
      () => /you.?re connected|connected/i.test(document.getElementById("root")?.innerText ?? ""),
      null,
      { timeout: 8000 },
    ),
  );
  const connectedText = await bodyText();
  check(
    "any code carries the walkthrough through to the connected screen",
    reachedConnected,
    JSON.stringify(connectedText.slice(0, 300)),
  );
  check(
    "the connected screen shows the identifier that was typed",
    connectedText.includes("guest@example.com"),
  );

  const afterConnect = await state();
  check(
    "NO portalRuntimeService call was made -- loginWithVoucher included",
    afterConnect.calls.length === 0,
    JSON.stringify(afterConnect.calls),
  );
  check(
    "no loginWithVoucher specifically",
    !afterConnect.calls.some((c) => c.name === "loginWithVoucher"),
  );
  check("no recordConsent", !afterConnect.calls.some((c) => c.name === "recordConsent"));
  check(
    "NO network request left the page at all (fetch/XHR/beacon)",
    afterConnect.net.length === 0,
    JSON.stringify(afterConnect.net),
  );
  check(
    "NO navigation -- so /portal/success, the only NAS hotspot POST, is never reached",
    afterConnect.nav.length === 0,
    JSON.stringify(afterConnect.nav),
  );
  check(
    "the only session anywhere is the fake in-memory one",
    !!afterConnect.storedSession &&
      JSON.parse(afterConnect.storedSession).sessionId === "demo-session",
    String(afterConnect.storedSession).slice(0, 200),
  );
  check(
    "...recorded as a voucher sign-in",
    !!afterConnect.storedSession && JSON.parse(afterConnect.storedSession).authMethod === "voucher",
  );
  check(
    "the connected screen says no real voucher was checked",
    /not checked against any real voucher/i.test(connectedText),
    JSON.stringify(connectedText.slice(0, 500)),
  );
  check(
    "the connected screen says nothing was redeemed or marked used",
    /redeemed or marked as used/i.test(connectedText),
  );
  check(
    "the connected screen still says no session was created",
    /no session was created/i.test(connectedText),
  );

  // Start over must return to the sign-in step, not to a half-cleared one.
  await soft(() => page.getByRole("button", { name: /start over/i }).click({ timeout: 5000 }));
  await page.waitForTimeout(300);
  check(
    "Start over returns the walkthrough to its sign-in step",
    await soft(() =>
      page
        .getByRole("button", { name: /redeem|voucher/i })
        .first()
        .waitFor({ timeout: 5000 }),
    ),
  );

  // The step is escapable without submitting.
  await soft(() =>
    page
      .getByRole("button", { name: /redeem|voucher/i })
      .first()
      .click({ timeout: 5000 }),
  );
  await soft(() => codeField.waitFor({ timeout: 5000 }));
  await soft(() => page.getByRole("button", { name: /back/i }).first().click({ timeout: 5000 }));
  await page.waitForTimeout(300);
  check(
    "Back leaves the voucher step without signing anything in",
    (await page.locator('input[placeholder="ABCD-1234"]').count()) === 0 &&
      (await state()).calls.length === 0,
  );

  // =====================================================================
  // 2. THE STATIC PREVIEW (previewMode) -- unchanged, still inert.
  // =====================================================================
  console.log("\n-- static preview (previewMode) --");
  await mount("preview");
  const previewAffordance = page.getByRole("button", { name: /redeem|voucher/i }).first();
  check(
    "the static preview's affordance is still a button",
    await soft(() => previewAffordance.waitFor({ timeout: 5000 })),
  );
  check(
    "...and still not a link out to the live voucher route",
    (await page.locator('a[data-router-link][href*="voucher"]').count()) === 0,
  );
  await soft(() => previewAffordance.click({ timeout: 5000 }));
  await page.waitForTimeout(400);
  const previewState = await state();
  check(
    "clicking it does NOT open a voucher form on the static preview",
    (await page.locator('input[placeholder="ABCD-1234"]').count()) === 0,
  );
  check(
    "...it still explains itself with a toast",
    previewState.toasts.some((t) => /voucher/i.test(t.msg)),
    JSON.stringify(previewState.toasts),
  );
  check("...and calls nothing", previewState.calls.length === 0 && previewState.net.length === 0);

  // =====================================================================
  // 3. A REAL GUEST -- neither flag. Nothing here may have changed.
  // =====================================================================
  console.log("\n-- real guest (neither flag) --");
  await mount("real");
  const realVoucherLink = page.locator('a[data-router-link][href*="voucher"]');
  check(
    "a real guest's voucher affordance is a real router <Link>",
    (await realVoucherLink.count()) === 1,
    `${await realVoucherLink.count()} found`,
  );
  check(
    "...pointing at the real /portal/auth/voucher route",
    ((await realVoucherLink.first().getAttribute("href")) ?? "").includes("/portal/auth/voucher"),
    (await realVoucherLink.first().getAttribute("href")) ?? "(none)",
  );

  await mount("real-form");
  await soft(() =>
    page.locator('input[placeholder="you@example.com or +1 555 010 2200"]').fill("+911234567890"),
  );
  await soft(() => page.locator('input[placeholder="ABCD-1234"]').fill("REAL-0001"));
  await soft(() => page.getByRole("button", { name: /submit/i }).click({ timeout: 5000 }));
  await soft(() =>
    page.waitForFunction(() => (globalThis.__calls ?? []).length > 0, null, { timeout: 8000 }),
  );
  const realState = await state();
  const voucherCalls = realState.calls.filter((c) => c.name === "loginWithVoucher");
  check(
    "a real guest's submit still calls loginWithVoucher exactly once",
    voucherCalls.length === 1,
    JSON.stringify(realState.calls),
  );
  check(
    "...with the identifier and code the guest typed",
    voucherCalls[0]?.args?.[0]?.identifier === "+911234567890" &&
      voucherCalls[0]?.args?.[0]?.code === "REAL-0001",
    JSON.stringify(voucherCalls[0]?.args?.[0]),
  );
  check(
    "...and the venue's real org/location/router ids",
    voucherCalls[0]?.args?.[0]?.organizationId === "org-1" &&
      voucherCalls[0]?.args?.[0]?.locationId === "loc-1" &&
      voucherCalls[0]?.args?.[0]?.routerId === "router-1",
    JSON.stringify(voucherCalls[0]?.args?.[0]),
  );
  check(
    "no demo session is ever handed to a real guest's onLoggedIn",
    realState.loggedIn.length === 0,
    JSON.stringify(realState.loggedIn),
  );

  check("no uncaught page errors in any scenario", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

// ---------------------------------------------------------------------------
// Source-level invariants -- the structural facts a render test cannot see.
// ---------------------------------------------------------------------------
console.log("\n-- source invariants --");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const authForms = read("src/components/portal-runtime/AuthMethodForms.tsx");
const tabSwitcher = read("src/components/portal-runtime/AuthTabSwitcher.tsx");
const authRoute = read("src/routes/portal.auth.$method.tsx");
const signInCard = read("src/components/portal-runtime/GuestSignInCard.tsx");
const previewRoute = read("src/routes/preview.portal.$locationId.tsx");

// One call site, still. A second one is a second place the guards have to
// be remembered, which is how this class of bug comes back.
const allSrc = (function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
})(join(ROOT, "src"));
const voucherCallSites = allSrc.filter((p) => /\.loginWithVoucher\(/.test(readFileSync(p, "utf8")));
check(
  "loginWithVoucher still has exactly ONE call site in src/",
  voucherCallSites.length === 1,
  voucherCallSites.join(", "),
);
check(
  "...and it is VoucherForm's own mutation",
  voucherCallSites[0]?.endsWith("AuthMethodForms.tsx"),
  voucherCallSites[0],
);

// The demo branch must come BEFORE the mutation, and previewMode between
// them -- the same order useGuestSignIn uses for every other method.
const demoIdx = authForms.indexOf("if (demoMode) {", authForms.indexOf("const onSubmit"));
const previewIdx = authForms.indexOf("if (previewMode) {", demoIdx);
const mutateIdx = authForms.indexOf("login.mutate(v)", demoIdx);
check("VoucherForm's submit branches on demoMode", demoIdx > 0);
check("...then on previewMode", previewIdx > demoIdx);
check("...and only then reaches login.mutate", mutateIdx > previewIdx);

// The guard that stops the escape to the live portal.
check(
  "AuthTabSwitcher still refuses to render a link on ANY simulated surface",
  /if \(previewMode \|\| demoMode\) \{/.test(tabSwitcher),
);
const guardIdx = tabSwitcher.indexOf("if (previewMode || demoMode) {");
check(
  "...and its <Link> to /portal/auth/$method is only reachable past that guard",
  tabSwitcher.indexOf('to="/portal/auth/$method"') > guardIdx,
);

// The route real guests use was deliberately NOT made preview-aware.
check(
  "the real /portal/auth/$method route knows nothing about previewMode",
  !/previewMode/.test(authRoute),
);
check("...or about demoMode", !/demoMode/.test(authRoute));
check(
  "...and still renders the real VoucherForm",
  /<VoucherForm/.test(authRoute) && /onLoggedIn=\{onVoucherLoggedIn\}/.test(authRoute),
);

// The walkthrough's own step navigates nowhere.
check(
  "the card that hosts the walkthrough's voucher step never navigates",
  !/useNavigate|navigate\(/.test(signInCard),
);
check(
  "the voucher step is gated on the hook's demoMode-only flag",
  /sign\.showVoucherForm/.test(signInCard),
);

// The honest treatment on the surface that runs the walkthrough.
check(
  "the amber demonstration strip still renders whenever the walkthrough is on",
  /\{walkthrough && \(/.test(previewRoute) &&
    /Demonstration &middot; not a live guest session/.test(previewRoute),
);

console.log("");
if (failures.length) {
  console.log(`voucher-walkthrough: ${failures.length} FAILED`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("voucher-walkthrough: all checks passed");
