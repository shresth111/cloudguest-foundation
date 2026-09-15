import type { Role } from "@/types/rbac";

/** The seeded role every organization must keep a holder of. The backend
 * refuses to edit or delete it (OwnerRoleProtectedError); Staff Access hides
 * the actions rather than offering buttons that always fail. */
export const ORGANIZATION_OWNER_ROLE_SLUG = "organization-owner";

export function isProtectedOwnerRole(role: Pick<Role, "slug">): boolean {
  return role.slug === ORGANIZATION_OWNER_ROLE_SLUG;
}

/** A built-in role is shared by every organization (`organizationId` null).
 * From a customer session the backend edits it copy-on-write (this
 * organization gets its own copy) and deletes it by hiding it for this
 * organization only -- the shared row is never changed. */
export function isBuiltInRole(role: Pick<Role, "organizationId">): boolean {
  return role.organizationId === null;
}
