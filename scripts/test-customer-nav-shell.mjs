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
 *   1. THE MENU IS ALL OF THEM. Every feature is still in `customerNav.ts`
 *      and still reached through the same two filters -- since the
 *      sections-with-tabs change (section 13) as a Home row or as a tab of
 *      one of ten rows, rather than as a row of its own.
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
writeFileSync(
  entry,
  `export * from "${p("src/lib/customerNav.ts")}";
   export * from "${p("src/lib/customerNavPermissions.ts")}";
   export * from "${p("src/lib/customerPaletteFilter.ts")}";`,
);

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
  customerSidebarGroupsForRole,
  customerSidebarEntries,
  customerNavGroupOf,
  featureHasSectionTabs,
  filterNavGroupsByPermissions,
  resolveSectionTabs,
  NAV_PERMISSION_KEYS,
  rankCustomerPaletteMatch,
  customerPaletteFloor,
  sectionTabEntries,
} = await import(`file://${outfile}`);

// ---------------------------------------------------------------------------
// 1. The menu is the 26 again.
// ---------------------------------------------------------------------------

console.log("\nthe customer menu is 30 features in eight sidebar groups plus Account");

// Nine since the Marketing add-on arrived as its own group, directly after
// Engagement (wyfy-specs/guest-marketing-campaigns.md §3.5): outbound guest
// messaging is a paid add-on with its own consent and send lifecycle, not a
// row under the captive-portal Campaigns screen. Eight since Operations
// went: its only row, Fix a Problem, moved up into Overview.
// Then the task-based regroup: seven sidebar groups (Home / Guests / Login
// Page / Network / Security / Help / Logs) plus "Account", which holds only
// Staff Access and never renders in the sidebar (it is in the avatar menu).
// Then sections with tabs (docs/design/nav-consolidation.md): Marketing is
// a group again -- Guest Messaging and Login Page Offers -- so eight sidebar
// groups plus Account.
check("there are nine groups", CUSTOMER_NAV_GROUPS.length === 9, `${CUSTOMER_NAV_GROUPS.length}`);
check(
  "eight of them render in the sidebar",
  customerSidebarGroupsForRole("owner").length === 8,
  `${customerSidebarGroupsForRole("owner").length}`,
);
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
// Then the Marketing add-on's row arrived (27) -- see the group note above.
// Then Security -> Firewall arrived (28): a new screen, not a move -- rules
// that reach the router through cloud-guest#304's push. Section 11 pins it.
// Then Security -> Web Filtering (29): Cloudflare categories, switched on per
// router through cloud-guest#307. Section 12 pins it.
// Then back to 28: Web filtering stopped being its own row and became the
// "Categories" section of Security -> Block Websites, so a venue owner finds
// website blocking in one place. Section 12 pins where it went.
// Asserted rather than derived on purpose -- it is what catches a row being
// dropped by an unrelated refactor -- so moving it is a deliberate step, and
// this is one.
// Then Network -> Traffic Lens (29): the paid add-on's own row, owner-only
// (wyfy-specs/flow-visibility/PRODUCT.md C1). scripts/test-traffic-flow.mjs
// pins where it sits and what gates it.
// Then Support & Logs -> NetLogs (30): the customer's own router + sign-in
// log lines (cloud-guest#420), gated on `network_logs.read`.
// scripts/test-netlogs.mjs pins where it sits and what gates it.
// Still 30 after the task-based regroup: Staff Access left the sidebar for
// the avatar menu but stays a feature (route, palette, permission gate).
check("there are 30 features", CUSTOMER_NAVS.length === 30, `${CUSTOMER_NAVS.length}`);
// Nine until Operations went: its only row, Fix a Problem, moved up into
// Overview (section 7 pins where), and a group of nothing is not kept.
check(
  "the nine groups are the canonical ones",
  CUSTOMER_NAV_GROUPS.map((g) => g.id).join(",") ===
    "overview,guests,marketing,login-page,network,security,logs,help,account",
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
  "the sidebar renders the nav groups, not a destination layer",
  /customerSidebarGroupsForRole\(/.test(sidebarCode) &&
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
// A Hindi session saw English names in the palette beside a Hindi sidebar.
// Same keys as the sidebar, and the English names stay searchable.
const paletteCode = strip(palette);
check(
  "the palette labels rows and groups from the sidebar's nav keys",
  /useTranslation\("nav", \{ i18n \}\)/.test(paletteCode) &&
    /t\(`customerItem\.\$\{item\.id\}`, item\.label\)/.test(paletteCode) &&
    /t\(`customerGroup\.\$\{group\.id\}`, group\.label\)/.test(paletteCode),
);
check(
  "the palette matches on the translated AND the English names, then the synonyms",
  /value=\{`\$\{label\} \$\{groupLabel\} \$\{item\.label\} \$\{group\.label\}`\}/.test(
    paletteCode,
  ) && /keywords=\{item\.keywords \? \[\.\.\.item\.keywords\] : undefined\}/.test(paletteCode),
);
check(
  "the palette ranks with customerPaletteFilter and shows only the best band",
  /<Command\s+filter=\{filter\}/.test(paletteCode) &&
    /customerPaletteFloor\(\s*search,/.test(paletteCode) &&
    /rankCustomerPaletteMatch\(value, s, keywords\)/.test(paletteCode) &&
    /return score >= floor \? score : 0/.test(paletteCode) &&
    /value=\{search\}/.test(paletteCode) &&
    /onValueChange=\{setSearch\}/.test(paletteCode),
);
check(
  "every palette entry is a screen, by its own label (not one entry per section)",
  /group\.items\.map\(\(item\)/.test(paletteCode) && /<span>\{label\}<\/span>/.test(paletteCode),
);
check(
  "the palette renders no untranslated label",
  !/>\{item\.label\}</.test(paletteCode) &&
    !/>\{group\.label\}</.test(paletteCode) &&
    !/heading=\{group\.label\}/.test(paletteCode),
);
for (const loc of ["en", "hi"]) {
  const cp = JSON.parse(
    readFileSync(join(ROOT, `src/lib/i18n/locales/${loc}/nav.json`), "utf8"),
  ).commandPalette;
  check(
    `${loc}: the palette's own strings are translated`,
    !!cp?.placeholder && !!cp?.empty && !!cp?.trigger,
  );
}
// The avatar menu was a useState toggle: no Escape, no outside click, no
// aria-expanded, no focus handling. The Radix primitive brings all four.
const headerCode = strip(
  readFileSync(join(ROOT, "src/components/customer/CustomerHeader.tsx"), "utf8"),
);
check(
  "the avatar menu is the Radix DropdownMenu, with a named trigger",
  headerCode.includes('from "@/components/ui/dropdown-menu"') &&
    /<DropdownMenuTrigger[^>]*aria-label="Account menu"/.test(headerCode) &&
    !/setMenu\(/.test(headerCode),
);
check(
  "every account action is a menu item, in the same order",
  ["onSwitchLocation", "onChangePassword", "onTfaSettings", "onLogout"]
    .map((h) => headerCode.indexOf(`onSelect={${h}}`))
    .every((i, n, all) => i > 0 && (n === 0 || i > all[n - 1])),
);
// Staff Access left the sidebar for this menu; it must be offered by the
// same role + permission gate the sidebar row used, and link to the same
// route.
check(
  "the avatar menu offers Staff access, gated like the old sidebar row",
  /filterNavGroupsByPermissions\(\s*customerNavGroupsForRole\(getCustomerLoginRole\(\)\),\s*permissions,?\s*\)/.test(
    headerCode,
  ) &&
    /item\.id === "agents"/.test(headerCode) &&
    /\{showStaffAccess && \(/.test(headerCode) &&
    /customerFeatureHref\("agents"\)/.test(headerCode),
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
// The task-based regroup: group membership, Logs collapsed, Staff Access off
// the rail but still a feature.
// ---------------------------------------------------------------------------

console.log("\nthe sidebar is grouped by task");

{
  const rows = (groups) =>
    groups.map((g) => `${g.id}=${g.items.map((i) => i.id).join(",")}`).join(" | ");
  check(
    "owner sidebar groups and rows are the pinned ones",
    rows(customerSidebarGroupsForRole("owner")) ===
      [
        "overview=dashboard,alerts,debugging",
        "guests=users,teams,vouchers,reports",
        "marketing=campaigns,marketing",
        "login-page=portal,business-hours",
        "network=devices,isp-details,traffic-lens,dhcp,vlans,port-forwarding,voip",
        "security=security,blocking,firewall,policies,whitelist,mac-auth",
        "logs=admin-logs,network-activity,netlogs",
        "help=tickets,how-it-works",
      ].join(" | "),
    rows(customerSidebarGroupsForRole("owner")),
  );
  check(
    "Staff Access is not a sidebar row for anyone",
    ["owner", "agent"].every(
      (r) => !customerSidebarGroupsForRole(r).some((g) => g.items.some((i) => i.id === "agents")),
    ),
  );
  const agents = CUSTOMER_NAVS.find((n) => n.id === "agents");
  check(
    "...but is still a known, owner-only feature at /agents",
    agents && agents.roles.join(",") === "owner" && customerFeatureHref("agents") === "/agents",
  );
  check(
    "...and the palette's grouped list still offers it to owners",
    customerNavGroupsForRole("owner").some((g) => g.items.some((i) => i.id === "agents")),
  );
  check(
    "no sidebar group is left empty for staff",
    customerSidebarGroupsForRole("agent").every((g) => g.items.length > 0),
  );
  // Logs used to be the one collapsible group (closed by default, so its
  // three rows did not push the rail past a laptop's fold). As one section
  // row there is nothing left to collapse, and a disclosure around a single
  // row would be a click that reveals one link. Retired, not left dangling.
  check(
    "Logs is one row now, so the collapsible-group machinery is gone",
    !/COLLAPSIBLE_GROUP_IDS/.test(sidebarCode) &&
      !/CollapsibleTrigger/.test(sidebarCode) &&
      !/groupOpenStorageKey/.test(sidebarCode),
  );
}

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
  /filterNavGroupsByPermissions\(customerSidebarGroupsForRole\(role\), permissions\)/.test(
    howItWorks,
  ),
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
// It is what an owner opens when the WiFi is down. As the only row of an
// "Operations" group near the bottom it sat below the fold on a laptop, so
// it lives in Home -- for both roles, since both render Home first -- as
// the third of the three "something is wrong" rows: Dashboard, Alerts, Fix a
// Problem.
for (const role of ["owner", "agent"]) {
  const overview = customerNavGroupsForRole(role)[0];
  check(
    `${role}: Home is Dashboard, Alerts, Fix a Problem`,
    overview?.id === "overview" &&
      overview.items.map((i) => i.id).join(",") === "dashboard,alerts,debugging",
    overview ? `${overview.id}: ${overview.items.map((i) => i.id).join(",")}` : "no groups",
  );
}

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
    "the Security group is Security Score, Block Websites, Firewall, then who-may-connect",
    security &&
      security.items.map((i) => i.id).join(",") ===
        "security,blocking,firewall,policies,whitelist,mac-auth",
    security ? security.items.map((i) => i.id).join(",") : "missing",
  );
  const score = CUSTOMER_NAVS.find((n) => n.id === "security");
  check(
    "the Security group's first row is Security Score, not a second Overview",
    score && score.label === "Security Score",
  );
  // Fix a Problem joined Overview from the retired Operations group (section
  // 7); the task-based regroup then moved Guests and Reports to the Guests
  // group and Alerts up under Dashboard.
  check(
    "the Home group's rows are pinned",
    (CUSTOMER_NAV_GROUPS.find((g) => g.id === "overview")?.items ?? [])
      .map((i) => `${i.id}:${i.label}`)
      .join(",") === "dashboard:Dashboard,alerts:Alerts,debugging:Fix a Problem",
  );
  const blocking = CUSTOMER_NAVS.find((n) => n.id === "blocking");
  // "Blocking", not "Block Websites": the page blocks guests and devices too
  // (lib/blocking.ts's two tabs). Same id, same URL.
  check("Blocking is labelled for the job", blocking && blocking.label === "Blocking");
  check(
    "the Blocking page really does cover guests (the rename's premise)",
    /id: "guests"/.test(readFileSync(join(ROOT, "src/lib/blocking.ts"), "utf8")),
  );
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
    "the Network section is Devices, the uplink and Traffic Lens, then the four Advanced settings",
    (CUSTOMER_NAV_GROUPS.find((g) => g.id === "network")?.items ?? [])
      .map((i) => `${i.id}${i.tabMenu ? `[${i.tabMenu.id}]` : ""}${i.tabGroup ? "|" : ""}`)
      .join(",") ===
      "devices,isp-details,traffic-lens,dhcp[advanced],vlans[advanced],port-forwarding[advanced],voip[advanced]",
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
    "the Websites tab leads with the type-a-name box, once per writable router",
    // One box per router through PerRouter, which the Apps section shares.
    /<WebsiteBlockBox routerId=\{id\}/.test(view) &&
      /\{render\(router\.id\)\}/.test(view) &&
      /partitionRoutersByDeviceWrite\(rows\)/.test(view) &&
      /<ControllerRoutersNote\b/.test(view),
  );
  check(
    "then the Cloudflare categories, as the existing Web filtering screen",
    /<WebFilteringView\b/.test(view) &&
      view.indexOf("<WebsiteBlockBox") > -1 &&
      view.indexOf("<WebsiteBlockBox") < view.indexOf("<WebFilteringView"),
  );
  check(
    "with the per-app switches between the two, on the same routers",
    /<AppBlockBox routerId=\{id\}/.test(view) &&
      view.indexOf("<WebsiteBlockBox") < view.indexOf("<AppBlockBox") &&
      view.indexOf("<AppBlockBox") < view.indexOf("<WebFilteringView"),
  );
  check(
    "and keeps the full rule list (and address blocking) under a folded Advanced",
    /<CollapsibleContent[^>]*>\s*<ContentFilterManagement\b/.test(view) &&
      view.indexOf("<WebFilteringView") < view.indexOf("<ContentFilterManagement"),
  );
  const firewallView = strip(
    readFileSync(join(ROOT, "src/components/security/FirewallView.tsx"), "utf8"),
  );
  check(
    "Firewall no longer blocks websites, and points owners at Block Websites",
    !/WebsiteBlockBox/.test(firewallView) && /<Link to="\/blocking"/.test(firewallView),
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
    "the Security Score links website, app, harmful-site, category, address and device blocking to it",
    linkedKeys.sort().join(",") ===
      "application_control,device_isolation,domain_blocking_dns,ip_and_cidr_blocking,threat_intelligence,web_category_filtering",
    linkedKeys.join(","),
  );
  check(
    "and links zone-to-zone firewalling, the flood limit and guest isolation to Security -> Firewall, and nothing else there",
    linkedTo("/firewall").sort().join(",") ===
      "connection_flood_protection,guest_client_isolation,zone_to_zone_firewall",
    linkedTo("/firewall").join(","),
  );
  check(
    "and links nothing to the retired /web-filtering address",
    linkedTo("/web-filtering").length === 0 && !/to="\/web-filtering"/.test(overview),
  );
  check(
    "and never renders the not-supported group to a customer",
    !/availability:\s*"not_supported"/.test(strip(overview)),
  );
  check(
    "and names capabilities in plain words, not the backend's",
    /PLAIN_LABEL\[feature\.key\]/.test(overview) &&
      !/"IP and CIDR blocking"|"Rogue DHCP detection"|"Zone-to-zone firewall"/.test(
        strip(overview),
      ),
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
// 12. Web Filtering: Cloudflare categories, now a section of Block Websites.
// ---------------------------------------------------------------------------

console.log(
  "\nWeb filtering is the Categories section of Block Websites, gated at controller venues",
);

{
  check(
    "Web filtering is not a row of its own any more",
    !CUSTOMER_NAVS.some((n) => n.id === "web-filtering"),
    "two rows for blocking a website is two places to look",
  );
  const routeSrc = strip(readFileSync(join(ROOT, "src/routes/web-filtering.tsx"), "utf8"));
  check(
    "/web-filtering redirects to the Categories section of the Websites tab",
    /redirect\(\{\s*to:\s*"\/blocking",\s*search:\s*\{\s*tab:\s*"websites"\s*\},\s*hash:\s*"categories"/.test(
      routeSrc,
    ),
  );
  check(
    "and still checks the session before it redirects",
    routeSrc.indexOf("requireCustomerSession") > -1 &&
      routeSrc.indexOf("requireCustomerSession") < routeSrc.indexOf("redirect({") &&
      !/CustomerFeaturePage/.test(routeSrc),
  );
  const view = strip(
    readFileSync(join(ROOT, "src/components/security/WebFilteringView.tsx"), "utf8"),
  );
  check(
    "the screen talks to the backend only through its hooks",
    /from "@\/hooks\/useDnsFiltering"/.test(view) && !/api\.(get|post|put|delete)\(/.test(view),
  );
  check(
    "the screen gates itself with the Websites tab's own controller id",
    /<ControllerManagedFeatureNotice\b/.test(view) &&
      /featureAppliesToControllerVenue\("website-blocking"\)/.test(view),
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
  check("the owner shell no longer mounts it on its own", !/<WebFilteringView\b/.test(shellSrc));
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

// ---------------------------------------------------------------------------
// 13. Sections with tabs (docs/design/nav-consolidation.md).
//
// The owner asked for fewer sidebar rows. The last time this was tried (#219)
// it was reverted (#220) because screens got harder to find, so this pins the
// new shape AND every way the old one could still be reached: by URL, by the
// palette under their own names, and by a tab shown exactly when its row
// would have been.
// ---------------------------------------------------------------------------

console.log(
  "\nthe sidebar is ten rows, and every screen is still a tab, a URL and a palette entry",
);

{
  const rowIds = (role) =>
    customerSidebarEntries(customerSidebarGroupsForRole(role)).map((e) =>
      e.kind === "item" ? e.item.id : `[${e.group.id}]`,
    );
  check(
    "owner: the ten rows are the pinned ones",
    rowIds("owner").join(",") ===
      "dashboard,alerts,debugging,[guests],[marketing],[login-page],[network],[security],[logs],[help]",
    rowIds("owner").join(","),
  );
  check(
    "agent: eight rows (no Login Page or Security tabs for a staff sign-in)",
    rowIds("agent").join(",") ===
      "dashboard,alerts,debugging,[guests],[marketing],[network],[logs],[help]",
    rowIds("agent").join(","),
  );
  check(
    "only Home is rows; every other sidebar group is one tabbed section with an icon",
    CUSTOMER_NAV_GROUPS.filter((g) => g.presentation === "rows")
      .map((g) => g.id)
      .join(",") === "overview" &&
      CUSTOMER_NAV_GROUPS.filter((g) => g.id !== "overview" && g.id !== "account").every(
        (g) => g.presentation === undefined && typeof g.icon === "function",
      ),
  );
  // The rail shows icons only: the ten row glyphs must differ.
  const glyphs = customerSidebarEntries(customerSidebarGroupsForRole("owner")).map((e) =>
    e.kind === "item" ? e.item.icon.name : e.group.icon.name,
  );
  const dupGlyphs = glyphs.filter((g, i) => glyphs.indexOf(g) !== i);
  check("no two sidebar rows share a glyph", dupGlyphs.length === 0, dupGlyphs.join(", "));

  // Nothing became unreachable. For each role, every feature the old menu
  // offered as a row is now: a Home row or a tab of a row that is present,
  // a URL, and a palette entry under its own id.
  for (const role of ["owner", "agent"]) {
    const groups = customerSidebarGroupsForRole(role);
    const entries = customerSidebarEntries(groups);
    const palette = customerNavGroupsForRole(role).flatMap((g) => g.items.map((i) => i.id));
    const lost = [];
    for (const g of groups) {
      for (const item of g.items) {
        const asRow = entries.some((e) => e.kind === "item" && e.item.id === item.id);
        const asTab = entries.some(
          (e) => e.kind === "section" && e.group.items.some((i) => i.id === item.id),
        );
        const model = resolveSectionTabs(
          item.id,
          CUSTOMER_NAV_GROUPS,
          groups,
          null,
          customerFeatureHref,
        );
        const tabShown = model.tabs.some((i) => i.id === item.id) || model.tabs.length === 0;
        if (!(asRow || asTab) || !tabShown || !palette.includes(item.id)) lost.push(item.id);
        if (!customerFeatureHref(item.id).startsWith("/")) lost.push(`${item.id}(href)`);
      }
    }
    check(
      `${role}: every offered screen is a row or a tab, a URL and a palette entry`,
      lost.length === 0,
      lost.join(", "),
    );
  }
  check(
    "the palette still holds all 30 screens for an owner (Staff Access included)",
    customerNavGroupsForRole("owner").flatMap((g) => g.items).length === 30,
  );

  // Section rows open the first tab the caller can see -- per tab, by the
  // same permission filter the rows used.
  check(
    "a section row links to its first visible tab",
    /href = customerFeatureHref\(tabs\[0\]\.id\)/.test(sidebarCode),
  );
  {
    const onlyOffers = filterNavGroupsByPermissions(customerSidebarGroupsForRole("owner"), [
      "dashboard.view",
      "campaigns.read",
    ]);
    const mk = onlyOffers.find((g) => g.id === "marketing");
    check(
      "a role holding only campaigns.read gets Marketing with one tab, opening Login Page Offers",
      mk &&
        mk.items.map((i) => i.id).join(",") === "campaigns" &&
        customerFeatureHref(mk.items[0].id) === "/guest-campaigns",
    );
    check(
      "a section whose tabs are all filtered out is dropped",
      !onlyOffers.some((g) =>
        ["guests", "network", "security", "logs", "login-page"].includes(g.id),
      ),
      onlyOffers.map((g) => g.id).join(","),
    );
    check(
      "how-it-works (no permission key) keeps Help alive for any grant set",
      onlyOffers.some(
        (g) => g.id === "help" && g.items.map((i) => i.id).join(",") === "how-it-works",
      ),
    );
  }

  // A screen opened by URL that its tab bar would not offer.
  const owner = customerSidebarGroupsForRole("owner");
  const agent = customerSidebarGroupsForRole("agent");
  {
    const m = resolveSectionTabs("guest-x", CUSTOMER_NAV_GROUPS, owner, null, customerFeatureHref);
    check("an unknown id has no tab bar", m.section === null && m.redirectTo === null);
  }
  for (const id of ["dashboard", "alerts", "debugging", "agents"]) {
    const m = resolveSectionTabs(id, CUSTOMER_NAV_GROUPS, owner, null, customerFeatureHref);
    check(
      `${id}: no tab bar (Home row / avatar menu)`,
      m.section === null && m.tabs.length === 0 && !featureHasSectionTabs(id),
    );
  }
  check(
    "every other sidebar screen has a tab bar",
    CUSTOMER_NAV_GROUPS.filter((g) => g.id !== "overview" && g.id !== "account")
      .flatMap((g) => g.items)
      .every((i) => featureHasSectionTabs(i.id)),
  );
  {
    const m = resolveSectionTabs("vouchers", CUSTOMER_NAV_GROUPS, owner, null, customerFeatureHref);
    check(
      "Guests › Vouchers: the four Guests tabs, no redirect, while grants are unknown",
      m.section?.id === "guests" &&
        m.tabs.map((i) => i.id).join(",") === "users,teams,vouchers,reports" &&
        m.redirectTo === null,
    );
  }
  {
    // Real grants exclude vouchers but allow guests: leave for the first
    // visible tab instead of rendering a screen the backend will refuse.
    const m = resolveSectionTabs(
      "vouchers",
      CUSTOMER_NAV_GROUPS,
      owner,
      ["guest_users.read", "reports.read"],
      customerFeatureHref,
    );
    check(
      "hidden by real grants -> redirect to the first visible tab",
      m.redirectTo === "/users" && !m.tabs.some((i) => i.id === "vouchers"),
      JSON.stringify({ r: m.redirectTo, t: m.tabs.map((i) => i.id) }),
    );
  }
  {
    // Nothing else in the section is visible either: render as before,
    // never a blank page or a bounce loop.
    const m = resolveSectionTabs(
      "voip",
      CUSTOMER_NAV_GROUPS,
      owner,
      ["dashboard.view"],
      customerFeatureHref,
    );
    check(
      "hidden by real grants with the whole section hidden -> render, no redirect",
      m.redirectTo === null && m.tabs.map((i) => i.id).join(",") === "voip",
    );
  }
  {
    // The login-role radio is not authorization: an agent sign-in that
    // opens /guest-portal sees the page, with its own tab in the bar.
    const m = resolveSectionTabs("portal", CUSTOMER_NAV_GROUPS, agent, null, customerFeatureHref);
    check(
      "hidden only by the login role -> render, with its own tab shown",
      m.redirectTo === null && m.tabs.map((i) => i.id).join(",") === "portal",
    );
    const n = resolveSectionTabs("dhcp", CUSTOMER_NAV_GROUPS, agent, null, customerFeatureHref);
    check(
      "...and it sits in its canonical place among the visible tabs",
      n.redirectTo === null && n.tabs.map((i) => i.id).join(",") === "devices,dhcp",
      n.tabs.map((i) => i.id).join(","),
    );
  }
  {
    // Empty / failed / loading grants mean "we don't know": no redirect.
    const ok = [null, undefined, []].every(
      (perms) =>
        resolveSectionTabs("firewall", CUSTOMER_NAV_GROUPS, owner, perms, customerFeatureHref)
          .redirectTo === null,
    );
    check("absent, failed or empty grants never redirect", ok);
  }

  // The tab bar component and where it renders.
  const tabsSrc = readFileSync(
    join(ROOT, "src/components/customer/console/SectionTabs.tsx"),
    "utf8",
  );
  const tabsCode = strip(tabsSrc);
  check(
    "SectionTabs evaluates the sidebar's own filters",
    /resolveSectionTabs\(/.test(tabsCode) &&
      /customerSidebarGroupsForRole\(getCustomerLoginRole\(\)\)/.test(tabsCode) &&
      /useMyPermissions\(\)/.test(tabsCode),
  );
  check(
    "tabs are links to the unchanged URLs, with aria-current, inside a labelled nav",
    /<nav/.test(tabsCode) &&
      /aria-label=/.test(tabsCode) &&
      /<Link/.test(tabsCode) &&
      /to=\{customerFeatureHref\(item\.id\)\}/.test(tabsCode) &&
      /aria-current=\{active \? "page" : undefined\}/.test(tabsCode) &&
      !/role="tablist"/.test(tabsCode),
  );
  check(
    "the redirect replaces history (back does not bounce)",
    /navigate\(\{ to: redirectTo, replace: true \}\)/.test(tabsCode),
  );
  check(
    "tabs keep the add-on lock badge and the controller-venue muting",
    /GUEST_MARKETING_FEATURE_KEY/.test(tabsCode) &&
      /TRAFFIC_LENS_FEATURE_KEY/.test(tabsCode) &&
      /featureAppliesToControllerVenue\(item\.id, controllerVendor\)/.test(tabsCode) &&
      /title=\{viaController \? controllerReason : undefined\}/.test(tabsCode),
  );
  check("tabs have a visible focus ring", /focus-visible:ring-2/.test(tabsCode));
  const featurePage = strip(
    readFileSync(join(ROOT, "src/components/customer/CustomerFeaturePage.tsx"), "utf8"),
  );
  const usersPage = strip(readFileSync(join(ROOT, "src/routes/users.tsx"), "utf8"));
  // Screens migrated to the console PageHeader (OWN_PAGE_HEADER_FEATURES)
  // draw their own single header from the shell's `pageScope`; every other
  // feature page, and a migrated screen replaced by the controller notice,
  // still gets the scope line directly under the tab bar.
  check(
    "every feature page and /users render the tab bar above the scope line (or the screen's own PageHeader)",
    /<SectionTabs featureId=\{feature\} \/>\s*(?:\{\s*\}\s*)?\{!ownPageHeader && \(\s*<CustomerPageScope/.test(
      featurePage,
    ) &&
      /const ownPageHeader = OWN_PAGE_HEADER_FEATURES\.has\(feature\) && !controllerGated;/.test(
        featurePage,
      ) &&
      // /users is its own route: it draws its own one PageHeader from the
      // same nav label + venue, directly under its tab bar.
      /<SectionTabs featureId="users" \/>\s*<PageHeader\s+title=\{pageScope\.title\}\s+venue=\{pageScope\.venue\}/.test(
        usersPage,
      ) &&
      /const pageScope = useCustomerPageScope\("users", activeLocation\?\.name\);/.test(
        usersPage,
      ) &&
      (usersPage.match(/<PageHeader\b/g) ?? []).length === 1 &&
      !/<CustomerPageScope\b/.test(usersPage),
  );
  {
    const scopeSrc = strip(scope);
    const own = [
      ...(
        scopeSrc.match(/OWN_PAGE_HEADER_FEATURES[^=]*=\s*new Set\(\[([^\]]*)\]/)?.[1] ?? ""
      ).matchAll(/"([^"]+)"/g),
    ].map((m) => m[1]);
    const VIEW = {
      alerts: ["AlertsView", "src/components/features/AlertsView.tsx"],
      dhcp: ["DhcpView", "src/components/network/DhcpManagement.tsx"],
      vlans: ["VlansView", "src/components/network/VlanManagement.tsx"],
      "port-forwarding": [
        "PortForwardingView",
        "src/components/network/PortForwardingManagement.tsx",
      ],
      voip: ["VoipView", "src/components/network/QosManagement.tsx"],
      // batch 2. A third element names the function to read when one file
      // holds several screens; Fix a Problem's header lives in FixAProblem,
      // which DebuggingView forwards the scope to (checked below).
      debugging: ["DebuggingView", "src/components/customer/FixAProblem.tsx"],
      teams: ["ManageTeamsPage", "src/components/features/ManageTeamsPage.tsx"],
      vouchers: ["VouchersPage", "src/components/features/VouchersPage.tsx"],
      reports: ["UserReports", "src/components/features/UserReports.tsx"],
      "business-hours": [
        "OpenHoursView",
        "src/components/features/OperationsFeatures.tsx",
        "OpenHoursView",
      ],
      "admin-logs": [
        "AdminLogsView",
        "src/components/features/OperationsFeatures.tsx",
        "AdminLogsView",
      ],
      "mac-auth": ["MacAuthView", "src/components/features/OperationsFeatures.tsx", "MacAuthView"],
      // batch 3b
      "traffic-lens": ["TrafficLensView", "src/components/traffic-lens/TrafficLensView.tsx"],
      marketing: ["MarketingView", "src/components/marketing/MarketingView.tsx"],
      campaigns: ["CampaignsPage", "src/components/features/CampaignsPage.tsx"],
    };
    // One screen's source: the whole file, or just `export function <fn>`
    // up to the next top-level export.
    const screenSource = (file, fn) => {
      const all = strip(readFileSync(join(ROOT, file), "utf8"));
      if (!fn) return all;
      const start = all.indexOf(`export function ${fn}(`);
      if (start < 0) return "";
      const next = all.indexOf("\nexport ", start + 1);
      return all.slice(start, next < 0 ? undefined : next);
    };
    check(
      "every screen that skips the scope line is handed the scope and draws one PageHeader",
      own.length > 0 &&
        own.every((id) => {
          const [view, file, fn] = VIEW[id] ?? [];
          if (!view) return false;
          const src = screenSource(file, fn);
          return (
            new RegExp(`<${view}\\b[^>]*scope=\\{pageScope\\}`).test(featurePage) &&
            (src.match(/<PageHeader\b/g) ?? []).length === 1 &&
            /venue=\{scope\?\.venue\}/.test(src)
          );
        }),
    );
    check(
      "Fix a Problem's DebuggingView forwards the shell's scope to FixAProblem",
      /<FixAProblem\b[^>]*scope=\{scope\}/.test(
        screenSource("src/components/features/OperationsFeatures.tsx", "DebuggingView"),
      ),
    );
  }
  check(
    "the rail flyout lists a section's tabs",
    /<SectionFlyout/.test(sidebarCode) &&
      /tooltip=\{collapsed \? tooltip : undefined\}/.test(sidebarCode),
  );
  check(
    "a section row is current on any of its pages (even one its filters hid)",
    /customerNavGroupOf\(activeFeatureId\)/.test(sidebarCode) &&
      /active = activeGroupId === group\.id/.test(sidebarCode),
  );
  check(
    "customerNavGroupOf finds every feature's section",
    CUSTOMER_NAVS.every((i) => customerNavGroupOf(i.id)?.items.includes(i)),
  );
  check(
    "the breadcrumb is Section › Tab, from the same groups",
    /t\(`customerGroup\.\$\{crumb\.groupId\}`, crumb\.groupLabel\)/.test(headerCode) &&
      /t\(`customerItem\.\$\{crumb\.itemId\}`, crumb\.itemLabel\)/.test(headerCode),
  );

  // Palette synonyms.
  const kw = (id) => CUSTOMER_NAVS.find((n) => n.id === id)?.keywords ?? [];
  check(
    "typing 'coupon' or 'access code' still finds Vouchers",
    kw("vouchers").includes("coupon") && kw("vouchers").includes("access code"),
  );
  check("typing 'whatsapp' still finds Guest Messaging", kw("marketing").includes("whatsapp"));
  check("typing 'dhcp' still finds IP Addresses", kw("dhcp").includes("dhcp"));
  check(
    "every screen carries synonyms, all lower-case",
    CUSTOMER_NAVS.every(
      (n) =>
        Array.isArray(n.keywords) &&
        n.keywords.length > 0 &&
        n.keywords.every((k) => k === k.toLowerCase()),
    ),
    CUSTOMER_NAVS.filter((n) => !n.keywords?.length)
      .map((n) => n.id)
      .join(","),
  );

  // Palette ranking, run on the real entries the palette builds (same value
  // string, same synonyms, same floor). "Enter opens it" is asserted the
  // strict way: the screen is the single best score AND the first shown entry
  // in menu order, so it holds whether or not cmdk reorders groups.
  for (const loc of ["en", "hi"]) {
    const nav = JSON.parse(
      readFileSync(join(ROOT, `src/lib/i18n/locales/${loc}/nav.json`), "utf8"),
    );
    for (const role of ["owner", "agent"]) {
      const entries = customerNavGroupsForRole(role).flatMap((g) => {
        const groupLabel = nav.customerGroup?.[g.id] ?? g.label;
        return g.items.map((item) => {
          const label = nav.customerItem?.[item.id] ?? item.label;
          return {
            id: item.id,
            label,
            value: `${label} ${groupLabel} ${item.label} ${g.label}`,
            keywords: item.keywords ? [...item.keywords] : undefined,
          };
        });
      });
      const opens = (q) => {
        const floor = customerPaletteFloor(q, entries);
        const shown = entries
          .map((e) => ({ id: e.id, score: rankCustomerPaletteMatch(e.value, q, e.keywords) }))
          .filter((e) => e.score > 0 && e.score >= floor);
        if (!shown.length) return null;
        const best = Math.max(...shown.map((e) => e.score));
        const top = shown.filter((e) => e.score === best);
        return top[0].id === shown[0].id ? shown[0].id : `${shown[0].id}|best:${top[0].id}`;
      };
      const wrong = entries
        .map((e) => [e.label, e.id, opens(e.label)])
        .filter(([, id, got]) => got !== id)
        .map(([l, id, got]) => `"${l}"->${got} (want ${id})`);
      check(
        `${loc}/${role}: typing any screen's own name opens that screen`,
        wrong.length === 0,
        wrong.join("; "),
      );
      if (loc === "en") {
        const want = {
          vouchers: "vouchers",
          voucher: "vouchers",
          coupon: "vouchers",
          "access code": "vouchers",
          whatsapp: "marketing",
          reports: "reports",
          netlogs: "netlogs",
          dhcp: role === "owner" ? "dhcp" : null,
          "port forwarding": role === "owner" ? "port-forwarding" : null,
        };
        const bad = Object.entries(want)
          .filter(([, id]) => id)
          .filter(([q, id]) => opens(q) !== id)
          .map(([q, id]) => `"${q}"->${opens(q)} (want ${id})`);
        check(
          `${role}: synonyms and short names open the right tab`,
          bad.length === 0,
          bad.join("; "),
        );
      }
    }
  }
  check(
    "a typo still finds something (fuzzy fallback survives the floor)",
    (() => {
      const e = [{ value: "Vouchers Guests Vouchers Guests" }];
      const f = customerPaletteFloor("vchrs", e);
      const sc = rankCustomerPaletteMatch(e[0].value, "vchrs");
      return sc > 0 && sc >= f;
    })(),
  );

  // Every new label is translated.
  for (const loc of ["en", "hi"]) {
    const nav = JSON.parse(
      readFileSync(join(ROOT, `src/lib/i18n/locales/${loc}/nav.json`), "utf8"),
    );
    const help = JSON.parse(
      readFileSync(join(ROOT, `src/lib/i18n/locales/${loc}/help.json`), "utf8"),
    );
    const missingGroups = CUSTOMER_NAV_GROUPS.map((g) => g.id).filter(
      (id) => !nav.customerGroup?.[id],
    );
    check(`${loc}: every section has a label`, missingGroups.length === 0, missingGroups.join(","));
    const missingItems = CUSTOMER_NAVS.map((n) => n.id).filter((id) => !nav.customerItem?.[id]);
    check(`${loc}: every screen has a label`, missingItems.length === 0, missingItems.join(","));
    const tabGroups = CUSTOMER_NAVS.filter((n) => n.tabGroup).map((n) => n.tabGroup.id);
    check(
      `${loc}: every tab sub-group has a label`,
      tabGroups.length === 1 && tabGroups.every((id) => !!nav.customerTabGroup?.[id]),
    );
    const tabMenus = CUSTOMER_NAVS.filter((n) => n.tabMenu).map((n) => n.tabMenu.id);
    check(
      `${loc}: every dropdown tab has a label`,
      tabMenus.length === 4 && tabMenus.every((id) => !!nav.customerTabMenu?.[id]),
    );
    check(
      `${loc}: the tab bar's accessible name is translated`,
      /\{\{section\}\}/.test(nav.sectionTabs?.label ?? ""),
    );
    const missingHelp = customerSidebarGroupsForRole("owner")
      .map((g) => g.id)
      .filter((id) => !help.group?.[id]);
    check(
      `${loc}: How It Works describes every section`,
      missingHelp.length === 0,
      missingHelp.join(","),
    );
  }
  check(
    "every permission key still belongs to a feature that exists",
    Object.keys(NAV_PERMISSION_KEYS).every((id) => CUSTOMER_NAVS.some((n) => n.id === id)),
  );
}

// ---------------------------------------------------------------------------
// 14. Owner decisions of 2026-10-31: Offers first in Marketing, Network's
//     installer tabs in one "Advanced" dropdown, and an Unblock path the
//     front desk can find.
// ---------------------------------------------------------------------------

console.log("\nOffers first, one Advanced dropdown, and unblock is findable");

{
  const owner = customerSidebarGroupsForRole("owner");
  const agent = customerSidebarGroupsForRole("agent");
  const ownerMk = owner.find((g) => g.id === "marketing");
  check(
    "Marketing opens Login Page Offers first for an owner, Guest Messaging second",
    ownerMk && ownerMk.items.map((i) => i.id).join(",") === "campaigns,marketing",
  );
  const agentMk = agent.find((g) => g.id === "marketing");
  check(
    "staff, who cannot see Offers, still land on Guest Messaging",
    agentMk &&
      agentMk.items.map((i) => i.id).join(",") === "marketing" &&
      customerFeatureHref(agentMk.items[0].id) === "/marketing",
  );
  {
    // Same rule by real grants: a role holding marketing.read but not
    // campaigns.read gets Guest Messaging as its first (only) tab.
    const mk = filterNavGroupsByPermissions(owner, ["dashboard.view", "marketing.read"]).find(
      (g) => g.id === "marketing",
    );
    check(
      "a grant set without campaigns.read opens Marketing on Guest Messaging",
      mk && mk.items[0].id === "marketing",
    );
  }

  // The Advanced dropdown: exactly the four installer screens, in order,
  // with their URLs unchanged, and nothing else folded in.
  const network = owner.find((g) => g.id === "network");
  const entries = sectionTabEntries(network.items);
  check(
    "Network's tab bar is Devices, Internet Connection, Traffic Lens, then ONE Advanced menu",
    entries.map((e) => (e.kind === "menu" ? `menu:${e.menu.id}` : e.item.id)).join(",") ===
      "devices,isp-details,traffic-lens,menu:advanced",
    entries.map((e) => e.kind).join(","),
  );
  const adv = entries.find((e) => e.kind === "menu");
  check(
    "the Advanced menu holds exactly the four installer screens, in order",
    adv && adv.items.map((i) => i.id).join(",") === "dhcp,vlans,port-forwarding,voip",
  );
  check(
    "and every one keeps its own URL",
    adv &&
      adv.items.map((i) => customerFeatureHref(i.id)).join(",") ===
        "/dhcp,/vlans,/port-forwarding,/voip",
  );
  check(
    "only Network has a dropdown tab",
    CUSTOMER_NAV_GROUPS.filter((g) => g.id !== "network").every((g) =>
      sectionTabEntries(g.items).every((e) => e.kind === "tab"),
    ),
  );
  check(
    "a menu survives a permission filter that leaves one of its screens",
    (() => {
      const one = sectionTabEntries(
        network.items.filter((i) => i.id !== "vlans" && i.id !== "voip" && i.id !== "dhcp"),
      );
      return one.length === 4 && one[3].kind === "menu" && one[3].items.length === 1;
    })(),
  );
  check(
    "each Advanced screen is still its own palette entry",
    ["dhcp", "vlans", "port-forwarding", "voip"].every((id) =>
      customerNavGroupsForRole("owner").some((g) => g.items.some((i) => i.id === id)),
    ),
  );

  const tabsCode = strip(
    readFileSync(join(ROOT, "src/components/customer/console/SectionTabs.tsx"), "utf8"),
  );
  check(
    "SectionTabs renders a menu entry as a Radix dropdown on the console surface",
    /sectionTabEntries\(model\.tabs\)/.test(tabsCode) &&
      /<DropdownMenuTrigger asChild>/.test(tabsCode) &&
      /<DropdownMenuContent[\s\S]{0,120}className="wy-console/.test(tabsCode),
  );
  check(
    "the trigger is a real button and reads 'Advanced · <screen>' while one is open",
    /<button\s+type="button"\s+data-tab-menu=/.test(tabsCode) &&
      /data-active=\{current \? "true" : undefined\}/.test(tabsCode) &&
      /tabClass\(!!current\)/.test(tabsCode) &&
      /·/.test(tabsCode),
  );
  check(
    "menu entries are links to the unchanged URLs with aria-current",
    /<DropdownMenuItem key=\{item\.id\} asChild>\s*<Link\s+to=\{customerFeatureHref\(item\.id\)\}\s+aria-current=\{active \? "page" : undefined\}/.test(
      tabsCode,
    ),
  );

  // Unblock: the palette word lands where the caller can act on it.
  const kwOf = (id) => CUSTOMER_NAVS.find((n) => n.id === id)?.keywords ?? [];
  for (const word of ["unblock", "blocked guest", "अनब्लॉक"]) {
    check(
      `palette keyword '${word}' is on Guests and on Blocking`,
      kwOf("users").includes(word) && kwOf("blocking").includes(word),
    );
  }
  {
    const entriesFor = (role) =>
      filterNavGroupsByPermissions(customerNavGroupsForRole(role), null).flatMap((g) =>
        g.items.map((item) => ({
          id: item.id,
          value: `${item.label} ${g.label} ${item.label} ${g.label}`,
          keywords: item.keywords ? [...item.keywords] : undefined,
        })),
      );
    const hits = (role, q) => {
      const es = entriesFor(role);
      const floor = customerPaletteFloor(q, es);
      return es
        .filter(
          (e) =>
            rankCustomerPaletteMatch(e.value, q, e.keywords) >= floor &&
            rankCustomerPaletteMatch(e.value, q, e.keywords) > 0,
        )
        .map((e) => e.id);
    };
    check(
      "staff typing 'unblock' get Guests (the screen they can act on)",
      hits("agent", "unblock").join(",") === "users",
      hits("agent", "unblock").join(","),
    );
    check(
      "staff typing 'blocked guest' get Guests",
      hits("agent", "blocked guest").join(",") === "users",
    );
    check(
      "an owner typing 'unblock' gets Guests and Security › Blocking",
      hits("owner", "unblock").join(",") === "users,blocking",
      hits("owner", "unblock").join(","),
    );
  }

  // Login Page › Portal points at the offers shown on it.
  const portal = strip(readFileSync(join(ROOT, "src/components/features/PortalPage.tsx"), "utf8"));
  check(
    "Portal links to Login Page Offers through the nav's own href",
    /to=\{customerFeatureHref\("campaigns"\)\}/.test(portal) &&
      /Offers shown on this page →/.test(portal),
  );
}

console.log(
  failures === 0
    ? `\nall customer nav shell checks passed\n`
    : `\n${failures} customer nav shell check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
