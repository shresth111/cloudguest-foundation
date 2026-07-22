import type { RoleAssignment } from "@/types/auth";

/** Display-only label for the user's highest-priority active role. Never
 * branch app logic on this — use `useAuth().can(permission)` instead. */
export function primaryRoleLabel(roles: RoleAssignment[]): string {
  return roles[0]?.roleName ?? "No role assigned";
}

/** All authenticated users land on the customer dashboard. */
export function homeRoute(): string {
  return "/customer";
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
  return "/customer";
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

const ORG_ADMIN_SLUGS = new Set(["organization-owner", "organization-admin", "msp-owner", "msp-admin"]);
const LOCATION_MANAGER_SLUGS = new Set(["location-manager", "office-admin"]);
const SUPPORT_SLUGS = new Set([
  "network-administrator",
  "network-engineer",
  "helpdesk",
  "platform-support",
]);

export function legacyRoleBucket(roles: RoleAssignment[]): LegacyRoleBucket {
  if (roles.some((r) => r.scopeType === "global")) return "super_admin";
  if (roles.some((r) => ORG_ADMIN_SLUGS.has(r.roleSlug))) return "org_admin";
  if (roles.some((r) => LOCATION_MANAGER_SLUGS.has(r.roleSlug))) return "location_manager";
  if (roles.some((r) => SUPPORT_SLUGS.has(r.roleSlug))) return "support_engineer";
  return "read_only";
}
