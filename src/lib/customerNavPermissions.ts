import type { CustomerNavGroup, CustomerNavItem } from "@/lib/customerNav";

/**
 * Which real backend permission keys make a customer nav item meaningful.
 *
 * WHY THIS EXISTS
 * ---------------
 * The customer sidebar used to be filtered by `cg_login_role` alone -- a
 * value written from a radio button on the sign-in form
 * (`LoginPage.tsx`'s "Owner / Staff" choice) straight into localStorage,
 * and read back by `getCustomerLoginRole()`. So "which screens does this
 * staff member get?" was answered by what they had clicked on the way in,
 * and any staff member who picked "Owner" got the owner's entire nav.
 * Meanwhile the fine-grained permission keys an owner genuinely saves in
 * Staff Access -> Roles (a real `PUT /roles/{id}`) drove nothing at all in
 * this shell.
 *
 * This table closes that gap by intersecting the nav with the caller's own
 * effective grants from `GET /me/permissions`.
 *
 * THE KEYS ARE VERIFIED, NOT GUESSED
 * ----------------------------------
 * Each entry was checked against the `RequirePermission(...)` decorators on
 * the endpoint the screen actually calls, not inferred from the nav id.
 * Three would have been wrong if inferred:
 *
 *   - `port-forwarding` is guarded by **`firewall.*`**, not a
 *     `port_forwarding` module (no such module exists in
 *     `PermissionModule`). `permissions.service.ts`'s own
 *     `MODULE_PERMISSION_PREFIX` still carries the wrong guess for this
 *     one; it fails open there, so it is a latent no-op rather than a bug.
 *   - `admin-logs` is guarded by **`audit_logs.*`**, not `admin_logs`.
 *   - `dashboard` is **`dashboard.view`**, not `dashboard.read` -- see that
 *     entry's own note below. This one was NOT verified when it was
 *     written, and it cost the founder access to his own dashboard.
 *
 * "Verified" is now mechanical rather than a promise in a comment. Every
 * key below is asserted by `scripts/test-customer-nav-permissions.mjs` to
 * be a member of `BACKEND_PERMISSION_KEYS` -- the backend's own seeded key
 * list, generated from `rbac/seed.py` by
 * `scripts/generate-backend-permission-keys.mjs` and committed here. A key
 * the backend does not seed now fails a test instead of hiding a screen.
 *
 * WHY EACH ENTRY IS A LIST
 * ------------------------
 * An item shows if the caller holds **any** key in its list. Several
 * screens legitimately read more than one domain (Reports pages
 * `/guest-sessions` but is conceptually the Reports module; Alerts is
 * served by the monitoring router, which accepts several), and a custom
 * role built by an owner may reasonably grant one but not the other.
 * Requiring all of them would hide working screens from people entitled to
 * them, which is the failure this file must not introduce.
 *
 * FAIL OPEN, ALWAYS
 * -----------------
 * This filter may only ever *remove* an item the role-based nav already
 * offered. It can never add one, and it must never be the reason a
 * legitimate user sees an empty sidebar:
 *
 *   - a nav id absent from this table is always shown (`how-it-works` is
 *     a static help page with no backing domain, and any nav item added
 *     later inherits the safe default rather than vanishing);
 *   - an empty or missing permission set means "we don't know", not
 *     "denied" -- an account with no role assignment resolves to `[]` on
 *     the backend, and older accounts provisioned before
 *     `location/provisioning_service.py` started assigning
 *     `organization-owner` can be in exactly that state;
 *   - a failed or still-loading fetch changes nothing.
 *
 * The backend enforces every request on its own regardless, so an extra
 * visible nav item is a cosmetic error while a missing one locks a paying
 * customer out of a feature they bought. Those costs are not symmetric,
 * and this file resolves every ambiguity toward the customer.
 */
export const NAV_PERMISSION_KEYS: Record<string, readonly string[]> = {
  // Overview
  // `view`, NOT `read`. DASHBOARD is the one module in the entire backend
  // seed whose only action is `view`:
  //
  //     MODULE_ACTIONS[PermissionModule.DASHBOARD] == (_A.VIEW,)
  //
  // Six modules (analytics, reports, monitoring, alerts, audit_logs,
  // ai_assistant) carry both `view` and `read`, and the entries just below
  // are keyed on `.read`, which is why `dashboard.read` looked like house
  // style and read as correct in review. It was not. No such permission
  // row is seeded, so no role can hold it, so `granted.has()` never
  // matched and the Dashboard row was filtered out of the sidebar for
  // EVERY customer -- including the organization owner, who holds every
  // one of his role's 246 grants. Nothing errored, nothing 403'd; the row
  // was simply not there, which is indistinguishable from a product that
  // never had one.
  //
  // `dashboard.view` needs no data repair and no migration: all 17 seeded
  // system roles hold it, from Super Admin down to Guest Operator.
  dashboard: ["dashboard.view"],
  users: ["guest_users.read", "guest_sessions.read"],
  reports: ["reports.read", "analytics.read"],
  alerts: ["alerts.read", "monitoring.read"],
  // Engagement
  campaigns: ["campaigns.read"],
  portal: ["captive_portal.read"],
  vouchers: ["voucher.read"],
  // Access & Policy
  policies: ["policy.read"],
  whitelist: ["guest_access.read"],
  "mac-auth": ["mac_authorization.read"],
  // Open Hours is a captive-portal config surface -- it reads and writes
  // through `/captive-portal/resolve` + the portal config PUT, same domain
  // as Portal itself (see business-hours.service.ts).
  "business-hours": ["captive_portal.read"],
  // Devices & Team
  devices: ["monitored_hardware.read"],
  teams: ["guest_teams.read"],
  // Staff Access administers real platform users, hence `users`, not a
  // guest-side domain.
  agents: ["users.read"],
  // Network
  dhcp: ["dhcp.read"],
  vlans: ["vlan.read"],
  "port-forwarding": ["firewall.read"],
  voip: ["qos.read"],
  "website-blocking": ["content_filtering.read"],
  "isp-details": ["isp.read"],
  // Operations
  // Two keys, and the OR is the point. This page's primary job -- looking
  // a guest up and saying why they cannot get on -- reads guest sessions,
  // not the diagnostics domain, and front-desk roles hold
  // `guest_sessions.read` while deliberately not holding
  // `network_diagnostics.*`. Requiring the diagnostics key alone hid the
  // whole page from exactly the people it is written for. The zones that
  // do need diagnostics degrade individually.
  debugging: ["guest_sessions.read", "network_diagnostics.read"],
  // Support & Logs
  tickets: ["support_tickets.read"],
  "admin-logs": ["audit_logs.read"],
  "network-activity": ["guest_sessions.read"],
  // `how-it-works` is deliberately absent: a static reference page with no
  // backend domain behind it, so there is nothing to check and no reason
  // to ever hide it.
};

/** True when this nav id should be visible to a caller holding `granted`.
 *
 * Exported for the regression test, which asserts the fail-open direction
 * directly rather than only through the group filter. */
export function navItemAllowed(id: string, granted: ReadonlySet<string>): boolean {
  const required = NAV_PERMISSION_KEYS[id];
  // Unmapped id -> always visible. See "FAIL OPEN" above.
  if (!required) return true;
  return required.some((key) => granted.has(key));
}

/**
 * Narrow already-role-filtered nav groups to what the caller's real
 * permissions support, dropping any group left empty.
 *
 * `permissions` is `null`/`undefined` while the fetch is in flight or if
 * it failed, and `[]` for an account the backend resolved to no grants at
 * all. All three mean "we don't know" and return `groups` untouched --
 * only a non-empty set is treated as an answer.
 */
export function filterNavGroupsByPermissions(
  groups: CustomerNavGroup[],
  permissions: readonly string[] | null | undefined,
): CustomerNavGroup[] {
  if (!permissions || permissions.length === 0) return groups;
  const granted = new Set(permissions);
  return groups
    .map((g) => ({ ...g, items: g.items.filter((item) => navItemAllowed(item.id, granted)) }))
    .filter((g) => g.items.length > 0);
}

/**
 * The items `filterNavGroupsByPermissions` would remove from `groups`.
 *
 * WHY THIS EXISTS
 * ---------------
 * The fail-open rules above cover the three non-answers -- `null`,
 * `undefined`, `[]`. They deliberately do not cover the fourth case: a
 * real grant set that happens to be short. That one MUST narrow the nav;
 * narrowing it is the entire point of this file.
 *
 * But narrowing it *silently* is what let `dashboard.read` survive. A row
 * the filter removed and a row that was never built render identically:
 * absent. There was no error, no 403, no empty state -- just a menu with
 * one fewer item than it should have had, which looks exactly like a
 * deliberate product decision. That is why nobody caught it until the
 * founder went looking for his own dashboard.
 *
 * So the sidebar now renders one quiet line -- "N sections hidden by your
 * permissions", naming them on hover -- whenever this returns anything.
 * It grants nothing and unhides nothing; the backend still enforces every
 * request and should. What it changes is that a permission becomes the
 * *explanation* for a gap rather than an invisible cause of one. A user
 * who can see that six sections are hidden can go ask their owner for
 * them. A user looking at a shorter menu cannot even form the question.
 *
 * Returns `[]` for the fail-open non-answers, since nothing is being
 * hidden in those cases.
 */
export function navItemsHiddenByPermissions(
  groups: CustomerNavGroup[],
  permissions: readonly string[] | null | undefined,
): CustomerNavItem[] {
  if (!permissions || permissions.length === 0) return [];
  const granted = new Set(permissions);
  return groups.flatMap((g) => g.items.filter((item) => !navItemAllowed(item.id, granted)));
}
