import type { CustomerNavGroup } from "@/lib/customerNav";

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
 * Two would have been wrong if inferred:
 *
 *   - `port-forwarding` is guarded by **`firewall.*`**, not a
 *     `port_forwarding` module (no such module exists in
 *     `PermissionModule`). `permissions.service.ts`'s own
 *     `MODULE_PERMISSION_PREFIX` still carries the wrong guess for this
 *     one; it fails open there, so it is a latent no-op rather than a bug.
 *   - `admin-logs` is guarded by **`audit_logs.*`**, not `admin_logs`.
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
const NAV_PERMISSION_KEYS: Record<string, readonly string[]> = {
  // Overview
  dashboard: ["dashboard.read"],
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
  notification: ["notifications.read"],
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
