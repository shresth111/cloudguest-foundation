/**
 * Instant On data on customer screens at an Aruba venue.
 *
 * Run: node scripts/test-instant-on-customer-data.mjs
 *
 * Pure parsing, plus the real panels in Chromium against a stubbed service:
 * shows nothing while it's switched off, says unavailable (never 0) when it's on
 * but can't be vouched for, and shows real rows when it can.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "instant-on-data-"));
let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

console.log("\n1. Parsing");
await build({
  entryPoints: [join(ROOT, "src/lib/instant-on-views.ts")],
  bundle: true,
  format: "esm",
  outfile: join(work, "views.mjs"),
  logLevel: "error",
});
const V = await import(pathToFileURL(join(work, "views.mjs")).href);
const off = { status: "unavailable", unavailable_reason: "polling_disabled", items: null };
check("polling off reads as off", V.toInstantOnEvents(off).status === "off");
check(
  "not configured reads as off",
  V.toInstantOnAlerts({ status: "unavailable", unavailable_reason: "not_configured" }).status ===
    "off",
);
for (const reason of ["poll_failed", "stale", "never_polled"]) {
  check(
    `${reason} reads as unavailable`,
    V.toInstantOnEvents({ status: "unavailable", unavailable_reason: reason, items: null })
      .status === "unavailable",
  );
}
check("a failed request is unavailable", V.toInstantOnAps(null).status === "unavailable");
check(
  "an ok answer with no list is unavailable, not empty",
  V.toInstantOnAps({ status: "ok", items: null }).status === "unavailable",
);
check(
  "a camelCase event reads as words",
  V.instantOnLabel("clientConnected") === "Client connected",
);
check("a snake_case type reads as words", V.instantOnLabel("device_down") === "Device down");

writeFileSync(
  join(work, "service-stub.js"),
  `export const instantOnCustomerService = {
     async read(_location, kind) {
       (window.__reads ||= []).push(kind);
       return window.__payloads[kind] ?? null;
     },
   };`,
);
writeFileSync(join(work, "demo-stub.js"), `export const isDemo = () => false;`);
writeFileSync(
  join(work, "entry.tsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { InstantOnActivityPanels, InstantOnVenueData } from "@/components/customer/InstantOnPanels";
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={new QueryClient()}>
       <div data-testid="ready">
         <InstantOnVenueData locationId="loc-1" />
         <InstantOnActivityPanels locationId="loc-1" />
       </div>
     </QueryClientProvider>,
   );`,
);
await build({
  entryPoints: [join(work, "entry.tsx")],
  bundle: true,
  format: "esm",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  logLimit: 0,
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  jsx: "automatic",
  define: {
    "import.meta.env": JSON.stringify({ MODE: "test", DEV: false, PROD: true }),
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@/services/instant-on-customer.service": join(work, "service-stub.js"),
    "@/services/customer.service": join(work, "demo-stub.js"),
    "@": join(ROOT, "src"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".css": "empty" },
});

const ok = (items) => ({ status: "ok", as_of: "2026-11-02T01:00:00Z", items });
const SCENES = {
  off: Object.fromEntries(
    ["access-points", "clients", "ssids", "alerts", "events"].map((k) => [k, off]),
  ),
  failed: Object.fromEntries(
    ["access-points", "clients", "ssids", "alerts", "events"].map((k) => [
      k,
      { status: "unavailable", unavailable_reason: "poll_failed", items: null },
    ]),
  ),
  live: {
    "access-points": ok([
      { name: "AP21", status: "online" },
      { name: "AP22", status: "offline" },
    ]),
    clients: ok([{ mac: "aa" }, { mac: "bb" }, { mac: "cc" }]),
    ssids: ok([{ name: "WYFY_ARUBA" }]),
    alerts: ok([{ type: "device_down", severity: "major", device_name: "AP22" }]),
    events: ok(
      Array.from({ length: 12 }, (_, i) => ({
        event_id: `e${i}`,
        event: "clientConnected",
        device_name: "AP21",
      })),
    ),
  },
  empty: {
    "access-points": ok([]),
    clients: ok([]),
    ssids: ok([]),
    alerts: ok([]),
    events: ok([]),
  },
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") {
    const scene = url.searchParams.get("scene");
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><script>window.__payloads=${JSON.stringify(SCENES[scene])}</script>
      <div id=root></div><script type=module src="./bundle.js"></script>`);
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
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const { chromium } = await import("playwright");
const browser = await chromium.launch();
async function open(scene) {
  const page = await browser.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/?scene=${scene}`);
  await page.getByTestId("ready").waitFor({ timeout: 15_000, state: "attached" });
  await page.waitForFunction(() => (window.__reads || []).length >= 5);
  await page.waitForTimeout(300);
  return page;
}
const text = (page) => page.locator("#root").innerText();

console.log("\n2. Switched off: nothing shows");
{
  const page = await open("off");
  const t = await text(page);
  check("no Instant On panel appears", t.trim() === "", t);
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));
  await page.close();
}

console.log("\n3. On, but the data can't be vouched for");
{
  const page = await open("failed");
  const t = await text(page);
  check(
    "the venue block says unavailable",
    (await page.getByTestId("instant-on-unavailable").count()) === 1,
  );
  check(
    "alerts say unavailable",
    (await page.getByTestId("instant-on-alerts-unavailable").count()) === 1,
  );
  check(
    "events say unavailable",
    (await page.getByTestId("instant-on-events-unavailable").count()) === 1,
  );
  check("no zero stands in", !/\b0 of 0\b/.test(t) && !/reports no/.test(t), t);
  await page.close();
}

console.log("\n4. Real data");
{
  const page = await open("live");
  const t = await text(page);
  check(
    "access points: 1 of 2 online",
    (await page.getByTestId("instant-on-aps").innerText()).includes("1 of 2 online"),
  );
  check(
    "devices connected are counted",
    (await page.getByTestId("instant-on-clients").innerText()).includes("3"),
  );
  check(
    "network names show",
    (await page.getByTestId("instant-on-ssids").innerText()).includes("WYFY_ARUBA"),
  );
  check("the alert shows with its device", t.includes("Device down · AP22"), t);
  check(
    "events show the latest 10 of 12",
    (await page.getByTestId("instant-on-event-row").count()) === 10,
  );
  check("events say they aren't a full history", t.includes("not a full history"));
  await page.close();
}

console.log("\n5. Truly empty is a real answer");
{
  const page = await open("empty");
  const t = await text(page);
  check("no alerts is stated", t.includes("reports no alerts"));
  check("no events is stated", t.includes("no recent events"));
  await page.close();
}

console.log("\n6. Wiring: only at a NAS-only venue");
const view = readFileSync(join(ROOT, "src/components/features/AlertsView.tsx"), "utf8");
check(
  "the Alerts page mounts it behind nasOnlyVenue",
  /nasOnlyVenue && activeLocationId && \(\s*<InstantOnActivityPanels/.test(view),
);
const card = readFileSync(join(ROOT, "src/components/customer/ArubaAccessPointsCard.tsx"), "utf8");
check(
  "the Access points card has it",
  /<InstantOnVenueData locationId=\{locationId\} \/>/.test(card),
);

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`instant on customer data: ${failures} FAILED`);
  process.exit(1);
}
console.log("instant on customer data: all checks passed");
