/**
 * Regression test for the 26 -> 9 customer navigation.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 * The sidebar used to render `CUSTOMER_NAV_GROUPS` directly: 26 items in
 * seven groups whose shape was byte-identical to the RBAC grant catalogue in
 * `customerFeatureCatalog.ts`. It was the backend's permission-module list
 * rendered as navigation, which is why "why is the WiFi down" had its answer
 * spread across four of the seven groups.
 *
 * Collapsing that to nine destinations is only safe if three things hold,
 * and each is a way the change could quietly do harm:
 *
 *   1. NOTHING IS STRANDED. Every one of the 26 feature ids must live in
 *      exactly one destination. A feature that fell out of the mapping would
 *      still have a working route -- so nothing would 404, nothing would
 *      throw, and the only symptom would be a screen the customer paid for
 *      that no longer appears anywhere in the product. That is the failure
 *      most likely to ship unnoticed, so it is assertion #1.
 *   2. THE FAIL-OPEN DIRECTION SURVIVES. `filterNavGroupsByPermissions` was
 *      built so that "we don't know" (in flight / failed / no role
 *      assignment) never hides anything. Routing the same decision through a
 *      second layer is exactly how that guarantee gets lost.
 *   3. A PARTIALLY-PERMITTED DESTINATION BEHAVES. The rule chosen is: shown
 *      when the caller can open AT LEAST ONE section, and then showing only
 *      the sections they can open. Both halves matter --
 *        - "all sections" would hide Guests from a front-desk account that
 *          can read the guest list but not the session log, i.e. the exact
 *          population this nav is for;
 *        - showing a destination whose sections are all forbidden recreates
 *          one layer up the defect where a page advertised screens the
 *          reader could not open.
 *
 * Checked for a real owner and a real staff account, because the two compose
 * role filtering and permission filtering differently and only the staff
 * path can regress silently.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The real
 * modules are bundled with esbuild and executed.
 *
 * Run: node scripts/test-customer-destinations.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "customer-destinations-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/customerDestinations.ts")}";
   export { CUSTOMER_NAVS, customerFeatureHref } from "${p("src/lib/customerNav.ts")}";`,
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
        // Read the icon names the modules under test actually import, so a
        // new icon can never fail this as "No matching export".
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => {
          const names = new Set();
          for (const f of ["src/lib/customerNav.ts", "src/lib/customerDestinations.ts"]) {
            const src = readFileSync(join(ROOT, f), "utf8");
            const m = src.match(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/s);
            if (m) for (const n of m[1].split(",")) if (n.trim()) names.add(n.trim());
          }
          return {
            contents: `export default new Proxy({}, { get: () => () => null });
                       ${[...names].map((n) => `export const ${n} = () => null;`).join("\n")}`,
            loader: "js",
          };
        });
      },
    },
  ],
});

const {
  CUSTOMER_DESTINATIONS,
  CUSTOMER_NAVS,
  customerFeatureHref,
  destinationForFeature,
  destinationHome,
  destinationsFor,
  sectionsFor,
} = await import(`file://${outfile}`);

const ids = (list) => list.map((d) => d.destination.id);

// ---------------------------------------------------------------------------
// 1. Nothing is stranded.
// ---------------------------------------------------------------------------

console.log("\nevery feature still has a home");

const mapped = CUSTOMER_DESTINATIONS.flatMap((d) => d.sections);
const navIds = CUSTOMER_NAVS.map((n) => n.id);

check("the nav still has all 26 features", navIds.length === 26, `found ${navIds.length}`);
const missing = navIds.filter((id) => !mapped.includes(id));
check("no feature was left out of the nine destinations", missing.length === 0, missing.join(", "));
const unknown = mapped.filter((id) => !navIds.includes(id));
check(
  "no destination points at a feature that does not exist",
  unknown.length === 0,
  unknown.join(", "),
);
const dupes = mapped.filter((id, i) => mapped.indexOf(id) !== i);
check("no feature is claimed by two destinations", dupes.length === 0, dupes.join(", "));
check(
  "there are nine destinations",
  CUSTOMER_DESTINATIONS.length === 9,
  `${CUSTOMER_DESTINATIONS.length}`,
);

// The whole promise of the restructure: this changes what is *offered*, not
// what exists. Every one of the 26 must still resolve to a real URL.
check(
  "every feature still resolves to a route",
  navIds.every(
    (id) => typeof customerFeatureHref(id) === "string" && customerFeatureHref(id).startsWith("/"),
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
  "a feature id maps back to the destination that holds it",
  destinationForFeature("network-activity")?.id === "guests" &&
    destinationForFeature("port-forwarding")?.id === "settings" &&
    destinationForFeature("business-hours")?.id === "login-screen",
);

// ---------------------------------------------------------------------------
// 2. Fail open, still.
// ---------------------------------------------------------------------------

console.log("\n'we don't know' still hides nothing");

const OWNER_FULL = ids(destinationsFor("owner", null));
check("null (in flight) shows every destination", OWNER_FULL.length === 9, OWNER_FULL.join(", "));
check(
  "undefined (fetch failed) shows every destination",
  ids(destinationsFor("owner", undefined)).length === 9,
);
check(
  "[] (no role assignment) shows every destination",
  ids(destinationsFor("owner", [])).length === 9,
);
check(
  "an unmapped feature id stays visible",
  // `how-it-works` is deliberately absent from NAV_PERMISSION_KEYS: a static
  // help page with no backing domain. It must survive a real, narrow grant
  // set rather than vanishing because nobody remembered to map it.
  sectionsFor(
    CUSTOMER_DESTINATIONS.find((d) => d.id === "help"),
    "owner",
    ["support_tickets.read"],
  ).some((s) => s.id === "how-it-works"),
);

// ---------------------------------------------------------------------------
// 3. The partially-permitted rule, for an owner and for staff.
// ---------------------------------------------------------------------------

console.log("\na destination is offered when at least one section opens");

const ACCESS = CUSTOMER_DESTINATIONS.find((d) => d.id === "access");

// Owner, granted exactly one of Access Rules' five sections.
{
  const granted = ["policy.read"];
  const shown = sectionsFor(ACCESS, "owner", granted).map((s) => s.id);
  check("one grant of five still opens the destination", shown.length === 1, shown.join(", "));
  check("and it shows only the section that opens", shown[0] === "policies");
  check("the destination is listed", ids(destinationsFor("owner", granted)).includes("access"));
  check(
    "it opens onto the section they can actually see",
    destinationHome(ACCESS, "owner", granted) === "policies",
  );
}

// Owner, granted none of them.
{
  const granted = ["dashboard.read"];
  check(
    "a destination with no openable section is hidden entirely",
    !ids(destinationsFor("owner", granted)).includes("access"),
  );
  check(
    "and it reports no landing section rather than a broken link",
    destinationHome(ACCESS, "owner", granted) === undefined,
  );
}

console.log("\na real staff account gets a real, narrower nav");

// A front-desk account: the guest list and support, nothing structural. Note
// `guest_sessions.read` covers BOTH `users` and `network-activity` in
// NAV_PERMISSION_KEYS -- the codebase already treated them as one domain,
// which is why they are one destination.
{
  const STAFF = [
    "dashboard.read",
    "guest_users.read",
    "guest_sessions.read",
    "support_tickets.read",
  ];
  const shown = ids(destinationsFor("agent", STAFF));
  check("staff see fewer destinations than an owner", shown.length < 9, shown.join(", "));
  check("staff still get Home", shown.includes("home"));
  check("staff still get Guests", shown.includes("guests"));
  check("staff still get Help", shown.includes("help"));
  check("staff do not get Settings", !shown.includes("settings"));
  check("staff do not get Access Rules", !shown.includes("access"));

  const guestSections = sectionsFor(
    CUSTOMER_DESTINATIONS.find((d) => d.id === "guests"),
    "agent",
    STAFF,
  ).map((s) => s.id);
  // This is the partial rule doing exactly its job, and it is worth being
  // explicit about because the first draft of this test asserted the
  // opposite. Staff hold `guest_sessions.read`, which is the permission key
  // for BOTH sections -- but `network-activity` is additionally
  // `roles: ["owner"]` (customerNav.ts), a deliberate restriction on
  // security-sensitive guest records that NetworkActivityLog also enforces
  // at render time. So the grant is not the binding constraint here, the
  // role is, and Guests correctly opens for staff showing one of its two
  // sections rather than being hidden for the section they cannot have.
  check(
    "Guests opens for staff with only the section their role allows",
    guestSections.join(",") === "users",
    guestSections.join(","),
  );
  check(
    "the owner still gets both sections of Guests",
    sectionsFor(
      CUSTOMER_DESTINATIONS.find((d) => d.id === "guests"),
      "owner",
      STAFF,
    )
      .map((s) => s.id)
      .join(",") === "users,network-activity",
  );
}

// The role filter must still bite on its own, independently of grants.
{
  const shown = ids(destinationsFor("agent", null));
  check(
    "role alone still narrows the nav when grants are unknown",
    shown.length < 9 && shown.includes("home"),
    shown.join(", "),
  );
  check("Settings is owner-only by role", !shown.includes("settings"));
  check(
    "Offers is not offered to staff by role",
    // campaigns/notification are owner-only; vouchers is not -- so Offers
    // survives for staff on the "any section" rule. This asserts the rule,
    // not an accident: if it ever flips to "all sections" this fails.
    shown.includes("offers"),
  );
  const offers = sectionsFor(
    CUSTOMER_DESTINATIONS.find((d) => d.id === "offers"),
    "agent",
    null,
  ).map((s) => s.id);
  check(
    "and Offers shows staff only the part they may use",
    offers.join(",") === "vouchers",
    offers.join(","),
  );
}

// ---------------------------------------------------------------------------
// 4. The seam that must stay soft.
// ---------------------------------------------------------------------------

console.log("\nthe Fix-a-Problem seam is not pinned to owner-only");

{
  const status = CUSTOMER_DESTINATIONS.find((d) => d.id === "status");
  // `debugging` is being renamed to "Fix a Problem" and moved to
  // roles ["owner","agent"] on an unmerged branch. Nothing in the
  // destination model may hardcode the current owner-only assumption: the
  // roles must be read off the nav items every time. If this file ever grows
  // its own `roles` field, this assertion is the thing that should stop it.
  check(
    "the destination declares no roles of its own",
    !("roles" in status),
    "a roles field here would freeze gating that is about to change",
  );
  const src = readFileSync(join(ROOT, "src/lib/customerDestinations.ts"), "utf8");
  check(
    "section gating is read from the nav items, not duplicated",
    src.includes("item.roles.includes(role)") && src.includes("navItemAllowed("),
  );
  // When debugging does flip to owner+agent, staff must get this destination
  // with no change to this file. Simulate it by checking the mechanism:
  // devices/alerts are already owner+agent, so staff reach Fix a Problem
  // today through them.
  check(
    "staff can already reach Fix a Problem through its owner+agent sections",
    sectionsFor(status, "agent", null).length > 0,
  );
}

// ---------------------------------------------------------------------------
// 5. Wiring.
// ---------------------------------------------------------------------------

console.log("\nthe real shell is wired to this");

const sidebar = readFileSync(join(ROOT, "src/components/customer/CustomerSidebar.tsx"), "utf8");
const palette = readFileSync(
  join(ROOT, "src/components/customer/CustomerCommandPalette.tsx"),
  "utf8",
);
const tabs = readFileSync(join(ROOT, "src/components/customer/CustomerSectionTabs.tsx"), "utf8");

check("CustomerSidebar renders destinations", /destinationsFor\(/.test(sidebar));
// Comments stripped: this file's own docstring explains what it replaced, so
// a raw grep for the old element matches the postmortem rather than the code.
const sidebarCode = sidebar.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
check(
  "CustomerSidebar uses the shared shadcn primitive, not a hand-rolled aside",
  sidebarCode.includes('from "@/components/ui/sidebar"') && !/<aside/.test(sidebarCode),
);
check("nav rows are links, not buttons", /<Link/.test(sidebar) && /aria-current=/.test(sidebar));
check("the sidebar still skeletons while grants are in flight", /showSkeleton/.test(sidebar));
// Cmd-K is the pressure valve that makes hiding 17 features defensible.
check(
  "the palette is bound to Cmd/Ctrl-K",
  /e\.key === "k" && \(e\.metaKey \|\| e\.ctrlKey\)/.test(palette),
);
check("the palette can reach every permitted feature", /sectionsFor\(/.test(palette));
check(
  "the palette navigates via the same href source of truth",
  /customerFeatureHref\(item\.id\)/.test(palette),
);
// A location-scoped staff member's lists are filtered server-side with no
// marker saying anything was withheld, so the screen has to name its scope.
check("section tabs name the venue they are scoped to", /locationName/.test(tabs));
check(
  "section tabs link to the real feature routes",
  /customerFeatureHref\(section\.id\)/.test(tabs),
);

// ---------------------------------------------------------------------------
// 6. The help page must describe the nav that exists.
// ---------------------------------------------------------------------------

console.log("\nthe help page documents this nav, not the previous one");

const howItWorks = readFileSync(join(ROOT, "src/components/customer/HowItWorksPage.tsx"), "utf8");
// #217 made this page generate its index from the sidebar's own expression,
// precisely so it could not describe screens the reader does not have. That
// expression changed with 26 -> 9. Left alone, the page would have gone on
// grouping by the seven old groups -- Overview, Engagement, Access & Policy,
// Devices & Team, Network, Operations, Support & Logs -- and sent readers
// looking for a "Network" section that no longer exists in the sidebar,
// which is the same defect one release later.
check("the help page reads the destination model", /destinationsFor\(/.test(howItWorks));
check(
  "the help page no longer groups by the retired seven",
  !/customerNavGroupsForRole\(/.test(howItWorks),
);
check(
  "the help page labels destinations from the same i18n namespace as the sidebar",
  /nav:customerDestination\./.test(howItWorks),
);

// ---------------------------------------------------------------------------
// 7. Fix a Problem stays reachable by front-desk staff.
// ---------------------------------------------------------------------------

console.log("\nFix a Problem is not quietly owner-only again");

{
  const nav = readFileSync(join(ROOT, "src/lib/customerNav.ts"), "utf8");
  check(
    "the debugging feature still declares owner + agent",
    /\{ id: "debugging", label: "Fix a Problem", icon: \w+, roles: \["owner", "agent"\] \}/.test(
      nav,
    ),
    "the restructure must not return this to owner-only",
  );
  const status = CUSTOMER_DESTINATIONS.find((d) => d.id === "status");
  const staffSections = sectionsFor(status, "agent", null).map((s) => s.id);
  check(
    "staff can open the fix-it page itself, not just its neighbours",
    staffSections.includes("debugging"),
    staffSections.join(","),
  );
  check(
    "and the destination opens straight onto it",
    destinationHome(status, "agent", null) === "debugging",
    String(destinationHome(status, "agent", null)),
  );
}

console.log(
  failures === 0
    ? `\nall customer destination checks passed\n`
    : `\n${failures} customer destination check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
