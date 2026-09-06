/**
 * Regression test for the customer navigation shell.
 *
 * WHERE THIS CAME FROM
 * --------------------
 * This replaces `test-customer-destinations.mjs`, which pinned a structure
 * that no longer exists: 26 features folded into nine "destinations", the
 * other seventeen reachable as tabs. That grouping was reverted -- the
 * sidebar offers all 26 in their seven groups again -- so those assertions
 * were not failing usefully, they were describing a deleted module. They are
 * deleted with it. (The count is 25 today: the "Notifications" preferences
 * screen was removed from the customer dashboard along with its nav entry;
 * see test-customer-nav-permissions.mjs's own note.)
 *
 * What is NOT deleted is everything that shipped in the same commit but was
 * never about the grouping, because each of those fixed a real defect and
 * losing it would be a regression on top of a revert. Those assertions are
 * kept verbatim where they still apply and inverted where the expression
 * they named moved back:
 *
 *   1. THE MENU IS THE 25 AGAIN. Seven groups, every feature its own row,
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
// 1. The menu is the 25 again.
// ---------------------------------------------------------------------------

console.log("\nthe customer menu is 25 features in seven groups");

check("there are seven groups", CUSTOMER_NAV_GROUPS.length === 7, `${CUSTOMER_NAV_GROUPS.length}`);
check("there are 25 features", CUSTOMER_NAVS.length === 25, `${CUSTOMER_NAVS.length}`);
check(
  "the seven groups are the canonical ones",
  CUSTOMER_NAV_GROUPS.map((g) => g.id).join(",") ===
    "overview,engagement,access-policy,devices-team,network,operations,support-logs",
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
  "the sidebar renders the seven groups, not a destination layer",
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
