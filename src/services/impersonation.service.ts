import { api } from "@/services/api";
import {
  toOrganizations,
  toRoles,
  type BackendOrganizationMembership,
  type BackendRoleAssignment,
} from "@/services/auth.service";
import type { OrganizationMembership, RoleAssignment } from "@/types/auth";

/** `POST /users/{user_id}/impersonate`'s success payload (already unwrapped
 * from the `{ success, message, data, request_id }` envelope by api.ts's
 * response interceptor). Only ever succeeds for a caller holding a
 * GLOBAL-scope role -- a 403 here is the real backstop; client-side
 * capability gating (see MasterShell's `impersonate` capability) is just
 * UX, not the security boundary. */
interface BackendImpersonateResponse {
  access_token: string;
  expires_at: string;
  target_user: {
    id: string;
    full_name: string;
    email: string;
    username: string;
  };
  /** The target's REAL role assignments and active memberships, in the exact
   * shape `POST /auth/login` returns them (the backend builds both with the
   * same helpers). Absent from a backend older than cloud-guest's
   * "impersonate returns the target's real grants" change -- `undefined`
   * then, never an invented list. */
  roles?: BackendRoleAssignment[];
  organizations?: BackendOrganizationMembership[];
}

export interface ImpersonationTargetUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
}

export interface ImpersonationSession {
  accessToken: string;
  expiresAt: string;
  targetUser: ImpersonationTargetUser;
  /** `null` when the backend did not report them (older backend). */
  roles: RoleAssignment[] | null;
  organizations: OrganizationMembership[] | null;
}

export const impersonationService = {
  /** Starts a time-boxed (server-enforced, ~30 minute) session as
   * `userId`. `reason` is a free-text audit note, optional. */
  async impersonate(userId: string, reason: string | null): Promise<ImpersonationSession> {
    const { data } = await api.post<BackendImpersonateResponse>(`/users/${userId}/impersonate`, {
      reason,
    });
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_at,
      targetUser: {
        id: data.target_user.id,
        fullName: data.target_user.full_name,
        email: data.target_user.email,
        username: data.target_user.username,
      },
      roles: Array.isArray(data.roles) ? toRoles(data.roles) : null,
      organizations: Array.isArray(data.organizations) ? toOrganizations(data.organizations) : null,
    };
  },
};
