/**
 * A controller-managed venue must not be OFFERED the five Network screens it
 * cannot use -- contract §11.5, customer side.
 *
 * WHAT THIS IS ABOUT
 * ------------------
 * Network Zones (VLANs), IP Addresses (DHCP), Port Forwarding, Call Priority
 * (QoS) and Website Blocking are all RouterOS writes. At a venue whose only
 * `Router` row is a TP-Link Omada controller there is no RouterOS to write
 * to, and the backend says so: `get_vlan_adapter` and its peers raise a typed
 * refusal for an unregistered vendor.
 *
 * That refusal is correct and stays. What was wrong is WHEN the venue owner
 * met it. All five screens sat in the sidebar, opened normally, fetched,
 * rendered an Add form, and refused only on submit -- after the owner had
 * found the screen, read the form and filled it in. Failing closed is safe;
 * it is not the same as behaving honestly. `src/lib/router-vendors.ts` was
 * imported by five files and not one of them was under
 * `src/components/features/`, which is the whole explanation.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. THE FORM IS NEVER MOUNTED. Not disabled over a live fetch -- absent.
 *      Each of these views loads its own rules on mount and offers
 *      Add/Edit/Apply; a greyed-out copy of it, still fetching, is the same
 *      defect with better manners.
 *   2. WHAT REPLACES IT SAYS WHY, AND WHERE TO GO. "This venue's network is
 *      managed by a TP-Link Omada controller" plus a link to Network
 *      Integrations. A venue owner who cannot find Port Forwarding files a
 *      support ticket; one who is told where it moved does not. This is why
 *      the nav row is muted rather than removed.
 *   3. THE GATE IS `every`, NOT `some`. A MIXED venue -- a MikroTik and a
 *      controller at one site -- keeps all five screens, because they act on
 *      the MikroTik and they work.
 *   4. EVERY UNKNOWN FAILS OPEN. No routers, an unreadable routers list, or a
 *      venue summary persisted before rows carried a vendor: the nav and the
 *      pages render exactly as they do today.
 *   5. A MIKROTIK-ONLY VENUE IS UNTOUCHED. Asserted positively: the five
 *      screens still mount, and none of the controller copy appears anywhere.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-router-detail-vendor.mjs` for the same note). The real
 * components are bundled with esbuild against stubs for the seams they do not
 * own and server-rendered, so the assertions are about the words a venue
 * owner would actually read.
 *
 * The nav rows and the five pages themselves are covered by
 * `scripts/test-controller-venue-nav.mjs`, which needs a real browser: both
 * read the active venue out of a zustand store, and zustand hands a SERVER
 * render its `getInitialState` snapshot rather than the live one, so an SSR
 * assertion about either would be about the wrong state.
 *
 * Run: node scripts/test-controller-venue-network-screens.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "controller-venue-screens-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

// --- stubs -----------------------------------------------------------
const routerStub = join(outdir, "router-stub.mjs");
writeFileSync(
  routerStub,
  `import React from "react";
   export function useNavigate() { return () => {}; }
   /** Spreads every prop onto the anchor: \`SidebarMenuButton asChild\` hands
    * its className down through a Radix Slot, and the muted-row class and the
    * reason \`title\` are exactly what this test reads. A stub that dropped
    * them would pass "not muted" for the wrong reason. */
   export function Link({ children, to, ...rest }) {
     return React.createElement(
       "a",
       { ...rest, href: typeof to === "string" ? to : "#" },
       children,
     );
   }
   export function Outlet() { return null; }
   export function useChildMatches() { return []; }
   export function useParams() { return {}; }
   export function useRouter() { return { navigate: () => {} }; }
   const routerState = { location: { pathname: "/", search: {} }, matches: [] };
   export function useRouterState(opts) {
     return opts && typeof opts.select === "function" ? opts.select(routerState) : routerState;
   }
   export function redirect(o) { return o; }
   export function createFileRoute() {
     return (options) => ({ options, useSearch: () => ({}), useParams: () => ({}) });
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

const authStub = join(outdir, "auth-stub.mjs");
writeFileSync(
  authStub,
  `export const IMPERSONATION_EXPIRES_AT_KEY = "impersonation-expires-at";
   export function AuthProvider({ children }) { return children; }
   export function useAuth() {
     return {
       user: { id: "u-1", name: "Owner", email: "owner@example.com", role: "customer" },
       isAuthenticated: true, isLoading: false, can: () => true,
       login: async () => {}, logout: async () => {},
     };
   }`,
);

/** Permissions resolve to "we don't know", which is the fail-open path --
 * so nothing in this test can be absent from the nav for an RBAC reason and
 * be mistaken for a vendor gate. */
const customerHooksStub = join(outdir, "customer-hooks-stub.mjs");
writeFileSync(
  customerHooksStub,
  `export function useMyPermissions() { return { data: null, isLoading: false }; }
   export function useIsDemo() { return false; }
   export function useDataMasking() {
     return {
       masked: false, sending: false, otpOpen: false, pendingTarget: false, sentTo: null,
       verifying: false, requestToggle: () => {}, verifyToggle: () => {}, cancel: () => {},
     };
   }
   export function useCustomerFeatureData() { return { data: null, isLoading: false }; }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { ControllerManagedFeatureNotice } from "${p("src/components/customer/ControllerManagedFeatureNotice.tsx")}";
   import { deriveLocationLiveness, locationIsControllerManaged, locationControllerVendor }
     from "${p("src/lib/location-liveness.ts")}";
   import { featureAppliesToControllerVenue, CONTROLLER_UNSUPPORTED_FEATURE_IDS,
            controllerVenueFeatureReason } from "${p("src/lib/router-vendors.ts")}";
   import { CUSTOMER_NAV_GROUPS } from "${p("src/lib/customerNav.ts")}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider,
            ControllerManagedFeatureNotice, deriveLocationLiveness,
            locationIsControllerManaged, locationControllerVendor,
            featureAppliesToControllerVenue, CONTROLLER_UNSUPPORTED_FEATURE_IDS,
            controllerVenueFeatureReason, CUSTOMER_NAV_GROUPS };`,
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
    "@/context/AuthContext": authStub,
    "@/hooks/useCustomerDashboard": customerHooksStub,
    sonner: sonnerStub,
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);

function decode(html) {
  return (
    html
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#x2F;/g, "/")
      // React emits the real typographic characters for `&rsquo;`/`&mdash;` in
      // JSX text. Normalised so an assertion is about the sentence, not the
      // glyph the source happened to spell it with.
      .replace(/\u2019/g, "'")
      .replace(/\u2014/g, "--")
  );
}

const NOW = new Date("2026-09-11T12:00:00Z");
const wire = {
  omada: {
    id: "r-omada",
    name: "Hotel OC200",
    status: "pending_provisioning",
    vendor: "tplink_omada",
  },
  mikrotikLive: {
    id: "r-hex",
    name: "Lobby hEX",
    status: "online",
    vendor: "mikrotik",
    last_seen_at: "2026-09-11T11:59:00Z",
  },
  mikrotikDead: {
    id: "r-dead",
    name: "Bar hEX",
    status: "pending_provisioning",
    vendor: "mikrotik",
  },
  vendorless: {
    id: "r-old",
    name: "Old row",
    status: "online",
    last_seen_at: "2026-09-11T11:59:00Z",
  },
};
const liveness = (rows) => m.deriveLocationLiveness(rows, NOW);

// ---------------------------------------------------------------------------
// 1. The predicate. Everything else in this file rides on it.
// ---------------------------------------------------------------------------

console.log("\nlocationIsControllerManaged: every, and every unknown fails open");

check(
  "controller-only-venue-is-gated",
  m.locationIsControllerManaged(liveness([wire.omada])) === true,
);
check(
  "mixed-venue-is-not-gated",
  m.locationIsControllerManaged(liveness([wire.omada, wire.mikrotikLive])) === false,
  "the five screens act on the MikroTik at that venue, and they work",
);
check(
  "mixed-venue-with-a-BROKEN-mikrotik-is-still-not-gated",
  m.locationIsControllerManaged(liveness([wire.omada, wire.mikrotikDead])) === false,
  "a MikroTik that is down is still a MikroTik these screens configure",
);
check(
  "mikrotik-only-venue-is-not-gated",
  m.locationIsControllerManaged(liveness([wire.mikrotikLive])) === false,
);
check(
  "vendorless-row-is-not-gated",
  m.locationIsControllerManaged(liveness([wire.vendorless])) === false,
  "a row with no vendor is agent-managed, as every row was before Omada existed",
);
check("venue-with-no-routers-is-not-gated", m.locationIsControllerManaged(liveness([])) === false);
check(
  "unreadable-routers-list-is-not-gated",
  m.locationIsControllerManaged(liveness(null)) === false,
  "losing Port Forwarding because a request timed out would be a worse bug than the one being fixed",
);
check("no-liveness-at-all-is-not-gated", m.locationIsControllerManaged(undefined) === false);

console.log("\nlocationControllerVendor: names the brand, or nothing");
check(
  "controller-venue-reports-its-vendor",
  m.locationControllerVendor(liveness([wire.omada])) === "tplink_omada",
);
check(
  "mikrotik-venue-reports-no-controller-vendor",
  m.locationControllerVendor(liveness([wire.mikrotikLive])) === null,
);
check(
  "reason-names-the-brand-when-known",
  /TP-Link Omada controller/.test(m.controllerVenueFeatureReason("tplink_omada")) &&
    /not by a WyfyGuest-managed router/.test(m.controllerVenueFeatureReason("tplink_omada")),
);
check(
  "reason-stays-vendor-neutral-when-not-known",
  /a network controller/.test(m.controllerVenueFeatureReason(null)) &&
    !/—/.test(m.controllerVenueFeatureReason(null)),
  "a venue summary persisted before rows carried a vendor must not render an em-dash as a brand",
);

// ---------------------------------------------------------------------------
// 2. The five ids, and the ones deliberately left alone.
// ---------------------------------------------------------------------------

console.log("\nwhich screens the gate covers");

for (const id of ["vlans", "dhcp", "port-forwarding", "voip", "website-blocking"]) {
  check(`${id}-is-gated`, m.featureAppliesToControllerVenue(id) === false);
}
for (const id of [
  "network-integrations",
  "isp-details",
  "dashboard",
  "users",
  "guests",
  "portal",
  "vouchers",
  "reports",
  "devices",
  "alerts",
  "network-activity",
  "mac-auth",
  "hotspot",
  "debugging",
]) {
  check(`${id}-is-not-gated`, m.featureAppliesToControllerVenue(id) === true);
}
check(
  "the-gated-list-is-exactly-five",
  m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.length === 5,
  `got ${m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.length}`,
);
check(
  "every-gated-id-is-a-real-nav-id",
  m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.every((id) =>
    m.CUSTOMER_NAV_GROUPS.some((g) => g.items.some((i) => i.id === id)),
  ),
  "a typo here would silently gate nothing",
);
check(
  "every-gated-id-is-in-the-Network-group",
  m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.every((id) =>
    (m.CUSTOMER_NAV_GROUPS.find((g) => g.id === "network")?.items ?? []).some((i) => i.id === id),
  ),
);

// ---------------------------------------------------------------------------
// 3. What the owner gets instead of the form.
// ---------------------------------------------------------------------------

console.log("\nthe panel that replaces a gated screen");

const notice = decode(
  m.renderToStaticMarkup(
    m.React.createElement(m.ControllerManagedFeatureNotice, {
      featureLabel: "Port Forwarding",
      vendor: "tplink_omada",
    }),
  ),
);

check(
  "notice-names-the-screen-the-owner-was-looking-for",
  /Port Forwarding is configured on this venue's controller/.test(notice),
);
check("notice-names-the-vendor", /TP-Link Omada controller/.test(notice));
check(
  "notice-names-the-other-four-screens-too",
  /Network Zones, IP Addresses, Port Forwarding, Call Priority and Website Blocking/.test(notice),
  "an owner told only about this one will try the other four in turn",
);
check(
  "notice-says-the-rest-of-the-dashboard-is-fine",
  /guests, sessions, vouchers, the sign-in portal and reports/.test(notice),
  "the failure mode being fixed is a working venue reading as a broken one",
);
check(
  "notice-links-to-network-integrations",
  /href="\/network-integrations"/.test(notice),
  "'you cannot do this here' with no destination is a support ticket",
);
check(
  "notice-offers-no-form",
  !/<input|<form|<textarea/.test(notice),
  "a control that will fail after the form is filled must not be rendered at all",
);

const neutralNotice = decode(
  m.renderToStaticMarkup(
    m.React.createElement(m.ControllerManagedFeatureNotice, {
      featureLabel: "Network Zones",
      vendor: null,
    }),
  ),
);
check(
  "notice-without-a-vendor-still-reads-correctly",
  /managed by a network controller/.test(neutralNotice) &&
    !/undefined|null|a --/.test(neutralNotice),
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
