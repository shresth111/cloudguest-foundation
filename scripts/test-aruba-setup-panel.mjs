/**
 * Router Fleet's setup screen for an Aruba Instant On fleet row (Master only).
 *
 * Run: node scripts/test-aruba-setup-panel.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * Mounts the REAL `RouterSetupDrilldown` in Chromium, through the REAL
 * `arubaInstantOnService` and `api` client, against a local server that plays
 * the backend of ~/wyfy-ops/aruba-ap21/API_CONTRACT.md §2-§4 and records every
 * request. Same harness shape as `test-omada-guided-setup.mjs`; only the
 * router library, `sonner` (recorded, so a refusal's toast can be read) and
 * `@/hooks/useRouters` are stubbed.
 *
 * What it pins (PM_SPEC §0.2, §0.3, AC1-2, AC1-3), none of it visible to tsc:
 *
 *   - gaps instead of values: until the backend reports no gap, no portal URL
 *     and no backend value is rendered with a copy button -- even when a URL
 *     leaks onto the response;
 *   - Register needs a public IP AND the "static" tick, warns that RADIUS
 *     restarts on the hub, and sends `{nas_ip}` and nothing else;
 *   - the shared secret is shown ONCE: it is in the one-time dialog, and gone
 *     from the DOM the moment that dialog closes; a reload shows only the
 *     fingerprint and the NAS-Identifier;
 *   - Rotate shows a new secret once, with the backend's own "Instant On still
 *     has the old secret" sentence;
 *   - a 422 refusal is shown verbatim;
 *   - the §0.3 checklist, in order, with the values split into Instant On's
 *     boxes, and the panel never claims it opened the hub firewall;
 *   - MikroTik and Omada rows never call the Aruba routes.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "aruba-setup-panel-"));

let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
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
const ARUBA_ROUTER = {
  id: "r-aruba",
  name: "Aruba AP21 VNV5M1K1M6",
  serialNumber: "VNV5M1K1M6",
  macAddress: "54:F0:B1:C8:A9:0A",
  model: "AP21",
  vendor: "aruba_instant_on",
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
  organizationName: "Wyfy In-house",
  locationId: "loc-1",
  locationName: "Office",
  createdAt: "2026-10-02T00:00:00Z",
  updatedAt: "2026-10-02T00:00:00Z",
};

const PATH_AND_QUERY =
  "/portal?organizationId=org-1&locationId=loc-1&routerId=r-aruba&netProvider=aruba_instant_on&portalMode=radius";
const PORTAL_URL = {
  url: `https://auth.wyfyguest.com${PATH_AND_QUERY}`,
  server_host: "auth.wyfyguest.com",
  server_url_path: PATH_AND_QUERY,
  server_port: 443,
  use_https: true,
};
const RADIUS_HOST = "198.51.100.7";
const SECRET_1 = "Qw3rTy7uI9oP1aS2dF4gH6jK8lZ0xC5v";
const SECRET_2 = "Mn8bV6cX4zL2kJ0hG9fD7sA5pO3iU1yT";

const unregistered = (over = {}) => ({
  router_id: "r-aruba",
  vendor: "aruba_instant_on",
  vendor_label: "Aruba Instant On",
  serial_number: "VNV5M1K1M6",
  mac_address: "54:F0:B1:C8:A9:0A",
  registered: false,
  nas_id: null,
  nas_identifier: null,
  nas_ip: null,
  nas_status: null,
  secret_fingerprint: null,
  secret_length: null,
  hub_confirmed: false,
  radius_server: { host: RADIUS_HOST, auth_port: 1812, accounting_port: 1813 },
  allowed_domains: ["auth.wyfyguest.com", "api.wyfyguest.com"],
  // Deliberately present while there is a gap: the console must not render
  // it anyway (the contract says it is null then; the console must not rely
  // on that alone).
  portal_url: PORTAL_URL,
  gaps: ["nas_not_registered"],
  ...over,
});
const registered = (over = {}) =>
  unregistered({
    registered: true,
    nas_id: "nas-1",
    nas_identifier: "cg-aruba-r-aruba0",
    nas_ip: "203.0.113.10",
    nas_status: "active",
    secret_fingerprint: "82fca06b91e3",
    secret_length: 32,
    hub_confirmed: true,
    portal_url: PORTAL_URL,
    gaps: [],
    ...over,
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
  `const record = (kind) => (msg) => { (window.__toasts ||= []).push({ kind, msg: String(msg) }); };
   export const toast = Object.assign(record("default"), {
     success: record("success"), error: record("error"), warning: record("warning"),
     info: record("info"), message: record("message"),
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
   window.__qc = qc;
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
// The backend.
// ---------------------------------------------------------------------------
/** Every API request, in order: { method, path, body, headers }. */
let requests = [];
let servedRouter = ARUBA_ROUTER;
/** What the status read answers: { status, body }. */
let statusAnswer = { status: 200, body: unregistered() };
/** What register answers, and the status read becomes after it. */
let registerAnswer = null;

const envelope = (data) => JSON.stringify({ success: true, message: "ok", data });
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(
        `<!doctype html><meta charset=utf-8><title>aruba setup harness</title>
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
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const path = url.pathname.replace(/^\/api\/v1/, "");
  requests.push({ method: req.method, path, body: raw, headers: req.headers });
  res.setHeader("content-type", "application/json");

  if (req.method === "GET" && path === "/platform/radius/nas/public/r-aruba") {
    res.writeHead(statusAnswer.status);
    return res.end(
      statusAnswer.status === 200
        ? envelope(statusAnswer.body)
        : JSON.stringify({ success: false, message: statusAnswer.message, data: {} }),
    );
  }
  if (req.method === "POST" && path === "/platform/radius/nas/register-public/r-aruba") {
    const a = registerAnswer;
    if (a.status !== 201) {
      res.writeHead(a.status);
      return res.end(
        JSON.stringify({
          success: false,
          message: a.message,
          data: { code: "PUBLIC_NAS_REGISTRATION_REFUSED" },
        }),
      );
    }
    statusAnswer = { status: 200, body: registered() };
    res.writeHead(201);
    return res.end(
      envelope({
        router_id: "r-aruba",
        nas_id: "nas-1",
        vendor: "aruba_instant_on",
        nas_identifier: "cg-aruba-r-aruba0",
        nas_ip: JSON.parse(raw).nas_ip,
        shared_secret: SECRET_1,
        secret_fingerprint: "82fca06b91e3",
        secret_length: 32,
        hub_confirmed: true,
        rotated: false,
        portal_url: PORTAL_URL,
      }),
    );
  }
  if (req.method === "POST" && path === "/platform/radius/nas/nas-1/regenerate-secret") {
    statusAnswer = { status: 200, body: registered({ secret_fingerprint: "0123456789ab" }) };
    res.writeHead(200);
    return res.end(
      envelope({
        id: "nas-1",
        nas_identifier: "cg-aruba-r-aruba0",
        ip_address: "203.0.113.10",
        shared_secret: SECRET_2,
        device_action_required: true,
        device_action:
          "Guest WiFi at this venue is DOWN until this secret is entered in the Instant On app.",
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

const arubaCalls = () => requests.filter((r) => r.path.startsWith("/platform/radius/nas/"));

async function open(router, waitFor) {
  requests = [];
  servedRouter = router;
  const page = await context.newPage();
  /** Every window.confirm the page raised, accepted. */
  page.__confirms = [];
  page.on("dialog", (d) => {
    page.__confirms.push(d.message());
    void d.accept();
  });
  await page.goto(origin);
  await page.getByText(waitFor).first().waitFor({ timeout: 10_000 });
  return page;
}
const text = (page) => page.locator("#root").innerText();
const html = (page) => page.content();
const copyButtons = (page, label) =>
  page.getByRole("button", { name: `Copy ${label}`, exact: true }).count();
const valueFor = (page, label) =>
  page
    .getByRole("button", { name: `Copy ${label}`, exact: true })
    .first()
    .locator("xpath=preceding-sibling::code")
    .innerText();

// ---------------------------------------------------------------------------
console.log("\n1. not registered: gaps, the checklist without values, Register gated");
{
  statusAnswer = { status: 200, body: unregistered() };
  const page = await open(ARUBA_ROUTER, "Guests cannot sign in at this venue yet");
  const t = await text(page);
  check(
    "the vendor select offers Aruba Instant On, selected",
    (await page.locator("select").first().inputValue()) === "aruba_instant_on",
  );
  check(
    "says there is no script and no API",
    t.includes("Aruba Instant On is set up in Aruba’s Instant On app, not by a script") &&
      t.includes("Wyfy has no API to Instant On"),
  );
  check("no 'coming soon' panel", !/coming soon/i.test(t));
  check(
    "the gap in ops' words, not its code",
    t.includes("not registered with RADIUS yet") && !t.includes("nas_not_registered"),
    t,
  );
  check(
    "the portal URL leaked onto the response is NOT rendered",
    !t.includes(PATH_AND_QUERY) && !(await html(page)).includes("portalMode=radius"),
  );
  for (const label of [
    "Primary server",
    "Server URL path",
    "Server host",
    "NAS-Identifier (custom)",
  ]) {
    check(`no copy button for ${label}`, (await copyButtons(page, label)) === 0);
  }
  check("the RADIUS server address is withheld too", !t.includes(RADIUS_HOST));
  const titles = [
    "1. Instant On app › Site › RADIUS › Create RADIUS profile",
    "2. Site › Guest portal",
    "3. Guest portal › Allowed domains",
    "4. Networks › Add › Wireless",
    "5. Save, then read back",
    "6. Test",
  ];
  const at = titles.map((x) => t.indexOf(x));
  check(
    "the §0.3 checklist is shown, all six steps in order",
    at.every((i) => i >= 0) && at.every((i, n) => n === 0 || i > at[n - 1]),
    JSON.stringify(at),
  );
  check(
    "placeholders say the values come after the gaps are fixed",
    (await page.getByTestId("aruba-value-pending").count()) >= 6,
  );
  check(
    "accounting and Message-Authenticator ON, guest authentication mode",
    t.includes("RADIUS accounting ON.") &&
      t.includes("Require Message-Authenticator ON.") &&
      t.includes("mode Guest authentication (not “Acknowledgment”)"),
  );
  check(
    "the troubleshooting line, in the spec's order",
    /\(1\) the secret in Instant On does not match[\s\S]*\(2\) the hub is not open to the venue IP[\s\S]*\(3\) the venue’s public IP has changed/.test(
      t,
    ),
  );
  check(
    "names what Wyfy cannot do here",
    t.includes("Not possible from Wyfy at this venue") && t.includes("Guest speed limits"),
  );
  check(
    "shows the venue read-only",
    t.includes("Wyfy In-house / Office") &&
      t.includes("serial VNV5M1K1M6") &&
      t.includes("54:F0:B1:C8:A9:0A"),
  );
  check(
    "the measuring hint",
    t.includes("Measure it from a phone on the venue WiFi: open checkip.amazonaws.com."),
  );

  const register = page.getByRole("button", { name: "Register with RADIUS" });
  check("Register is disabled with no IP", await register.isDisabled());
  await page.locator("#aruba-venue-ip").fill("192.168.1.135");
  check(
    "a private IP gets PM_SPEC §4's sentence",
    (await text(page)).includes(
      "That's a private address. Use the venue's public IP, measured from a phone on the venue WiFi.",
    ),
  );
  await page.getByLabel("The ISP confirms this IP is static").check();
  check("Register stays disabled for a private IP, ticked or not", await register.isDisabled());
  await page.locator("#aruba-venue-ip").fill("100.64.1.1");
  check("and for a CGNAT IP", await register.isDisabled());
  await page.getByLabel("The ISP confirms this IP is static").uncheck();
  await page.locator("#aruba-venue-ip").fill("203.0.113.10");
  check(
    "a public IP alone is not enough: the static tick is required",
    await register.isDisabled(),
  );
  await page.getByLabel("The ISP confirms this IP is static").check();
  check("public IP + static tick enables Register", !(await register.isDisabled()));
  check(
    "nothing was POSTed while filling in the form",
    arubaCalls().every((r) => r.method === "GET"),
  );

  // ---- a refusal is shown verbatim ----
  registerAnswer = {
    status: 422,
    message:
      "Another device already uses 203.0.113.10 as its RADIUS client address. Two venues behind one IP can't share RADIUS safely.",
  };
  await register.click();
  await page.waitForFunction(() => (window.__toasts || []).some((x) => x.kind === "error"));
  const toasts = await page.evaluate(() => window.__toasts);
  check(
    "a 422 refusal's message is shown verbatim",
    toasts.some((x) => x.kind === "error" && x.msg === registerAnswer.message),
    JSON.stringify(toasts),
  );
  check(
    "Register asked first, and the confirm names the hub restart",
    page.__confirms.length === 1 &&
      page.__confirms[0].includes(
        "This restarts RADIUS on the hub for 1 to 2 seconds. Every venue's sign-ins pause briefly. Avoid peak hours.",
      ),
    JSON.stringify(page.__confirms),
  );
  check(
    "no secret dialog after a refusal",
    (await page.getByTestId("aruba-secret-once").count()) === 0,
  );

  // ---- register ----
  registerAnswer = { status: 201 };
  await register.click();
  await page.getByTestId("aruba-secret-once").waitFor({ timeout: 10_000 });
  const posts = requests.filter(
    (r) => r.method === "POST" && r.path === "/platform/radius/nas/register-public/r-aruba",
  );
  check(
    "the register body is exactly {nas_ip} -- no secret, ever",
    posts.length === 2 && posts[1].body === JSON.stringify({ nas_ip: "203.0.113.10" }),
    JSON.stringify(posts.map((p) => p.body)),
  );
  check(
    "a platform call, so no X-Organization-Id header",
    posts.every((p) => !("x-organization-id" in p.headers)),
  );
  check(
    "the secret is shown once, in the dialog",
    (await page.getByTestId("aruba-secret-once").innerText()) === SECRET_1,
  );
  const dialogText = await page.locator("body").innerText();
  check(
    "with the spec's line and the fingerprint",
    dialogText.includes("Type this into Instant On now. It won’t be shown again.") &&
      dialogText.includes("82fca06b91e3") &&
      dialogText.includes("cg-aruba-r-aruba0"),
  );
  await page.getByRole("button", { name: "Copy shared secret" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  check("Copy puts exactly the secret on the clipboard", copied === SECRET_1, String(copied));

  await page.getByRole("button", { name: /Done — it.s in Instant On/ }).click();
  await page.getByTestId("aruba-registered").waitFor({ timeout: 10_000 });
  check(
    "closing the dialog removes the secret from the page entirely",
    !(await html(page)).includes(SECRET_1),
  );
  const cacheHasSecret = await page.evaluate(
    (s) =>
      JSON.stringify(
        window.__qc
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ).includes(s),
    SECRET_1,
  );
  check("and it is not in the query cache", !cacheHasSecret);
  const after = await text(page);
  check(
    "registered: identifier, IP, fingerprint and length, hub confirmed",
    after.includes("cg-aruba-r-aruba0") &&
      after.includes("203.0.113.10") &&
      after.includes("82fca06b91e3") &&
      after.includes("32 chars") &&
      after.includes("hub confirmed"),
    after,
  );
  check(
    "the hub firewall is NOT claimed: ops is told to ask an engineer",
    after.includes("Ask an engineer to open UDP 1812-1813 from 203.0.113.10/32 on the hub") &&
      after.includes("This panel does not do it."),
  );
  check("the gap list is gone", !after.includes("Guests cannot sign in at this venue yet"));
  check(
    "the status was re-read after register",
    requests.filter((r) => r.method === "GET").length >= 2,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n2. registered (a reload): fingerprint only, the checklist with every value");
{
  statusAnswer = { status: 200, body: registered() };
  const page = await open(ARUBA_ROUTER, "Registered with RADIUS");
  const t = await text(page);
  check("no secret on a reload", !(await html(page)).includes(SECRET_1));
  check(
    "no 'show again' control",
    !/show (it )?again|reveal/i.test(t.replace("never shown again", "")),
  );
  check("says rotate is the only way to a new one", t.includes("rotate to issue a new one"));
  check("Primary server", (await valueFor(page, "Primary server")) === RADIUS_HOST);
  check("Authentication port", (await valueFor(page, "Authentication port")) === "1812");
  check("Accounting port", (await valueFor(page, "Accounting port")) === "1813");
  check(
    "NAS-Identifier (custom)",
    (await valueFor(page, "NAS-Identifier (custom)")) === "cg-aruba-r-aruba0",
  );
  check("Profile name", (await valueFor(page, "Profile name")) === "Wyfy Guest");
  check("Server host", (await valueFor(page, "Server host")) === "auth.wyfyguest.com");
  check("Server port", (await valueFor(page, "Server port")) === "443");
  check(
    "Server URL path is path + query, no scheme or host",
    (await valueFor(page, "Server URL path")) === PATH_AND_QUERY,
  );
  check(
    "allowed domains come from the backend, one copy button each",
    (await copyButtons(page, "Allowed domain")) === 2 &&
      t.includes("auth.wyfyguest.com") &&
      t.includes("api.wyfyguest.com"),
  );
  check("Use HTTPS ON", t.includes("Use HTTPS ON."));
  check(
    "the full https URL is never shown glued together (Instant On asks for boxes)",
    !t.includes(`https://auth.wyfyguest.com${PATH_AND_QUERY}`),
  );
  check("no pending placeholders", (await page.getByTestId("aruba-value-pending").count()) === 0);

  // ---- rotate ----
  await page.getByRole("button", { name: "Rotate secret" }).click();
  await page.getByTestId("aruba-secret-once").waitFor({ timeout: 10_000 });
  check(
    "rotate POSTs the NAS row's regenerate route",
    requests.some(
      (r) => r.method === "POST" && r.path === "/platform/radius/nas/nas-1/regenerate-secret",
    ),
  );
  check(
    "rotate asked first, saying sign-ins fail until Instant On has it",
    page.__confirms.some((m) =>
      m.includes("Guest sign-ins at this venue fail until the new secret"),
    ),
  );
  check(
    "the new secret, once",
    (await page.getByTestId("aruba-secret-once").innerText()) === SECRET_2,
  );
  check(
    "with the backend's own device-action sentence",
    (await page.locator("body").innerText()).includes(
      "Guest WiFi at this venue is DOWN until this secret is entered in the Instant On app.",
    ),
  );
  await page.getByRole("button", { name: /Done — it.s in Instant On/ }).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="aruba-secret-once"]'));
  check("closed: the rotated secret is gone too", !(await html(page)).includes(SECRET_2));

  // ---- venue IP changed ----
  await page.getByRole("button", { name: "Venue IP changed" }).click();
  check(
    "the re-register form says it issues a new secret",
    (await text(page)).includes("issues a new secret, shown once"),
  );
  check(
    "and is gated the same way",
    await page.getByRole("button", { name: "Register new IP" }).isDisabled(),
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n3. registered but the hub did not confirm: gaps again, no values");
{
  statusAnswer = {
    status: 200,
    body: registered({ hub_confirmed: false, portal_url: null, gaps: ["hub_not_confirmed"] }),
  };
  const page = await open(ARUBA_ROUTER, "Guests cannot sign in at this venue yet");
  const t = await text(page);
  check("says the hub has not confirmed", t.includes("The hub has not confirmed"));
  check("hub NOT confirmed on the registration line", t.includes("hub NOT confirmed"));
  check("no copyable portal path", (await copyButtons(page, "Server URL path")) === 0);
  await page.close();
}

console.log("\n4. the status read fails: the backend's message, not an empty panel");
{
  statusAnswer = { status: 403, message: "You need radius.read at platform scope" };
  const page = await open(ARUBA_ROUTER, "You need radius.read at platform scope");
  check("no checklist values", (await copyButtons(page, "Server URL path")) === 0);
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n5. MikroTik and Omada rows never call the Aruba routes");
{
  const page = await open(
    { ...ARUBA_ROUTER, id: "r-mt", name: "Lobby hEX", vendor: "mikrotik", model: "hEX S" },
    "Generate script",
  );
  check(
    "MikroTik: script generator, no Aruba panel",
    (await page.getByTestId("aruba-instant-on-setup").count()) === 0,
  );
  check("MikroTik: no Aruba request", arubaCalls().length === 0);
  await page.close();
}
{
  const page = await open(
    { ...ARUBA_ROUTER, id: "r-omada", name: "OC200", vendor: "tplink_omada", model: "OC200" },
    "TP-Link Omada is configured on the controller, not by a script",
  );
  check(
    "Omada: the Omada panel, no Aruba panel",
    (await page.getByTestId("aruba-instant-on-setup").count()) === 0,
  );
  check("Omada: no Aruba request", arubaCalls().length === 0);
  await page.close();
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "aruba setup panel: all checks passed"
    : `aruba setup panel: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
