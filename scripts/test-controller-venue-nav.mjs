/**
 * A controller-managed venue's own dashboard: the five Network screens are
 * greyed in the nav and never mount a form -- contract §11.5.
 *
 * The companion to `scripts/test-controller-venue-network-screens.mjs`, which
 * covers the predicate, the gated id list and the replacement panel. This one
 * covers the two REAL SURFACES the venue owner touches, and it needs a real
 * browser to do it: `CustomerSidebar` and `CustomerFeaturePage` both read the
 * active venue out of a zustand store, and zustand hands a server render its
 * `getInitialState` snapshot rather than the live one -- so a server-rendered
 * assertion about either would be an assertion about the wrong state, and
 * would pass whether the gate worked or not.
 *
 * (Needs Playwright's Chromium: `npx playwright install chromium`. Same
 * dependency, and the same reason, as `scripts/test-plan-editor-feedback.mjs`.)
 *
 * WHAT WAS WRONG
 * --------------
 * Network Zones, IP Addresses, Port Forwarding, Call Priority and Website
 * Blocking are RouterOS writes. At a venue whose only router is a TP-Link
 * Omada controller there is no RouterOS to write to, and the backend refuses
 * -- but only on submit, after the owner has found the screen and filled in
 * the form. `src/lib/router-vendors.ts` was imported by five files and not one
 * of them was under `src/components/features/`.
 *
 * WHAT IS ASSERTED
 * ----------------
 *   1. THE FORM IS NOT MOUNTED. Opening Port Forwarding at a controller venue
 *      renders no "Add" control and none of the view's own headings. Absent,
 *      not disabled: each of these views fetches its rules on mount.
 *   2. WHAT IS THERE INSTEAD NAMES THE VENDOR AND LINKS ON. "You cannot do
 *      this here" with no destination is a support ticket.
 *   3. THE NAV ROW SURVIVES, MUTED, WITH THE REASON ON IT. Hiding it would
 *      replace one lie with a silence nobody can question.
 *   4. AN UNGATED SCREEN AT THE SAME VENUE STILL MOUNTS. The gate is five
 *      screens, not the Network group and not the dashboard.
 *   5. A MIKROTIK VENUE IS UNCHANGED -- every one of the five still mounts its
 *      real view, and no controller copy appears anywhere.
 *
 * Run: node scripts/test-controller-venue-nav.mjs
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "controller-venue-nav-"));

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const OMADA = {
  id: "r-omada",
  name: "Hotel OC200",
  status: "pending_provisioning",
  vendor: "tplink_omada",
};
const MIKROTIK = {
  id: "r-hex",
  name: "Lobby hEX",
  status: "online",
  vendor: "mikrotik",
  last_seen_at: new Date().toISOString(),
};

// --- stubs -----------------------------------------------------------
writeFileSync(
  join(work, "router-stub.js"),
  `import React from "react";
   export function useNavigate() { return () => {}; }
   /** Spreads every prop onto the anchor: \`SidebarMenuButton asChild\` hands
    * className and the reason \`title\` down through a Radix Slot, and those
    * are exactly what this test reads. */
   export function Link({ children, to, params, search, ...rest }) {
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

writeFileSync(
  join(work, "sonner-stub.js"),
  `const noop = () => {};
   export const toast = Object.assign(noop, {
     success: noop, error: noop, warning: noop, info: noop, message: noop,
   });
   export const Toaster = () => null;`,
);

writeFileSync(
  join(work, "auth-stub.js"),
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

/**
 * Only three hooks are replaced, and the rest of the module comes through
 * untouched: this shell's tree imports a dozen others, and a stub that
 * enumerated them would go stale the moment one is added -- which is the
 * exact failure `scripts/ci-gated-test.sh` exists to catch.
 *
 * `useMyPermissions` returns "we don't know", which is
 * `customerNavPermissions`' fail-open path, so nothing here can be missing
 * from the nav for an RBAC reason and be mistaken for a vendor gate.
 */
const realCustomerHooks = join(ROOT, "src/hooks/useCustomerDashboard.ts").replace(/\\/g, "/");
writeFileSync(
  join(work, "customer-hooks-stub.js"),
  `export * from "${realCustomerHooks}";
   export function useMyPermissions() { return { data: null, isLoading: false }; }
   export function useIsDemo() { return false; }
   export function useCustomerFeatureData() { return { data: null, isLoading: false }; }`,
);

const realBillingHooks = join(ROOT, "src/hooks/useBilling.ts").replace(/\\/g, "/");
writeFileSync(
  join(work, "billing-hooks-stub.js"),
  `export * from "${realBillingHooks}";
   export function useMyBillingDashboard() { return { data: null, isLoading: false }; }`,
);

const shell = join(ROOT, "src/components/customer/CustomerFeaturePage.tsx").replace(/\\/g, "/");
const store = join(ROOT, "src/stores/customerStore.ts").replace(/\\/g, "/");
const liveness = join(ROOT, "src/lib/location-liveness.ts").replace(/\\/g, "/");

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import { CustomerFeaturePage } from "${shell}";
   import { useCustomerStore } from "${store}";
   import { deriveLocationLiveness } from "${liveness}";
   useCustomerStore.setState({
     activeLocationId: "loc-1",
     activeLocation: {
       id: "loc-1",
       name: "Grand Hotel",
       organizationId: "org-1",
       organizationName: "Grand Hotel Group",
       liveness: deriveLocationLiveness(window.__routers),
     },
   });
   const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
   createRoot(document.getElementById("root")).render(
     <QueryClientProvider client={client}>
       <CustomerFeaturePage feature={window.__feature} />
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
    "@tanstack/react-router": join(work, "router-stub.js"),
    "@/context/AuthContext": join(work, "auth-stub.js"),
    "@/hooks/useCustomerDashboard": join(work, "customer-hooks-stub.js"),
    "@/hooks/useBilling": join(work, "billing-hooks-stub.js"),
    sonner: join(work, "sonner-stub.js"),
  },
  loader: { ".ts": "ts", ".tsx": "tsx" },
});

let served = { routers: [MIKROTIK], feature: "dhcp" };
const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (name === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      `<!doctype html><meta charset=utf-8><title>venue nav harness</title>
       <script>window.__routers = ${JSON.stringify(served.routers)};
               window.__feature = ${JSON.stringify(served.feature)};
               localStorage.clear();</script>
       <div id=root></div><script type=module src="./bundle.js"></script>`,
    );
  }
  try {
    const body = readFileSync(join(work, name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await import("playwright");
const browser = await chromium.launch();

const NETWORK_LABELS = [
  "Network Zones",
  "IP Addresses",
  "Port Forwarding",
  "Call Priority",
  "Website Blocking",
];

/** Open one feature page at a venue with `routers`, and report what a venue
 * owner would see: the page body, and the nav rows with their muted state. */
async function openFeature(feature, routers) {
  served = { feature, routers };
  const page = await browser.newPage();
  await page.goto(origin);
  await page.waitForSelector("[data-sidebar='menu']", { timeout: 10_000 });
  await page.waitForTimeout(300);
  const rows = await page.$$eval("[data-sidebar='menu-button']", (els) =>
    els.map((el) => ({
      label: el.innerText.trim(),
      muted: el.className.includes("opacity-60"),
      title: el.getAttribute("title"),
    })),
  );
  // Product copy uses typographic apostrophes (`&rsquo;`), which reach
  // `innerText` as U+2019. Normalised so an assertion is about the sentence
  // rather than the glyph the source spelled it with.
  const text = (await page.locator("body").innerText()).replace(/\u2019/g, "'");
  return { page, text, rows };
}

console.log("\ncontroller venue: the five Network screens");
{
  const r = await openFeature("port-forwarding", [OMADA]);

  check(
    "omada-port-forwarding-mounts-no-form",
    !r.text.includes("New Rule") &&
      !/Total Rules/.test(r.text) &&
      !(await r.page.locator("form").count()),
    "the view fetches its rules and offers Add/Edit on mount; it must not mount at all",
  );
  // Copy updated 2026-09-12 to FIX-PLAN D4's wording. The ASSERTIONS are not
  // weakened -- they still require a headline that says where the setting
  // lives, the vendor named in full, the specific noun for THIS screen (so a
  // generic panel cannot satisfy every screen's test), and the deep link that
  // is the load-bearing half of the panel. Only the strings moved.
  check(
    "omada-port-forwarding-explains-itself",
    /Configured in Omada, not here\./.test(r.text) &&
      /TP-Link Omada controller/.test(r.text) &&
      /Port forwarding rules for this venue are set in Omada's own interface/.test(r.text),
  );
  check(
    "omada-port-forwarding-links-to-the-integration",
    (await r.page.getByRole("link", { name: /See this venue.s controller/ }).count()) === 1,
  );

  const network = r.rows.filter((row) => NETWORK_LABELS.includes(row.label));
  check(
    "omada-nav-keeps-all-five-rows",
    network.length === 5,
    `found ${network.length}: ${network.map((n) => n.label).join(", ")}`,
  );
  check(
    "omada-nav-mutes-all-five-rows",
    network.every((row) => row.muted),
  );
  check(
    "omada-nav-rows-carry-the-reason",
    network.every((row) => /managed by a TP-Link Omada controller/.test(row.title ?? "")),
  );
  check(
    "omada-nav-mutes-nothing-else",
    r.rows.filter((row) => row.muted).length === 5,
    `${r.rows
      .filter((row) => row.muted)
      .map((n) => n.label)
      .join(", ")}`,
  );
  check(
    "omada-nav-keeps-network-integrations-usable",
    r.rows.some((row) => row.label === "Network Integrations" && !row.muted),
    "excluding the screen this state is configured on would strand the owner",
  );
  await r.page.close();
}

console.log("\ncontroller venue: a screen that is NOT gated still works");
{
  const r = await openFeature("network-integrations", [OMADA]);
  check(
    "omada-network-integrations-is-not-replaced",
    !/is configured on this venue's controller/.test(r.text),
    "the gate is five screens, not the Network group",
  );
  await r.page.close();
}

/** Each view's own "add a rule" control -- the positive evidence that the
 * real screen, not the notice, is what mounted. Asserting only that the
 * controller copy is ABSENT would pass on a blank page. */
const REAL_VIEW_CTA = {
  "port-forwarding": "New Rule",
  dhcp: "New address range",
  vlans: "New zone",
  voip: "New Rule",
  "website-blocking": "Block a website",
};

console.log("\nMikroTik venue: unchanged, screen by screen");
for (const feature of ["port-forwarding", "dhcp", "vlans", "voip", "website-blocking"]) {
  const r = await openFeature(feature, [MIKROTIK]);
  check(
    `mikrotik-${feature}-still-mounts-its-real-view`,
    r.text.includes(REAL_VIEW_CTA[feature]) &&
      !/is configured on this venue's controller/.test(r.text) &&
      !/managed by a TP-Link Omada controller/.test(r.text),
    `expected the view's own "${REAL_VIEW_CTA[feature]}" control`,
  );
  const network = r.rows.filter((row) => NETWORK_LABELS.includes(row.label));
  check(
    `mikrotik-${feature}-nav-is-not-muted`,
    network.length === 5 && network.every((row) => !row.muted && row.title === null),
  );
  await r.page.close();
}

console.log("\nmixed venue: a MikroTik beside the controller keeps everything");
{
  const r = await openFeature("port-forwarding", [OMADA, MIKROTIK]);
  check(
    "mixed-venue-is-not-gated",
    !/is configured on this venue's controller/.test(r.text) &&
      r.rows.filter((row) => row.muted).length === 0,
    "`every`, not `some` -- those five screens act on the MikroTik and they work",
  );
  await r.page.close();
}

console.log("\nunknown venue state: fails open");
{
  const r = await openFeature("port-forwarding", []);
  check(
    "venue-with-no-routers-is-not-gated",
    !/is configured on this venue's controller/.test(r.text),
  );
  await r.page.close();
}

await browser.close();
server.close();

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
