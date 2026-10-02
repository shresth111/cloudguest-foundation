import type { OrganizationMembership, RoleAssignment } from "@/types/auth";

/** Input to `beginImpersonation` -- `POST /users/{id}/impersonate`'s
 * response (`accessToken`, `expiresAt`, `targetUser`, and -- from a backend
 * that reports them -- the target's REAL `roles`/`organizations`), plus the
 * organization the operator chose in the Master drawer. */
export interface BeginImpersonationInput {
  accessToken: string;
  expiresAt: string;
  targetUser: { id: string; fullName: string; email: string; username: string };
  organization: { id: string; name: string; slug: string };
  /** `null`/absent: the backend did not report them (older backend). */
  roles?: RoleAssignment[] | null;
  organizations?: OrganizationMembership[] | null;
}

/** Thrown by `beginImpersonation` when the session it would start cannot be
 * the customer's own -- nothing has been swapped when it is thrown. */
export class ImpersonationRefusedError extends Error {}

/** What the impersonated session holds, decided BEFORE anything is swapped.
 *
 * Pure, and kept out of AuthContext.tsx so scripts/test-impersonation-session.mjs
 * can drive it directly.
 *
 * The session is the customer's, exactly: their real role assignments and
 * their real active memberships, as the backend reports them. It used to be
 * invented here -- one placeholder organization-scoped role plus the
 * organization picked in the drawer -- and an invented session is wrong in
 * exactly the cases that matter: a customer whose grant is location-scoped
 * lost the location roles `customerService.listLocations()` falls back on
 * when the org-wide read 403s, so the venue list read "No locations yet"; and
 * a target who is not an active member of the drawer's organization got a
 * session pointed at a tenant the backend refuses them on every request.
 *
 * Refuses (throws {@link ImpersonationRefusedError}) rather than starting a
 * session that cannot work or that would carry more than the customer holds:
 *  - any GLOBAL-scope role in the reported grants (the backend refuses to
 *    impersonate staff; this is the client-side backstop -- a global role in
 *    the impersonated session would reopen the Master console as the
 *    customer);
 *  - a target with no active membership in the chosen organization.
 *
 * Falls back to the old placeholder ONLY when the backend reported no grants
 * at all (a backend older than the change that added them), so deploying the
 * frontend first does not break the feature. */
export function resolveImpersonatedGrants(input: BeginImpersonationInput): {
  roles: RoleAssignment[];
  organizations: OrganizationMembership[];
} {
  const reportedRoles = Array.isArray(input.roles) ? input.roles : null;
  const reportedOrgs = Array.isArray(input.organizations) ? input.organizations : null;

  if (reportedRoles?.some((r) => r.scopeType === "global")) {
    throw new ImpersonationRefusedError(
      `${input.targetUser.email} holds a platform-wide role -- staff accounts cannot be viewed as a customer.`,
    );
  }

  if (reportedOrgs === null) {
    return {
      roles: reportedRoles?.length
        ? reportedRoles
        : [
            {
              roleId: "impersonated-session",
              roleName: "Customer (impersonated)",
              roleSlug: "impersonated-customer",
              scopeType: "organization",
              organizationId: input.organization.id,
            },
          ],
      organizations: [
        {
          organizationId: input.organization.id,
          organizationName: input.organization.name,
          organizationSlug: input.organization.slug,
          isPrimaryContact: true,
          enabledFeatures: ["all"],
        },
      ],
    };
  }

  const chosen = reportedOrgs.find((o) => o.organizationId === input.organization.id);
  if (!chosen) {
    throw new ImpersonationRefusedError(
      `${input.targetUser.email} is not an active member of ${input.organization.name}, so there is no ${input.organization.name} dashboard to view as them.`,
    );
  }
  // The chosen organization first: WorkspaceProvider and the request
  // interceptor's default both read `organizations[0]` as the active one.
  return {
    roles: reportedRoles ?? [],
    organizations: [chosen, ...reportedOrgs.filter((o) => o !== chosen)],
  };
}

