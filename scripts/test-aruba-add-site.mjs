/**
 * Router Fleet: "Add Instant On site" and "Remove this Instant On site"
 * (Master only).
 *
 * Run: node scripts/test-aruba-add-site.mjs
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * Two halves, same shape as test-aruba-instant-on.mjs / test-aruba-setup-panel.mjs:
 *
 *   1. PURE: `src/lib/aruba-instant-on-site.ts` -- validation, MAC
 *      normalization, the request body (blank optionals OMITTED, never sent
 *      as "" -- the backend forbids unknown keys and reads an absent
 *      serial/MAC as "mint one"), the conflict warning that mirrors the
 *      backend's mixed-venue refusal, and the refusal mapper.
 *   2. CHROMIUM: the REAL dialogs, through the REAL `arubaInstantOnService`
 *      and `api` client, against a local server playing
 *      `POST /platform/routers/instant-on-sites` and `DELETE /routers/{id}`.
 *      Only `@/services/router.service` (the org/location pickers' data) and
 *      `sonner` (recorded) are stubbed.
 *
 * What it pins:
 *   - nothing is sent until the form is valid;
 *   - the location list is the chosen customer's only;
 *   - a location that already has a device is warned about before submit;
 *   - the body is exactly the fields filled in, with no X-Organization-Id;
 *   - success hands the new router id to the caller (which opens the setup
 *     panel) and raises NO success toast;
 *   - a 409/422 refusal is shown verbatim, `already_onboarded` offers the
 *     existing row's setup, and nothing claims success;
 *   - Remove sends DELETE /routers/{id} and nothing else; a 502 (hub refused
 *     to deregister) is shown verbatim and the row is not reported removed;
 *   - no customer-dashboard file imports any of this.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "aruba-add-site-"));

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

const ENV = {
  "import.meta.env": JSON.stringify({
    MODE: "test",
    DEV: false,
    PROD: true,
    VITE_API_BASE_URL: "/api/v1",
  }),
  "process.env.NODE_ENV": '"production"',
};

// ---------------------------------------------------------------------------
console.log("\n1. pure: aruba-instant-on-site.ts");
// ---------------------------------------------------------------------------
await build({
  entryPoints: [join(ROOT, "src/lib/aruba-instant-on-site.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "site.mjs"),
  logLevel: "error",
  absWorkingDir: ROOT,
  alias: { "@": join(ROOT, "src") },
  define: ENV,
});
const S = await import(pathToFileURL(join(work, "site.mjs")).href);

const full = {
  organizationId: "org-1",
  locationId: "loc-1",
  name: "  Aruba AP21 VNV5M1K1M6 ",
  serialNumber: " VNV5M1K1M6 ",
  macAddress: "54-f0-b1-c8-a9-0a",
  siteId: " fe0177b6-2ff9-4c0b-9326-091953c67f5f ",
  siteName: " inhouse-office ",
};
{
  const e = S.validateInstantOnSiteDraft(S.EMPTY_INSTANT_ON_SITE_DRAFT);
  check(
    "empty draft: customer, location and name are required",
    !!e.organizationId && !!e.locationId && !!e.name && !e.serialNumber && !e.macAddress,
    JSON.stringify(e),
  );
  check(
    "a full draft validates",
    Object.keys(S.validateInstantOnSiteDraft(full)).length === 0,
    JSON.stringify(S.validateInstantOnSiteDraft(full)),
  );
  check(
    "a short MAC is refused",
    !!S.validateInstantOnSiteDraft({ ...full, macAddress: "54:F0:B1" }).macAddress,
  );
  check(
    "a 201-character name is refused",
    !!S.validateInstantOnSiteDraft({ ...full, name: "x".repeat(201) }).name,
  );
  for (const [input, want] of [
    ["54:f0:b1:c8:a9:0a", "54:F0:B1:C8:A9:0A"],
    ["54-F0-B1-C8-A9-0A", "54:F0:B1:C8:A9:0A"],
    ["54f0b1c8a90a", "54:F0:B1:C8:A9:0A"],
  ]) {
    check(`normalizeMac(${input})`, S.normalizeMac(input) === want, S.normalizeMac(input));
  }
  const body = S.buildInstantOnSiteBody(full);
  check(
    "full body: trimmed, MAC normalized, site fields named as the backend names them",
    JSON.stringify(body) ===
      JSON.stringify({
        organization_id: "org-1",
        location_id: "loc-1",
        name: "Aruba AP21 VNV5M1K1M6",
        serial_number: "VNV5M1K1M6",
        mac_address: "54:F0:B1:C8:A9:0A",
        instant_on_site_id: "fe0177b6-2ff9-4c0b-9326-091953c67f5f",
        instant_on_site_name: "inhouse-office",
      }),
    JSON.stringify(body),
  );
  const minimal = S.buildInstantOnSiteBody({
    ...S.EMPTY_INSTANT_ON_SITE_DRAFT,
    organizationId: "org-1",
    locationId: "loc-1",
    name: "AP",
    serialNumber: "   ",
  });
  check(
    "blank optionals are OMITTED, never sent as '' or null",
    JSON.stringify(Object.keys(minimal)) ===
      JSON.stringify(["organization_id", "location_id", "name"]),
    JSON.stringify(minimal),
  );
  const created = S.toCreatedInstantOnSite({
    router: { id: "r-new", name: "AP", serial_number: "AIO-1", mac_address: "02:00:00:00:00:01" },
    synthetic_serial_number: true,
    synthetic_mac_address: true,
  });
  check(
    "the created row is read from `router`",
    created.routerId === "r-new" && created.syntheticSerialNumber && created.syntheticMacAddress,
  );
  check(
    "a location with nothing on it: no warning",
    S.locationConflictWarning(S.devicesAlreadyAtLocation([], "loc-1")) === null,
  );
  const fleet = [
    { locationId: "loc-1", vendor: "mikrotik", name: "hEX" },
    { locationId: "loc-2", vendor: "aruba_instant_on", name: "AP21" },
  ];
  check(
    "only the chosen location's devices count",
    S.devicesAlreadyAtLocation(fleet, "loc-3").length === 0 &&
      S.devicesAlreadyAtLocation(fleet, "loc-1").length === 1,
  );
  const mixed = S.locationConflictWarning(S.devicesAlreadyAtLocation(fleet, "loc-1"));
  check(
    "a MikroTik at the location: warned that it will be refused",
    !!mixed && mixed.includes("hEX") && mixed.includes("will be refused"),
    mixed ?? "",
  );
  const dup = S.locationConflictWarning(S.devicesAlreadyAtLocation(fleet, "loc-2"));
  check(
    "an Instant On site at the location: open that one instead",
    !!dup && dup.includes("already has an Instant On site") && dup.includes("AP21"),
    dup ?? "",
  );
  const r = S.instantOnSiteRefusal({
    status: 409,
    code: "x",
    message: "This location already has an Instant On site ('AP21').",
    data: { code: "NAS_ONLY_SITE_REFUSED", existing_router_id: "r-old" },
  });
  check(
    "refusal: the backend's sentence verbatim, and the row it pointed at",
    r.message === "This location already has an Instant On site ('AP21')." &&
      r.existingRouterId === "r-old",
  );
  check(
    "refusal without a row id or message",
    S.instantOnSiteRefusal(new TypeError("boom")).existingRouterId === null &&
      S.instantOnSiteRefusal(null).message === "The Instant On site could not be added.",
  );
}

// ---------------------------------------------------------------------------
console.log("\n2. master-only: no customer surface imports the add/remove code");
// ---------------------------------------------------------------------------
{
  const walk = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const offenders = [
    ...walk(join(ROOT, "src/components/customer")),
    ...walk(join(ROOT, "src/routes")).filter((p) => !/[\\/]master[.\\/]/.test(p)),
  ].filter((p) =>
    /InstantOnSiteDialogs|aruba-instant-on-site|aruba-instant-on\.service/.test(
      readFileSync(p, "utf8"),
    ),
  );
  check(
    "only /master routes reach it",
    offenders.length === 0,
    offenders.map((p) => p.slice(ROOT.length)).join(", "),
  );
  const fleet = readFileSync(join(ROOT, "src/routes/master.routers.tsx"), "utf8");
  check(
    "the pre-check is fed the all-pages fleet read (#375), not a single page",
    fleet.includes("useAllRouters(") &&
      !/\buseRouters\(/.test(fleet) &&
      /fleet=\{routers\}/.test(fleet),
  );
  check(
    "Router Fleet mounts the dialogs, and not in demo",
    fleet.includes("<AddInstantOnSiteDialog") &&
      fleet.includes("<RemoveInstantOnSiteDialog") &&
      /\{!demo && \(\s*<>\s*<AddInstantOnSiteDialog/.test(fleet),
  );
  check(
    "Remove is offered only on NAS-only rows",
    /isNasOnlyVendor\(sel\.vendor\) && \([\s\S]{0,900}remove-instant-on-site/.test(fleet),
  );
}

// ---------------------------------------------------------------------------
// The bundle: the real dialogs in a real QueryClient.
// ---------------------------------------------------------------------------
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
  join(work, "router-service-stub.js"),
  `export const routerService = {
     async organizations() {
       return [{ id: "org-1", name: "Wyfy In-house" }, { id: "org-2", name: "Other Hotel" }];
     },
     async locations() {
       return [
         { id: "loc-1", name: "Office", organizationId: "org-1" },
         { id: "loc-busy", name: "Lobby (has a hEX)", organizationId: "org-1" },
         { id: "loc-9", name: "Elsewhere", organizationId: "org-2" },
       ];
     },
   };`,
);
const dialogs = join(ROOT, "src/components/routers/InstantOnSiteDialogs.tsx").replace(/\\/g, "/");
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { AddInstantOnSiteDialog, RemoveInstantOnSiteDialog } from "${dialogs}";
   const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   window.__created = []; window.__opened = []; window.__removed = []; window.__closed = 0;
   const fleet = [{ id: "r-hex", locationId: "loc-busy", vendor: "mikrotik", name: "hEX lobby" }];
   const target = { id: "r-aruba", name: "Aruba AP21", organizationName: "Wyfy In-house", locationName: "Office", vendor: "aruba_instant_on" };
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={qc}>
       {window.__mode === "remove" ? (
         <RemoveInstantOnSiteDialog router={target} onClose={() => { window.__closed++; }}
           onRemoved={(r) => { window.__removed.push(r.id); }} />
       ) : (
         <AddInstantOnSiteDialog open fleet={fleet} fleetIncomplete={!!window.__incomplete} onClose={() => { window.__closed++; }}
           onCreated={(c) => { window.__created.push(c); }}
           onOpenExisting={(id) => { window.__opened.push(id); }} />
       )}
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
  define: ENV,
  alias: {
    "@/services/router.service": join(work, "router-service-stub.js"),
    sonner: join(work, "sonner-stub.js"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

// ---------------------------------------------------------------------------
// The backend.
// ---------------------------------------------------------------------------
let requests = [];
let mode = "add";
let incomplete = false;
/** What the create route answers: { status, message?, data? }. */
let createAnswer = { status: 201 };
let deleteAnswer = { status: 200 };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(
        `<!doctype html><meta charset=utf-8><title>add site harness</title>
         <script>window.__mode = ${JSON.stringify(mode)}; window.__incomplete = ${JSON.stringify(incomplete)};</script>
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

  if (req.method === "POST" && path === "/platform/routers/instant-on-sites") {
    const a = createAnswer;
    res.writeHead(a.status);
    if (a.status !== 201) {
      return res.end(JSON.stringify({ success: false, message: a.message, data: a.data ?? {} }));
    }
    const b = JSON.parse(raw);
    return res.end(
      JSON.stringify({
        success: true,
        message: "Instant On site added",
        data: {
          router: {
            id: "r-new",
            name: b.name,
            serial_number: b.serial_number ?? "AIO-0123456789AB",
            mac_address: b.mac_address ?? "02:11:22:33:44:55",
            vendor: "aruba_instant_on",
          },
          synthetic_serial_number: !b.serial_number,
          synthetic_mac_address: !b.mac_address,
        },
      }),
    );
  }
  if (req.method === "DELETE" && path === "/routers/r-aruba") {
    const a = deleteAnswer;
    res.writeHead(a.status);
    return res.end(
      a.status === 200
        ? JSON.stringify({ success: true, message: "Router decommissioned", data: {} })
        : JSON.stringify({ success: false, message: a.message, data: {} }),
    );
  }
  res.writeHead(404);
  res.end(JSON.stringify({ success: false, message: `unexpected ${path}`, data: {} }));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const context = await browser.newContext();

async function open(m, waitFor, { partialFleet = false } = {}) {
  requests = [];
  mode = m;
  incomplete = partialFleet;
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByText(waitFor).first().waitFor({ timeout: 10_000 });
  return page;
}
const text = (page) => page.locator("#root").innerText();
const win = (page, key) => page.evaluate((k) => window[k], key);
const creates = () => requests.filter((r) => r.path === "/platform/routers/instant-on-sites");
async function waitForOptions(page, selector, n) {
  await page.waitForFunction(
    ([s, count]) => document.querySelector(s)?.options.length >= count,
    [selector, n],
  );
}

// ---------------------------------------------------------------------------
console.log("\n3. add: nothing is sent until the form is valid");
// ---------------------------------------------------------------------------
{
  const page = await open("add", "Add Instant On site");
  const t = await text(page);
  check(
    "says it only records the site and what comes next",
    t.includes("nothing is sent to the access points or the RADIUS hub") &&
      t.includes("The Instant On setup panel opens next"),
  );
  await page.getByTestId("instant-on-site-submit").click();
  await page.getByTestId("ios-org-error").waitFor();
  check(
    "empty submit: field errors, no request",
    (await page.getByTestId("ios-location-error").count()) === 1 &&
      (await page.getByTestId("ios-name-error").count()) === 1 &&
      creates().length === 0,
  );
  await waitForOptions(page, "#ios-org", 3);
  await page.selectOption("#ios-org", "org-1");
  await waitForOptions(page, "#ios-location", 3);
  const locs = await page.locator("#ios-location option").allInnerTexts();
  check(
    "the location list is this customer's only",
    locs.includes("Office") && locs.includes("Lobby (has a hEX)") && !locs.includes("Elsewhere"),
    JSON.stringify(locs),
  );
  await page.selectOption("#ios-location", "loc-busy");
  check(
    "a location with a device on it is warned about before submit",
    (await page.getByTestId("instant-on-site-conflict").innerText()).includes("hEX lobby"),
  );
  await page.selectOption("#ios-location", "loc-1");
  check(
    "the warning goes when the location is clear",
    (await page.getByTestId("instant-on-site-conflict").count()) === 0,
  );
  await page.fill("#ios-name", "Aruba AP21 VNV5M1K1M6");
  await page.fill("#ios-mac", "54:F0:B1");
  await page.getByTestId("instant-on-site-submit").click();
  await page.getByTestId("ios-mac-error").waitFor();
  check("a bad MAC blocks the request", creates().length === 0);
  await page.close();
}

{
  const page = await open("add", "Add Instant On site", { partialFleet: true });
  await waitForOptions(page, "#ios-org", 3);
  await page.selectOption("#ios-org", "org-1");
  await waitForOptions(page, "#ios-location", 3);
  await page.selectOption("#ios-location", "loc-1");
  check(
    "a partly-read fleet says the pre-check may miss a device",
    (await page.getByTestId("instant-on-site-fleet-incomplete").count()) === 1,
  );
  await page.close();
  const full = await open("add", "Add Instant On site");
  await waitForOptions(full, "#ios-org", 3);
  await full.selectOption("#ios-org", "org-1");
  await waitForOptions(full, "#ios-location", 3);
  await full.selectOption("#ios-location", "loc-1");
  check(
    "a fully-read fleet does not",
    (await full.getByTestId("instant-on-site-fleet-incomplete").count()) === 0,
  );
  await full.close();
}

// ---------------------------------------------------------------------------
console.log("\n4. add: success hands the new row to the caller, no toast");
// ---------------------------------------------------------------------------
{
  createAnswer = { status: 201 };
  const page = await open("add", "Add Instant On site");
  await waitForOptions(page, "#ios-org", 3);
  await page.selectOption("#ios-org", "org-1");
  await waitForOptions(page, "#ios-location", 3);
  await page.selectOption("#ios-location", "loc-1");
  await page.fill("#ios-name", "Aruba AP21 VNV5M1K1M6");
  await page.fill("#ios-serial", "VNV5M1K1M6");
  await page.fill("#ios-mac", "54-f0-b1-c8-a9-0a");
  await page.fill("#ios-site-name", "inhouse-office");
  await page.getByTestId("instant-on-site-submit").click();
  await page.waitForFunction(() => window.__created.length === 1);
  const sent = creates();
  check("exactly one create request", sent.length === 1);
  check(
    "the body is the fields filled in, MAC normalized, site id omitted",
    sent[0] &&
      JSON.stringify(JSON.parse(sent[0].body)) ===
        JSON.stringify({
          organization_id: "org-1",
          location_id: "loc-1",
          name: "Aruba AP21 VNV5M1K1M6",
          serial_number: "VNV5M1K1M6",
          mac_address: "54:F0:B1:C8:A9:0A",
          instant_on_site_name: "inhouse-office",
        }),
    sent[0]?.body,
  );
  check(
    "no X-Organization-Id: the tenant travels in the body",
    sent[0] && !("x-organization-id" in sent[0].headers),
  );
  const created = (await win(page, "__created"))[0];
  check("the caller gets the new router id", created?.routerId === "r-new");
  check(
    "no success toast (the setup panel opening is the confirmation)",
    !(await win(page, "__toasts")),
  );
  await page.close();
}

// ---------------------------------------------------------------------------
console.log("\n5. add: refusals are shown verbatim and never claim success");
// ---------------------------------------------------------------------------
{
  const msg =
    "This location already has an Instant On site ('Aruba AP21'). One Instant On site maps to one location; open that row's Instant On setup instead.";
  createAnswer = {
    status: 409,
    message: msg,
    data: {
      code: "NAS_ONLY_SITE_REFUSED",
      reason: "already_onboarded",
      existing_router_id: "r-old",
    },
  };
  const page = await open("add", "Add Instant On site");
  await waitForOptions(page, "#ios-org", 3);
  await page.selectOption("#ios-org", "org-1");
  await waitForOptions(page, "#ios-location", 3);
  await page.selectOption("#ios-location", "loc-1");
  await page.fill("#ios-name", "Again");
  await page.getByTestId("instant-on-site-submit").click();
  await page.getByTestId("instant-on-site-refusal").waitFor();
  check(
    "409: the backend's sentence, verbatim",
    (await page.getByTestId("instant-on-site-refusal").innerText()).includes(msg),
  );
  check("409: nothing reported created", (await win(page, "__created")).length === 0);
  check("409: no toast", !(await win(page, "__toasts")));
  await page.getByRole("button", { name: "Open that site's Instant On setup" }).click();
  check(
    "already_onboarded: opens the existing row's setup",
    JSON.stringify(await win(page, "__opened")) === JSON.stringify(["r-old"]),
  );
  await page.close();

  createAnswer = {
    status: 422,
    message: "Location loc-busy does not belong to organization org-2.",
    data: { code: "NAS_ONLY_SITE_REFUSED", reason: "location_not_in_organization" },
  };
  const p2 = await open("add", "Add Instant On site");
  await waitForOptions(p2, "#ios-org", 3);
  await p2.selectOption("#ios-org", "org-1");
  await waitForOptions(p2, "#ios-location", 3);
  await p2.selectOption("#ios-location", "loc-1");
  await p2.fill("#ios-name", "X");
  await p2.getByTestId("instant-on-site-submit").click();
  await p2.getByTestId("instant-on-site-refusal").waitFor();
  const t2 = await p2.getByTestId("instant-on-site-refusal").innerText();
  check(
    "422: verbatim, and no 'open existing' offer without a row id",
    t2.includes("does not belong to organization") &&
      (await p2.getByRole("button", { name: "Open that site's Instant On setup" }).count()) === 0,
  );
  await p2.close();
}

// ---------------------------------------------------------------------------
console.log("\n6. remove: DELETE /routers/{id}; a hub refusal is not a removal");
// ---------------------------------------------------------------------------
{
  deleteAnswer = {
    status: 502,
    message: "The RADIUS hub did not confirm removing this NAS client: 501 Unsupported method",
  };
  const page = await open("remove", "Remove Aruba AP21?");
  const t = await text(page);
  check(
    "the confirm says RADIUS is removed from the hub first, and what is not touched",
    t.includes("its client is removed from the hub first") &&
      t.includes("if the hub refuses, nothing is removed") &&
      t.includes("Nothing is changed in the Instant On app"),
  );
  await page.getByTestId("instant-on-site-remove-confirm").click();
  await page.getByTestId("instant-on-site-remove-error").waitFor();
  check(
    "502: the backend's sentence, verbatim",
    (await page.getByTestId("instant-on-site-remove-error").innerText()).includes(
      "did not confirm removing this NAS client",
    ),
  );
  check("502: not reported removed", (await win(page, "__removed")).length === 0);
  check(
    "502: the only request was the DELETE",
    requests.length === 1 &&
      requests[0].method === "DELETE" &&
      requests[0].path === "/routers/r-aruba",
    JSON.stringify(requests.map((r) => `${r.method} ${r.path}`)),
  );
  await page.close();

  deleteAnswer = { status: 200 };
  const p2 = await open("remove", "Remove Aruba AP21?");
  await p2.getByTestId("instant-on-site-remove-confirm").click();
  await p2.waitForFunction(() => window.__removed.length === 1);
  check(
    "200: reported removed, after exactly one DELETE",
    JSON.stringify(await win(p2, "__removed")) === JSON.stringify(["r-aruba"]) &&
      requests.length === 1 &&
      requests[0].method === "DELETE",
  );
  await p2.close();
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "aruba add site: all checks passed"
    : `aruba add site: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
