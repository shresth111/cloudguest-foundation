import type { RoleAssignment } from "@/types/auth";

/** Display-only label for the user's highest-priority active role. Never
 * branch app logic on this — use `useAuth().can(permission)` instead. */
export function primaryRoleLabel(roles: RoleAssignment[]): string {
  return roles[0]?.roleName ?? "No role assigned";
}

/** All authenticated users land on the customer dashboard. */
export function homeRoute(): string {
  return "/";
}

/**
 * Login-time landing preference, not an authorization mechanism -- real
 * page content is still gated by the user's actual assigned permissions
 * (see `<Can/>`/`useAuth().can`) regardless of which one was picked. An
 * agent who selects "Owner" just sees an owner-shaped page with locked/
 * empty sections; nothing here grants access on its own.
 */
export type LoginMode = "owner" | "agent";

export function landingRouteForLoginMode(mode: LoginMode): string {
  return "/";
}

/**
 * The still-mocked sidebar/dashboard-visibility system
 * (`usePermissions`/`permissions.service.ts`) predates real RBAC and keys
 * its fake permission tables on one of five legacy buckets. Real roles are
 * an arbitrary, data-driven set of slugs (see `rbac/seed.py`), so this maps
 * from real role/scope data down to the closest legacy bucket purely to
 * keep that still-mocked system rendering something sensible until it's
 * migrated to the real flat permission-key list. Never use this for actual
 * authorization — use `useAuth().can(permission)` for that.
 */
export type LegacyRoleBucket =
  | "super_admin"
  | "org_admin"
  | "location_manager"
  | "support_engineer"
  | "read_only";

const ORG_ADMIN_SLUGS = new Set([
  "organization-owner",
  "organization-admin",
  "msp-owner",
  "msp-admin",
]);
const LOCATION_MANAGER_SLUGS = new Set(["location-manager", "office-admin"]);
const SUPPORT_SLUGS = new Set([
  "network-administrator",
  "network-engineer",
  "helpdesk",
  "platform-support",
]);

/**
 * A platform operator: someone holding a role assignment at GLOBAL scope.
 *
 * The same predicate `_authenticated.tsx`, `master.tsx`, `authGuards.ts`,
 * `api.ts` and `legacyRoleBucket` below had each open-coded. Named here
 * because it is now also a decision inside a COMPONENT rather than only in a
 * route guard: `RouterWizard`'s Omada branch submits to
 * `POST /network-integrations/platform/onboard`, which the backend gates at
 * `ScopeType.GLOBAL`. Every route that mounts that wizard happens to require
 * this today, so the choice cannot currently be reached without it -- but the
 * wizard is a component, mountable anywhere, and "the route guard upstream
 * makes this safe" is an invariant held in a comment rather than in code. A
 * venue owner who ever did reach it would fill in a long form and collect a
 * 403 on the last step.
 */
export function hasGlobalScopeRole(roles: RoleAssignment[] | null | undefined): boolean {
  return (roles ?? []).some((r) => r.scopeType === "global");
}

export function legacyRoleBucket(roles: RoleAssignment[]): LegacyRoleBucket {
  if (hasGlobalScopeRole(roles)) return "super_admin";
  if (roles.some((r) => ORG_ADMIN_SLUGS.has(r.roleSlug))) return "org_admin";
  if (roles.some((r) => LOCATION_MANAGER_SLUGS.has(r.roleSlug))) return "location_manager";
  if (roles.some((r) => SUPPORT_SLUGS.has(r.roleSlug))) return "support_engineer";
  return "read_only";
}
