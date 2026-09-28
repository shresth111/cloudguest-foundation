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
 *   2. WHAT REPLACES IT SAYS WHY, AND WHO CAN DO IT. A venue owner who cannot
 *      find Port Forwarding files a support ticket; one who is told where it
 *      moved does not. This is why the nav row is muted rather than removed.
 *      It used to say where to GO -- a link to Network Integrations -- but
 *      backend `074d719` made every route on that page GLOBAL-scoped, so for
 *      a venue owner it 403s and it has been retired from the customer
 *      dashboard (FIX-PLAN FE-0). The panel now names a person instead, and
 *      the assertion below is the stronger one: no link at all.
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
   import { BLOCKING_TABS, blockingTabsFor, initialBlockingTab }
     from "${p("src/lib/blocking.ts")}";
   import * as firewallRules from "${p("src/lib/firewall-rules.ts")}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider,
            ControllerManagedFeatureNotice, deriveLocationLiveness,
            locationIsControllerManaged, locationControllerVendor,
            featureAppliesToControllerVenue, CONTROLLER_UNSUPPORTED_FEATURE_IDS,
            controllerVenueFeatureReason, CUSTOMER_NAV_GROUPS,
            BLOCKING_TABS, blockingTabsFor, initialBlockingTab, firewallRules };`,
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

for (const id of ["vlans", "dhcp", "port-forwarding", "voip", "website-blocking", "firewall"]) {
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
// Six since Security -> Firewall: cloud-guest#304's push is MikroTik-only
// and refuses a controller-managed router at create, push and band.
check(
  "the-gated-list-is-exactly-six",
  m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.length === 6,
  `got ${m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.length}`,
);
// Every gated id still has to name a real screen -- a typo here would
// silently gate nothing. Since Website Blocking moved into Security ->
// Blocking a gated screen is either a Network nav row or a tab that declares
// the id itself (`lib/blocking.ts`'s `controllerGatedAs`). Both halves are
// asserted, and each id must be claimed by EXACTLY one of them: a screen
// reachable as both a row and a tab is the duplicate this move removed.
const networkIds = (m.CUSTOMER_NAV_GROUPS.find((g) => g.id === "network")?.items ?? []).map(
  (i) => i.id,
);
const tabGatedIds = m.BLOCKING_TABS.map((t) => t.controllerGatedAs).filter(Boolean);
// The one gated row outside Network, named rather than inferred: Security ->
// Firewall is a whole page that writes RouterOS and nothing else, so greying
// the whole row at a controller-only venue is right for it (unlike Blocking,
// whose Guests tab works there).
const securityIds = (m.CUSTOMER_NAV_GROUPS.find((g) => g.id === "security")?.items ?? []).map(
  (i) => i.id,
);
const GATED_OUTSIDE_NETWORK = ["firewall"];
check(
  "every-gated-id-is-a-real-screen",
  m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.every(
    (id) =>
      [networkIds.includes(id), tabGatedIds.includes(id), securityIds.includes(id)].filter(Boolean)
        .length === 1,
  ),
  "a typo here would silently gate nothing",
);
check(
  "every-gated-nav-row-is-in-Network-or-is-the-Firewall-row",
  m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.filter(
    (id) => !tabGatedIds.includes(id) && !GATED_OUTSIDE_NETWORK.includes(id),
  ).every((id) => networkIds.includes(id)) &&
    m.CUSTOMER_NAV_GROUPS.filter((g) => g.id !== "network")
      .flatMap((g) => g.items.map((i) => i.id))
      .filter((id) => !GATED_OUTSIDE_NETWORK.includes(id))
      .every((id) => m.featureAppliesToControllerVenue(id)),
  "a gated row outside Network would grey a whole page, not a screen",
);
check(
  "the-firewall-row-is-in-Security-and-gated",
  securityIds.includes("firewall") && m.featureAppliesToControllerVenue("firewall") === false,
);
check(
  "website-blocking-is-a-blocking-tab-not-a-nav-row",
  tabGatedIds.includes("website-blocking") && !networkIds.includes("website-blocking"),
);
// Every tab-declared id must actually be in the gated list, or the tab would
// mount a RouterOS form at an Omada venue with nothing saying so.
check(
  "every-tab-gated-id-is-actually-gated",
  tabGatedIds.every((id) => m.CONTROLLER_UNSUPPORTED_FEATURE_IDS.includes(id)),
  tabGatedIds.join(", "),
);

// ---------------------------------------------------------------------------
// 2b. Security -> Blocking at a controller venue: gate the tab, not the page.
// ---------------------------------------------------------------------------

console.log("\nSecurity -> Blocking gates one tab, not the page");

check(
  "the-blocking-page-itself-is-not-gated",
  m.featureAppliesToControllerVenue("blocking") === true,
  "its Guests tab works at an Omada venue -- greying the row would hide it",
);
check(
  "the-guests-tab-is-never-controller-gated",
  m.BLOCKING_TABS.find((t) => t.id === "guests")?.controllerGatedAs === null,
  "BlockUsers already reaches the controller with its own client block",
);
const everyTab = m.blockingTabsFor(null);
check(
  "a-controller-venue-opens-on-the-tab-that-works",
  m.initialBlockingTab(undefined, everyTab, true) === "guests",
);
check(
  "a-mikrotik-venue-opens-on-websites",
  m.initialBlockingTab(undefined, everyTab, false) === "websites",
);
check(
  "an-explicit-deep-link-wins-even-at-a-controller-venue",
  m.initialBlockingTab("websites", everyTab, true) === "websites",
  "the Security overview and old /website-blocking bookmarks must land where they say",
);
check(
  "an-unknown-tab-in-the-url-falls-back-rather-than-breaking",
  m.initialBlockingTab("firewall", everyTab, false) === "websites",
);
check(
  "tabs-fail-open-on-a-non-answer",
  m.blockingTabsFor(null).length === 2 &&
    m.blockingTabsFor(undefined).length === 2 &&
    m.blockingTabsFor([]).length === 2,
);
check(
  "a-real-grant-set-narrows-the-tabs",
  m
    .blockingTabsFor(["guest_access.read"])
    .map((t) => t.id)
    .join(",") === "guests",
);
check(
  "a-tab-that-is-not-offered-cannot-be-deep-linked-into",
  m.initialBlockingTab("websites", m.blockingTabsFor(["guest_access.read"]), false) === "guests",
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
  /Network Zones, IP Addresses, Port Forwarding, Call Priority, website blocking and firewall\s+rules/.test(
    notice,
  ),
  "an owner told only about this one will try the other four in turn",
);
check(
  "notice-says-the-rest-of-the-dashboard-is-fine",
  /guests, sessions, vouchers, the sign-in portal and reports/.test(notice),
  "the failure mode being fixed is a working venue reading as a broken one",
);
// INVERTED 2026-09-12, FIX-PLAN FE-0 step 4. This used to require the deep
// link, on the reasoning that "'you cannot do this here' with no destination
// is a support ticket; with one it is a redirect". That was right for as long
// as a destination existed. Backend `074d719` moved every
// `network_integrations.*` route to ScopeType.GLOBAL and retired the
// org-scoped grants, so the page 403s for a venue owner and its customer
// route, nav row and catalog entry are now gone. A button to a denial is
// worse than a sentence, so the assertion is now the stronger one: the panel
// must offer NO link at all, and must name a person instead.
check(
  "notice-does-not-link-to-the-retired-page",
  !/href="\/network-integrations"/.test(notice),
  "a call to action that 403s spends the trust the rest of the panel is built on",
);
check(
  "notice-names-who-can-do-it-instead",
  /Your Wyfy Guest contact manages this venue/.test(notice),
  "an owner who accepts they cannot do it is looking for who can",
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

// ---------------------------------------------------------------------------
// 5. Security -> Firewall speaks plainly, and says what the push said.
//    `lib/firewall-rules.ts` is the whole translation between the owner's
//    pickers and cloud-guest#304's rule fields and error codes, so it is
//    executed here rather than grepped.
// ---------------------------------------------------------------------------

console.log("\nSecurity -> Firewall: plain words in, forward rules out");
{
  const fw = m.firewallRules;
  const draft = (over = {}) => ({
    name: "Printer off-limits",
    decision: "block",
    who: "",
    where: "192.168.88.20",
    service: "everything",
    customProtocol: "tcp",
    customPort: "",
    priority: 100,
    isEnabled: true,
    ...over,
  });
  const f = fw.draftToFields(draft());
  check(
    "a-customer-rule-is-always-forward",
    f.chain === "forward" && fw.draftToFields(draft({ decision: "allow" })).chain === "forward",
    "the writer manages forward only; input/output is how a router got cut off",
  );
  check(
    "block-is-drop-and-allow-is-accept",
    f.action === "drop" && fw.draftToFields(draft({ decision: "allow" })).action === "accept",
  );
  check(
    "anyone-and-anywhere-are-empty-not-0.0.0.0",
    f.sourceAddress === null &&
      fw.draftToFields(draft({ where: "", decision: "allow" })).destinationAddress === null,
  );
  check(
    "a-preset-service-sets-protocol-and-port",
    (() => {
      const w = fw.draftToFields(draft({ service: "web-secure" }));
      return w.protocol === "tcp" && w.destinationPort === 443;
    })(),
  );
  check(
    "a-custom-port-keeps-the-chosen-protocol",
    (() => {
      const w = fw.draftToFields(
        draft({ service: "custom", customProtocol: "udp", customPort: "5060" }),
      );
      return w.protocol === "udp" && w.destinationPort === 5060;
    })(),
  );
  check("a-valid-draft-has-no-errors", Object.keys(fw.validateFirewallDraft(draft())).length === 0);
  check(
    "a-block-with-no-who-and-no-where-is-refused-before-save",
    !!fw.validateFirewallDraft(draft({ where: "" })).where,
    "#304 refuses it at Apply (ACCESS_RULES_WOULD_BREAK_GUEST_PATH)",
  );
  check(
    "blocking-a-management-port-is-refused-before-save",
    !!fw.validateFirewallDraft(draft({ service: "custom", customPort: "8728" })).customPort,
    "#304 refuses it at Apply (ACCESS_RULES_WOULD_ORPHAN_MANAGEMENT)",
  );
  check(
    "no-preset-can-only-fail",
    fw.FIREWALL_SERVICES.filter((s) => s.port != null).every(
      (s) => !fw.MANAGEMENT_PORTS.includes(s.port),
    ),
  );
  check(
    "a-bad-address-is-caught",
    !!fw.validateFirewallDraft(draft({ where: "10.0.0.300" })).where,
  );
  check("a-cidr-range-is-fine", !fw.validateFirewallDraft(draft({ where: "10.0.0.0/24" })).where);
  check(
    "a-stored-rule-round-trips-through-the-form",
    (() => {
      const rule = {
        name: "x",
        chain: "forward",
        action: "drop",
        protocol: "tcp",
        sourceAddress: "192.168.88.5",
        destinationAddress: null,
        sourcePort: null,
        destinationPort: 8080,
        priority: 7,
        isEnabled: false,
      };
      const back = fw.draftToFields(fw.ruleToDraft(rule));
      return (
        back.protocol === "tcp" &&
        back.destinationPort === 8080 &&
        back.sourceAddress === "192.168.88.5" &&
        back.priority === 7 &&
        back.isEnabled === false
      );
    })(),
  );
  check(
    "an-edit-that-clears-a-field-sends-an-explicit-null",
    (() => {
      // cloud-guest#306: on PUT an omitted key is "unchanged" and an explicit
      // null clears it. JSON drops \`undefined\`, so a cleared address or
      // port must come out of the form as null or the edit keeps the old one.
      const f = fw.draftToFields(
        draft({ decision: "allow", who: "", where: "", service: "everything" }),
      );
      const body = JSON.parse(JSON.stringify(f));
      return (
        "sourceAddress" in body &&
        body.sourceAddress === null &&
        "destinationAddress" in body &&
        body.destinationAddress === null &&
        "destinationPort" in body &&
        body.destinationPort === null
      );
    })(),
    "a cleared field serialised as undefined is silently kept by the backend",
  );
  check(
    "operator-made-router-rules-are-read-only-here",
    fw.isCustomerEditable({
      chain: "input",
      action: "drop",
      protocol: "all",
      sourceAddress: null,
      destinationAddress: null,
      sourcePort: null,
      destinationPort: null,
      priority: 1,
      isEnabled: true,
    }).editable === false,
  );
  check(
    "the-table-is-in-router-order",
    fw
      .inRouterOrder([
        { priority: 20, createdAt: "b" },
        { priority: 10, createdAt: "c" },
        { priority: 20, createdAt: "a" },
      ])
      .map((r) => `${r.priority}${r.createdAt}`)
      .join(",") === "10c,20a,20b",
  );
  check(
    "no-routeros-vocabulary-in-what-the-owner-reads",
    [
      fw.describeService({ protocol: "all", destinationPort: null }),
      fw.describeWho(null),
      fw.describeWhere(null),
      fw.describeAction("drop"),
      ...fw.FIREWALL_SERVICES.map((s) => s.label),
    ].every((t) => !/chain|forward|place-before|accept|drop|reject/i.test(t)),
  );

  console.log("\nSecurity -> Firewall: every push failure is a sentence");
  const say = (status, data, message = "raw backend text") =>
    fw.firewallPushErrorSentence({ status, data, message });
  const band = say(409, { code: "ACCESS_RULES_BAND_MISSING" });
  check(
    "band-missing-says-contact-support",
    band.sentence ===
      "This router hasn't been prepared for firewall rules yet. Our team needs to set it up once — contact support." &&
      band.needsSupport,
  );
  check(
    "push-in-progress-says-try-again-in-a-minute",
    say(409, { code: "FIREWALL_PUSH_IN_PROGRESS" }).sentence ===
      "Another change is being applied to this router — try again in a minute.",
  );
  const unrestored = say(502, { code: "ACCESS_RULES_PUSH_FAILED", restored: false });
  check(
    "restored-false-is-said-honestly",
    unrestored.sentence ===
      "The change failed partway; we could not confirm the router's previous rules were restored — contact support." &&
      unrestored.needsSupport,
  );
  check(
    "restored-true-says-nothing-changed",
    /previous firewall rules were put back/.test(
      say(502, { code: "ACCESS_RULES_PUSH_FAILED", restored: true }).sentence,
    ),
  );
  check(
    "a-chain-refusal-names-the-rules",
    /Guest SSH, Old input rule/.test(
      say(422, { code: "ACCESS_RULES_CHAIN_UNSUPPORTED", rules: ["Guest SSH", "Old input rule"] })
        .sentence,
    ),
  );
  check(
    "a-controller-refusal-shows-the-backend-sentence",
    say(422, undefined, "Firewall Rules isn't available for this venue.").sentence ===
      "Firewall Rules isn't available for this venue.",
  );
  check(
    "no-sentence-shows-a-bare-code",
    [
      "ACCESS_RULES_BAND_MISSING",
      "FIREWALL_PUSH_IN_PROGRESS",
      "ACCESS_RULES_PUSH_FAILED",
      "ACCESS_RULES_WOULD_ORPHAN_MANAGEMENT",
      "ACCESS_RULES_WOULD_BREAK_GUEST_PATH",
      "ACCESS_RULES_ORPHAN_MARKER",
      "ACCESS_RULES_SOMETHING_NEW",
    ]
      .map((code) => say(409, { code }).sentence)
      .every((t) => !/ACCESS_RULES|FIREWALL_PUSH/.test(t)),
  );
  check("an-unknown-band-state-says-nothing", fw.bandStateSentence(null) === null);
  check(
    "a-missing-band-and-a-refused-push-say-the-same-thing",
    fw.bandStateSentence("missing") === band.sentence,
  );
  const sum = fw.applySummary([
    { chain: "forward", action: "drop", isEnabled: true },
    { chain: "forward", action: "accept", isEnabled: true },
    { chain: "forward", action: "drop", isEnabled: false },
    { chain: "input", action: "drop", isEnabled: true },
  ]);
  check(
    "the-apply-dialog-counts-what-will-change",
    sum.on === 2 && sum.off === 1 && sum.blocks === 1 && sum.unpushable === 1,
    JSON.stringify(sum),
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
