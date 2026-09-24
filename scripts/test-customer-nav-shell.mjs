/**
 * Regression test for the customer navigation shell.
 *
 * WHERE THIS CAME FROM
 * --------------------
 * This replaces `test-customer-destinations.mjs`, which pinned a structure
 * that no longer exists: 26 features folded into nine "destinations", the
 * other seventeen reachable as tabs. That grouping was reverted -- the
 * sidebar offers all 26 in their eight groups again -- so those assertions
 * were not failing usefully, they were describing a deleted module. They are
 * deleted with it. (The count is 26 today: the "Notifications" preferences
 * screen was removed from the customer dashboard along with its nav entry,
 * and the Security group later added one row; see
 * test-customer-nav-permissions.mjs's own note.)
 *
 * What is NOT deleted is everything that shipped in the same commit but was
 * never about the grouping, because each of those fixed a real defect and
 * losing it would be a regression on top of a revert. Those assertions are
 * kept verbatim where they still apply and inverted where the expression
 * they named moved back:
 *
 *   1. THE MENU IS ALL OF THEM. Eight groups, every feature its own row,
 *      rendered from `customerNav.ts` through the same two filters.
 *   2. THE SHELL IS STILL THE SHARED PRIMITIVE. `components/ui/sidebar.tsx`,
 *      not a hand-rolled `<aside>` -- cookie-persisted collapse, Cmd/Ctrl-B,
 *      a Radix Sheet mobile drawer, focus rings. The hand-rolled one lost
 *      its collapse state on every route change and its "drawer" had no
 *      focus trap, Escape or scroll lock.
 *   3. ROWS ARE LINKS. `<Link>` with `aria-current`, not unlabelled buttons
 *      with no href.
 *   4. CMD-K STILL REACHES EVERY FEATURE, scoped by the same rules.
 *   5. THE SCOPE LINE STILL NAMES THE VENUE. Server-side location filtering
 *      does not mark what it withheld, so the screen has to say what it is
 *      showing.
 *   6. THE HELP PAGE DESCRIBES THE MENU THAT EXISTS. It generates its index
 *      from the sidebar's own expression; that expression moved twice, and
 *      this is the assertion that makes it move in step rather than
 *      describing a menu one release out of date.
 *   7. FIX A PROBLEM IS NOT QUIETLY OWNER-ONLY AGAIN. Front-desk staff are
 *      its audience and already hold the permissions it needs.
 *   8. NO TWO ROWS SHARE A GLYPH. In the collapsed rail labels are hidden
 *      entirely, so two rows with the same icon are indistinguishable
 *      pixels.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The real
 * modules are bundled with esbuild and executed; the wiring is checked
 * against the real component sources.
 *
 * Run: node scripts/test-customer-nav-shell.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "customer-nav-shell-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(entry, `export * from "${p("src/lib/customerNav.ts")}";`);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
  plugins: [
    {
      name: "stub-lucide",
      setup(b) {
        b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: "lucide", namespace: "stub" }));
        // Read the icon names customerNav.ts actually imports, so a new icon
        // can never fail this as "No matching export". Each stub is a named
        // function, so the icon a nav item carries is still identifiable by
        // `.name` -- which is how the glyph checks below tell two icons
        // apart without importing lucide for real.
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => {
          const src = readFileSync(join(ROOT, "src/lib/customerNav.ts"), "utf8");
          const m = src.match(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/s);
          const names = new Set();
          if (m) for (const n of m[1].split(",")) if (n.trim()) names.add(n.trim());
          return {
            contents: `export default new Proxy({}, { get: () => () => null });
                       ${[...names].map((n) => `export function ${n}() { return null; }`).join("\n")}`,
            loader: "js",
          };
        });
      },
    },
  ],
});

const {
  CUSTOMER_NAV_GROUPS,
  CUSTOMER_NAVS,
  customerFeatureHref,
  customerNavGroupsForRole,
  customerNavsForRole,
} = await import(`file://${outfile}`);

// ---------------------------------------------------------------------------
// 1. The menu is the 26 again.
// ---------------------------------------------------------------------------

console.log("\nthe customer menu is 26 features in eight groups");

check("there are eight groups", CUSTOMER_NAV_GROUPS.length === 8, `${CUSTOMER_NAV_GROUPS.length}`);
// 26: main removed the "Notifications" preferences screen (25), a branch
// added "Network Integrations" to the Network group (26), and FIX-PLAN FE-0
// retired that row again (25) -- backend `074d719` made every
// `network_integrations.*` route GLOBAL-scoped and dropped the org-scoped
// grants, so for a venue owner the page it led to 403s on every call.
// Then the Security group arrived with one row, "Overview" (26): the posture
// page is the only security surface this platform can produce numbers for,
// so it ships alone rather than with the three placeholder rows a fuller
// menu would have implied.
// Then Security -> Blocking arrived (27) and Network -> Website Blocking left
// (26): the same screen, now a tab of the new page beside blocked guests, so
// the count is unchanged by a move rather than by a removal. Section 10 pins
// the move itself.
// Then Security -> Firewall arrived (27): a new screen, not a move -- rules
// that reach the router through cloud-guest#304's push. Section 11 pins it.
// Then Security -> Web Filtering (28): Cloudflare categories, switched on per
// router through cloud-guest#307. Section 12 pins it.
// Asserted rather than derived on purpose -- it is what catches a row being
// dropped by an unrelated refactor -- so moving it is a deliberate step, and
// this is one.
check("there are 28 features", CUSTOMER_NAVS.length === 28, `${CUSTOMER_NAVS.length}`);
check(
  "the eight groups are the canonical ones",
  CUSTOMER_NAV_GROUPS.map((g) => g.id).join(",") ===
    "overview,engagement,access-policy,devices-team,network,security,operations,support-logs",
  CUSTOMER_NAV_GROUPS.map((g) => g.id).join(","),
);
const dupes = CUSTOMER_NAVS.map((n) => n.id).filter((id, i, all) => all.indexOf(id) !== i);
check("no feature id appears twice", dupes.length === 0, dupes.join(", "));
check(
  "every group has at least one feature",
  CUSTOMER_NAV_GROUPS.every((g) => g.items.length > 0),
);
check(
  "every feature resolves to a route",
  CUSTOMER_NAVS.every(
    (n) =>
      typeof customerFeatureHref(n.id) === "string" && customerFeatureHref(n.id).startsWith("/"),
  ),
);
check(
  "the reserved hrefs still win over the bare name",
  customerFeatureHref("dashboard") === "/" &&
    customerFeatureHref("portal") === "/guest-portal" &&
    customerFeatureHref("campaigns") === "/guest-campaigns" &&
    customerFeatureHref("vouchers") === "/guest-vouchers",
);
check(
  "the grouped and flat views hold the same features",
  CUSTOMER_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).join(",") ===
    CUSTOMER_NAVS.map((n) => n.id).join(","),
);
// The layer that folded these into nine is gone, not merely unused: a
// dangling module is how a reverted structure comes back by accident.
check(
  "the destination layer is deleted, not orphaned",
  !existsSync(join(ROOT, "src/lib/customerDestinations.ts")),
);

// ---------------------------------------------------------------------------
// 2-5. The shell, and what was kept from the change that restructured it.
// ---------------------------------------------------------------------------

console.log("\nthe shell keeps the fixes that were not about the grouping");

const sidebar = readFileSync(join(ROOT, "src/components/customer/CustomerSidebar.tsx"), "utf8");
const palette = readFileSync(
  join(ROOT, "src/components/customer/CustomerCommandPalette.tsx"),
  "utf8",
);
const scope = readFileSync(join(ROOT, "src/components/customer/CustomerPageScope.tsx"), "utf8");
// Comments stripped: these files' own docstrings explain what they replaced,
// so a raw grep matches the postmortem rather than the code.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const sidebarCode = strip(sidebar);

check(
  "the sidebar renders the eight groups, not a destination layer",
  /customerNavGroupsForRole\(/.test(sidebarCode) &&
    /filterNavGroupsByPermissions\(/.test(sidebarCode) &&
    !/destinationsFor\(/.test(sidebarCode),
);
check(
  "the sidebar uses the shared shadcn primitive, not a hand-rolled aside",
  sidebarCode.includes('from "@/components/ui/sidebar"') && !/<aside/.test(sidebarCode),
);
check(
  "the sidebar is collapsible to a rail with the primitive's own toggle",
  /collapsible="icon"/.test(sidebarCode) && /<SidebarRail/.test(sidebarCode),
);
check(
  "nav rows are links, not buttons",
  /<Link/.test(sidebarCode) && /aria-current=/.test(sidebarCode),
);
check(
  "rows navigate via the same href source of truth",
  /customerFeatureHref\(item\.id\)/.test(sidebarCode),
);
check("the sidebar still skeletons while grants are in flight", /showSkeleton/.test(sidebarCode));
check(
  "the palette is bound to Cmd/Ctrl-K",
  /e\.key === "k" && \(e\.metaKey \|\| e\.ctrlKey\)/.test(palette),
);
check(
  "the palette is scoped by the same expression as the sidebar",
  /filterNavGroupsByPermissions\(customerNavGroupsForRole\(role\), permissions\)/.test(palette),
);
check(
  "the palette navigates via the same href source of truth",
  /customerFeatureHref\(item\.id\)/.test(palette),
);
// A location-scoped staff member's lists are filtered server-side with no
// marker saying anything was withheld, so the screen has to name its scope.
check("the page scope line names the venue it is scoped to", /locationName/.test(strip(scope)));
check(
  "and names the screen from the nav's own labels",
  /customerItem\.\$\{item\.id\}/.test(scope) && /CUSTOMER_NAVS/.test(scope),
);

// ---------------------------------------------------------------------------
// 6. The help page describes the menu that exists.
// ---------------------------------------------------------------------------

console.log("\nthe help page documents this menu, not the previous one");

const howItWorks = readFileSync(join(ROOT, "src/components/customer/HowItWorksPage.tsx"), "utf8");
// This page generates its index from the sidebar's own expression precisely
// so it cannot describe screens the reader does not have. That expression
// moved to a nine-destination model and back; the page has to move with it in
// both directions or it documents a menu that is one release out of date.
check(
  "the help page reads the same expression the sidebar evaluates",
  /filterNavGroupsByPermissions\(customerNavGroupsForRole\(role\), permissions\)/.test(howItWorks),
);
check(
  "the help page does not read a retired destination model",
  // Comments stripped: this page's docstring narrates the expression moving
  // to `destinationsFor()` and back, so a raw grep matches the history note
  // rather than a live call.
  !/destinationsFor\(/.test(strip(howItWorks)) && !/customerDestinations/.test(strip(howItWorks)),
);
check(
  "the help page labels groups from the same i18n namespace as the sidebar",
  /nav:customerGroup\./.test(howItWorks) && /nav:customerItem\./.test(howItWorks),
);

// ---------------------------------------------------------------------------
// 7. Fix a Problem stays reachable by front-desk staff.
// ---------------------------------------------------------------------------

console.log("\nFix a Problem is not quietly owner-only again");

const debugging = CUSTOMER_NAVS.find((n) => n.id === "debugging");
check("the fix-it page is still in the nav", !!debugging);
check(
  "it declares owner + agent",
  debugging && debugging.roles.slice().sort().join(",") === "agent,owner",
  debugging ? debugging.roles.join(",") : "missing",
);
check("it is still named for the job", debugging && debugging.label === "Fix a Problem");
check(
  "a staff sign-in is actually offered it",
  customerNavsForRole("agent").some((n) => n.id === "debugging"),
);
check(
  "and it survives the grouped filter staff actually render",
  customerNavGroupsForRole("agent")
    .flatMap((g) => g.items.map((i) => i.id))
    .includes("debugging"),
);

// ---------------------------------------------------------------------------
// 8. Two rows in the collapsed rail must not be the same glyph.
// ---------------------------------------------------------------------------

console.log("\nthe collapsed rail is icons only, so the icons must differ");

const alerts = CUSTOMER_NAVS.find((n) => n.id === "alerts");
check("Alerts still carries Bell", alerts && alerts.icon.name === "Bell");
// Stated generally rather than only for that one pair: the rail hides every
// label, so any repeated glyph is two rows a customer cannot tell apart.
{
  const seen = new Map();
  const clashes = [];
  for (const item of CUSTOMER_NAVS) {
    const name = item.icon.name;
    if (seen.has(name)) clashes.push(`${seen.get(name)}/${item.id} both use ${name}`);
    else seen.set(name, item.id);
  }
  check("no two features share an icon", clashes.length === 0, clashes.join("; "));
}

// ---------------------------------------------------------------------------
// 10. Security -> Blocking is one home, not a second copy.
// ---------------------------------------------------------------------------

console.log("\nSecurity -> Blocking replaced Network -> Website Blocking");

{
  const security = CUSTOMER_NAV_GROUPS.find((g) => g.id === "security");
  check(
    "the Security group is Overview, Blocking, Firewall, then Web filtering",
    security &&
      security.items.map((i) => i.id).join(",") === "security,blocking,firewall,web-filtering",
    security ? security.items.map((i) => i.id).join(",") : "missing",
  );
  const blocking = CUSTOMER_NAVS.find((n) => n.id === "blocking");
  check("Blocking is labelled for the job", blocking && blocking.label === "Blocking");
  check(
    "Blocking is owner-only, like Access Rules its guests tab came from",
    blocking && blocking.roles.join(",") === "owner",
  );
  check("Blocking lives at /blocking", customerFeatureHref("blocking") === "/blocking");
  check(
    "Website Blocking is not a row anywhere any more",
    !CUSTOMER_NAVS.some((n) => n.id === "website-blocking"),
    "the same screen reachable as a row and as a tab is two homes for one setting",
  );
  check(
    "the Network group keeps its other five rows",
    (CUSTOMER_NAV_GROUPS.find((g) => g.id === "network")?.items ?? [])
      .map((i) => i.id)
      .join(",") === "dhcp,vlans,port-forwarding,voip,isp-details",
  );
  // Old links must keep working: a bookmark to the old address is a
  // redirect to the tab it became, behind the same session guards.
  const redirectSrc = strip(readFileSync(join(ROOT, "src/routes/website-blocking.tsx"), "utf8"));
  check(
    "/website-blocking redirects to the Websites tab",
    /redirect\(\{\s*to:\s*"\/blocking",\s*search:\s*\{\s*tab:\s*"websites"\s*\}/.test(redirectSrc),
  );
  check(
    "and still checks the session before it redirects",
    redirectSrc.indexOf("requireCustomerSession") > -1 &&
      redirectSrc.indexOf("requireCustomerSession") < redirectSrc.indexOf("redirect({"),
  );
  check("and no longer mounts a page of its own", !/CustomerFeaturePage/.test(redirectSrc));
  const routeSrc = strip(readFileSync(join(ROOT, "src/routes/blocking.tsx"), "utf8"));
  check(
    "/blocking mounts the shared shell with the blocking id",
    /<CustomerFeaturePage feature="blocking" \/>/.test(routeSrc) &&
      /requireCustomerSession/.test(routeSrc) &&
      /requireActiveLocationId/.test(routeSrc),
  );
  // The page is built from the screens that already worked, not forks of
  // them -- and those screens left their old homes.
  const view = strip(readFileSync(join(ROOT, "src/components/security/BlockingView.tsx"), "utf8"));
  check(
    "the Websites tab is the existing content-filter screen",
    /<ContentFilterManagement\b/.test(view),
  );
  check("the Guests tab is the existing Blocked Guests screen", /<BlockUsers\b/.test(view));
  check(
    "the page gates the Websites tab with the existing controller notice",
    /<ControllerManagedFeatureNotice\b/.test(view) &&
      /featureAppliesToControllerVenue\(/.test(view),
  );
  const hub = strip(readFileSync(join(ROOT, "src/components/features/PoliciesHub.tsx"), "utf8"));
  check(
    "Access Rules no longer mounts Blocked Guests",
    !/<BlockUsers\b/.test(hub) && !/id:\s*"block"/.test(hub),
  );
  check(
    "and points owners at where it went",
    /to="\/blocking"/.test(hub) && /tab:\s*"guests"/.test(hub),
  );
  // The overview links each enforced capability that has a control to it --
  // and only those.
  const overview = readFileSync(
    join(ROOT, "src/components/security/SecurityOverviewView.tsx"),
    "utf8",
  );
  const managed = overview.split("const MANAGED_AT")[1]?.split("};")[0] ?? "";
  const linkedTo = (dest) =>
    [...managed.matchAll(/^\s*([a-z_]+):\s*\{\s*to:\s*"([^"]+)"/gm)]
      .filter((mm) => mm[2] === dest)
      .map((mm) => mm[1]);
  const linkedKeys = linkedTo("/blocking");
  check(
    "the Security overview links domain, address and device blocking to it",
    linkedKeys.sort().join(",") === "device_isolation,domain_blocking_dns,ip_and_cidr_blocking",
    linkedKeys.join(","),
  );
  check(
    "and links zone-to-zone firewalling to Security -> Firewall, and nothing else there",
    linkedTo("/firewall").join(",") === "zone_to_zone_firewall",
    linkedTo("/firewall").join(","),
  );
  check(
    "and links web category filtering to Security -> Web Filtering, and nothing else there",
    linkedTo("/web-filtering").join(",") === "web_category_filtering",
    linkedTo("/web-filtering").join(","),
  );
  check("and links nothing that has no screen", !managed.includes("domain_blocking_sni"));
  check(
    "and only from the Enforced-today group",
    /group\.availability === "available" && MANAGED_AT\[feature\.key\]/.test(strip(overview)),
  );
}

// ---------------------------------------------------------------------------
// 11. Security -> Firewall: MikroTik rules with an Apply, in plain words.
// ---------------------------------------------------------------------------

console.log("\nSecurity -> Firewall is a real screen, owner-only, gated at controller venues");

{
  const firewall = CUSTOMER_NAVS.find((n) => n.id === "firewall");
  check("Firewall is labelled for the job", firewall && firewall.label === "Firewall");
  check("Firewall is owner-only", firewall && firewall.roles.join(",") === "owner");
  check("Firewall lives at /firewall", customerFeatureHref("firewall") === "/firewall");
  const routeSrc = strip(readFileSync(join(ROOT, "src/routes/firewall.tsx"), "utf8"));
  check(
    "/firewall mounts the shared shell with the firewall id, behind the session guards",
    /<CustomerFeaturePage feature="firewall" \/>/.test(routeSrc) &&
      /requireCustomerSession/.test(routeSrc) &&
      /requireActiveLocationId/.test(routeSrc),
  );
  const view = strip(readFileSync(join(ROOT, "src/components/security/FirewallView.tsx"), "utf8"));
  check(
    "the screen reuses the existing firewall service and hooks, not a fork",
    /from "@\/hooks\/useFirewall"/.test(view) && !/api\.(get|post|put|delete)\(/.test(view),
  );
  check(
    "the screen gates itself with the existing controller notice too (the /agent shell has no gate)",
    /<ControllerManagedFeatureNotice\b/.test(view) &&
      /featureAppliesToControllerVenue\(/.test(view),
  );
  check(
    "Apply asks first",
    /<AlertDialog open=\{confirmApply\}/.test(view) && /onClick=\{runPush\}/.test(view),
  );
  check(
    "the form offers no RouterOS vocabulary",
    !/chain|place-before|in_interface|inInterface/i.test(
      view.split("function RuleDialog")[1] ?? "chain",
    ),
  );
  const shellSrc = strip(
    readFileSync(join(ROOT, "src/components/customer/CustomerFeaturePage.tsx"), "utf8"),
  );
  const gatedBlock = shellSrc.split("controllerGated ?")[1] ?? "";
  check(
    "the owner shell mounts it inside the controller gate",
    /feature === "firewall" && <FirewallView\b/.test(gatedBlock),
  );
  // The operator screen is untouched and still where it was.
  const operatorRoute = readFileSync(
    join(ROOT, "src/routes/_authenticated/network.firewall.tsx"),
    "utf8",
  );
  check(
    "the old operator route still mounts FirewallManagement",
    /<FirewallManagement\s*\/>/.test(operatorRoute),
  );
}

// ---------------------------------------------------------------------------
// 12. Security -> Web Filtering: Cloudflare categories, per-router switch.
// ---------------------------------------------------------------------------

console.log("\nSecurity -> Web Filtering is a real screen, owner-only, gated at controller venues");

{
  const wf = CUSTOMER_NAVS.find((n) => n.id === "web-filtering");
  check("Web filtering is labelled for the job", wf && wf.label === "Web filtering");
  check("Web filtering is owner-only", wf && wf.roles.join(",") === "owner");
  check(
    "Web filtering lives at /web-filtering",
    customerFeatureHref("web-filtering") === "/web-filtering",
  );
  const routeSrc = strip(readFileSync(join(ROOT, "src/routes/web-filtering.tsx"), "utf8"));
  check(
    "/web-filtering mounts the shared shell with its id, behind the session guards",
    /<CustomerFeaturePage feature="web-filtering" \/>/.test(routeSrc) &&
      /requireCustomerSession/.test(routeSrc) &&
      /requireActiveLocationId/.test(routeSrc),
  );
  const view = strip(
    readFileSync(join(ROOT, "src/components/security/WebFilteringView.tsx"), "utf8"),
  );
  check(
    "the screen talks to the backend only through its hooks",
    /from "@\/hooks\/useDnsFiltering"/.test(view) && !/api\.(get|post|put|delete)\(/.test(view),
  );
  check(
    "the screen gates itself with the existing controller notice too (the /agent shell has no gate)",
    /<ControllerManagedFeatureNotice\b/.test(view) &&
      /featureAppliesToControllerVenue\("web-filtering"\)/.test(view),
  );
  check(
    "Turn on and Turn off both ask first",
    /<AlertDialog open=\{confirm !== null\}/.test(view) &&
      /onClick=\{\(\) => setConfirm\("enable"\)\}/.test(view) &&
      /onClick=\{\(\) => setConfirm\("disable"\)\}/.test(view),
  );
  check(
    "the not-configured state renders before any control",
    view.indexOf('categories.data.state === "not_configured"') > -1 &&
      view.indexOf('categories.data.state === "not_configured"') < view.indexOf("<CategoriesCard"),
  );
  check("no fixture data in the screen", !/const\s+(MOCK|FAKE|SAMPLE|DEMO)_/i.test(view));
  const shellSrc = strip(
    readFileSync(join(ROOT, "src/components/customer/CustomerFeaturePage.tsx"), "utf8"),
  );
  const gatedBlock = shellSrc.split("controllerGated ?")[1] ?? "";
  check(
    "the owner shell mounts it inside the controller gate",
    /feature === "web-filtering" && <WebFilteringView\b/.test(gatedBlock),
  );
}

// ---------------------------------------------------------------------------
// 9. Every row has a name in both locales.
// ---------------------------------------------------------------------------

console.log("\nevery row is nameable in both shipped locales");

for (const loc of ["en", "hi"]) {
  const nav = JSON.parse(readFileSync(join(ROOT, `src/lib/i18n/locales/${loc}/nav.json`), "utf8"));
  const items = nav.customerItem ?? {};
  const groups = nav.customerGroup ?? {};
  const missingItems = CUSTOMER_NAVS.map((n) => n.id).filter((id) => !items[id]);
  const orphanItems = Object.keys(items).filter((id) => !CUSTOMER_NAVS.some((n) => n.id === id));
  const missingGroups = CUSTOMER_NAV_GROUPS.map((g) => g.id).filter((id) => !groups[id]);
  check(`${loc}: every feature has a label`, missingItems.length === 0, missingItems.join(", "));
  check(
    `${loc}: no label for a feature that does not exist`,
    orphanItems.length === 0,
    orphanItems.join(", "),
  );
  check(`${loc}: every group has a label`, missingGroups.length === 0, missingGroups.join(", "));
  // The destination labels shipped with the reverted grouping; leaving them
  // behind is how a deleted menu keeps a foothold in the product's strings.
  check(
    `${loc}: the retired destination labels are gone`,
    !nav.customerDestination && !nav.customerDestinationGroup,
  );
  // The Blocking page's own tab names and sentences, in the same namespace.
  check(
    `${loc}: both Blocking tabs are named`,
    !!nav.blockingTab?.websites && !!nav.blockingTab?.guests,
  );
  check(
    `${loc}: the Blocking page's sentences are translated`,
    !!nav.blockingPage?.intro && !!nav.blockingPage?.onlyAllowedPrefix,
  );
  check(
    `${loc}: the Firewall page's key sentences are translated`,
    !!nav.firewallPage?.intro &&
      !!nav.firewallPage?.apply &&
      !!nav.firewallPage?.bandMissing &&
      !!nav.firewallPage?.status?.pending &&
      !!nav.firewallPage?.status?.active &&
      !!nav.firewallPage?.status?.failed,
  );
  check(
    `${loc}: the Web filtering page's key sentences are translated`,
    !!nav.webFilteringPage?.intro &&
      !!nav.webFilteringPage?.enableWhat &&
      !!nav.webFilteringPage?.enableSafety &&
      !!nav.webFilteringPage?.bypassBody &&
      !!nav.webFilteringPage?.err?.notSetUp &&
      ["active", "disabled", "pending", "failed"].every((s) => !!nav.webFilteringPage?.state?.[s]),
  );
}
{
  // Every Web filtering key in English exists in Hindi, nested included.
  const keys = (o, pre = "") =>
    Object.entries(o ?? {}).flatMap(([k, v]) =>
      v && typeof v === "object" ? keys(v, `${pre}${k}.`) : [`${pre}${k}`],
    );
  const read = (loc) =>
    JSON.parse(readFileSync(join(ROOT, `src/lib/i18n/locales/${loc}/nav.json`), "utf8"))
      .webFilteringPage;
  const missing = keys(read("en")).filter((k) => !keys(read("hi")).includes(k));
  check("hi has every Web filtering key en has", missing.length === 0, missing.join(", "));
}
// The rename in #216 reached customerNav.ts but not the locale, so the
// translated label still read "Connection Tools" -- which is what a customer
// with the en bundle loaded actually saw, since t() prefers the resource over
// the hardcoded fallback. The sidebar reads this key for every row.
{
  const en = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/en/nav.json"), "utf8"));
  check(
    "the en label agrees with the code label for the fix-it page",
    en.customerItem.debugging === "Fix a Problem",
    en.customerItem.debugging,
  );
}

console.log(
  failures === 0
    ? `\nall customer nav shell checks passed\n`
    : `\n${failures} customer nav shell check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
