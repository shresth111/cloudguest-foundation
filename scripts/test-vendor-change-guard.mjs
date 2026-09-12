/**
 * The guard in front of changing a fleet row's vendor.
 *
 * Run: node scripts/test-vendor-change-guard.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-09-10 the vendor `<select>` on the Master console's router screens
 * wrote on `change`: `api.put('/routers/{id}', { vendor })`, straight through,
 * no confirmation and no undo. Looking for the TP-Link option, the platform
 * owner relabelled SEVEN real rows as `tplink_omada` -- including the org's
 * live lab MikroTik hEX lite ("Office Guest") and six MikroTik demo rows.
 * Each relabelled row immediately lost its setup script to the Omada panel,
 * left the Online fleet counter for "Via controller", had reboot and every
 * other agent action disabled by `isControllerManaged`, and stopped being
 * measured for liveness. Nothing on any device changed; the platform's record
 * of seven devices did, silently.
 *
 * The fix is that a `<select>` can no longer write. It can only ASK, and the
 * page answers with `VendorChangeDialog`. What can go wrong with that, and
 * none of it visible to tsc:
 *
 *   - the dialog renders but the mutation fires anyway (guard is decorative);
 *   - Cancel leaves the dropdown reading the vendor that was NOT saved, so
 *     the console shows one thing and the database holds another -- which is
 *     the same class of defect as the incident, reintroduced in the control;
 *   - the typed acknowledgement accepts anything, or is demanded of every row
 *     until people learn to type through it;
 *   - a failed PUT leaves the dropdown on the value that failed to save;
 *   - one of the two vendor controls (the setup drilldown, the fleet drawer)
 *     gets fixed and the other does not.
 *
 * So this drives the REAL fleet screen -- `Route.options.component` out of
 * `src/routes/master.routers.tsx` -- in Chromium, through the REAL
 * `useUpdateRouterVendor` and the REAL `api` client, against a local server
 * that plays the backend and records every request. `useRouters` is a fixture
 * (this is about what a change DOES, not how the fleet is fetched); the auth
 * context, `isDemo`, `sonner` and the router library are stubbed at their
 * seams. The rules themselves are imported from `@/lib/router-vendor-change`
 * and asserted directly, so a mutated rule fails here rather than passing a
 * grep.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "vendor-change-guard-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

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
// Fixtures. Two rows, because the guard is deliberately not the same for both.
// ---------------------------------------------------------------------------
const BASE = {
  serialNumber: "MT-0001",
  macAddress: "02:11:22:33:44:55",
  model: "hEX lite",
  vendor: "mikrotik",
  routerOsVersion: null,
  managementIpAddress: "10.20.0.4",
  publicIpAddress: null,
  status: "online",
  lastSeenAt: null,
  lastHealthCheckAt: null,
  healthStatus: null,
  hasApiCredentials: false,
  settings: {},
  organizationId: "org-1",
  organizationName: "Acme Hospitality",
  locationId: "loc-1",
  locationName: "Head Office",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

/** The row from the incident: it has actually reported in as a MikroTik. */
const LAB = {
  ...BASE,
  id: "r-lab",
  name: "Office Guest",
  routerOsVersion: "7.15.3",
  lastSeenAt: "2026-09-10T08:31:00Z",
};

/** A row that has never reported in: management IP typed by a human at
 * creation, nothing device-written. Ordinary work, plain confirm. */
const SPARE = { ...BASE, id: "r-spare", name: "Spare hEX (unboxed)" };

// ---------------------------------------------------------------------------
// Stubs -- only the seams the screen does not own.
// ---------------------------------------------------------------------------
const routerStub = join(work, "router-stub.jsx");
writeFileSync(
  routerStub,
  `import React from "react";
   export const search = { value: {} };
   export const navigations = [];
   export function useNavigate() { return (to) => { navigations.push(to); }; }
   export function Link({ children, className }) {
     return React.createElement("a", { className }, children);
   }
   export function Outlet() { return null; }
   export function useChildMatches() { return []; }
   export function useParams() { return {}; }
   export function useRouter() { return { navigate: () => {} }; }
   const routerState = { location: { pathname: "/master/routers", search: {} }, matches: [] };
   export function useRouterState(opts) {
     return opts && typeof opts.select === "function" ? opts.select(routerState) : routerState;
   }
   export function redirect(o) { return o; }
   export function createFileRoute() {
     return (options) => ({ options, useSearch: () => search.value, useParams: () => ({}) });
   }`,
);

/** Toasts are captured rather than rendered: `sonner`'s own `Toaster` is not
 * what is under test, but WHICH message the screen decided to raise is. */
const sonnerStub = join(work, "sonner-stub.js");
writeFileSync(
  sonnerStub,
  `export const toasts = [];
   globalThis.__toasts = toasts;
   const push = (kind) => (msg) => { toasts.push({ kind, msg: String(msg) }); };
   export const toast = Object.assign(push("message"), {
     success: push("success"), error: push("error"),
     warning: push("warning"), info: push("info"), message: push("message"),
   });
   export const Toaster = () => null;`,
);

const svcProxy = `new Proxy({}, { get: () => async () => { throw new Error("not part of this test"); } })`;
const routerSvcStub = join(work, "router-service-stub.js");
writeFileSync(
  routerSvcStub,
  `export const routerService = ${svcProxy};
   export function routerModelGroupsForVendor() { return []; }`,
);

/** Answers empty rather than throwing: once a row becomes a controller the
 * screen legitimately asks for that venue's integrations, and a throw there
 * would look like a failure of the thing under test. */
const integrationSvcStub = join(work, "integration-service-stub.js");
writeFileSync(
  integrationSvcStub,
  `export const networkIntegrationService = {
     listPlatformIntegrations: async () => ({ rows: [], hasNext: false }),
   };`,
);

const customerSvcStub = join(work, "customer-service-stub.js");
writeFileSync(
  customerSvcStub,
  `export function isDemo() { return false; }
   export function resolveOrgId() { return "org-1"; }`,
);

const authStub = join(work, "auth-stub.js");
writeFileSync(
  authStub,
  `export const IMPERSONATION_EXPIRES_AT_KEY = "impersonation-expires-at";
   export function AuthProvider({ children }) { return children; }
   export function useAuth() {
     return {
       user: { id: "u-1", name: "Operator", email: "ops@example.com", role: "super_admin" },
       isAuthenticated: true, isLoading: false, can: () => true,
       login: async () => {}, logout: async () => {},
     };
   }`,
);

/**
 * The fleet list is a fixture; `useUpdateRouterVendor` is the REAL one,
 * re-exported from its real module by absolute path so the esbuild alias for
 * `@/hooks/useRouters` does not swallow it. That is the point of the whole
 * harness: the PUT under assertion is the product's own mutation, over the
 * product's own `api` client.
 */
const routerHooksStub = join(work, "router-hooks-stub.js");
writeFileSync(
  routerHooksStub,
  `export { useUpdateRouterVendor, routerKeys } from "${p("src/hooks/useRouters.ts")}";
   export const fixture = { rows: [] };
   export function useRouters() {
     return {
       data: { rows: fixture.rows, total: fixture.rows.length, unreachableLocationCount: 0 },
       isLoading: false, isError: false, error: null, refetch: () => {},
     };
   }
   export function useRouter() { return { data: null, isLoading: false, isError: false, refetch: () => {} }; }
   export function useWireGuardPeer() { return { data: null, isLoading: false, isError: false, refetch: () => {} }; }
   const idle = { mutate: () => {}, mutateAsync: async () => {}, isPending: false, reset: () => {} };
   export function useCreateRouter() { return idle; }
   export function useOnboardController() { return idle; }
   export function useUpdateRouterStatus() { return idle; }
   export function useRebootRouter() { return idle; }
   export function useDeleteRouters() { return idle; }
   export function useGenerateProvisioningToken() { return idle; }
   export function useAllocateWireGuardPeer() { return idle; }
   export function useRevokeWireGuardPeer() { return idle; }`,
);

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { Route } from "${p("src/routes/master.routers.tsx")}";
   import { search } from "${norm(routerStub)}";
   import { fixture } from "${norm(routerHooksStub)}";
   import {
     routerAgentEvidence, typedNameMatches, vendorChangeConsequences,
     vendorChangeKind, vendorChangeNeedsTypedName, vendorChangeSummary,
   } from "${p("src/lib/router-vendor-change.ts")}";

   // The rules, reachable from the page so the pure-function checks assert
   // against the same implementation the screen just ran.
   window.__rules = {
     routerAgentEvidence, typedNameMatches, vendorChangeConsequences,
     vendorChangeKind, vendorChangeNeedsTypedName, vendorChangeSummary,
   };

   fixture.rows = window.__rows;
   search.value = window.__search;
   const Screen = Route.options.component;
   const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={qc}><Screen /></QueryClientProvider>,
   );`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  define: {
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "/api/v1",
    }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@tanstack/react-router": routerStub,
    "@/services/router.service": routerSvcStub,
    "@/services/network-integration.service": integrationSvcStub,
    "@/services/customer.service": customerSvcStub,
    "@/hooks/useRouters": routerHooksStub,
    "@/context/AuthContext": authStub,
    sonner: sonnerStub,
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

// ---------------------------------------------------------------------------
// The backend: records every request, and can be told to refuse.
// ---------------------------------------------------------------------------
let requests = [];
/** null = succeed. Otherwise { status, message }. */
let putRefusal = null;
let rows = [];
let searchParams = {};

const envelope = (data) => JSON.stringify({ success: true, message: "ok", data });
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(
        `<!doctype html><meta charset=utf-8><title>vendor change guard harness</title>
         <script>window.__rows = ${JSON.stringify(rows)};
                 window.__search = ${JSON.stringify(searchParams)};</script>
         <div id=root></div><script type=module src="./bundle.js"></script>`,
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
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const path = url.pathname.replace(/^\/api\/v1/, "");
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }
    requests.push({ method: req.method, path, body });
    res.setHeader("content-type", "application/json");
    if (req.method === "PUT" && /^\/routers\/[^/]+$/.test(path)) {
      if (putRefusal) {
        res.writeHead(putRefusal.status);
        return res.end(JSON.stringify({ success: false, message: putRefusal.message, data: {} }));
      }
      const id = path.split("/")[2];
      const row = rows.find((r) => r.id === id) ?? {};
      res.writeHead(200);
      return res.end(envelope({ ...row, vendor: body?.vendor }));
    }
    res.writeHead(200);
    res.end(envelope({ items: [], total_items: 0, has_next: false }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const context = await browser.newContext();

const puts = () => requests.filter((r) => r.method === "PUT");
const toasts = (page) => page.evaluate(() => globalThis.__toasts ?? []);

/** Opens the screen with these rows, and leaves the caller on the page. */
async function open({ fixtureRows = [LAB, SPARE], search = {}, refuse = null } = {}) {
  requests = [];
  rows = fixtureRows;
  searchParams = search;
  putRefusal = refuse;
  const page = await context.newPage();
  await page.goto(origin);
  await page.locator("#root").waitFor({ timeout: 10_000 });
  return page;
}

/** The fleet drawer for a row, opened by clicking its table row. */
async function openDrawer(page, name) {
  await page
    .getByRole("row", { name: new RegExp(name) })
    .first()
    .click();
  await page.getByLabel("Vendor").first().waitFor({ timeout: 10_000 });
  return page.getByLabel("Vendor").first();
}

const dialog = (page) => page.getByRole("alertdialog");

// ===========================================================================
console.log("\n1. a row that has never reported in: the plain confirm");
{
  const page = await open();
  const select = await openDrawer(page, "Spare hEX");
  await select.selectOption("tplink_omada");
  await dialog(page).waitFor({ timeout: 10_000 });
  const text = await dialog(page).innerText();

  check(
    "selecting a vendor writes nothing on its own",
    puts().length === 0,
    JSON.stringify(puts()),
  );
  check("the dialog names the router", text.includes("Spare hEX (unboxed)"), text);
  check("it shows old -> new", text.includes("MikroTik → TP-Link Omada"), text);
  check(
    "it says the setup script is replaced",
    /setup script[\s\S]*replaced by the TP-Link Omada controller panel/i.test(text),
    text,
  );
  check(
    "it names the agent actions that stop applying",
    /Reboot, provisioning, the WireGuard tunnel and RADIUS/i.test(text),
    text,
  );
  check(
    "it says the row leaves the online fleet count",
    /leaves the Online fleet count/i.test(text),
    text,
  );
  check(
    "it says nothing about the device itself changes",
    /Nothing about the device itself changes/i.test(text),
    text,
  );
  check(
    "no typed acknowledgement is demanded of a row that never reported in",
    (await page.getByLabel("Type the router name to confirm").count()) === 0,
  );

  // --- cancel ------------------------------------------------------------
  await page.getByRole("button", { name: "Keep it as it is" }).click();
  await dialog(page).waitFor({ state: "detached", timeout: 10_000 });
  check("cancel sends no request at all", puts().length === 0, JSON.stringify(puts()));
  check(
    "cancel puts the dropdown back to the stored vendor",
    (await select.inputValue()) === "mikrotik",
    await select.inputValue(),
  );

  // --- confirm -----------------------------------------------------------
  await select.selectOption("tplink_omada");
  await dialog(page).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Change vendor" }).click();
  await page.waitForFunction(() => (globalThis.__toasts ?? []).some((t) => t.kind === "success"), {
    timeout: 10_000,
  });
  check("confirm sends exactly one PUT", puts().length === 1, JSON.stringify(puts()));
  check(
    "the PUT is to this router, with the new vendor and nothing else",
    puts()[0]?.path === "/routers/r-spare" &&
      JSON.stringify(puts()[0]?.body) === JSON.stringify({ vendor: "tplink_omada" }),
    JSON.stringify(puts()[0]),
  );
  check(
    "the dropdown now shows the saved vendor",
    (await select.inputValue()) === "tplink_omada",
    await select.inputValue(),
  );
  await page.close();
}

// ===========================================================================
console.log("\n2. the incident's row -- it has reported in -- needs the name typed");
{
  const page = await open();
  const select = await openDrawer(page, "Office Guest");
  await select.selectOption("tplink_omada");
  await dialog(page).waitFor({ timeout: 10_000 });
  const text = await dialog(page).innerText();

  check(
    "the dialog cites the evidence that this is a real device",
    text.includes("7.15.3") && /reported RouterOS/i.test(text),
    text,
  );
  const typed = page.getByLabel("Type the router name to confirm");
  check("a typed acknowledgement is demanded", (await typed.count()) === 1);
  const confirmBtn = page.getByRole("button", { name: "Change vendor" });
  check("the confirm button starts disabled", await confirmBtn.isDisabled());

  await typed.fill("Office");
  check("a partial name does not unlock it", await confirmBtn.isDisabled());
  await typed.fill("tplink_omada");
  check("typing the vendor instead of the name does not unlock it", await confirmBtn.isDisabled());
  check("nothing has been written while typing", puts().length === 0, JSON.stringify(puts()));

  await typed.fill("  office guest  ");
  check(
    "the router's own name unlocks it, trimmed and case-folded",
    !(await confirmBtn.isDisabled()),
  );
  await confirmBtn.click();
  await page.waitForFunction(() => (globalThis.__toasts ?? []).some((t) => t.kind === "success"), {
    timeout: 10_000,
  });
  check("exactly one PUT, after the name was typed", puts().length === 1, JSON.stringify(puts()));
  check(
    "and it carries the vendor that was confirmed",
    puts()[0]?.path === "/routers/r-lab" && puts()[0]?.body?.vendor === "tplink_omada",
    JSON.stringify(puts()[0]),
  );
  await page.close();
}

// ===========================================================================
console.log("\n3. the request fails: the dropdown must not keep the value that did not save");
{
  const page = await open({
    refuse: { status: 409, message: "Vendor is locked while a provisioning run is in flight" },
  });
  const select = await openDrawer(page, "Spare hEX");
  await select.selectOption("tplink_omada");
  await dialog(page).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Change vendor" }).click();
  await page.waitForFunction(() => (globalThis.__toasts ?? []).some((t) => t.kind === "error"), {
    timeout: 10_000,
  });

  check("one attempt, not a retry storm", puts().length === 1, JSON.stringify(puts()));
  check(
    "the dropdown reverts to the vendor that is actually stored",
    (await select.inputValue()) === "mikrotik",
    await select.inputValue(),
  );
  const raised = await toasts(page);
  check(
    "the backend's own refusal is shown, not a generic one",
    raised.some(
      (t) =>
        t.kind === "error" &&
        t.msg.includes("Vendor is locked while a provisioning run is in flight"),
    ),
    JSON.stringify(raised),
  );
  check(
    "and no success is claimed",
    !raised.some((t) => t.kind === "success"),
    JSON.stringify(raised),
  );
  await page.close();
}

// ===========================================================================
console.log("\n4. the OTHER vendor control -- the setup drilldown -- is guarded too");
{
  const page = await open({ search: { advanced: "r-lab" } });
  const select = page.getByLabel("Vendor").first();
  await select.waitFor({ timeout: 10_000 });
  await select.selectOption("tplink_omada");
  await dialog(page).waitFor({ timeout: 10_000 });
  const text = await dialog(page).innerText();

  check("the setup screen's control opens the same guard", text.includes("Office Guest"), text);
  check("and writes nothing on selection", puts().length === 0, JSON.stringify(puts()));
  await page.getByRole("button", { name: "Keep it as it is" }).click();
  await dialog(page).waitFor({ state: "detached", timeout: 10_000 });
  check("cancel there sends no request either", puts().length === 0, JSON.stringify(puts()));
  check(
    "and its dropdown reverts as well",
    (await select.inputValue()) === "mikrotik",
    await select.inputValue(),
  );
  await page.close();
}

// ===========================================================================
console.log("\n5. the rules themselves, asserted against the real implementation");
{
  const page = await open();
  const r = async (fn, ...args) =>
    page.evaluate(([name, a]) => window.__rules[name](...a), [fn, args]);

  check(
    "a reported RouterOS version is evidence",
    (await r("routerAgentEvidence", { ...BASE, routerOsVersion: "7.15.3", lastSeenAt: null }))
      .length === 1,
  );
  check(
    "a heartbeat is evidence",
    (await r("routerAgentEvidence", { ...BASE, lastSeenAt: "2026-09-10T08:31:00Z" })).length === 1,
  );
  check(
    "an admin-typed management IP is NOT evidence",
    (await r("routerAgentEvidence", { ...BASE, managementIpAddress: "10.20.0.4" })).length === 0,
  );
  check(
    "nor are saved API credentials",
    (await r("routerAgentEvidence", { ...BASE, hasApiCredentials: true })).length === 0,
  );
  check(
    "a whitespace-only RouterOS version is not evidence either",
    (await r("routerAgentEvidence", { ...BASE, routerOsVersion: "   " })).length === 0,
  );
  check("the incident's row needs the name typed", await r("vendorChangeNeedsTypedName", LAB));
  check("a never-seen row does not", !(await r("vendorChangeNeedsTypedName", SPARE)));

  check("the exact name is accepted", await r("typedNameMatches", LAB, "Office Guest"));
  check(
    "a blank name can never be acknowledged",
    !(await r("typedNameMatches", { ...LAB, name: "  " }, "")),
  );
  check(
    "a different row's name is refused",
    !(await r("typedNameMatches", LAB, "Spare hEX (unboxed)")),
  );

  check(
    "mikrotik -> tplink_omada is the controller direction",
    (await r("vendorChangeKind", "mikrotik", "tplink_omada")) === "to-controller",
  );
  check(
    "tplink_omada -> mikrotik is the reverse",
    (await r("vendorChangeKind", "tplink_omada", "mikrotik")) === "to-agent",
  );
  const back = await r("vendorChangeConsequences", "tplink_omada", "mikrotik");
  check(
    "the reverse says the row rejoins the fleet count and will read Offline",
    back.some((l) => /rejoins the Online\/Offline fleet count/i.test(l)) &&
      back.some((l) => /begin reading as Offline/i.test(l)),
    JSON.stringify(back),
  );
  check(
    "the summary is old -> new in human labels",
    (await r("vendorChangeSummary", "mikrotik", "tplink_omada")) === "MikroTik → TP-Link Omada",
  );
  await page.close();
}

await browser.close();
server.close();
console.log(
  failures === 0
    ? "\nvendor change guard: all checks passed"
    : `\nvendor change guard: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
