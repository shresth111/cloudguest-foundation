/**
 * A half-configured network integration must be impossible to miss.
 *
 * THE STATE
 * ---------
 * The Omada connect flow cannot collect everything before it writes a row:
 * listing a controller's sites needs an authenticated call, which needs
 * stored credentials, which needs the row the wizard is only creating at
 * that moment. So the row is created as soon as the connection test passes
 * and the site / venue / guest-SSID choices are PATCHed on afterwards. An
 * operator who stops there -- which the Master device wizard's own last step
 * invites, because it says "now go and map the site in Integrations" --
 * leaves a row that exists, reads `Connecting` or `Setup incomplete`, and
 * **authorises nobody**.
 *
 * A guest at that venue completes the entire sign-in journey. Code
 * delivered, code accepted, "you're connected". And has no internet, because
 * the network-enforcement step at the end has no site and no SSID to send.
 * The venue reads that as this platform being broken.
 *
 * Before this, the only signal anywhere was an amber status badge in a row
 * of status badges, on a page you had to already be looking at.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. THE VERDICT COMES FROM THE FIELDS, NOT FROM `status`. A row still
 *      reading `connecting` with no site mapped is exactly as dead as an
 *      `unconfigured` one -- and `connecting`'s own copy ("waiting on the
 *      controller's first successful reply, this usually takes seconds") is
 *      a reassuring sentence to print over a venue where nobody can get
 *      online. A `status === "unconfigured"` check would have missed it.
 *   2. NO FALSE ALARM ON A WORKING VENUE. This banner is destructive-red and
 *      names the customer; firing it on a healthy integration is how a
 *      warning stops being read. Asserted on the rendered page, both ways.
 *   3. "SWITCHED OFF" AND "NEVER FINISHED" STAY DIFFERENT ANSWERS. Both
 *      authorise nobody. One was a decision and the other was an accident,
 *      and they have different fixes.
 *   4. LEGACY (OPERATOR-CREDENTIAL) VENUES ARE NOT REPORTED AS BROKEN.
 *      CR-002: with operator credentials the controller cannot list its own
 *      sites, so the site arrives as a hand-typed NAME with no id. Demanding
 *      an id would report every correctly-configured legacy venue as dead.
 *   5. THE WARNING SAYS WHAT IS MISSING AND WHAT IT COSTS, not "misconfigured".
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-network-integration-render.mjs` for the same note). The pure
 * derivation is bundled and executed for real; the customer page is bundled
 * against stubs and server-rendered against a pre-seeded React Query cache.
 *
 * Run: node scripts/test-integration-half-configured.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "half-configured-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

const hooksStub = join(outdir, "hooks-stub.mjs");
writeFileSync(
  hooksStub,
  `let demo = false;
   export function setDemo(v) { demo = v; }
   export function useIsDemo() { return demo; }
   export function useCustomerLocations() {
     return { data: [{ id: "loc-1", name: "Lobby", city: "Mumbai" }], isLoading: false };
   }
   export function useDataMasking() { return { masked: false }; }`,
);

/** Every service method throws: a render must not need one. */
const svcStub = join(outdir, "svc-stub.mjs");
writeFileSync(
  svcStub,
  `export const networkIntegrationService = new Proxy(
     {},
     { get: () => async () => { throw new Error("the render test makes no requests"); } },
   );`,
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

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { NetworkIntegrationsPage } from "${p("src/components/features/NetworkIntegrationsPage.tsx")}";
   import {
     deriveIntegrationSetup,
     halfConfiguredIntegrations,
     integrationAuthorizesGuests,
     INTEGRATION_DEAD_CONSEQUENCE,
   } from "${p("src/lib/network-integration-readiness.ts")}";
   import { setDemo } from "${norm(hooksStub)}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider,
            NetworkIntegrationsPage, deriveIntegrationSetup, halfConfiguredIntegrations,
            integrationAuthorizesGuests, INTEGRATION_DEAD_CONSEQUENCE, setDemo };`,
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
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "@/hooks/useCustomerDashboard": hooksStub,
    "@/services/network-integration.service": svcStub,
    sonner: sonnerStub,
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);

/** A fully mapped, working integration. Every case below is this minus one
 * thing, so a check can never pass because two faults cancelled out. */
const WORKING = {
  id: "int-1",
  organizationId: "org-1",
  locationId: "loc-1",
  organizationName: "Grand Hotel",
  locationName: "Lobby",
  provider: "omada",
  name: "Lobby controller",
  status: "connected",
  isEnabled: true,
  baseUrl: "https://controller.example.com:8043",
  authMode: "openapi",
  controllerId: "abc123",
  controllerVersion: "5.14.20.9",
  externalSiteId: "site-1",
  externalSiteName: "Default",
  guestSsidName: "Hotel Guest",
  guestSsidId: "ssid-1",
  sessionDurationSeconds: 3600,
  syncIntervalSeconds: 300,
  lastSyncAt: "2026-09-10T09:00:00Z",
  lastSyncStatus: "ok",
  lastErrorCode: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  deviceCount: 4,
  clientCount: 37,
  activeAuthorizationCount: 12,
  hasCredentials: true,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-10T09:00:00Z",
};

const at = (overrides) => ({ ...WORKING, ...overrides });
const setup = (overrides) => m.deriveIntegrationSetup(at(overrides));

/** Exactly what the Master device wizard leaves behind when an operator
 * stops after the connection test. */
const WIZARD_STOPPED_HALFWAY = at({
  status: "unconfigured",
  externalSiteId: null,
  externalSiteName: null,
  guestSsidId: null,
  guestSsidName: null,
});

// ---------------------------------------------------------------------------
// 1. The verdict comes from the fields, not from `status`.
// ---------------------------------------------------------------------------

console.log("\nthe verdict is derived from what is actually stored");

check(
  "a fully mapped, enabled integration authorises guests",
  m.integrationAuthorizesGuests(WORKING) === true,
);
check(
  "the wizard's half-finished row does not",
  m.integrationAuthorizesGuests(WIZARD_STOPPED_HALFWAY) === false,
);

// THE CRUX. `status` still reads `connecting`, whose own copy says this is
// normal and takes seconds. It is not: nothing is mapped, so nobody gets on.
{
  const stillConnecting = setup({
    status: "connecting",
    externalSiteId: null,
    externalSiteName: null,
    guestSsidId: null,
    guestSsidName: null,
  });
  check(
    "a `connecting` row with nothing mapped is still reported as authorising nobody",
    stillConnecting.isHalfConfigured === true && stillConnecting.authorizesGuests === false,
    "a status-only check reads this as 'waiting on the controller, usually seconds'",
  );
}

// The converse: the backend saying `unconfigured` over a row that is in fact
// fully mapped must not produce a warning nobody can act on.
check(
  "an `unconfigured` status over a fully mapped row raises no gap",
  setup({ status: "unconfigured" }).isHalfConfigured === false,
  "there would be nothing on screen for the reader to go and fix",
);

console.log("\neach missing piece is named separately");

const CASES = [
  ["site", { externalSiteId: null, externalSiteName: null }],
  ["guestNetwork", { guestSsidId: null, guestSsidName: null }],
  ["venue", { locationId: null }],
  ["credentials", { hasCredentials: false }],
];
for (const [key, overrides] of CASES) {
  const s = setup(overrides);
  check(
    `missing ${key} is reported as a gap`,
    s.isHalfConfigured && s.gaps.length === 1 && s.gaps[0].key === key,
    JSON.stringify(s.gaps.map((g) => g.key)),
  );
  check(`missing ${key} means no guest is authorised`, s.authorizesGuests === false);
  check(
    `missing ${key} has its own sentence`,
    typeof s.gaps[0].detail === "string" && s.gaps[0].detail.length > 20,
    s.gaps[0].detail,
  );
}

// Four separate causes, four distinct sentences. Collapsing them into one
// "misconfigured" line is what makes a warning unactionable.
{
  const details = CASES.map(([, o]) => setup(o).gaps[0].detail);
  check(
    "the four gap sentences are all different",
    new Set(details).size === CASES.length,
    details.join(" // "),
  );
}

check(
  "several missing pieces are all listed, not just the first",
  setup({
    externalSiteId: null,
    externalSiteName: null,
    guestSsidId: null,
    guestSsidName: null,
    locationId: null,
  }).gaps.length === 3,
);

// ---------------------------------------------------------------------------
// 2. "Switched off" and "never finished" stay different answers.
// ---------------------------------------------------------------------------

console.log("\nswitched off is not the same problem as never finished");

{
  const off = setup({ isEnabled: false, status: "disabled" });
  check("a switched-off integration authorises nobody", off.authorizesGuests === false);
  check(
    "but it is NOT reported as half configured",
    off.isHalfConfigured === false,
    "turning it back on and finishing setup are different actions with different buttons",
  );
  check("and it is reported as switched off", off.isSwitchedOff === true);
  check("a working integration is not switched off", setup({}).isSwitchedOff === false);
}

// ---------------------------------------------------------------------------
// 3. CR-002: legacy operator credentials are not a fault.
// ---------------------------------------------------------------------------

console.log("\na legacy (operator-credential) venue is not reported as broken");

{
  // With operator credentials the controller cannot list its own sites, so
  // the site and SSID are typed in by hand and arrive as names with no ids.
  const legacy = setup({
    authMode: "legacy",
    externalSiteId: null,
    externalSiteName: "Default",
    guestSsidId: null,
    guestSsidName: "Hotel Guest",
  });
  check(
    "a hand-typed site name counts as a mapped site",
    legacy.isHalfConfigured === false,
    JSON.stringify(legacy.gaps.map((g) => g.key)),
  );
  check("and it authorises guests", legacy.authorizesGuests === true);
}

// ---------------------------------------------------------------------------
// 4. It reaches the screen, and only the right screens.
// ---------------------------------------------------------------------------

console.log("\nthe customer's own page shouts about it");

function decode(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x201C;/g, "“")
    .replace(/&#x201D;/g, "”");
}

function renderPage(rows, { locationId = "loc-1" } = {}) {
  m.setDemo(false);
  const client = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["network-integrations", "list"], {
    rows,
    total: rows.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });
  return decode(
    m.renderToStaticMarkup(
      m.React.createElement(
        m.QueryClientProvider,
        { client },
        m.React.createElement(m.NetworkIntegrationsPage, { locationId }),
      ),
    ),
  );
}

const brokenHtml = renderPage([WIZARD_STOPPED_HALFWAY]);
const workingHtml = renderPage([WORKING]);

check(
  "the half-configured venue gets the headline",
  /Connected, but authorising nobody/.test(brokenHtml),
  brokenHtml.slice(0, 300),
);
check(
  "it says what a guest actually experiences",
  brokenHtml.includes(m.INTEGRATION_DEAD_CONSEQUENCE),
  "'not configured' reads as a settings nit; this is a venue with no working WiFi",
);
check(
  "it names the missing site",
  /Omada site/.test(brokenHtml) && /nowhere to authorise a guest/.test(brokenHtml),
);
check(
  "it names the missing guest network",
  /Guest network/.test(brokenHtml) && /never put onto one/.test(brokenHtml),
);
check("it offers the button that fixes it", /Finish setup/.test(brokenHtml));

// The other half, and the one that keeps this warning worth reading.
check(
  "a working venue gets no headline",
  !/authorising nobody/i.test(workingHtml),
  "a red banner over a healthy venue trains people to ignore red banners",
);
check(
  "a working venue is not told guests cannot get online",
  !workingHtml.includes(m.INTEGRATION_DEAD_CONSEQUENCE),
);
check("a working venue is not offered Finish setup", !/Finish setup/.test(workingHtml));

// The status-only version of this feature would print nothing here.
{
  const connectingUnmapped = at({
    status: "connecting",
    externalSiteId: null,
    externalSiteName: null,
    guestSsidId: null,
    guestSsidName: null,
  });
  const html = renderPage([connectingUnmapped]);
  check(
    "a `connecting` row with nothing mapped is warned about on the page too",
    /authorising nobody/i.test(html),
    "this is the case a `status === 'unconfigured'` check silently passes over",
  );
  check(
    "and the reassuring `connecting` sentence does not stand alone",
    html.includes(m.INTEGRATION_DEAD_CONSEQUENCE),
  );
}

// A venue with several integrations: the dead one must be findable without
// clicking each chip.
{
  const html = renderPage([
    WORKING,
    { ...WIZARD_STOPPED_HALFWAY, id: "int-2", name: "Bar controller" },
  ]);
  check(
    "with several integrations the dead one is named in the banner",
    /Bar controller/.test(html) && /authorising nobody/i.test(html),
    "an owner lands on the first chip; the dead venue may be the third",
  );
}

// ---------------------------------------------------------------------------
// 5. The list helper the three surfaces share.
// ---------------------------------------------------------------------------

console.log("\nall three surfaces count the same thing");

{
  const rows = [
    WORKING,
    WIZARD_STOPPED_HALFWAY,
    at({ id: "x", isEnabled: false, status: "disabled" }),
  ];
  const flagged = m.halfConfiguredIntegrations(rows);
  check(
    "only the unfinished one is flagged",
    flagged.length === 1 && flagged[0].id === WIZARD_STOPPED_HALFWAY.id,
    flagged.map((r) => r.id).join(","),
  );
  check("an empty list flags nothing", m.halfConfiguredIntegrations([]).length === 0);
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
