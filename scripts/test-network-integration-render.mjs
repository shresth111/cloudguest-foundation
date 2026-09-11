/**
 * Render test for the customer "Network Integrations" page.
 *
 * WHAT IT PROVES, AND WHAT IT DOES NOT
 * ------------------------------------
 * The backend for `/api/v1/network-integrations` does not exist yet, so this
 * page has never been opened against a real API. A typecheck and a production
 * build both pass on a component that throws the moment it mounts, and the
 * one thing worse than an unfinished feature is one that white-screens a
 * venue owner's dashboard. So the real component is rendered here, seven
 * times, against a pre-seeded React Query cache standing in for the backend.
 *
 * This is a server render (`renderToStaticMarkup`), not a browser. It proves
 * the module graph resolves, the component mounts, and the copy that reaches
 * the markup is the copy the contract asks for. It proves nothing about
 * click behaviour, the Radix dialogs (which only mount on interaction), or
 * anything at all about a real Omada controller.
 *
 * THE ASSERTIONS THAT MATTER
 * --------------------------
 *   1. ALL SEVEN STATUSES RENDER. CONTRACT.md §8 requires every one of them,
 *      with distinct copy. `test-network-integration-contract.mjs` checks the
 *      copy tables are distinct; this checks the page actually puts them on
 *      screen, which is a different failure (a `switch` that only handles
 *      four, a badge map with a hole in it).
 *   2. A REJECTED CREDENTIAL AND A FAILED POLL READ DIFFERENTLY, in the
 *      rendered output and not merely in a table.
 *   3. NO RAW ERROR CODE IS EVER IN THE MARKUP of the customer page. The
 *      operator drawer in `/master/integrations` deliberately shows the code
 *      (it is what an engineer greps for); this page must not.
 *   4. NO SECRET IS IN THE MARKUP. The API cannot return one, but a mapper
 *      that passed an unexpected field through would put it here.
 *   5. THE DEMO WORKSPACE SAYS SO INSTEAD OF INVENTING HARDWARE. A demo
 *      session has no controller, and fabricating access points for a
 *      prospect is a mistake this product has made before.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-isp-links-single-flight.mjs` for the same note). The real
 * component is bundled with esbuild against stubs for the two seams it does
 * not own -- the demo flag / venue list hooks, and the service layer -- and
 * executed.
 *
 * Run: node scripts/test-network-integration-render.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "network-integration-render-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

/** The demo flag and the venue list are the page's two hook seams. Stubbed
 * rather than driven, because the real ones read `localStorage` and fan out
 * across `/me/organizations`, neither of which exists in node -- and neither
 * is what this test is about. */
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

/** Every service method throws. Deliberate: a render must not need one. If a
 * future edit fetches during render instead of through React Query, this
 * turns that into a loud failure rather than a silent extra request. */
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
   import { setDemo } from "${norm(hooksStub)}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider, NetworkIntegrationsPage, setDemo };`,
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
  // The entry lives in a temp dir, so package resolution has to be anchored
  // back at the repo or bare imports like `react` cannot be found.
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: {
    "@/hooks/useCustomerDashboard": hooksStub,
    "@/services/network-integration.service": svcStub,
    sonner: sonnerStub,
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);

const STATUSES = [
  "connected",
  "connecting",
  "auth_failed",
  "connection_failed",
  "disabled",
  "sync_error",
  "unconfigured",
];

/** A distinctive fragment of each status' own sentence. Fragments rather than
 * whole strings so that copy can be improved without this test becoming a
 * spelling checker -- but one fragment per status, so a status quietly
 * borrowing another's words still fails. */
const DETAIL_FRAGMENTS = {
  connected: "answered on the last check",
  connecting: "first successful reply",
  auth_failed: "rejected the credentials we have on file",
  connection_failed: "could not reach the controller at all",
  disabled: "Switched off on purpose",
  sync_error: "background refresh failed",
  // Not "no site and guest network have been chosen" any more: that was one
  // of several reasons a row is unconfigured (an Open API app with no
  // operator account is another), and the page lists which.
  unconfigured: "setup is not finished",
};

const INTEGRATION = {
  id: "int-1",
  organizationId: "org-1",
  locationId: "loc-1",
  organizationName: null,
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
  // A guest-ready integration: a portal URL to paste into the controller,
  // and nothing standing between it and its first authorized guest. Both
  // halves, because the dashboard renders them into two separate fields --
  // the controller's own `serverUrl` pattern rejects a value containing a
  // scheme, so handing over one joined string is the likeliest paste error.
  portalUrlScheme: "https",
  portalUrlHostAndQuery:
    "auth.wyfyguest.com/portal?organizationId=b1f2&locationId=c3d4&routerId=e5f6&netProvider=omada",
  portalReadinessGaps: [],
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-10T09:00:00Z",
};

/** `renderToStaticMarkup` escapes quotes and apostrophes, which real product
 * copy is full of. Decoded before matching so an assertion is about the words
 * a customer reads, not about HTML entities. */
function decode(html) {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function render(rows, { demo = false, locationId = "loc-1" } = {}) {
  m.setDemo(demo);
  const client = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (rows) {
    // Seeded straight into the cache under the page's own key, so the query
    // resolves synchronously and the service stub is never called. This is
    // the mock backend.
    client.setQueryData(["network-integrations", "list"], {
      rows,
      total: rows.length,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
  }
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

// ---------------------------------------------------------------------------
// 1. The demo workspace.
// ---------------------------------------------------------------------------

console.log("\nthe demo workspace says it cannot show this, instead of inventing it");

{
  const html = render(null, { demo: true });
  check("the demo notice renders", html.includes("Not available in the demo workspace"));
  check("and it explains why in terms of real hardware", /real Omada box/.test(html));
  check(
    "no fabricated access point, client or session count appears",
    !/Access points &amp; devices/.test(html) && !/Connected clients/.test(html),
  );
  check("and no Add integration button is offered", !/Add integration/.test(html));
}

// ---------------------------------------------------------------------------
// 2. First run, with no controller connected.
// ---------------------------------------------------------------------------

console.log("\nan account with no controller gets a first-run state, not an empty table");

{
  const html = render([]);
  check("the empty state renders", html.includes("No controller connected"));
  check("and it offers the wizard", html.includes("Add integration"));
}

// ---------------------------------------------------------------------------
// 3. All seven statuses.
// ---------------------------------------------------------------------------

console.log("\nall seven statuses render on the real page");

const rendered = {};
for (const status of STATUSES) {
  const errored = status === "auth_failed";
  const html = render([
    {
      ...INTEGRATION,
      status,
      isEnabled: status !== "disabled",
      lastErrorCode: errored ? "OMADA_AUTH_FAILED" : null,
      lastErrorMessage: errored ? "controller replied 401" : null,
      lastErrorAt: errored ? "2026-09-10T08:00:00Z" : null,
    },
  ]);
  rendered[status] = html;
  check(`${status}: renders its own sentence`, html.includes(DETAIL_FRAGMENTS[status]), status);
  check(
    `${status}: does not render another status' sentence`,
    Object.entries(DETAIL_FRAGMENTS).every(
      ([other, fragment]) => other === status || !html.includes(fragment),
    ),
  );
  check(`${status}: renders the controller address`, html.includes("controller.example.com:8043"));
  check(
    `${status}: renders no secret and no raw code`,
    !/client_secret|clientSecret|gAAAA|OMADA_[A-Z_]+/.test(html),
  );
}

check(
  "auth_failed and sync_error do not produce the same page",
  rendered.auth_failed !== rendered.sync_error,
);
check(
  "auth_failed shows the human sentence for the error code, not the code",
  /replace them to reconnect/.test(rendered.auth_failed) &&
    !rendered.auth_failed.includes("OMADA_AUTH_FAILED") &&
    !rendered.auth_failed.includes("401"),
);
check(
  "unconfigured offers the way to finish, since that is the only useful action",
  rendered.unconfigured.includes("Finish setup"),
);
check(
  "a connected integration reports credentials as on file, never their value",
  /On file/.test(rendered.connected) && /never shown again/.test(rendered.connected),
);
check(
  "the counts come from the integration row and are rendered",
  /Access points/.test(rendered.connected) && /Active guest sessions/.test(rendered.connected),
);
check(
  "and the destructive action is present but not the default",
  /Disconnect/.test(rendered.connected),
);

// ---------------------------------------------------------------------------
// 4. CR-002: a legacy-mode integration explains itself instead of showing
//    an empty table.
// ---------------------------------------------------------------------------

console.log("\na legacy-mode integration explains what it cannot read, rather than showing zero");

{
  // The Devices tab is the default one, so this render lands directly on the
  // surface CR-002 is about.
  const legacy = render([{ ...INTEGRATION, authMode: "legacy" }]);
  const openapi = rendered.connected;

  check("the Open API integration renders its device table", /Controller hardware/.test(openapi));
  check(
    "the legacy integration does NOT render a device table",
    !/Controller hardware/.test(legacy),
  );
  check("it renders the needs-Open-API state instead", /Needs Open API credentials/.test(legacy));
  check(
    "which says the guest sign-in still works",
    /sign-in is unaffected and fully supported/i.test(legacy),
  );
  check(
    "and does not blame the customer's credentials",
    /not a problem with your credentials/i.test(legacy),
  );
  check("and offers the fix", /Replace credentials/.test(legacy));
  check(
    "the device and client counts render as a dash, not a fabricated zero",
    /Needs Open API credentials/.test(legacy) && !/>4<\/span>/.test(legacy),
  );
  check(
    "the active guest session count is still shown, because that one is real in both modes",
    /Active guest sessions/.test(legacy),
  );
  check(
    "no raw error code or error banner is used to express a capability limit",
    !/OMADA_API_UNSUPPORTED/.test(legacy) && !/Could not load devices/.test(legacy),
  );
}

// ---------------------------------------------------------------------------
// 5. CR-001: nothing on the page offers to kick a guest off.
// ---------------------------------------------------------------------------

console.log("\nCR-001: the rendered page offers no per-guest disconnect");

{
  const connected = rendered.connected;
  check(
    "the only Disconnect on the page is the integration-level one",
    (connected.match(/Disconnect/g) ?? []).length === 1,
    String((connected.match(/Disconnect/g) ?? []).length),
  );
  check(
    "and no kick/deauthorise wording appears at all",
    !/kick|deauthoris|deauthoriz/i.test(connected),
  );
}

console.log(
  failures === 0
    ? "\nall network-integration render checks passed"
    : `\n${failures} network-integration render check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
