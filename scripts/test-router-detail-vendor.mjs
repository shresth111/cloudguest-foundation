/**
 * The fleet detail drawer must stop describing a controller as a MikroTik.
 *
 * WHAT THIS IS ABOUT (contract §11.5)
 * -----------------------------------
 * A TP-Link Omada controller is registered as a `Router` row -- it has to be,
 * because `guest_sessions.router_id` is NOT NULL, so an Omada venue could not
 * log a guest in without one. But no `router_agent` ever checks in for it.
 * `RouterDetailTabs` was written when every row in that table was a MikroTik
 * running this platform's own agent, and it never had to say so: eleven tabs,
 * nine of which are either an instruction to that agent (setup script,
 * WireGuard peer, config push, provisioning, on-device diagnostics) or a
 * measurement of it (monitoring, analytics, connected devices).
 *
 * Opened on a controller, that drawer was wrong in a specific and expensive
 * way. It did not merely show empty tabs; it made claims:
 *
 *   - "Pending provisioning" -- a device somebody forgot to finish setting up.
 *     Nothing is unfinished. There is nothing to provision.
 *   - "Last seen: Never" -- a measurement. We looked, and it never has. In
 *     fact nothing here ever looks.
 *   - "RouterOS: Unknown (never reported)" -- a version we failed to collect,
 *     from a device that does not run RouterOS.
 *   - "API credentials: Not set" -- pointing at a form that does not exist for
 *     this row. The credentials that matter are on its network integration.
 *   - A WireGuard tab. The backend now refuses that with a 422, and it must:
 *     the hub agent has no delete verb and `next_free_ip()` scans live kernel
 *     state, so a peer allocated to a controller leaks an address forever, and
 *     a peer that never handshakes looks exactly like one nobody finished.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. NO AGENT-SHAPED TAB IS REACHABLE ON A CONTROLLER. Not hidden-but-
 *      mounted: `TabsContent` mounts its children, so a panel left in place
 *      is one `setTab` away from firing a mutation at a device that cannot
 *      answer. Asserted on the rendered markup, not on the source.
 *   2. NO FABRICATED MEASUREMENT REACHES THE SCREEN. The five sentences above
 *      must be absent from a controller's drawer.
 *   3. THE OPERATOR IS POINTED AT WHERE THE ANSWER ACTUALLY IS -- the venue's
 *      network integration -- rather than left with a drawer full of blanks.
 *   4. THE GATE IS NARROW. A MikroTik row, and a row whose vendor this build
 *      does not recognise, keep all eleven tabs and every word they had.
 *      Every fix in this area risks being a fix for one vendor and a
 *      regression for the other fourteen.
 *   5. A STALE `?tab=wireguard` LINK STILL RENDERS A PANEL. Radix shows
 *      nothing at all when `value` matches no trigger, which reads as a
 *      broken page rather than as a tab that does not apply.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-network-integration-render.mjs` for the same note). The real
 * component is bundled with esbuild against stubs for the seams it does not
 * own -- the router, navigation and toast layers -- and server-rendered.
 *
 * Run: node scripts/test-router-detail-vendor.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "router-detail-vendor-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

/** Navigation. Recorded rather than performed, so the "where the real answer
 * is" button can be asserted as a destination and not just as a label. */
const routerStub = join(outdir, "router-stub.mjs");
writeFileSync(
  routerStub,
  `export const navigations = [];
   export function useNavigate() { return (to) => { navigations.push(to); }; }
   export function Link(props) { return null; }
   export function useChildMatches() { return []; }
   export function createFileRoute() { return () => ({}); }`,
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

/** Every service method throws. A render must not need one -- if a later edit
 * fetches during render instead of through React Query, this is a loud
 * failure rather than a silent extra request. */
const svcProxy = `new Proxy({}, { get: () => async () => { throw new Error("the render test makes no requests"); } })`;
const routerSvcStub = join(outdir, "router-service-stub.mjs");
writeFileSync(routerSvcStub, `export const routerService = ${svcProxy};`);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { RouterDetailTabs } from "${p("src/components/routers/RouterDetailTabs.tsx")}";
   import {
     resolveRouterDetailTab,
     routerDetailTabsFor,
     routerDetailTabsNotApplicableFor,
     ROUTER_DETAIL_TABS,
   } from "${p("src/lib/router-vendors.ts")}";
   import { navigations } from "${norm(routerStub)}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider, RouterDetailTabs,
            resolveRouterDetailTab, routerDetailTabsFor, routerDetailTabsNotApplicableFor,
            ROUTER_DETAIL_TABS, navigations };`,
);

// CJS out, not ESM: `react-dom/server.node` is CommonJS and reaches for
// node's `util` through a bare `require`, which esbuild cannot express in an
// ESM bundle ("Dynamic require of util is not supported").
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
  // Vite's `import.meta.env` does not exist outside Vite, and
  // `services/api.ts` reads it at import time.
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
    sonner: sonnerStub,
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);

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
  locationName: "Grand Hotel — Lobby",
  publicIpAddress: null,
  managementIpAddress: null,
  lastSeenAt: null,
  lastHealthCheckAt: null,
  createdAt: "2026-09-01T00:00:00Z",
};

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

/**
 * Renders, and reports BOTH the markup and every query the render
 * registered.
 *
 * The query cache is the load-bearing half. "This panel is not shown" is an
 * assertion about the markup and it is the weaker claim: `TabsContent` mounts
 * its children, and a mounted `WireGuardTab` whose query has not resolved
 * renders a loading skeleton with no distinctive words in it -- so a
 * text-absence check would pass on a panel that had in fact mounted and is
 * one `setTab` away from allocating a hub peer that can never be revoked.
 * A registered query key is direct evidence the component ran.
 */
function render(overrides, initialTab) {
  m.navigations.length = 0;
  const client = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = decode(
    m.renderToStaticMarkup(
      m.React.createElement(
        m.QueryClientProvider,
        { client },
        m.React.createElement(m.RouterDetailTabs, {
          router: { ...BASE_ROUTER, ...overrides },
          initialTab,
        }),
      ),
    ),
  );
  const queries = client
    .getQueryCache()
    .getAll()
    .map((q) => JSON.stringify(q.queryKey));
  return { html, queries, queryText: queries.join(" | ") };
}
function renderHtml(overrides, initialTab) {
  return render(overrides, initialTab).html;
}

const OMADA = { vendor: "tplink_omada", model: "OC200" };

// ---------------------------------------------------------------------------
// 1. No agent-shaped tab is reachable on a controller.
// ---------------------------------------------------------------------------

console.log("\na controller's drawer has no agent-shaped tabs");

const controllerHtml = renderHtml(OMADA);
const mikrotikHtml = renderHtml({});

/** Every tab label that is a conversation with the agent. */
const AGENT_TABS = [
  "Setup Script",
  "WireGuard",
  "Guest WiFi",
  "Connected Devices",
  "Monitoring",
  "Analytics",
  "Configuration",
  "Provisioning",
  "Diagnostics",
];

for (const label of AGENT_TABS) {
  check(
    `controller-has-no-${label.toLowerCase().replace(/ /g, "-")}-tab`,
    !new RegExp(`>${label}<`).test(controllerHtml),
    "the trigger is still rendered",
  );
}
check(
  "controller-keeps-overview",
  />Overview</.test(controllerHtml),
  "the Router row itself is real and must still be inspectable",
);
check(
  "controller-keeps-audit-logs",
  />Audit Logs</.test(controllerHtml),
  "audit rows record what people did in this console and exist regardless of vendor",
);

// A hidden trigger is not enough: `TabsContent` mounts its children, so the
// panels have to be gone too -- and the evidence for that is the query cache,
// not the markup (see `render`'s docstring).
{
  const controller = render(OMADA, "wireguard");
  const agent = render({}, "wireguard");
  check(
    "positive control: a mikrotik deep-linked to wireguard DOES register its peer query",
    /wireguard/i.test(agent.queryText),
    `without this the absence check below is vacuous -- keys were: ${agent.queryText}`,
  );
  check(
    "controller-does-not-mount-the-wireguard-panel",
    !/wireguard/i.test(controller.queryText),
    `a mounted panel is one setTab away from allocating a hub peer that can never be revoked -- keys were: ${controller.queryText}`,
  );
}
check(
  "controller-does-not-mount-the-setup-script-panel",
  !/Open in Master Console/.test(controllerHtml),
  "a RouterOS script for an agent that will never run",
);
check(
  "controller-does-not-mount-the-guest-wifi-panel",
  !/isn't managed here/.test(controllerHtml),
  "that panel's explanation -- MikroTik hotspot settings live in the customer dashboard -- is the wrong answer for a controller",
);
// Same argument for every other agent-shaped panel, in one pass: on a
// controller none of them may reach the point of asking the backend anything.
for (const [tab, marker] of [
  ["devices", /connected-devices|connectedDevices|device/i],
  ["monitoring", /monitoring|metric|domain-routers/i],
  ["config", /config/i],
  ["provisioning", /provisioning/i],
  ["diagnostics", /diagnostic/i],
]) {
  const agent = render({}, tab);
  const controller = render(OMADA, tab);
  check(
    `positive control: a mikrotik on the ${tab} tab queries the backend`,
    marker.test(agent.queryText),
    `keys were: ${agent.queryText}`,
  );
  check(
    `controller-does-not-mount-the-${tab}-panel`,
    !marker.test(controller.queryText),
    `keys were: ${controller.queryText}`,
  );
}

// ---------------------------------------------------------------------------
// 2. No fabricated measurement reaches the screen.
// ---------------------------------------------------------------------------

console.log("\nnothing is claimed that was never measured");

check(
  "controller-is-not-called-pending-provisioning",
  !/Pending provisioning/i.test(controllerHtml),
  "there is nothing to provision, so this reads as a device somebody abandoned",
);
check(
  "controller-does-not-report-last-seen-never",
  !/>Never</.test(controllerHtml),
  '"Never" is a measurement claim; nothing here ever measures',
);
check(
  "controller-does-not-report-a-routeros-version",
  !/>RouterOS</.test(controllerHtml) && !/Unknown \(never reported\)/.test(controllerHtml),
  "it does not run RouterOS, so a missing version is not a collection failure",
);
check(
  "controller-does-not-say-credentials-are-not-set",
  !/Not set/.test(controllerHtml),
  "no form on this page could set them; they live on the network integration",
);
check(
  "controller-does-not-offer-a-provisioning-token",
  !/Generate token/.test(controllerHtml),
  "nothing will ever exchange it, and the backend refuses to mint one",
);
check(
  "controller-says-what-it-does-not-measure",
  /Not measured here/.test(controllerHtml),
  "the honest replacement for Never/Unknown",
);
check(
  "controller-names-its-vendor-in-words",
  /TP-Link Omada/.test(controllerHtml),
  "the raw `tplink_omada` column value is not operator-facing copy",
);

// ---------------------------------------------------------------------------
// 3. The operator is pointed at where the answer actually is.
// ---------------------------------------------------------------------------

console.log("\nthe drawer points at the venue's network integration");

check(
  "controller-mentions-the-network-integration",
  /network integration/i.test(controllerHtml),
  controllerHtml.slice(0, 200),
);
check(
  "controller-names-the-tabs-it-is-not-showing",
  AGENT_TABS.every((label) => controllerHtml.includes(label)) &&
    /do not apply and are not shown/i.test(controllerHtml),
  "a drawer missing most of its tabs with no explanation reads as a broken console",
);
check(
  "controller-offers-a-button-to-the-integration",
  /Open network integration/.test(controllerHtml),
  "a sentence pointing somewhere unreachable is not a pointer",
);

// ---------------------------------------------------------------------------
// 4. The gate is narrow.
// ---------------------------------------------------------------------------

console.log("\nevery other vendor is untouched");

for (const t of m.ROUTER_DETAIL_TABS) {
  check(
    `mikrotik-keeps-${t.key}`,
    new RegExp(`>${t.label}<`).test(mikrotikHtml),
    "the controller gate must not remove a tab from an agent-managed row",
  );
}
check(
  "mikrotik-still-reports-last-seen-never",
  />Never</.test(mikrotikHtml),
  "on an agent-managed router this IS a measurement, and a true one",
);
check(
  "mikrotik-still-reports-its-routeros-version-field",
  />RouterOS</.test(mikrotikHtml) && /Unknown \(never reported\)/.test(mikrotikHtml),
  "an agent-managed router that never reported a version HAS failed to report one",
);
check("mikrotik-gets-no-controller-panel", !/Open network integration/.test(mikrotikHtml));

// POSITIVE CONTROL for the three "does not mount" checks above. Each of them
// is an assertion that a string is ABSENT, and an absent string is also what
// you get from a typo in the pattern, from a panel that was renamed, or from
// a component that stopped rendering for an unrelated reason. So the same
// patterns are asserted PRESENT on the vendor that should have them. Without
// this pair, those checks could pass on a drawer that renders nothing at all.
{
  const mikrotikSetup = renderHtml({}, "setup-script");
  check(
    "positive control: the setup-script panel really does say Open in Master Console",
    /Open in Master Console/.test(mikrotikSetup),
  );
  const mikrotikWifi = renderHtml({}, "wifi");
  check(
    "positive control: the guest-wifi panel really does say isn't managed here",
    /isn't managed here/.test(mikrotikWifi),
  );
}

const unknownVendorHtml = renderHtml({ vendor: "ubiquiti_unifi" });
check(
  "an unrecognised vendor keeps every tab",
  m.ROUTER_DETAIL_TABS.every((t) => new RegExp(`>${t.label}<`).test(unknownVendorHtml)),
  "the allowlist is CONTROLLER_MANAGED_VENDORS, not `anything that is not mikrotik`",
);
const noVendorHtml = renderHtml({ vendor: "" });
check(
  "a row with no vendor keeps every tab",
  m.ROUTER_DETAIL_TABS.every((t) => new RegExp(`>${t.label}<`).test(noVendorHtml)),
  "every row that existed before this feature has no vendor",
);
check(
  "vendor matching is case-insensitive",
  m.routerDetailTabsFor("TPLink_Omada").length === m.routerDetailTabsFor("tplink_omada").length,
  "the API returns the raw column; the demo fixtures carry the display spelling",
);

// ---------------------------------------------------------------------------
// 5. A stale deep link still renders a panel.
// ---------------------------------------------------------------------------

console.log("\na bookmarked ?tab= that no longer applies still renders something");

check(
  "a controller asked for the wireguard tab lands on overview",
  m.resolveRouterDetailTab("tplink_omada", "wireguard") === "overview",
  m.resolveRouterDetailTab("tplink_omada", "wireguard"),
);
check(
  "a mikrotik asked for the wireguard tab gets the wireguard tab",
  m.resolveRouterDetailTab("mikrotik", "wireguard") === "wireguard",
);
check(
  "an unknown tab name lands on the first available tab",
  m.resolveRouterDetailTab("mikrotik", "not-a-tab") === "overview",
);
check(
  "no requested tab lands on the first available tab",
  m.resolveRouterDetailTab("tplink_omada", undefined) === "overview",
);

const deepLinked = renderHtml(OMADA, "wireguard");
check(
  "a controller deep-linked to wireguard still renders the overview panel",
  /Device information/.test(deepLinked),
  "Radix renders no panel at all when `value` matches no trigger",
);

// The lists must agree: together they are exactly the full tab set, with no
// tab in both and none in neither.
{
  const applies = m.routerDetailTabsFor("tplink_omada").map((t) => t.key);
  const doesNot = m.routerDetailTabsNotApplicableFor("tplink_omada").map((t) => t.key);
  const all = m.ROUTER_DETAIL_TABS.map((t) => t.key);
  check(
    "the shown and not-shown lists partition the tab set",
    applies.length + doesNot.length === all.length &&
      all.every((k) => applies.includes(k) !== doesNot.includes(k)),
    `${applies.length} + ${doesNot.length} vs ${all.length}`,
  );
  check(
    "an agent-managed vendor has no not-applicable list to render",
    m.routerDetailTabsNotApplicableFor("mikrotik").length === 0,
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
