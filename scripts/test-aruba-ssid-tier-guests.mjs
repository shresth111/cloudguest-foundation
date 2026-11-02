/**
 * A specific guest on a paid WiFi network at an Aruba Instant On venue.
 *
 * Run: node scripts/test-aruba-ssid-tier-guests.mjs
 * The REAL SsidSpeedTiers + SsidTierGuests in Chromium, with the policy, guest
 * and customer services and the API stubbed and recorded. Backend half:
 * cloud-guest `tests/unit/test_ssid_speed_tiers.py` (a GUEST assignment entitles).
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "ssid-tier-guests-"));
const src = (p) => readFileSync(join(ROOT, p), "utf8");
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

writeFileSync(
  join(work, "api-stub.js"),
  `const rec = (method, path, body) => window.__calls.push({ method, path, body: body ?? null });
   export const api = {
     async get(path) {
       rec("GET", path);
       return { data: { items: window.__rows, note: "n", manual_steps: [], instant_on_push_enabled: false } };
     },
     async put(path, body) {
       rec("PUT", path, body);
       window.__rows = body.items;
       return { data: { items: body.items, note: "n", manual_steps: [], instant_on_push_enabled: false } };
     },
     async post(path, body) { rec("POST", path, body); return { data: {} }; },
     async delete(path) { rec("DELETE", path); return { data: {} }; },
   };
   export function crossOrganizationHeaders() { return undefined; }
   export function requestErrorMessage(e, fallback) { return e?.message || fallback; }`,
);
writeFileSync(join(work, "portal-api-stub.js"), `export const guestPortalApi = {};`);
writeFileSync(
  join(work, "customer-stub.js"),
  `export async function resolveOrgId() { return "org-1"; }`,
);
writeFileSync(
  join(work, "policy-stub.js"),
  `const rec = (method, body) => window.__calls.push({ method, body });
   export const bandwidthPolicyService = {
     async list() { return window.__policies; },
     async save(input) { rec("SAVE-TIER", input); const p = { id: "tier-new", name: input.name, status: "active" }; window.__policies.push(p); return p; },
     async mapTierToLocation(id, loc) { rec("MAP-TIER", { id, loc }); return "tier-map-1"; },
     async guestMappings() { return window.__mappings; },
     async mapGuestToLocation(id, loc, guestId) {
       rec("MAP-GUEST", { id, loc, guestId });
       if (window.__mapFails) throw new Error("Guest is already mapped to another group");
       window.__mappings.push({ assignmentId: "a-" + guestId, guestId });
       return "a-" + guestId;
     },
     async unmapGuestFromLocation(id, assignmentId) {
       rec("UNMAP-GUEST", { id, assignmentId });
       window.__mappings = window.__mappings.filter((m) => m.assignmentId !== assignmentId);
     },
   };`,
);
writeFileSync(
  join(work, "guest-stub.js"),
  `const G = [
     { id: "g1", identifier: "+919000000001", displayName: "Asha", locationId: "loc-1" },
     { id: "g2", identifier: "+919000000002", displayName: null, locationId: "elsewhere" },
   ];
   export const guestService = {
     async list({ search }) { return { rows: G.filter((g) => g.identifier.includes(search)) }; },
     async get(id) { return G.find((g) => g.id === id) ?? null; },
   };`,
);
writeFileSync(
  join(work, "entry.tsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import SsidSpeedTiers from "@/components/features/SsidSpeedTiers";
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
       <SsidSpeedTiers locationId="loc-1" />
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
    "@/services/api": join(work, "api-stub.js"),
    "@/services/bandwidth-policy.service": join(work, "policy-stub.js"),
    "@/services/customer.service": join(work, "customer-stub.js"),
    "@/services/guest.service": join(work, "guest-stub.js"),
    "@": join(ROOT, "src"),
  },
  plugins: [
    {
      name: "stub-relative-api",
      setup(b) {
        b.onResolve({ filter: /^\.\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
        b.onResolve({ filter: /^\.\/guest-portal-api$/ }, () => ({
          path: join(work, "portal-api-stub.js"),
        }));
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx", ".css": "empty" },
});
const ROW = (over = {}) => ({
  ssid: "WYFY_PREMIUM",
  tier_name: "Premium",
  requires_entitlement: true,
  policy_id: null,
  voucher_plan_ids: [],
  download_mbps: 50,
  upload_mbps: 20,
  ...over,
});
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/") {
    const state = {
      rows: url.searchParams.has("open") ? [ROW({ requires_entitlement: false })] : [ROW()],
      fails: url.searchParams.has("fail"),
    };
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(`<!doctype html><script>
      window.__calls=[];window.__mappings=[];window.__policies=[];
      window.__rows=${JSON.stringify(state.rows)};window.__mapFails=${state.fails};
      </script><div id=root></div><script type=module src="./bundle.js"></script>`);
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
const open = async (query = "") => {
  const page = await browser.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e)));
  await page.goto(`${origin}/${query}`);
  await page.getByTestId("ssid-tier-row").first().waitFor({ timeout: 15_000 });
  return page;
};
const calls = (page, method) =>
  page.evaluate((m) => window.__calls.filter((c) => c.method === m), method);
const find = async (page, q) => {
  await page.getByRole("textbox", { name: /Find a guest/ }).fill(q);
  await page.getByRole("button", { name: "Find", exact: true }).click();
};

console.log("\n1. Adding the first guest makes the network's tier and links it");
{
  const page = await open();
  const panel = page.getByTestId("ssid-tier-guests");
  await panel.waitFor();
  check("starts empty", (await page.getByTestId("ssid-tier-guests-empty").count()) === 1);
  check(
    "no Access Tier picker",
    (await page.getByRole("combobox", { name: "Access Tier" }).count()) === 0,
  );
  await find(page, "000000001");
  await panel.getByRole("button", { name: "Add" }).click();
  await page.getByTestId("ssid-tier-guest").waitFor();
  const [tier] = await calls(page, "SAVE-TIER");
  check(
    "tier is named after the network",
    tier?.body.name === "WiFi network: WYFY_PREMIUM",
    JSON.stringify(tier),
  );
  check(
    "tier sets no limit on the guest but the network's own speed",
    tier?.body.downloadRateKbps === 50000 &&
      tier?.body.uploadRateKbps === 20000 &&
      ![
        "sessionTimeoutMinutes",
        "idleTimeoutMinutes",
        "devicesPerUser",
        "dailyLimitMinutes",
        "dataLimit",
      ].some((k) => tier?.body[k] != null),
    JSON.stringify(tier),
  );
  check(
    "tier is offered at this location",
    (await calls(page, "MAP-TIER"))[0]?.body.loc === "loc-1",
  );
  const [put] = await calls(page, "PUT");
  check(
    "the row is linked to the tier",
    put?.body.items[0].policy_id === "tier-new",
    JSON.stringify(put),
  );
  check("the row stays paid", put?.body.items[0].requires_entitlement === true);
  const [mapped] = await calls(page, "MAP-GUEST");
  check(
    "the guest is mapped at this location",
    mapped?.body.guestId === "g1" && mapped?.body.loc === "loc-1",
  );
  check(
    "the guest is listed by name",
    (await page.getByTestId("ssid-tier-guest").innerText()).includes("Asha"),
  );
  check("no page error", page.__errors.length === 0, page.__errors.join(" | "));

  console.log("\n2. Removing takes them off");
  await page.getByTestId("ssid-tier-guest").getByRole("button", { name: "Remove" }).click();
  await page.getByTestId("ssid-tier-guests-empty").waitFor();
  check(
    "the assignment is ended",
    (await calls(page, "UNMAP-GUEST"))[0]?.body.assignmentId === "a-g1",
  );
  await page.close();
}

console.log("\n3. Search and failures");
{
  const page = await open();
  await find(page, "000000002");
  await page.getByText(/No guest found at this location/).waitFor();
  check("a guest of another location is not offered", true);
  await page.close();
}
{
  const page = await open("?fail=1");
  await find(page, "000000001");
  await page.getByTestId("ssid-tier-guests").getByRole("button", { name: "Add" }).click();
  await page.getByRole("alert").waitFor();
  check(
    "the server's refusal is shown",
    (await page.getByRole("alert").innerText()).includes("already mapped"),
  );
  check("no guest is listed as added", (await page.getByTestId("ssid-tier-guest").count()) === 0);
  await page.close();
}

console.log("\n4. An open network has no guest list");
{
  const page = await open("?open=1");
  check("no list on an open network", (await page.getByTestId("ssid-tier-guests").count()) === 0);
  await page.close();
}

console.log("\n5. Only at a NAS-only venue");
{
  const hub = src("src/components/features/PoliciesHub.tsx");
  check("the section mounts only at a NAS-only venue", /nasOnlyVenue && tiersLocationId/.test(hub));
  const importers = ["CreateGroup", "LocationPolicies", "CustomerFeaturePage"].filter((f) =>
    /SsidTierGuests/.test(
      src(
        f === "CustomerFeaturePage"
          ? "src/components/customer/CustomerFeaturePage.tsx"
          : `src/components/features/${f}.tsx`,
      ),
    ),
  );
  check(
    "MikroTik and Omada screens do not import the list",
    importers.length === 0,
    importers.join(),
  );
}

await browser.close();
server.close();
console.log(`\n${ran} checks ran`);
if (failures) {
  console.log(`aruba ssid tier guests: ${failures} FAILED`);
  process.exit(1);
}
console.log("aruba ssid tier guests: all checks passed");
