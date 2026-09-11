/**
 * The three screens that LINK TO the vendor-aware router drawer must stop
 * contradicting it.
 *
 * WHAT THIS IS ABOUT (contract §11.5)
 * -----------------------------------
 * `RouterDetailTabs` was fixed: for a TP-Link Omada controller it renders two
 * tabs instead of eleven, names the nine it dropped, and refuses to print
 * "Pending provisioning", "Last seen: Never" or a RouterOS version for a
 * device that has none of those things. `scripts/test-router-detail-vendor.mjs`
 * locks that down.
 *
 * The three surfaces that link INTO that drawer were not fixed, and each of
 * them printed the sentences the drawer refuses to:
 *
 *   1. `master.routers.tsx` -- the platform operator's Router Fleet. Its
 *      `LIVENESS_BADGE` map had no `not-applicable` key, so `statusBadge`
 *      fell through to `?? { label: r.status }` and rendered the RAW BACKEND
 *      ENUM: a working Omada controller appeared in the Status cell, and
 *      again on the drawer's Status tile, as the literal string
 *      `pending_provisioning`. The same screen also printed "Never heard from
 *      this router" under Last seen, offered Reboot and WinBox remote access
 *      on a device with no agent, and advertised "WireGuard tunnel, config
 *      rollback/backup, diagnostics, connected devices" as what the operator
 *      would find one click away -- all four of which that destination drops
 *      for a controller.
 *   2. `RouterTable.tsx` -- and this one is the VENUE OWNER'S OWN screen.
 *      "Pending provisioning", Health "Unknown", Last seen "Never", plus a
 *      RouterOS column. A hotel whose guest WiFi is working, told on its own
 *      dashboard that its network was half-installed.
 *   3. `routers.$routerId.tsx` -- the page header wrapped around the drawer
 *      that is already gated, printing "Pending provisioning" in 24px type
 *      two inches above the drawer refusing to print it.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. NO RAW ENUM REACHES A SCREEN. `pending_provisioning` is a database
 *      value, not a sentence, and it is the one an Omada row falls through
 *      to on every one of these three surfaces.
 *   2. NO FABRICATED MEASUREMENT REACHES A SCREEN. "Never", "Never heard from
 *      this router" and "Unknown" are all claims that somebody looked. For a
 *      controller nothing here ever looks, and `RouterDetailTabs` already
 *      says so in the words this test expects instead: "Not measured here".
 *   3. NO AGENT VERB IS OFFERED ON A DEVICE WITH NO AGENT. Reboot and remote
 *      access both go through the router agent; a controller runs none and
 *      has no WireGuard peer (the backend refuses to allocate one with a
 *      422). Disabled-with-a-reason, not silently removed -- an operator who
 *      cannot find Reboot opens a ticket.
 *   4. THE MIKROTIK PATH IS BYTE-FOR-BYTE UNCHANGED. Every fix in this area
 *      risks being a fix for one vendor and a regression for the other. This
 *      is asserted positively -- the exact words a MikroTik row rendered
 *      before this change must still be there -- and not merely as "the
 *      controller branch was not taken".
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-router-detail-vendor.mjs` for the same note). The real
 * components are bundled with esbuild against stubs for the seams they do not
 * own -- routing, hooks, services, toasts -- and server-rendered, so the
 * assertions are about the markup a human would actually read.
 *
 * Run: node scripts/test-controller-fleet-honesty.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "controller-fleet-honesty-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

// ---------------------------------------------------------------------------
// Stubs. Only the seams these components do not own.
// ---------------------------------------------------------------------------

/** `createFileRoute` keeps the options object here, because the fleet screen
 * is not exported -- it is reachable only as `Route.options.component`. The
 * real `useSearch`/`useParams` are replaced by fixed values so the screen
 * renders its browse list rather than a deep-linked setup panel. */
const routerStub = join(outdir, "router-stub.mjs");
writeFileSync(
  routerStub,
  `import React from "react";
   export const navigations = [];
   export function useNavigate() { return (to) => { navigations.push(to); }; }
   export function Link({ children }) { return React.createElement("a", null, children); }
   export function Outlet() { return null; }
   export function useChildMatches() { return []; }
   export function useParams() { return { routerId: "r-omada" }; }
   export function useRouter() { return { navigate: () => {} }; }
   const routerState = { location: { pathname: "/master/routers", search: {} }, matches: [] };
   export function useRouterState(opts) {
     return opts && typeof opts.select === "function" ? opts.select(routerState) : routerState;
   }
   export function redirect(opts) { return opts; }
   export function createFileRoute() {
     return (options) => ({
       options,
       useSearch: () => ({}),
       useParams: () => ({ routerId: "r-omada" }),
     });
   }`,
);

const sonnerStub = join(outdir, "sonner-stub.mjs");
writeFileSync(
  sonnerStub,
  `const noop = () => {};
   export const toast = Object.assign(noop, {
     success: noop, error: noop, warning: noop, info: noop, message: noop,
   });
   export const Toaster = () => null;`,
);

/** Every service method throws: a render must not need one. */
const svcProxy = `new Proxy({}, { get: () => async () => { throw new Error("the render test makes no requests"); } })`;
const routerSvcStub = join(outdir, "router-service-stub.mjs");
writeFileSync(
  routerSvcStub,
  `export const routerService = ${svcProxy};
   export function routerModelGroupsForVendor() { return []; }`,
);

const integrationSvcStub = join(outdir, "integration-service-stub.mjs");
writeFileSync(integrationSvcStub, `export const networkIntegrationService = ${svcProxy};`);

/** `isDemo()` is false: the demo branch hides the very actions under test. */
const customerSvcStub = join(outdir, "customer-service-stub.mjs");
writeFileSync(
  customerSvcStub,
  `export function isDemo() { return false; }
   export function resolveOrgId() { return "org-1"; }`,
);

/**
 * The router hooks, fed from a mutable fixture the test sets before each
 * render. Stubbed rather than driven through React Query because what is
 * under test is what the SCREEN renders for a given row, not how it fetches.
 */
const routerHooksStub = join(outdir, "router-hooks-stub.mjs");
writeFileSync(
  routerHooksStub,
  `export const fixture = { rows: [], one: null };
   export const routerKeys = {
     all: ["routers"],
     list: (q) => ["routers", "list", q],
     detail: (id) => ["routers", "detail", id],
     wireguard: (id) => ["routers", "wireguard", id],
   };
   export function useRouters() {
     return {
       data: { rows: fixture.rows, total: fixture.rows.length, unreachableLocationCount: 0 },
       isLoading: false,
       isError: false,
       error: null,
       refetch: () => {},
     };
   }
   export function useRouter() {
     return { data: fixture.one, isLoading: false, isError: false, refetch: () => {} };
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

/** The master shell reads the signed-in operator (name, permissions) from
 * context. `can()` answers yes so nothing under test is hidden by RBAC --
 * this test is about vendor gating, and an RBAC-hidden control would pass a
 * "not rendered" assertion for the wrong reason. */
const authStub = join(outdir, "auth-stub.mjs");
writeFileSync(
  authStub,
  `import React from "react";
   export const IMPERSONATION_EXPIRES_AT_KEY = "impersonation-expires-at";
   export function AuthProvider({ children }) { return children; }
   export function useAuth() {
     return {
       user: { id: "u-1", name: "Operator", email: "ops@example.com", role: "super_admin" },
       isAuthenticated: true,
       isLoading: false,
       can: () => true,
       login: async () => {},
       logout: async () => {},
     };
   }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { Route as FleetRoute } from "${p("src/routes/master.routers.tsx")}";
   import { Route as DetailRoute } from "${p("src/routes/_authenticated/routers.$routerId.tsx")}";
   import { RouterTable } from "${p("src/components/routers/RouterTable.tsx")}";
   import { lastContactLabel, deriveRouterLiveness } from "${p("src/lib/location-liveness.ts")}";
   import { fixture } from "${norm(routerHooksStub)}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider,
            FleetRoute, DetailRoute, RouterTable, lastContactLabel,
            deriveRouterLiveness, fixture };`,
);

const outfile = join(outdir, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
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
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);

/** `renderToStaticMarkup` escapes quotes and apostrophes, which real product
 * copy is full of. Decoded before matching so an assertion is about the words
 * an operator reads, not about HTML entities. */
function decode(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
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

function renderWith(element) {
  const client = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  return decode(
    m.renderToStaticMarkup(m.React.createElement(m.QueryClientProvider, { client }, element)),
  );
}

/** The fleet screen, with `rows` in the list and `sel` NOT open -- the drawer
 * is local state this SSR pass cannot click into, so drawer-only assertions
 * go through `renderFleetDrawer` below. */
function renderFleet(rows) {
  m.fixture.rows = rows;
  const Screen = m.FleetRoute.options.component;
  return renderWith(m.React.createElement(Screen));
}

function renderCustomerList(rows) {
  m.fixture.rows = rows;
  return renderWith(m.React.createElement(m.RouterTable));
}

function renderCustomerDetail(router) {
  m.fixture.one = router;
  const Page = m.DetailRoute.options.component;
  return renderWith(m.React.createElement(Page));
}

// ---------------------------------------------------------------------------
// 1. The platform operator's Router Fleet list.
// ---------------------------------------------------------------------------

console.log("\nmaster Router Fleet: a controller row states nothing false");

const fleetOmada = renderFleet([OMADA]);
const fleetMikrotik = renderFleet([MIKROTIK]);

check(
  "fleet-omada-no-raw-enum",
  !/pending_provisioning/.test(fleetOmada),
  "`LIVENESS_BADGE` has no `not-applicable` key, so `statusBadge` fell through to `r.status`",
);
check(
  "fleet-omada-says-via-controller",
  /Via controller/.test(fleetOmada),
  "the same words as the summary tile, so the cell and the count agree",
);
check(
  "fleet-omada-no-never-heard-from",
  !/Never heard from this router/.test(fleetOmada),
  "a measurement claim about a check nothing here ever runs",
);
check(
  "fleet-omada-says-not-measured-here",
  /Not measured here/.test(fleetOmada),
  "the phrasing `RouterDetailTabs` already uses for exactly this field",
);
check(
  "fleet-omada-routeros-column-not-applicable",
  /Not applicable/.test(fleetOmada),
  "a controller does not run RouterOS; the em-dash means 'no version on file', which is different",
);
check(
  "fleet-omada-no-advanced-setup-button",
  !/Advanced/.test(fleetOmada),
  "pre-existing gate: the RouterOS script generator was already withheld",
);

// ---- the MikroTik path, asserted positively ----
check(
  "fleet-mikrotik-still-says-never-checked-in",
  /Never checked in/.test(fleetMikrotik),
  "a MikroTik that never called home must still be reported as such",
);
check(
  "fleet-mikrotik-still-says-never-heard-from",
  /Never heard from this router/.test(fleetMikrotik),
  "the Last seen cell's wording for an agent-managed row is unchanged",
);
check(
  "fleet-mikrotik-has-no-controller-wording",
  !/Via controller/.test(fleetMikrotik) && !/Not measured here/.test(fleetMikrotik),
  "the controller branch must not leak onto an agent-managed row",
);
check(
  "fleet-mikrotik-keeps-advanced-setup-button",
  /Advanced/.test(fleetMikrotik),
  "the fleet's only provisioning entry point",
);
check(
  "fleet-mikrotik-routeros-cell-is-still-a-dash",
  !/Not applicable/.test(fleetMikrotik),
  "a MikroTik with no reported version keeps the em-dash it had",
);

// ---------------------------------------------------------------------------
// 2. The venue owner's own router list.
// ---------------------------------------------------------------------------

console.log("\ncustomer router list: a controller row states nothing false");

const listOmada = renderCustomerList([OMADA]);
const listMikrotik = renderCustomerList([MIKROTIK]);

check(
  "customer-list-omada-no-pending-provisioning",
  !/Pending Provisioning/.test(listOmada),
  "RouterStatusBadge rendered the raw status on the venue owner's own screen",
);
check(
  "customer-list-omada-names-the-vendor-instead",
  /TP-Link Omada/.test(listOmada),
  "`ControllerManagedBadge` stands in place of the status word",
);
check(
  "customer-list-omada-health-not-measured",
  /Not measured here/.test(listOmada) && !/>unknown</.test(listOmada),
  "`HealthStatusBadge`'s honest 'Unknown' still implies somebody looked",
);
check(
  "customer-list-omada-last-seen-is-not-never",
  !/>Never</.test(listOmada),
  "`relative(null)` is 'Never' -- a measurement claim, and the wrong one",
);
check(
  "customer-list-omada-routeros-not-applicable",
  /Not applicable/.test(listOmada),
  "the detail drawer this row links to drops the RouterOS field entirely",
);
check(
  "customer-list-omada-no-needs-credentials",
  !/Needs credentials/.test(listOmada),
  "pre-existing gate: a controller's credentials live on its network integration",
);

// ---- the MikroTik path, asserted positively ----
check(
  "customer-list-mikrotik-still-says-pending-provisioning",
  /Pending Provisioning/.test(listMikrotik),
  "a MikroTik nobody finished setting up must still say so",
);
check(
  "customer-list-mikrotik-still-says-unknown-health",
  />unknown</.test(listMikrotik),
  "the health badge for an agent-managed row is unchanged",
);
check(
  "customer-list-mikrotik-still-says-never",
  />Never</.test(listMikrotik),
  "'Never' is correct for a device this platform really does watch",
);
check(
  "customer-list-mikrotik-has-no-controller-wording",
  !/Not measured here/.test(listMikrotik) && !/Not applicable/.test(listMikrotik),
  "the controller branch must not leak onto an agent-managed row",
);

// ---------------------------------------------------------------------------
// 3. The customer's router detail page header.
// ---------------------------------------------------------------------------

console.log("\ncustomer router detail header: agrees with the drawer below it");

const detailOmada = renderCustomerDetail(OMADA);
const detailMikrotik = renderCustomerDetail(MIKROTIK);

check(
  "customer-detail-omada-header-no-pending-provisioning",
  !/Pending Provisioning/.test(detailOmada),
  "the heading printed what the drawer three lines below refuses to print",
);
check(
  "customer-detail-omada-header-names-the-vendor",
  /TP-Link Omada/.test(detailOmada),
  "same substitution the drawer's own Status tile makes",
);
check(
  "customer-detail-mikrotik-header-unchanged",
  /Pending Provisioning/.test(detailMikrotik),
  "an agent-managed row keeps the status badge it had",
);

// ---------------------------------------------------------------------------
// 4. `lastContactLabel` -- the shared source of every "last seen" sentence.
// ---------------------------------------------------------------------------

console.log("\nlastContactLabel: 'nothing looks' and 'we looked and saw nothing' are different");

const now = new Date("2026-09-11T12:00:00Z");
const liveness = (raw) => m.deriveRouterLiveness(raw, now);

check(
  "label-controller-is-not-measured-here",
  m.lastContactLabel(
    liveness({ id: "a", status: "pending_provisioning", vendor: "tplink_omada" }),
    now,
  ) === "Not measured here",
);
check(
  "label-mikrotik-with-no-contact-is-unchanged",
  m.lastContactLabel(
    liveness({ id: "b", status: "pending_provisioning", vendor: "mikrotik" }),
    now,
  ) === "Never heard from this router",
  "the sentence an agent-managed row has always got",
);
check(
  "label-vendorless-row-is-unchanged",
  m.lastContactLabel(liveness({ id: "c", status: "pending_provisioning" }), now) ===
    "Never heard from this router",
  "a row with no vendor is treated as agent-managed, as it always was",
);
check(
  "label-real-heartbeat-is-unchanged",
  m
    .lastContactLabel(
      liveness({
        id: "d",
        status: "online",
        vendor: "mikrotik",
        last_seen_at: "2026-09-11T11:59:00Z",
      }),
      now,
    )
    .startsWith("Last check-in "),
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
