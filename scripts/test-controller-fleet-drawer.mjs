/**
 * The Router Fleet drawer must not offer agent verbs on a device with no
 * agent -- contract §11.5.
 *
 * WHY THIS IS A SEPARATE, BROWSER-DRIVEN TEST
 * -------------------------------------------
 * `scripts/test-controller-fleet-honesty.mjs` covers everything on this
 * screen that is visible without interacting: the Status cell, the Last seen
 * cell and the RouterOS column. It cannot cover the drawer. The drawer is
 * opened by `setSel(row)` from a row click, `MDrawer` returns `null` while
 * closed, and `renderToStaticMarkup` neither clicks nor runs effects -- so an
 * SSR pass proves nothing about it either way. This one drives a real
 * Chromium, clicks the row, and reads what an operator would read.
 *
 * (Needs Playwright's Chromium: `npx playwright install chromium`. Same
 * dependency, and the same reason, as `scripts/test-plan-editor-feedback.mjs`.)
 *
 * WHAT WAS WRONG
 * --------------
 * Three things, all of them promises about a device this platform cannot
 * reach:
 *
 *   1. REBOOT. `POST /routers/{id}/reboot` is an agent command, and the
 *      confirmation copy says it "immediately restarts the physical device".
 *      A TP-Link Omada controller runs no agent, so the button could only
 *      ever fail -- and the sentence it failed with was a claim about
 *      hardware.
 *   2. REMOTE ACCESS. `RemoteAccessCard` offers WinBox/SSH over this
 *      platform's own tunnel. A controller has no WireGuard peer and cannot
 *      be given one: `wireguard/validators.py` refuses with a 422, and it
 *      must, because the hub agent has no delete verb.
 *   3. THE "MANAGE THIS ROUTER" SUBTITLE. It advertised "WireGuard tunnel,
 *      config rollback/backup, diagnostics, connected devices" as what was
 *      one click away. For a controller the destination renders two tabs and
 *      none of those four. The button promised four features and delivered
 *      zero, and the screen it pointed at had already been fixed -- which is
 *      exactly how a gap like this survives a review.
 *
 * WHAT IS ASSERTED
 * ----------------
 *   1. Reboot is DISABLED for a controller, and carries a reason. Disabled,
 *      not removed: an operator who cannot find Reboot files a support
 *      ticket; one who reads why it is greyed out does not.
 *   2. The remote-access card is NOT MOUNTED for a controller, and the space
 *      it occupied says why. Not merely hidden -- mounting it would also
 *      fire its own read at a router that cannot answer.
 *   3. The subtitle no longer names any of the four agent features.
 *   4. A MIKROTIK DRAWER IS UNCHANGED: Reboot enabled, remote access card
 *      present, the original subtitle word for word.
 *
 * Run: node scripts/test-controller-fleet-drawer.mjs
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "controller-fleet-drawer-"));

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const BASE_ROUTER = {
  id: "r-1",
  name: "Lobby device",
  serialNumber: "SN-1",
  macAddress: "AA:BB:CC:DD:EE:FF",
  model: "hEX S",
  vendor: "mikrotik",
  status: "pending_provisioning",
  healthStatus: null,
  hasApiCredentials: false,
  routerOsVersion: null,
  organizationId: "org-1",
  organizationName: "Grand Hotel",
  locationId: "loc-1",
  locationName: "Grand Hotel - Lobby",
  publicIpAddress: "203.0.113.9",
  managementIpAddress: "192.168.88.1",
  lastSeenAt: null,
  lastHealthCheckAt: null,
  createdAt: "2026-09-01T00:00:00Z",
};
const MIKROTIK = { ...BASE_ROUTER, id: "r-mikrotik", name: "Lobby hEX" };
const OMADA = {
  ...BASE_ROUTER,
  id: "r-omada",
  name: "Hotel OC200",
  model: "OC200",
  vendor: "tplink_omada",
};

// --- stubs: only the seams this screen does not own -------------------
writeFileSync(
  join(work, "router-stub.js"),
  `import React from "react";
   export function useNavigate() { return () => {}; }
   export function Link({ children }) { return React.createElement("a", { href: "#" }, children); }
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
     return (options) => ({ options, useSearch: () => ({}), useParams: () => ({}) });
   }`,
);

writeFileSync(
  join(work, "sonner-stub.js"),
  `const noop = () => {};
   export const toast = Object.assign(noop, {
     success: noop, error: noop, warning: noop, info: noop, message: noop,
   });
   export const Toaster = () => null;`,
);

const svcProxy = `new Proxy({}, { get: () => async () => { throw new Error("this test makes no requests"); } })`;
writeFileSync(
  join(work, "router-service-stub.js"),
  `export const routerService = ${svcProxy};
   export function routerModelGroupsForVendor() { return []; }`,
);
writeFileSync(
  join(work, "integration-service-stub.js"),
  `export const networkIntegrationService = ${svcProxy};`,
);
writeFileSync(
  join(work, "customer-service-stub.js"),
  `export function isDemo() { return false; }
   export function resolveOrgId() { return "org-1"; }`,
);
writeFileSync(
  join(work, "auth-stub.js"),
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
writeFileSync(
  join(work, "router-hooks-stub.js"),
  `export const routerKeys = {
     all: ["routers"], list: (q) => ["routers", "list", q],
     detail: (id) => ["routers", "detail", id], wireguard: (id) => ["routers", "wg", id],
   };
   export function useRouters() {
     return {
       data: { rows: window.__rows, total: window.__rows.length, unreachableLocationCount: 0 },
       isLoading: false, isError: false, error: null, refetch: () => {},
     };
   }
   export function useRouter() {
     return { data: window.__rows[0], isLoading: false, isError: false, refetch: () => {} };
   }
   export function useWireGuardPeer() {
     return { data: null, isLoading: false, isError: false, refetch: () => {} };
   }
   const idle = { mutate: () => {}, mutateAsync: async () => {}, isPending: false, reset: () => {} };
   export function useCreateRouter() { return idle; }
   export function useOnboardController() { return idle; }
   export function useUpdateRouterStatus() { return idle; }
   export function useRebootRouter() { return idle; }
   export function useDeleteRouters() { return idle; }
   export function useGenerateProvisioningToken() { return idle; }
   export function useAllocateWireGuardPeer() { return idle; }
   export function useRevokeWireGuardPeer() { return idle; }
   export function useUpdateRouterVendor() { return idle; }`,
);

/** Absolute path, not the `@/` alias: this entry file lives outside the
 * project tree, where esbuild does not apply tsconfig `paths`. */
const fleetRoute = join(ROOT, "src/routes/master.routers.tsx").replace(/\\/g, "/");
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { Route } from "${fleetRoute}";
   const Screen = Route.options.component;
   const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={client}><Screen /></QueryClientProvider>,
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
    "@tanstack/react-router": join(work, "router-stub.js"),
    "@/services/router.service": join(work, "router-service-stub.js"),
    "@/services/network-integration.service": join(work, "integration-service-stub.js"),
    "@/services/customer.service": join(work, "customer-service-stub.js"),
    "@/context/AuthContext": join(work, "auth-stub.js"),
    "@/hooks/useRouters": join(work, "router-hooks-stub.js"),
    sonner: join(work, "sonner-stub.js"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

let servedRows = [MIKROTIK];
const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (name === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><meta charset=utf-8><title>fleet drawer harness</title>
       <script>window.__rows = ${JSON.stringify(servedRows)};</script>
       <div id=root></div><script type=module src="./bundle.js"></script>`,
    );
  }
  try {
    const body = readFileSync(join(work, name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

/** Load the fleet with one row, click it, and report the open drawer. */
async function openDrawer(row) {
  servedRows = [row];
  const page = await browser.newPage();
  await page.goto(origin);
  await page.getByText(row.name, { exact: true }).first().click();
  await page.waitForTimeout(100);
  const reboot = page.getByRole("button", { name: /Reboot/ });
  return {
    page,
    text: await page.locator("body").innerText(),
    rebootCount: await reboot.count(),
    rebootDisabled: (await reboot.count()) > 0 ? await reboot.first().isDisabled() : null,
    rebootTitle: (await reboot.count()) > 0 ? await reboot.first().getAttribute("title") : null,
  };
}

console.log("\nfleet drawer, TP-Link Omada controller:");
{
  const d = await openDrawer(OMADA);
  check("omada-drawer-opened", /Hotel OC200/.test(d.text), "the row click did not open the drawer");
  check(
    "omada-reboot-is-offered-but-disabled",
    d.rebootCount === 1 && d.rebootDisabled === true,
    `count=${d.rebootCount} disabled=${d.rebootDisabled} -- removed entirely is a support ticket, enabled is a lie`,
  );
  check(
    "omada-reboot-says-why",
    !!d.rebootTitle && /agent/.test(d.rebootTitle) && /TP-Link Omada/.test(d.rebootTitle),
    `title=${JSON.stringify(d.rebootTitle)}`,
  );
  check(
    "omada-has-no-remote-access-card",
    !/WinBox/i.test(d.text),
    "WinBox over a tunnel this device does not have",
  );
  check(
    "omada-explains-the-missing-remote-access",
    /Remote access runs over this platform's own tunnel/.test(d.text),
    "an affordance that is withheld must be named, not vanished",
  );
  check(
    "omada-subtitle-drops-the-agent-features",
    !/WireGuard tunnel, config rollback/.test(d.text),
    "the destination renders none of those four for a controller",
  );
  check(
    "omada-subtitle-says-what-is-actually-there",
    /carries this controller's own record and its audit log/.test(d.text),
    "the two tabs `CONTROLLER_MANAGED_TAB_KEYS` actually keeps",
  );
  check(
    "omada-status-tile-is-not-a-raw-enum",
    !/pending_provisioning/.test(d.text),
    "the drawer's Status tile reads off the same `statusBadge` as the list cell",
  );
  await d.page.close();
}

console.log("\nfleet drawer, MikroTik -- unchanged in every respect:");
{
  const d = await openDrawer(MIKROTIK);
  check("mikrotik-drawer-opened", /Lobby hEX/.test(d.text));
  check(
    "mikrotik-reboot-still-enabled",
    d.rebootCount === 1 && d.rebootDisabled === false,
    `count=${d.rebootCount} disabled=${d.rebootDisabled}`,
  );
  check(
    "mikrotik-reboot-has-no-disabled-reason",
    d.rebootTitle === null,
    `title=${JSON.stringify(d.rebootTitle)} -- an enabled button must carry no excuse`,
  );
  check(
    "mikrotik-keeps-remote-access-card",
    /WinBox \/ API login/i.test(d.text),
    "WinBox over the platform tunnel is a real, working affordance here",
  );
  check(
    "mikrotik-keeps-the-original-subtitle",
    /WireGuard tunnel, config rollback\/backup, diagnostics, connected devices/.test(d.text),
    "word for word what it said before this change",
  );
  check(
    "mikrotik-has-no-controller-wording",
    !/Remote access runs over this platform's own tunnel/.test(d.text) &&
      !/carries this controller's own record/.test(d.text),
    "the controller branch must not leak onto an agent-managed row",
  );
  await d.page.close();
}

await browser.close();
server.close();

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
