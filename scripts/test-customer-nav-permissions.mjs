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
  `export { filterNavGroupsByPermissions, navItemAllowed } from "${p("src/lib/customerNavPermissions.ts")}";
   export { CUSTOMER_NAV_GROUPS, customerNavGroupsForRole } from "${p("src/lib/customerNav.ts")}";`,
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
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: `export default new Proxy({}, { get: () => () => null });
                     ${[
                       "LayoutDashboard,Users,FileText,Megaphone,Palette,Ticket,ShieldCheck,Shield",
                       "Monitor,UsersRound,Bot,Network,Settings2,Bell,Sun,Globe,ScrollText",
                       "Fingerprint,Server,Signal,Wifi,Ban,LifeBuoy,Share2,HelpCircle,Radar",
                     ]
                       .join(",")
                       .split(",")
                       .map((n) => `export const ${n} = () => null;`)
                       .join("\n")}`,
          loader: "js",
        }));
      },
    },
  ],
});

const {
  filterNavGroupsByPermissions,
  navItemAllowed,
  CUSTOMER_NAV_GROUPS,
  customerNavGroupsForRole,
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
  "dashboard.read",
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
  navItemAllowed("how-it-works", new Set(["dashboard.read"])),
);
check("how-it-works survives an empty grant set", navItemAllowed("how-it-works", new Set()));
check(
  "a hypothetical future nav id is shown, not hidden",
  navItemAllowed("some-feature-added-next-year", new Set(["dashboard.read"])),
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
const FRONT_DESK = ["dashboard.read", "guest_users.read", "voucher.read", "support_tickets.read"];
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

// ---------------------------------------------------------------------------
// 6. Wiring.
// ---------------------------------------------------------------------------

console.log("\nthe real sidebar and service are wired to this");

const sidebar = readFileSync(join(ROOT, "src/components/customer/CustomerSidebar.tsx"), "utf8");
const rbac = readFileSync(join(ROOT, "src/services/rbac.service.ts"), "utf8");
const hooks = readFileSync(join(ROOT, "src/hooks/useCustomerDashboard.ts"), "utf8");

check("CustomerSidebar imports the filter", sidebar.includes("@/lib/customerNavPermissions"));
check("CustomerSidebar applies the filter", /filterNavGroupsByPermissions\(/.test(sidebar));
check("CustomerSidebar feeds it useMyPermissions", /useMyPermissions\(\)/.test(sidebar));
check("rbac.service exposes getMyPermissions", /async getMyPermissions\(/.test(rbac));
check(
  "getMyPermissions calls the unguarded /me/permissions endpoint",
  /api\.get<[^>]*>\("\/me\/permissions"\)/.test(rbac),
);
check("useMyPermissions is skipped in demo mode", /enabled:\s*!demo/.test(hooks));

console.log(
  failures === 0
    ? `\nall customer nav permission checks passed\n`
    : `\n${failures} customer nav permission check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
