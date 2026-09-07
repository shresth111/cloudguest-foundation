/**
 * Regression test for the customer sidebar's permission filter.
 *
 * FAILURE MODE THIS LOCKS DOWN: "each staff member sees only what their
 * job needs" was decided by a radio button. `LoginPage` writes the
 * Owner/Staff choice to `localStorage.cg_login_role`, `customerNav.ts`
 * reads it back, and that was the whole of it -- so a front-desk account
 * that picked "Owner" on the way in got the owner's entire sidebar, while
 * the fine-grained permission keys an owner genuinely saves in Staff
 * Access -> Roles (a real `PUT /roles/{id}`) drove nothing in this shell
 * at all.
 *
 * THE DANGEROUS DIRECTION IS THE FIX, NOT THE BUG. Getting this wrong
 * empties a paying customer's sidebar. The backend resolves permissions
 * purely from role assignments with no superuser bypass
 * (app/domains/rbac/authorization.py's `resolve`), and an account with no
 * assignment resolves to `[]` -- a real state for accounts created before
 * `location/provisioning_service.py` started assigning
 * `organization-owner`. So the assertions below are weighted toward
 * failing open, in this order:
 *
 *   1. NOTHING IS EVER HIDDEN ON A NON-ANSWER. `null` (in flight),
 *      `undefined` (fetch failed) and `[]` (no role assignment) must all
 *      return the role-based nav completely untouched. This is the
 *      assertion that stands between a bad deploy and a locked-out
 *      customer.
 *   2. THE FILTER MAY ONLY REMOVE. It can never introduce an item the
 *      role-based nav did not already offer.
 *   3. AN UNMAPPED NAV ID STAYS VISIBLE. New nav items must default to
 *      shown, not disappear until someone remembers this table.
 *   4. A REAL STAFF GRANT SET NARROWS THE OWNER NAV. The actual bug.
 *
 * It also pins the two permission keys that were verified against the
 * backend's own `RequirePermission(...)` decorators and would BOTH be
 * wrong if inferred from the nav id -- `port-forwarding` is guarded by
 * `firewall.*` (there is no `port_forwarding` module) and `admin-logs` by
 * `audit_logs.*`. A future tidy-up that "corrects" those to match their
 * nav ids would silently hide two working screens.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The
 * real table and filter are bundled with esbuild and executed; the wiring
 * is checked against the real component and service sources.
 *
 * COUNT NOTE: the owner nav used to be 26 items; the "Notifications"
 * preferences screen was removed from the customer dashboard along with
 * its nav entry (id "notification"), so the nav is 25. The stub below
 * reads the lucide imports straight from `customerNav.ts` +
 * `customerFeatureCatalog.ts`, so removing that entry's `Send` icon drops
 * it from the stub automatically.
 *
 * Run: node scripts/test-customer-nav-permissions.mjs
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

// ---------------------------------------------------------------------------
// Bundle the real filter + the real nav table.
// ---------------------------------------------------------------------------

const outdir = mkdtempSync(join(tmpdir(), "customer-nav-perms-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export { filterNavGroupsByPermissions, navItemAllowed, navItemsHiddenByPermissions, NAV_PERMISSION_KEYS } from "${p("src/lib/customerNavPermissions.ts")}";
   export { CUSTOMER_NAV_GROUPS, customerNavGroupsForRole } from "${p("src/lib/customerNav.ts")}";
   export { BACKEND_PERMISSION_KEYS } from "${p("src/lib/backendPermissionKeys.generated.ts")}";`,
);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  // lucide-react ships the icons the nav table imports; stub them out so
  // this stays a test of the table, not of an icon package.
  plugins: [
    {
      name: "stub-lucide",
      setup(b) {
        b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: "lucide", namespace: "stub" }));
        // The stub used to carry a hand-maintained list of icon names, so
        // adding one to the nav (or dropping a dead import) failed this test
        // with "No matching export in stub:lucide" -- a real change reported
        // as an unrelated breakage. Read the names the modules under test
        // actually import instead, so the stub can never drift from them.
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => {
          const names = new Set();
          for (const f of ["src/lib/customerNav.ts", "src/config/customerFeatureCatalog.ts"]) {
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
  filterNavGroupsByPermissions,
  navItemAllowed,
  navItemsHiddenByPermissions,
  NAV_PERMISSION_KEYS,
  CUSTOMER_NAV_GROUPS,
  customerNavGroupsForRole,
  BACKEND_PERMISSION_KEYS,
} = await import(`file://${outfile}`);

const ownerNav = customerNavGroupsForRole("owner");
const idsOf = (groups) => groups.flatMap((g) => g.items.map((i) => i.id));
const OWNER_IDS = idsOf(ownerNav);

// ---------------------------------------------------------------------------
// 1. Nothing is ever hidden on a non-answer.
// ---------------------------------------------------------------------------

console.log("\na non-answer never hides anything");

for (const [label, value] of [
  ["null (fetch in flight)", null],
  ["undefined (fetch failed)", undefined],
  ["[] (account has no role assignment)", []],
]) {
  const out = filterNavGroupsByPermissions(ownerNav, value);
  check(
    `${label} leaves the owner nav untouched`,
    idsOf(out).join(",") === OWNER_IDS.join(","),
    `got ${idsOf(out).length} of ${OWNER_IDS.length} items`,
  );
  check(`${label} preserves every group`, out.length === ownerNav.length);
}

// ---------------------------------------------------------------------------
// 2. The filter may only remove.
// ---------------------------------------------------------------------------

console.log("\nthe filter can only ever remove");

const EVERY_KEY_IMAGINABLE = [
  "dashboard.view",
  "guest_users.read",
  "reports.read",
  "alerts.read",
  "campaigns.read",
  "captive_portal.read",
  "voucher.read",
  "policy.read",
  "guest_access.read",
  "mac_authorization.read",
  "monitored_hardware.read",
  "guest_teams.read",
  "users.read",
  "dhcp.read",
  "vlan.read",
  "firewall.read",
  "qos.read",
  "content_filtering.read",
  "isp.read",
  "notifications.read",
  "network_diagnostics.read",
  "support_tickets.read",
  "audit_logs.read",
  "guest_sessions.read",
  // Keys for screens this nav does not have at all.
  "system_settings.manage",
  "device_console.execute",
  "channel_partners.read",
];
const wideOpen = idsOf(filterNavGroupsByPermissions(ownerNav, EVERY_KEY_IMAGINABLE));
check(
  "a caller holding everything sees exactly the owner nav, no more",
  wideOpen.join(",") === OWNER_IDS.join(","),
  `got ${wideOpen.length}, expected ${OWNER_IDS.length}`,
);

const agentNav = customerNavGroupsForRole("agent");
const agentWideOpen = idsOf(filterNavGroupsByPermissions(agentNav, EVERY_KEY_IMAGINABLE));
check(
  "permissions never widen the staff nav back to the owner's",
  agentWideOpen.length === idsOf(agentNav).length && agentWideOpen.length < OWNER_IDS.length,
  `agent saw ${agentWideOpen.length}, owner nav is ${OWNER_IDS.length}`,
);

// ---------------------------------------------------------------------------
// 3. An unmapped nav id stays visible.
// ---------------------------------------------------------------------------

console.log("\nunmapped nav ids default to visible");

check(
  "how-it-works survives an unrelated grant set",
  navItemAllowed("how-it-works", new Set(["dashboard.view"])),
);
check("how-it-works survives an empty grant set", navItemAllowed("how-it-works", new Set()));
check(
  "a hypothetical future nav id is shown, not hidden",
  navItemAllowed("some-feature-added-next-year", new Set(["dashboard.view"])),
);

// Every nav id must be either mapped or knowingly unmapped -- this catches
// a new nav item silently inheriting the default without anyone deciding.
// A mapped id requires at least one key, so an empty grant set hides it.
// An id still visible against `new Set()` is therefore unmapped.
const KNOWINGLY_UNMAPPED = new Set(["how-it-works"]);
const accidentallyUnmapped = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).filter(
  (id) => navItemAllowed(id, new Set()) && !KNOWINGLY_UNMAPPED.has(id),
);
check(
  "no nav item is accidentally unmapped",
  accidentallyUnmapped.length === 0,
  `unmapped: ${accidentallyUnmapped.join(", ")}`,
);

// ---------------------------------------------------------------------------
// 4. A real staff grant set narrows the owner nav -- the actual bug.
// ---------------------------------------------------------------------------

console.log("\na staff member who picked 'Owner' is still narrowed to their role");

// What a front-desk role realistically holds: see guests, hand out
// vouchers, raise a ticket. No network, no staff admin, no logs.
const FRONT_DESK = ["dashboard.view", "guest_users.read", "voucher.read", "support_tickets.read"];
const frontDeskIds = idsOf(filterNavGroupsByPermissions(ownerNav, FRONT_DESK));

check(
  "front desk no longer gets the whole owner nav",
  frontDeskIds.length < OWNER_IDS.length,
  `saw ${frontDeskIds.length} of ${OWNER_IDS.length}`,
);
for (const id of ["dashboard", "users", "vouchers", "tickets"]) {
  check(`front desk keeps ${id}`, frontDeskIds.includes(id));
}
for (const id of [
  "agents",
  "vlans",
  "admin-logs",
  "network-activity",
  "website-blocking",
  "campaigns",
]) {
  check(`front desk does not get ${id}`, !frontDeskIds.includes(id));
}
check("front desk still keeps the always-visible help page", frontDeskIds.includes("how-it-works"));
check(
  "groups emptied by the filter are dropped, not left as headers",
  filterNavGroupsByPermissions(ownerNav, FRONT_DESK).every((g) => g.items.length > 0),
);

// ---------------------------------------------------------------------------
// 5. The two keys that would be wrong if inferred from the nav id.
// ---------------------------------------------------------------------------

console.log("\nkeys verified against the backend, not inferred from the nav id");

check(
  "port-forwarding is gated on firewall.read (there is no port_forwarding module)",
  navItemAllowed("port-forwarding", new Set(["firewall.read"])) &&
    !navItemAllowed("port-forwarding", new Set(["port_forwarding.read"])),
);
check(
  "admin-logs is gated on audit_logs.read (not admin_logs)",
  navItemAllowed("admin-logs", new Set(["audit_logs.read"])) &&
    !navItemAllowed("admin-logs", new Set(["admin_logs.read"])),
);
check(
  "website-blocking is gated on content_filtering.read",
  navItemAllowed("website-blocking", new Set(["content_filtering.read"])),
);
check(
  "voip is gated on qos.read",
  navItemAllowed("voip", new Set(["qos.read"])) && !navItemAllowed("voip", new Set(["voip.read"])),
);
// THE ONE THAT WAS ACTUALLY WRONG. `dashboard: ["dashboard.read"]` shipped
// and hid the Dashboard row from every customer including the organization
// owner. DASHBOARD's only seeded action is `view` -- it is the sole module
// in the backend seed with no `read` at all -- so the required key named a
// permission that does not exist, `granted.has()` returned false forever,
// and the row was filtered out with no error anywhere to explain it.
//
// Both halves of this assertion matter. The first is the fix; the second
// stops a future tidy-up from "restoring consistency" with the `.read`
// entries around it and putting the founder back where he started.
check(
  "dashboard is gated on dashboard.view (there is no dashboard.read to hold)",
  navItemAllowed("dashboard", new Set(["dashboard.view"])) &&
    !navItemAllowed("dashboard", new Set(["dashboard.read"])),
);
// And the end-to-end shape of the bug: an organization owner holding a
// realistic grant set must be able to see the Dashboard row.
check(
  "an owner-shaped grant set keeps the Dashboard row",
  idsOf(
    filterNavGroupsByPermissions(ownerNav, ["dashboard.view", "guest_users.read", "reports.read"]),
  ).includes("dashboard"),
);

// ---------------------------------------------------------------------------
// 5b. EVERY KEY THIS TABLE ASKS FOR MUST ACTUALLY EXIST.
//
// The section above pins five keys a human read off the backend's own
// decorators. This one removes the human. `dashboard.read` got through
// review precisely BECAUSE it looked right: six sibling modules really do
// have a `.read`, the entry was formatted like all its neighbours, and
// asking for a permission that does not exist throws nothing, logs
// nothing and 403s nothing. The set test just returns false forever and
// the row is gone. The organization owner -- holding every grant his role
// has -- could not reach his own dashboard, and neither the product nor
// the console nor CI said a word.
//
// A comment claiming the keys were verified is not a guard. This is.
//
// `BACKEND_PERMISSION_KEYS` is the backend's real seeded key list,
// generated by `scripts/generate-backend-permission-keys.mjs` (which
// parses `rbac/seed.py`'s MODULE_ACTIONS against `rbac/enums.py` -- so
// running THIS assertion needs no Python and no backend checkout). That
// script's own `--check` mode guards the other direction: the backend
// renaming or dropping a key out from under us.
// ---------------------------------------------------------------------------

console.log("\nevery key this table demands exists in the backend's seed");

const SEEDED = new Set(BACKEND_PERMISSION_KEYS);

check(
  "the vendored backend key list is populated",
  SEEDED.size > 200,
  `got ${SEEDED.size} keys -- the generator or the vendored file is broken`,
);
check(
  "the vendored list is the real seed, not a stub",
  // Two keys from opposite ends of the module list, one of them the very
  // key this whole incident was about. If these are missing the list is
  // not what it claims to be and every assertion below is vacuous.
  SEEDED.has("dashboard.view") && SEEDED.has("audit_logs.read"),
);
check(
  "the vendored list still does NOT contain the key that caused the bug",
  !SEEDED.has("dashboard.read"),
  "dashboard.read is now seeded -- re-check which key the nav should ask for",
);

const unseeded = [];
for (const [navId, keys] of Object.entries(NAV_PERMISSION_KEYS)) {
  for (const key of keys) if (!SEEDED.has(key)) unseeded.push(`${navId} -> ${key}`);
}
check(
  "no nav item requires a permission key the backend never seeds",
  unseeded.length === 0,
  `these can never match, so their screens are invisible to everyone: ${unseeded.join("; ")}`,
);

// A key that exists but is shaped wrong is the same failure one step
// later, so pin the shape too: `<module>.<action>`, both halves non-empty.
const malformed = Object.entries(NAV_PERMISSION_KEYS).flatMap(([navId, keys]) =>
  keys.filter((k) => !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(k)).map((k) => `${navId} -> ${k}`),
);
check(
  "every required key is shaped <module>.<action>",
  malformed.length === 0,
  malformed.join("; "),
);

// And every mapped nav id must be a real nav id. An entry for an id that
// no longer exists is dead weight that reads as coverage.
const NAV_IDS = new Set(CUSTOMER_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)));
const orphaned = Object.keys(NAV_PERMISSION_KEYS).filter((id) => !NAV_IDS.has(id));
check(
  "no permission entry maps a nav id that does not exist",
  orphaned.length === 0,
  orphaned.join(", "),
);

// The customer sidebar is not the only table in this repo that names
// backend permission keys. `permissions.service.ts` keeps its own
// module -> domain prefix map and denies a module when the caller lacks
// `<prefix>.read` -- so a prefix naming a module the backend does not
// seed denies that module to EVERYONE. Same defect, worse direction: the
// nav table's version failed to show a row, this one actively hides one.
// Two entries were in exactly that state (`port_forwarding`,
// `queue_management`; neither is a PermissionModule). Read the map out of
// the real source rather than restating it here, so this cannot pass by
// testing a copy.
const permsService = readFileSync(join(ROOT, "src/services/permissions.service.ts"), "utf8");
const prefixBlock = permsService
  .split("MODULE_PERMISSION_PREFIX: Partial<Record<ModuleId, string>> = {")[1]
  ?.split("};")[0];
check("the module -> permission-prefix map is still readable", Boolean(prefixBlock));
const badPrefixes = [...(prefixBlock ?? "").matchAll(/"?[\w-]+"?\s*:\s*"([a-z_]+)"/g)]
  .map((m) => m[1])
  .filter((prefix) => !SEEDED.has(`${prefix}.read`));
check(
  "every permission-prefix names a module the backend actually seeds",
  badPrefixes.length === 0,
  `these deny their module to every caller: ${[...new Set(badPrefixes)].join(", ")}`,
);

// ---------------------------------------------------------------------------
// 5c. A PRESENT-BUT-INCOMPLETE GRANT SET IS EXPLICABLE, NOT INVISIBLE.
//
// The fail-open rules in section 1 cover null/undefined/[]. They
// deliberately do not cover "a real answer that happens to be short" --
// that case must narrow the nav, which is the whole point of the filter.
// But narrowing it silently is what made the Dashboard bug survive: a
// removed row and a row that was never built look identical. So the
// filter now reports what it removed and the sidebar says so.
// ---------------------------------------------------------------------------

console.log("\na permission-hidden section is explained, not just absent");

check(
  "nothing is reported hidden on the fail-open non-answers",
  navItemsHiddenByPermissions(ownerNav, null).length === 0 &&
    navItemsHiddenByPermissions(ownerNav, undefined).length === 0 &&
    navItemsHiddenByPermissions(ownerNav, []).length === 0,
);
check(
  "a caller holding everything is told nothing is hidden",
  navItemsHiddenByPermissions(ownerNav, EVERY_KEY_IMAGINABLE).length === 0,
);
const frontDeskHidden = navItemsHiddenByPermissions(ownerNav, FRONT_DESK);
check(
  "the hidden list accounts for exactly what the filter removed",
  frontDeskHidden.length === OWNER_IDS.length - frontDeskIds.length,
  `reported ${frontDeskHidden.length}, filter removed ${OWNER_IDS.length - frontDeskIds.length}`,
);
check(
  "the hidden list names the sections, so the message can too",
  frontDeskHidden.every((i) => typeof i.label === "string" && i.label.length > 0) &&
    frontDeskHidden.some((i) => i.id === "vlans"),
);

// ---------------------------------------------------------------------------
// 6. Wiring.
// ---------------------------------------------------------------------------

console.log("\nthe real sidebar and service are wired to this");

const sidebar = readFileSync(join(ROOT, "src/components/customer/CustomerSidebar.tsx"), "utf8");
const rbac = readFileSync(join(ROOT, "src/services/rbac.service.ts"), "utf8");
const hooks = readFileSync(join(ROOT, "src/hooks/useCustomerDashboard.ts"), "utf8");

// The sidebar renders the seven nav groups directly again (the nine-
// destination layer that briefly sat between them was reverted), so it reads
// this filter itself rather than through a second module. Assert the direct
// call: a parallel filter somewhere else is exactly how the fail-open
// guarantee below gets lost.
check("CustomerSidebar imports the filter", sidebar.includes("@/lib/customerNavPermissions"));
check("CustomerSidebar applies the filter", /filterNavGroupsByPermissions\(/.test(sidebar));
// The palette reaches the same customer features and must be narrowed by the
// same expression -- a shortcut past the scrolling, never past the
// permissions.
const palette = readFileSync(
  join(ROOT, "src/components/customer/CustomerCommandPalette.tsx"),
  "utf8",
);
check(
  "the command palette applies the same filter",
  /filterNavGroupsByPermissions\(customerNavGroupsForRole\(role\), permissions\)/.test(palette),
);
check("CustomerSidebar feeds it useMyPermissions", /useMyPermissions\(\)/.test(sidebar));
// The signal from 5c, asserted on the wiring rather than the copy: what
// must not regress is that the sidebar computes what the filter removed
// and renders it, not the exact wording of the sentence.
check(
  "CustomerSidebar computes which sections the permission filter removed",
  /navItemsHiddenByPermissions\(/.test(sidebar),
);
check(
  "CustomerSidebar renders that count instead of leaving the gap unexplained",
  /hiddenByPermissions\.length\s*>\s*0/.test(sidebar) && /hidden by your permissions/.test(sidebar),
);
check(
  "the filter and the explanation are computed from the SAME role nav",
  // Two separate `customerNavGroupsForRole(role)` calls would drift the
  // moment one of them grew an argument, and the count would then
  // describe a nav nobody is looking at.
  /const roleNavGroups = customerNavGroupsForRole\(role\);/.test(sidebar) &&
    /filterNavGroupsByPermissions\(roleNavGroups, permissions\)/.test(sidebar) &&
    /navItemsHiddenByPermissions\(roleNavGroups, permissions\)/.test(sidebar),
);
check("rbac.service exposes getMyPermissions", /async getMyPermissions\(/.test(rbac));
check(
  "getMyPermissions calls the unguarded /me/permissions endpoint",
  /api\.get<[^>]*>\("\/me\/permissions"\)/.test(rbac),
);
check("useMyPermissions is skipped in demo mode", /enabled:\s*!demo/.test(hooks));

// ---------------------------------------------------------------------------
// 7. "We haven't looked yet" must not be spelled "demo".
// ---------------------------------------------------------------------------

console.log("\nthe nav does not paint an answer it is about to take back");

// useIsDemo() was `useState(true)` + a correcting useEffect, so the FIRST
// client render of every real session asserted "this is the demo". The most
// load-bearing consumer treats that as fact -- useMyPermissions is
// `enabled: !demo` -- so the permission fetch was disabled on first paint,
// the sidebar rendered its unfiltered nav, and then silently shrank
// once the effect ran and the answer arrived. Items vanished from under the
// pointer. The fail-open rules above are all still correct; the bug was that
// "unknown" and "demo" were the same value.
// Comments stripped first: the docstring on useIsDemo quotes the old
// `useState(true)` to explain what changed, and a grep over the raw source
// would match its own postmortem.
const hooksCode = hooks.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
check(
  "useIsDemo does not initialise to a positive claim",
  !/useState\(true\)/.test(hooksCode),
  "useIsDemo is asserting 'demo' before it has looked",
);
check(
  "useIsDemo reads the real value on the first client render",
  /useSyncExternalStore\(/.test(hooks),
);
check(
  "the SSR snapshot still matches isDemo()'s own no-window branch",
  /getServerSnapshot:\s*\(\)\s*=>\s*false/.test(hooks),
);
// And while the real answer is genuinely in flight, say so rather than
// showing a nav that is about to get shorter. Must be gated on the query's
// own loading flag, which is false for demo/failed/empty -- all of which
// still fall through to the fail-open full nav asserted in section 1.
check(
  "CustomerSidebar shows a skeleton while grants are in flight",
  // Asserted on the behaviour, not on a local variable name. This check was
  // once pinned to `showNavSkeleton`; a rewrite renamed it to `showSkeleton`
  // and the check failed while the skeleton itself was intact. What matters
  // is that the loading flag is read from the permissions query and gates a
  // skeleton render.
  /isLoading:\s*\w*[Pp]ermissions\w*/.test(sidebar) && /[Ss]keleton/.test(sidebar),
);

console.log(
  failures === 0
    ? `\nall customer nav permission checks passed\n`
    : `\n${failures} customer nav permission check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
