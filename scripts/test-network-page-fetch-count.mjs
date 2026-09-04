/**
 * Regression test: a network page must issue each of its reads ONCE.
 *
 * Run: `npm run test:fetch-count`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * A live capture of the customer dashboard showed
 * `GET /port-forwarding/rules?page=1&page_size=100` **four times** on a single
 * page load, and `GET /dhcp-pools?page=1&page_size=100` twice. Neither was a
 * `refetchOnWindowFocus` artifact -- there was no focus event between them.
 *
 * Two independent causes, both now removed:
 *
 *   1. THE ORG ID WAS IN THE QUERY KEY. Each page resolved its own
 *      `scopedOrgId` and threaded it into the list query's key while gating
 *      on `enabled: locationId ? demoFlag || !!scopedOrgId : true`. `useIsDemo()`
 *      starts `true` (deliberately -- it is post-mount, for hydration safety),
 *      so the gate was ALREADY OPEN on the first render and the query fired
 *      with `organizationId: undefined`. Post-mount the flag flipped, the id
 *      resolved, the key changed, and everything refetched. The header those
 *      pages were working so hard to supply is attached to every request
 *      anyway by `attachOrganizationHeader` in `services/api.ts`.
 *   2. THE KPI TILES REFETCHED THE LIST. `getKpis()` hit the SAME endpoint
 *      with the SAME `page_size=100` -- a byte-identical second request --
 *      and then counted `enabled`/`disabled` over at most one page while
 *      reporting the server's true total next to them.
 *
 * WHAT THIS LOCKS DOWN, and why in a browser
 * ------------------------------------------
 * Both bugs are *timing* bugs: they need a real mount, a real effect flush,
 * and a real React Query cache to appear at all. Neither `tsc` nor a
 * source-text check can see them, and this repo has no test runner (see
 * `scripts/test-portal-signin-fields.mjs` for the same note) -- so, as that
 * test does, this drives the real components in a real Chromium with esbuild.
 *
 * The only thing substituted is `@/services/api` (a recording fake, so the
 * count is taken at the axios seam where the duplicates were observed) and
 * `@/services/customer.service` (whose `resolveOrgId` still delegates to the
 * REAL shared `organization-id` resolver, so its own dedupe stays under test).
 * The services, hooks, query keys and components are all the shipping ones.
 *
 * CASE 4 IS THE CONTROL. It mounts a component with the OLD shape -- a
 * post-mount flag plus a resolved id in the key -- and asserts it fires
 * TWICE. Without it, "exactly one request" could just mean the harness never
 * detects a second one, and the test would pass against the very bug it
 * exists to catch.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "fetch-count-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name} -- ${detail}`);
  }
};

// --- the recording fake for `@/services/api` --------------------------
// Shaped like the real module's surface as these files use it: `api` with
// get/post/put/delete resolving `{ data }` (the real response interceptor
// has already unwrapped the envelope by the time a service sees it).
const API_STUB = `
const RULE = (id, enabled) => ({
  id, router_id: "r1", organization_id: "org-1", location_id: "loc-1",
  name: "rule-" + id, protocol: "tcp", source_address: null,
  destination_address: null, destination_port: 8080, internal_address: "10.0.0.5",
  internal_port: 80, description: null, is_enabled: enabled,
  device_push_status: "active", device_push_error: null,
  device_pushed_at: null, created_at: "2026-01-01T00:00:00Z",
});
const POOL = (id, enabled) => ({
  id, router_id: "r1", organization_id: "org-1", location_id: "loc-1",
  name: "pool-" + id, interface: "ether1", address_range_start: "10.0.0.10",
  address_range_end: "10.0.0.200", gateway_ip_address: "10.0.0.1",
  dns_primary: null, dns_secondary: null, lease_time_seconds: 3600,
  is_enabled: enabled, device_push_status: "active", device_push_error: null,
  device_pushed_at: null, created_at: "2026-01-01T00:00:00Z",
});
const page = (items) => ({
  items, page: 1, page_size: 100, total_items: items.length,
  total_pages: 1, has_next: false, has_previous: false,
});

const BODIES = {
  "/port-forwarding/rules": page([RULE("a", true), RULE("b", false), RULE("c", true)]),
  "/dhcp-pools": page([POOL("a", true), POOL("b", false)]),
  "/me/organizations": [{ id: "m1", organization_id: "org-1", status: "active" }],
};

window.__CALLS__ = [];
function record(method, url, config) {
  window.__CALLS__.push({
    method,
    url,
    params: config?.params ?? null,
    // The whole point of the fix: no call site sets this by hand any more,
    // the request interceptor does. A non-null here is a regression.
    orgHeader: config?.headers?.["X-Organization-Id"] ?? null,
  });
}
function body(url) {
  if (BODIES[url]) return BODIES[url];
  if (/^\\/locations\\/[^/]+\\/routers$/.test(url)) return { items: [] };
  return { items: [] };
}
export const api = {
  get: async (url, config) => { record("get", url, config); return { data: body(url) }; },
  post: async (url, _b, config) => { record("post", url, config); return { data: {} }; },
  put: async (url, _b, config) => { record("put", url, config); return { data: {} }; },
  delete: async (url, config) => { record("delete", url, config); return { data: {} }; },
};
export const DEMO_ACCESS_TOKEN = "demo-access-token";
export default api;
`;
writeFileSync(join(work, "api-stub.js"), API_STUB);

// `customer.service` is a ~1500-line module that would drag the whole app in
// for two functions. `isDemo` reads the same localStorage key the real one
// does; `resolveOrgId` delegates to the same shared resolver the real one
// delegates to, so its cache/in-flight dedupe is genuinely exercised.
writeFileSync(
  join(work, "customer-service-stub.js"),
  `import { resolveOrganizationId } from "@/services/organization-id";
   export function isDemo() {
     return localStorage.getItem("cloudguest_token") === "demo-access-token";
   }
   export function resolveOrgId() { return resolveOrganizationId(); }
`,
);

// --- the harness ------------------------------------------------------
writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { useEffect, useState } from "react";
   import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
   import { TooltipProvider } from "@/components/ui/tooltip";
   import { PortForwardingManagement } from "@/components/network/PortForwardingManagement";
   import { DhcpManagement } from "@/components/network/DhcpManagement";
   import { api } from "@/services/api";

   const params = new URLSearchParams(location.search);
   const which = params.get("case");
   if (which === "demo") localStorage.setItem("cloudguest_token", "demo-access-token");
   else localStorage.setItem("cloudguest_token", "a-real-looking-token");

   /** The shape every one of these pages had before this fix, reduced to its
    *  essentials: a flag that starts one way and flips post-mount, an id
    *  resolved by its own query, and both of them in the list query's key +
    *  enabled. Present as a control -- it MUST double. */
   function OldShape() {
     const [demo, setDemo] = useState(true);
     useEffect(() => { setDemo(false); }, []);
     const { data: scopedOrgId } = useQuery({
       queryKey: ["control", "org-id"],
       queryFn: async () => {
         const { data } = await api.get("/me/organizations");
         return data[0].organization_id;
       },
       enabled: !demo,
     });
     useQuery({
       queryKey: ["control", "list", { organizationId: scopedOrgId }],
       queryFn: async () => {
         const { data } = await api.get("/port-forwarding/rules", {
           params: { page: 1, page_size: 100 },
         });
         return data;
       },
       enabled: demo || !!scopedOrgId,
     });
     return <div>control</div>;
   }

   const client = new QueryClient({
     defaultOptions: { queries: { retry: false } },
   });
   const body =
     which === "dhcp" ? <DhcpManagement locationId="loc-1" />
     : which === "control" ? <OldShape />
     : <PortForwardingManagement locationId="loc-1" />;

   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={client}>
       <TooltipProvider>{body}</TooltipProvider>
     </QueryClientProvider>,
   );
`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  // The entry lives in a temp dir, so bare specifiers have no node_modules
  // above them to walk into -- point esbuild at the repo's own. This is the
  // real React/React Query the app ships.
  nodePaths: [resolve(ROOT, "node_modules")],
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "network-page-aliases",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({
          path: join(work, "api-stub.js"),
        }));
        // Modules inside src/services reach it as a relative "./api" -- catch
        // those too, or the real axios instance loads alongside the stub and
        // half the requests go uncounted.
        b.onResolve({ filter: /^\.\.?\// }, (args) => {
          const target = resolve(args.resolveDir, args.path);
          if (target === join(ROOT, "src", "services", "api")) {
            return { path: join(work, "api-stub.js") };
          }
          if (target === join(ROOT, "src", "services", "customer.service")) {
            return { path: join(work, "customer-service-stub.js") };
          }
          return null;
        });
        b.onResolve({ filter: /^@\/services\/customer\.service$/ }, () => ({
          path: join(work, "customer-service-stub.js"),
        }));
        // `@/x` -> `<root>/src/x`, with the extension probing esbuild would
        // otherwise do for us (an onResolve result must be an exact path).
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          const probes = [
            base,
            `${base}.tsx`,
            `${base}.ts`,
            join(base, "index.tsx"),
            join(base, "index.ts"),
          ];
          for (const p of probes) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8>
   <title>Network page fetch-count harness</title>
   <div id=root></div>
   <script type=module src="./bundle.js"></script>`,
);

const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const file = readFileSync(join(work, name === "/" ? "/index.html" : name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(file);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

/** Loads one case and returns every recorded request. A fresh page per case
 *  means a fresh QueryClient and fresh module state (the shared org-id
 *  resolver caches at module scope), so cases cannot mask each other. */
async function callsFor(which) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/index.html?case=${which}`);
  await page.waitForFunction(() => Array.isArray(window.__CALLS__), null, { timeout: 10_000 });
  // Settle: effects flush, the post-mount flag flips, any query keyed off a
  // resolved id refetches. A duplicate that arrives late still gets counted.
  await page.waitForTimeout(1200);
  const calls = await page.evaluate(() => window.__CALLS__);
  await page.close();
  if (errors.length) throw new Error(`${which}: page errors: ${errors.join(" | ")}`);
  return calls;
}

const countOf = (calls, url) => calls.filter((c) => c.url === url).length;
/** True when nothing set `X-Organization-Id` by hand on `url`.
 *
 * Scoped to the list endpoints on purpose. `/locations/{id}/routers` still
 * takes an explicit id and must keep doing so: `LocationDetailTabs` reads one
 * named organization's routers from an operator session, which holds GLOBAL
 * scope and therefore gets no header from the interceptor at all. */
const noHandSetHeader = (calls, url) =>
  calls.filter((c) => c.url === url).every((c) => c.orgHeader === null);

console.log("\nNetwork pages, mounted for real:");

// 1 -- Port Forwarding: the page a live capture caught fetching four times.
const pf = await callsFor("pf");
check(
  "port-forwarding-list-once",
  countOf(pf, "/port-forwarding/rules") === 1,
  `GET /port-forwarding/rules issued ${countOf(pf, "/port-forwarding/rules")} time(s), expected 1 -- ${JSON.stringify(pf.map((c) => c.url))}`,
);
check(
  "port-forwarding-no-hand-set-org-header",
  noHandSetHeader(pf, "/port-forwarding/rules"),
  "a call site set X-Organization-Id by hand; attachOrganizationHeader owns that header",
);
check(
  "port-forwarding-org-lookup-at-most-once",
  countOf(pf, "/me/organizations") <= 1,
  `GET /me/organizations issued ${countOf(pf, "/me/organizations")} time(s)`,
);

// 2 -- DHCP: two of its duplicates were the KPI call re-issuing this URL.
const dhcp = await callsFor("dhcp");
check(
  "dhcp-list-once",
  countOf(dhcp, "/dhcp-pools") === 1,
  `GET /dhcp-pools issued ${countOf(dhcp, "/dhcp-pools")} time(s), expected 1 -- ${JSON.stringify(dhcp.map((c) => c.url))}`,
);
check(
  "dhcp-no-hand-set-org-header",
  noHandSetHeader(dhcp, "/dhcp-pools"),
  "a call site set X-Organization-Id by hand; attachOrganizationHeader owns that header",
);

// 3 -- The demo account still reaches no backend at all. Its token is not a
//      real session; every one of these calls 401s, and the services
//      short-circuit before making them. Removing the org gate must not have
//      quietly reintroduced the `/me/organizations` request that was
//      deliberately taken off this page.
const demo = await callsFor("demo");
check(
  "demo-issues-no-requests",
  demo.length === 0,
  `demo mode issued ${demo.length} request(s): ${JSON.stringify(demo.map((c) => c.url))}`,
);

// 4 -- CONTROL. The old shape, so a passing run above means the harness can
//      actually see a duplicate rather than never looking.
const control = await callsFor("control");
check(
  "control-old-shape-does-double",
  countOf(control, "/port-forwarding/rules") === 2,
  `the pre-fix shape fired ${countOf(control, "/port-forwarding/rules")} time(s); if this is not 2 the harness is not detecting duplicates and the assertions above prove nothing`,
);

await browser.close();
server.close();

console.log("");
if (failures.length) {
  console.log(`${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("all checks passed");
