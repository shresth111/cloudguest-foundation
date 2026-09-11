/**
 * Router Fleet's setup screen for a TP-Link Omada controller.
 *
 * Run: node scripts/test-omada-guided-setup.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * `RouterSetupDrilldown` rendered "TP-Link Omada support is coming soon --
 * MikroTik is the only supported vendor today" for every Omada row. Omada
 * venues are fully supported (integration + fleet row via
 * `POST /network-integrations/platform/onboard`, guests authorized through
 * the controller's hotspot API); what Omada lacks is a SCRIPT, because the
 * controller is configured in its own UI. The platform owner opened an Omada
 * venue's setup screen, read "coming soon", and concluded Omada was never
 * built.
 *
 * The replacement, `OmadaGuidedSetupPanel`, finds the device's integration
 * and shows the controller settings from it. What can go wrong, and none of
 * it visible to tsc:
 *
 *   - the scheme glued onto the URL (the controller rejects it);
 *   - another device's integration shown for this one;
 *   - a copyable URL beside a readiness gap, pasted and walked away from;
 *   - MikroTik losing its script generator, or the stub vendors their honest
 *     "not supported" panel.
 *
 * So this mounts the REAL drilldown in Chromium, through the REAL
 * network-integration service and `api` client, against a local server that
 * plays the backend and records every request. Only the router library,
 * `sonner` and `@/hooks/useRouters` are stubbed: the drilldown is not
 * mounted inside a route tree, and the script generator's mutations are
 * never fired here.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "omada-guided-setup-"));

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
// Fixtures.
// ---------------------------------------------------------------------------
const BASE_ROUTER = {
  id: "r-omada",
  name: "Seaside OC200",
  serialNumber: "OMADA-0A1B2C3D4E5F",
  macAddress: "02:11:22:33:44:55",
  model: "Omada Software Controller",
  vendor: "tplink_omada",
  routerOsVersion: null,
  managementIpAddress: null,
  publicIpAddress: null,
  status: "pending_provisioning",
  lastSeenAt: null,
  lastHealthCheckAt: null,
  healthStatus: null,
  hasApiCredentials: false,
  settings: {},
  organizationId: "org-1",
  organizationName: "Acme Hospitality",
  locationId: "loc-1",
  locationName: "Seaside Hotel",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

const PORTAL_HOST = "app.wyfyguest.com";
const HOST_AND_QUERY = `${PORTAL_HOST}/portal?organizationId=org-1&locationId=loc-1&routerId=r-omada&netProvider=omada`;
const DECOY_HOST_AND_QUERY = `${PORTAL_HOST}/portal?organizationId=org-1&locationId=loc-2&routerId=r-other&netProvider=omada`;

function integration(over) {
  return {
    id: "int-1",
    organization_id: "org-1",
    organization_name: "Acme Hospitality",
    location_id: "loc-1",
    location_name: "Seaside Hotel",
    provider: "omada",
    name: "Seaside Controller",
    status: "connected",
    is_enabled: true,
    base_url: "https://ctl.example.com:8043",
    auth_mode: "legacy",
    tls_mode: "strict",
    controller_id: "omadac-1",
    controller_version: "5.15",
    external_site_id: "Default",
    external_site_name: "Default",
    guest_ssid_name: "Seaside-Guest",
    guest_ssid_id: "ssid-1",
    session_duration_seconds: 86400,
    sync_interval_seconds: 300,
    last_sync_at: null,
    last_sync_status: "ok",
    last_error_code: null,
    last_error_message: null,
    last_error_at: null,
    device_count: 3,
    client_count: 0,
    active_authorization_count: 0,
    has_credentials: true,
    // Never part of the real response. Here to prove nothing in the
    // response shape reaches the screen by accident.
    password: "op-Secret-9731",
    portal_url_scheme: "https",
    portal_url_host_and_query: HOST_AND_QUERY,
    portal_readiness_gaps: [],
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}
const DECOY = integration({
  id: "int-other",
  name: "Harbour Controller",
  location_id: "loc-2",
  guest_ssid_name: "Harbour-Guest",
  portal_url_host_and_query: DECOY_HOST_AND_QUERY,
});

// ---------------------------------------------------------------------------
// The bundle: the real drilldown, in a real QueryClient.
// ---------------------------------------------------------------------------
writeFileSync(
  join(work, "router-stub.jsx"),
  `export function Link({ to, search, children, onClick, className }) {
     const q = search ? "?" + new URLSearchParams(search).toString() : "";
     return <a href={to + q} className={className} onClick={(e) => { e.preventDefault(); onClick?.(e); }}>{children}</a>;
   }
   export function useNavigate() { return () => {}; }
   export function Outlet() { return null; }
   export function useChildMatches() { return []; }
   export function useParams() { return {}; }
   export function useSearch() { return {}; }
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
writeFileSync(
  join(work, "router-hooks-stub.js"),
  `export const routerKeys = {
     all: ["routers"], list: (q) => ["routers", "list", q],
     detail: (id) => ["routers", "detail", id], wireguard: (id) => ["routers", "wg", id],
   };
   const idle = { mutate: () => {}, mutateAsync: async () => {}, isPending: false, reset: () => {} };
   const none = { data: undefined, isLoading: false, isError: false, error: null, refetch: () => {} };
   export function useRouters() { return none; }
   export function useRouter() { return none; }
   export function useWireGuardPeer() { return none; }
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

const drilldown = join(ROOT, "src/components/routers/RouterSetupScriptAdvanced.tsx").replace(
  /\\/g,
  "/",
);
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { RouterSetupDrilldown } from "${drilldown}";
   const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={qc}>
       <RouterSetupDrilldown router={window.__router} demo={false} vendorSaving={false} onVendorChange={() => {}} />
     </QueryClientProvider>,
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
    "@tanstack/react-router": join(work, "router-stub.jsx"),
    "@/hooks/useRouters": join(work, "router-hooks-stub.js"),
    sonner: join(work, "sonner-stub.js"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

// ---------------------------------------------------------------------------
// The backend: the harness page plus the one endpoint the panel calls.
// ---------------------------------------------------------------------------
/** Every API request, in order: { method, path, query, headers }. */
let requests = [];
/** What the platform list answers: { status, rows }. */
let listAnswer = { status: 200, rows: [] };
let servedRouter = BASE_ROUTER;

const envelope = (data) => JSON.stringify({ success: true, message: "ok", data });
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(
        `<!doctype html><meta charset=utf-8><title>omada guided setup harness</title>
         <script>window.__router = ${JSON.stringify(servedRouter)};</script>
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
  const path = url.pathname.replace(/^\/api\/v1/, "");
  requests.push({
    method: req.method,
    path,
    query: Object.fromEntries(url.searchParams),
    headers: req.headers,
  });
  res.setHeader("content-type", "application/json");
  if (req.method === "GET" && path === "/network-integrations/platform/integrations") {
    if (listAnswer.status !== 200) {
      res.writeHead(listAnswer.status);
      return res.end(
        JSON.stringify({ success: false, message: listAnswer.message ?? "Forbidden", data: {} }),
      );
    }
    res.writeHead(200);
    return res.end(
      envelope({
        items: listAnswer.rows,
        page: 1,
        page_size: 100,
        total_items: listAnswer.rows.length,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      }),
    );
  }
  res.writeHead(404);
  res.end(JSON.stringify({ success: false, message: `unexpected ${path}`, data: {} }));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });

const integrationCalls = () =>
  requests.filter((r) => r.path === "/network-integrations/platform/integrations");

async function open(router, answer, waitFor) {
  requests = [];
  servedRouter = router;
  listAnswer = answer;
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByText(waitFor).first().waitFor({ timeout: 10_000 });
  const text = await page.locator("#root").innerText();
  return { page, text };
}

/** The `<code>` value beside a copy button, by the button's label. */
const valueFor = (page, label) =>
  page
    .getByRole("button", { name: `Copy ${label}`, exact: true })
    .locator("xpath=preceding-sibling::code")
    .innerText();

// ---------------------------------------------------------------------------
console.log("\n1. tplink_omada, ready integration: the four steps with the exact split");
{
  const { page, text } = await open(
    BASE_ROUTER,
    { status: 200, rows: [DECOY, integration({})] },
    "1. External Portal Server",
  );

  check("the 'coming soon' panel is gone", !/coming soon/i.test(text), text.slice(0, 400));
  check(
    "says there is no script, the controller is configured in its own UI",
    text.includes("TP-Link Omada is configured on the controller, not by a script"),
  );

  const calls = integrationCalls();
  check("exactly one integrations request", calls.length === 1, String(calls.length));
  check(
    "it is the platform list, filtered to this device's organization and to omada",
    calls[0]?.method === "GET" &&
      calls[0]?.query.organization_id === "org-1" &&
      calls[0]?.query.provider === "omada",
    JSON.stringify(calls[0]?.query),
  );
  check(
    "a platform call, so no X-Organization-Id header",
    calls[0] && !("x-organization-id" in calls[0].headers),
  );
  check(
    "nothing else was requested",
    requests.length === calls.length,
    JSON.stringify(requests.map((r) => r.path)),
  );

  const titles = [
    "1. External Portal Server",
    "2. Pre-Authentication Access",
    "3. Guests must reach the controller",
    "4. Verify",
  ];
  const at = titles.map((t) => text.indexOf(t));
  check(
    "all four steps, in order",
    at.every((i) => i >= 0) && at.every((i, n) => n === 0 || i > at[n - 1]),
    JSON.stringify(at),
  );

  check(
    "step 1 names the controller path",
    text.includes(
      "Site View → Network Config → Authentication → Portal → (create or edit the portal for the guest SSID) → Authentication Type: External Portal Server → Host Type: URL",
    ),
  );
  check("Scheme is exactly https", (await valueFor(page, "Scheme")) === "https");
  check(
    "URL is exactly host+path+query, WITHOUT https://",
    (await valueFor(page, "URL")) === HOST_AND_QUERY,
    await valueFor(page, "URL"),
  );
  check(
    "the scheme is never glued onto the URL anywhere on screen",
    !text.includes(`https://${HOST_AND_QUERY}`) && !text.includes(`https://${PORTAL_HOST}/`),
  );
  check(
    "warns the controller rejects a URL containing the scheme",
    text.includes("the controller rejects a URL that contains the scheme"),
  );
  check(
    "names the SSID the portal must be attached to",
    (await valueFor(page, "Guest SSID")) === "Seaside-Guest",
  );

  check(
    "step 2 names the Pre-Authentication Access path",
    text.includes(
      "Authentication → Portal → Access Control → Pre-Authentication Access → add URL entry",
    ),
  );
  check(
    "step 2's value is the portal host alone",
    (await valueFor(page, "Portal host")) === PORTAL_HOST,
  );
  check(
    "step 2 says why: guests hang, Omada does not auto-allow the portal server",
    text.includes("Without it guests hang forever") &&
      text.includes("does not automatically allow the portal server"),
  );

  check(
    "step 3: the controller's own portal page on 8088 (8843 with HTTPS redirection)",
    text.includes("port 8088") && text.includes("8843"),
  );
  check(
    "step 3: a cloud-hosted controller must allow the venue's public IP",
    text.includes("allowing the venue’s public IP"),
  );
  check(
    "step 4: the sign-in address carries site= and clientMac=, then the phone browses",
    text.includes("site=") && text.includes("clientMac=") && /should browse/.test(text),
  );

  for (const label of ["Scheme", "URL", "Guest SSID", "Portal host"]) {
    check(
      `one copy button for ${label}`,
      (await page.getByRole("button", { name: `Copy ${label}`, exact: true }).count()) === 1,
    );
  }
  await page.getByRole("button", { name: "Copy URL", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  check(
    "Copy URL puts exactly the scheme-less URL on the clipboard",
    copied === HOST_AND_QUERY,
    String(copied),
  );

  check(
    "another device's integration is not shown",
    !text.includes("Harbour") && !text.includes(DECOY_HOST_AND_QUERY),
  );
  check("never shows credentials", !text.includes("op-Secret-9731"));
  check(
    "links to the integration",
    (await page.locator('a[href="/master/integrations?q=Seaside+Controller"]').count()) === 1,
  );
  check(
    "no script generator for an Omada device",
    (await page.getByRole("button", { name: /Generate script/ }).count()) === 0,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n2. tplink_omada, integration with gaps: the gaps, not the values");
{
  const { page, text } = await open(
    BASE_ROUTER,
    {
      status: 200,
      rows: [
        integration({
          has_credentials: false,
          external_site_id: null,
          portal_readiness_gaps: ["credentials_missing", "site_not_selected"],
        }),
      ],
    },
    "Guests cannot sign in at this venue yet",
  );
  check(
    "names each gap in the backend's own wording",
    text.includes("no controller credentials have been saved") &&
      text.includes("no controller site has been selected"),
    text,
  );
  check("does not show raw gap codes", !text.includes("credentials_missing"));
  check(
    "shows none of the values, even though the URL is on the response",
    !text.includes(HOST_AND_QUERY) &&
      !text.includes("1. External Portal Server") &&
      (await page.getByRole("button", { name: /^Copy / }).count()) === 0,
  );
  check(
    "links to the integration",
    (await page.locator('a[href="/master/integrations?q=Seaside+Controller"]').count()) === 1,
  );
  await page.close();
}

console.log("\n2b. no integration names this device: the venue's URL-less one, with its gap");
{
  const { page, text } = await open(
    BASE_ROUTER,
    {
      status: 200,
      rows: [
        DECOY,
        integration({
          name: "Unpaired Controller",
          portal_url_scheme: null,
          portal_url_host_and_query: null,
          portal_readiness_gaps: ["fleet_device_missing"],
        }),
      ],
    },
    "No integration names this device yet",
  );
  check(
    "shows the no-fleet-device gap in the backend's own wording",
    text.includes("it has no fleet device, so no guest session can be created for it"),
    text,
  );
  check("names the candidate", text.includes("Unpaired Controller"));
  check("does not offer the other device's integration", !text.includes("Harbour"));
  check("no copyable values", (await page.getByRole("button", { name: /^Copy / }).count()) === 0);
  await page.close();
}

console.log("\n2c. no integration at all");
{
  const { page, text } = await open(
    BASE_ROUTER,
    { status: 200, rows: [DECOY] },
    "No network integration is linked to this device",
  );
  check("says so, and does not borrow another device's values", !text.includes("Harbour"));
  check(
    "links to the organization's integrations",
    (await page.locator('a[href="/master/integrations?q=Acme+Hospitality"]').count()) === 1,
  );
  await page.close();
}

console.log("\n2d. the list cannot be read");
{
  const { page, text } = await open(
    BASE_ROUTER,
    { status: 403, rows: [], message: "You do not have permission to read integrations" },
    "Could not load this controller's network integration",
  );
  check(
    "shows the backend's message, not an empty 'no integration' claim",
    text.includes("You do not have permission to read integrations") &&
      !text.includes("No network integration is linked"),
    text,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n3. mikrotik: still the script generator");
{
  const { page, text } = await open(
    { ...BASE_ROUTER, id: "r-mt", name: "Lobby hEX", vendor: "mikrotik", model: "hEX S" },
    { status: 200, rows: [integration({})] },
    "Generate script",
  );
  check(
    "the Generate script button is there",
    (await page.getByRole("button", { name: /Generate script/ }).count()) >= 1,
  );
  check(
    "no Omada panel and no 'coming soon'",
    !text.includes("configured on the controller, not by a script") && !/coming soon/i.test(text),
  );
  check("no integrations request", integrationCalls().length === 0);
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n4. ruckus: still the honest not-supported panel");
{
  const { page, text } = await open(
    { ...BASE_ROUTER, id: "r-rk", name: "Ruckus AP", vendor: "ruckus", model: "R550" },
    { status: 200, rows: [integration({})] },
    "Ruckus support is coming soon",
  );
  check(
    "no script generator",
    (await page.getByRole("button", { name: /Generate script/ }).count()) === 0,
  );
  check("no Omada panel", !text.includes("configured on the controller, not by a script"));
  check(
    "no longer claims MikroTik is the only supported vendor",
    !text.includes("MikroTik is the only supported vendor"),
  );
  check("no integrations request", integrationCalls().length === 0);
  await page.close();
}

await browser.close();
server.close();
console.log(
  failures === 0
    ? "\nomada guided setup: all checks passed"
    : `\nomada guided setup: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
