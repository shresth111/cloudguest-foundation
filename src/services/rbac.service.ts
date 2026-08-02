import { api } from "@/services/api";
import { routerService } from "@/services/router.service";
import type {
  AssignRolePayload,
  CloneRolePayload,
  CreateRolePayload,
  CreateUserPayload,
  InviteUserPayload,
  InviteUserResult,
  LoginAttemptListQuery,
  LoginAttemptLog,
  PaginatedResult,
  Permission,
  PermissionGroup,
  RbacKpis,
  RbacUser,
  Role,
  ScopeType,
  UpdateRolePayload,
  UpdateUserPayload,
  UserDetail,
  UserListQuery,
  UserRoleAssignment,
} from "@/types/rbac";

// ============================================================================
// Backend wire shapes
// ============================================================================

interface BackendUser {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  username: string;
  phone: string | null;
  profile_photo: string | null;
  designation: string | null;
  department: string | null;
  employee_id: string | null;
  timezone: string;
  language: string;
  status: string;
  is_active: boolean;
  is_verified: boolean;
  data_masking_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendUserListResponse {
  items: BackendUser[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendOrganizationMembershipSummary {
  organization_id: string;
  organization_name: string;
  status: string;
  is_primary_contact: boolean;
  invited_at: string | null;
  joined_at: string | null;
}

interface BackendRoleSummary {
  id: string;
  name: string;
  slug: string;
  scope_type: ScopeType;
  organization_id: string | null;
}

interface BackendUserDetailResponse {
  user: BackendUser;
  organizations: BackendOrganizationMembershipSummary[];
  roles: BackendRoleSummary[];
}

interface BackendInviteUserResponse {
  user: BackendUser;
  temporary_password: string;
}

interface BackendPermission {
  id: string;
  permission_group_id: string;
  key: string;
  action: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface BackendPermissionGroup {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface BackendRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system_role: boolean;
  is_template: boolean;
  is_active: boolean;
  scope_type: ScopeType;
  organization_id: string | null;
  parent_role_id: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

interface BackendUserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  scope_type: ScopeType;
  organization_id: string | null;
  location_id: string | null;
  router_id: string | null;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  is_active: boolean;
}

interface BackendLoginAttemptLog {
  id: string;
  user_id: string | null;
  email: string;
  ip_address: string;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
}

interface BackendLoginAttemptListResponse {
  items: BackendLoginAttemptLog[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// ============================================================================
// Converters
// ============================================================================

function toUser(u: BackendUser): RbacUser {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    fullName: u.full_name,
    email: u.email,
    username: u.username,
    phone: u.phone,
    profilePhoto: u.profile_photo,
    designation: u.designation,
    department: u.department,
    employeeId: u.employee_id,
    timezone: u.timezone,
    language: u.language,
    status: u.status,
    isActive: u.is_active,
    isVerified: u.is_verified,
    dataMaskingEnabled: u.data_masking_enabled,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

function toRoleSummary(r: BackendRoleSummary) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    scopeType: r.scope_type,
    organizationId: r.organization_id,
  };
}

function toUserDetail(d: BackendUserDetailResponse): UserDetail {
  return {
    user: toUser(d.user),
    organizations: d.organizations.map((o) => ({
      organizationId: o.organization_id,
      organizationName: o.organization_name,
      status: o.status,
      isPrimaryContact: o.is_primary_contact,
      invitedAt: o.invited_at,
      joinedAt: o.joined_at,
    })),
    roles: d.roles.map(toRoleSummary),
  };
}

function toPermission(p: BackendPermission): Permission {
  return {
    id: p.id,
    permissionGroupId: p.permission_group_id,
    key: p.key,
    action: p.action,
    name: p.name,
    description: p.description,
    isActive: p.is_active,
  };
}

function toPermissionGroup(g: BackendPermissionGroup): PermissionGroup {
  return {
    id: g.id,
    key: g.key,
    name: g.name,
    description: g.description,
    sortOrder: g.sort_order,
  };
}

function toRole(r: BackendRole): Role {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    isSystemRole: r.is_system_role,
    isTemplate: r.is_template,
    isActive: r.is_active,
    scopeType: r.scope_type,
    organizationId: r.organization_id,
    parentRoleId: r.parent_role_id,
    permissions: r.permissions,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toUserRoleAssignment(a: BackendUserRoleAssignment): UserRoleAssignment {
  return {
    id: a.id,
    userId: a.user_id,
    roleId: a.role_id,
    scopeType: a.scope_type,
    organizationId: a.organization_id,
    locationId: a.location_id,
    routerId: a.router_id,
    grantedAt: a.granted_at,
    grantedBy: a.granted_by,
    expiresAt: a.expires_at,
    isActive: a.is_active,
  };
}

function toLoginAttemptLog(l: BackendLoginAttemptLog): LoginAttemptLog {
  return {
    id: l.id,
    userId: l.user_id,
    email: l.email,
    ipAddress: l.ip_address,
    userAgent: l.user_agent,
    success: l.success,
    failureReason: l.failure_reason,
    createdAt: l.created_at,
  };
}

// ============================================================================
// Service
// ============================================================================

export const rbacService = {
  // -- Users ----------------------------------------------------------------

  /** `organizationId` is optional -- see `listRoles()`'s doc comment, same
   * GLOBAL-vs-ORGANIZATION scope story applies to GET /users. */
  async listUsers(q: UserListQuery, organizationId?: string): Promise<PaginatedResult<RbacUser>> {
    const { data } = await api.get<BackendUserListResponse>("/users", {
      params: {
        search: q.search || undefined,
        is_active: q.isActive,
        page: q.page,
        page_size: q.pageSize,
      },
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return {
      items: data.items.map(toUser),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getUserDetail(id: string): Promise<UserDetail> {
    const { data } = await api.get<BackendUserDetailResponse>(`/users/${id}`);
    return toUserDetail(data);
  },

  async createUser(payload: CreateUserPayload): Promise<RbacUser> {
    const { data } = await api.post<BackendUser>("/users", {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      username: payload.username,
      temporary_password: payload.temporaryPassword,
      phone: payload.phone,
      designation: payload.designation,
      department: payload.department,
      employee_id: payload.employeeId,
      timezone: payload.timezone,
      language: payload.language,
      organization_id: payload.organizationId,
      initial_role_id: payload.initialRoleId,
    });
    return toUser(data);
  },

  // Same GLOBAL-vs-ORGANIZATION scope story as listRoles() above --
  // users.create is only held at ORGANIZATION scope for a customer/org-owner
  // session, and POST /users/invite infers GLOBAL whenever X-Organization-Id
  // is absent even though organization_id is already in the body.
  async inviteUser(payload: InviteUserPayload): Promise<InviteUserResult> {
    const { data } = await api.post<BackendInviteUserResponse>(
      "/users/invite",
      {
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        username: payload.username,
        phone: payload.phone,
        designation: payload.designation,
        department: payload.department,
        employee_id: payload.employeeId,
        timezone: payload.timezone,
        language: payload.language,
        organization_id: payload.organizationId,
        initial_role_id: payload.initialRoleId,
      },
      { headers: payload.organizationId ? { "X-Organization-Id": payload.organizationId } : undefined },
    );
    return { user: toUser(data.user), temporaryPassword: data.temporary_password };
  },

  // organizationId optional on all three -- same GLOBAL-vs-ORGANIZATION
  // scope story as inviteUser()/listRoles() above.
  async updateUser(id: string, payload: UpdateUserPayload, organizationId?: string): Promise<RbacUser> {
    const { data } = await api.put<BackendUser>(
      `/users/${id}`,
      {
        first_name: payload.firstName,
        last_name: payload.lastName,
        phone: payload.phone,
        profile_photo: payload.profilePhoto,
        designation: payload.designation,
        department: payload.department,
        employee_id: payload.employeeId,
        timezone: payload.timezone,
        language: payload.language,
        is_verified: payload.isVerified,
        data_masking_enabled: payload.dataMaskingEnabled,
      },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toUser(data);
  },

  // Self-service data-masking OTP step-up (see backend
  // app/domains/user/router.py's "/me/data-masking..." endpoints) --
  // distinct from updateUser() above, which is the admin-on-someone-else
  // path (or, for AgentsPage.tsx, an owner managing staff). These two
  // always act on the CALLER's own account; the backend derives the OTP
  // identifier from the session (SMS to their phone if one's on file,
  // email otherwise), never a client-supplied id/email/phone. Returns the
  // backend's own message ("Verification code sent via sms to
  // +91••••••210") so the UI never has to guess which channel was used.
  async requestOwnDataMaskingOtp(): Promise<string> {
    const { data } = await api.post<{ message: string }>("/me/data-masking/otp");
    return data.message;
  },

  async verifyOwnDataMaskingOtp(code: string, masked: boolean): Promise<RbacUser> {
    const { data } = await api.post<BackendUser>("/me/data-masking", { code, masked });
    return toUser(data);
  },

  async activateUser(id: string, organizationId?: string): Promise<RbacUser> {
    const { data } = await api.post<BackendUser>(`/users/${id}/activate`, undefined, {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return toUser(data);
  },

  async deactivateUser(id: string, organizationId?: string): Promise<RbacUser> {
    const { data } = await api.post<BackendUser>(`/users/${id}/deactivate`, undefined, {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return toUser(data);
  },

  /** Real, immediate session termination -- unlike deactivate, the account
   * itself stays active (they can sign back in right away); this only
   * ends whatever session(s) exist right now, on the target's very next
   * request, not just their next natural token expiry. See the backend's
   * `UserService.force_logout_user` for the full "why two steps" writeup. */
  async forceLogoutUser(id: string, organizationId?: string): Promise<RbacUser> {
    const { data } = await api.post<BackendUser>(`/users/${id}/force-logout`, undefined, {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return toUser(data);
  },

  // -- Permissions / Permission Groups (read-only, seeded) -------------------

  // `organizationId` optional -- same GLOBAL-vs-ORGANIZATION scope story as
  // listRoles()/listUsers(): permissions.read is only held at ORGANIZATION
  // scope for a customer/org-owner session, and these endpoints infer
  // GLOBAL scope whenever X-Organization-Id is absent.
  async listPermissionGroups(organizationId?: string): Promise<PermissionGroup[]> {
    const { data } = await api.get<BackendPermissionGroup[]>("/permission-groups", {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return data.map(toPermissionGroup);
  },

  async listPermissions(permissionGroupId?: string, organizationId?: string): Promise<Permission[]> {
    const { data } = await api.get<BackendPermission[]>("/permissions", {
      params: { permission_group_id: permissionGroupId },
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return data.map(toPermission);
  },

  // -- Roles ------------------------------------------------------------------

  /** `organizationId` is optional -- platform/Master callers (no org
   * context) omit it and see every role at GLOBAL scope, same as before.
   * An org-scoped caller (e.g. a customer's own Manage Agents page) must
   * pass its own org id: roles.read is only held at ORGANIZATION scope for
   * that kind of session, and GET /roles infers GLOBAL scope whenever
   * X-Organization-Id is absent -- omitting it 403'd for every non-platform
   * caller. */
  async listRoles(organizationId?: string): Promise<Role[]> {
    const { data } = await api.get<BackendRole[]>("/roles", {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return data.map(toRole);
  },

  // `organizationId` optional -- same GLOBAL-vs-ORGANIZATION scope story as
  // listRoles(): roles.create is only held at ORGANIZATION scope for a
  // customer/org-owner session, and POST /roles infers GLOBAL scope
  // whenever X-Organization-Id is absent even though organization_id is
  // already in the body.
  async createRole(payload: CreateRolePayload, organizationId?: string): Promise<Role> {
    const { data } = await api.post<BackendRole>(
      "/roles",
      {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        scope_type: payload.scopeType,
        organization_id: payload.organizationId,
        parent_role_id: payload.parentRoleId,
        is_template: payload.isTemplate ?? false,
        permission_keys: payload.permissionKeys,
        allowed_scope_types: payload.allowedScopeTypes ?? [],
      },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toRole(data);
  },

  // `organizationId` optional, same story -- roles.update is only held at
  // ORGANIZATION scope for a customer/org-owner session. `permissionKeys`,
  // when passed, is a full replacement of the role's permission set and
  // rides on this same `roles.update` permission rather than the separate
  // attach/detach-one-permission endpoints' `roles.manage` (which an
  // Organization Owner does not hold by default -- see the backend's
  // RoleUpdateRequest doc comment).
  async updateRole(id: string, payload: UpdateRolePayload, organizationId?: string): Promise<Role> {
    const { data } = await api.put<BackendRole>(
      `/roles/${id}`,
      {
        name: payload.name,
        description: payload.description,
        is_template: payload.isTemplate,
        parent_role_id: payload.parentRoleId,
        permission_keys: payload.permissionKeys,
      },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toRole(data);
  },

  async deleteRole(id: string, organizationId?: string): Promise<void> {
    await api.delete(`/roles/${id}`, {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
  },

  // Same missing-X-Organization-Id gap as vlan/dhcp/firewall/connected-
  // devices this session -- these 5 had no `organizationId` parameter at
  // all (unlike their createRole/updateRole/deleteRole siblings just
  // above), so the header could never be attached. Confirmed live: a real
  // org-owner session 403'd at GLOBAL scope with no header.
  async cloneRole(id: string, payload: CloneRolePayload, organizationId?: string): Promise<Role> {
    const { data } = await api.post<BackendRole>(
      `/roles/${id}/clone`,
      {
        new_name: payload.newName,
        new_slug: payload.newSlug,
        target_organization_id: payload.targetOrganizationId,
      },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toRole(data);
  },

  async activateRole(id: string, organizationId?: string): Promise<Role> {
    const { data } = await api.post<BackendRole>(`/roles/${id}/activate`, undefined, {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return toRole(data);
  },

  async deactivateRole(id: string, organizationId?: string): Promise<Role> {
    const { data } = await api.post<BackendRole>(`/roles/${id}/deactivate`, undefined, {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return toRole(data);
  },

  async attachRolePermission(
    roleId: string,
    permissionKey: string,
    organizationId?: string,
  ): Promise<Role> {
    const { data } = await api.post<BackendRole>(
      `/roles/${roleId}/permissions`,
      { permission_key: permissionKey },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toRole(data);
  },

  async detachRolePermission(
    roleId: string,
    permissionKey: string,
    organizationId?: string,
  ): Promise<Role> {
    const { data } = await api.delete<BackendRole>(
      `/roles/${roleId}/permissions/${encodeURIComponent(permissionKey)}`,
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toRole(data);
  },

  // -- Role assignment (scoped, per user) ------------------------------------

  // `organizationId` optional on all three -- same GLOBAL-vs-ORGANIZATION
  // scope story as listRoles()/listUsers() above: users.read/roles.assign
  // are only held at ORGANIZATION scope for a customer/org-owner session,
  // and these endpoints infer GLOBAL whenever X-Organization-Id is absent.
  async listUserRoleAssignments(userId: string, organizationId?: string): Promise<UserRoleAssignment[]> {
    const { data } = await api.get<{ items: BackendUserRoleAssignment[] }>(
      `/users/${userId}/roles`,
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return data.items.map(toUserRoleAssignment);
  },

  async assignRole(userId: string, payload: AssignRolePayload, organizationId?: string): Promise<UserRoleAssignment> {
    const { data } = await api.post<BackendUserRoleAssignment>(
      `/users/${userId}/roles`,
      {
        role_id: payload.roleId,
        scope_type: payload.scopeType,
        organization_id: payload.organizationId,
        location_id: payload.locationId,
        router_id: payload.routerId,
        expires_at: payload.expiresAt,
      },
      { headers: organizationId ? { "X-Organization-Id": organizationId } : undefined },
    );
    return toUserRoleAssignment(data);
  },

  async revokeRoleAssignment(userId: string, assignmentId: string, organizationId?: string): Promise<void> {
    await api.delete(`/users/${userId}/roles/${assignmentId}`, {
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
  },

  async getUserPermissions(userId: string): Promise<string[]> {
    const { data } = await api.get<{ user_id: string; permissions: string[] }>(
      `/users/${userId}/permissions`,
    );
    return data.permissions;
  },

  // -- Login attempts (admin-facing, via controller-logs) --------------------

  async listLoginAttempts(q: LoginAttemptListQuery): Promise<PaginatedResult<LoginAttemptLog>> {
    const { data } = await api.get<BackendLoginAttemptListResponse>(
      "/controller-logs/authentication/admin",
      {
        params: {
          email: q.email || undefined,
          success: q.success,
          page: q.page,
          page_size: q.pageSize,
        },
      },
    );
    return {
      items: data.items.map(toLoginAttemptLog),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  // -- Organizations/locations/routers (reuses the already-migrated Router
  // service's own fan-out fetchers for pickers) ------------------------------

  async organizations(): Promise<{ id: string; name: string }[]> {
    return routerService.organizations();
  },

  async locations(): Promise<{ id: string; name: string; organizationId: string }[]> {
    return routerService.locations();
  },

  // -- KPIs (derived from real list totals, no fabricated counters) ---------

  async getKpis(): Promise<RbacKpis> {
    const [totalPage, activePage, inactivePage, roles, failedLoginsPage] = await Promise.all([
      rbacService.listUsers({ page: 1, pageSize: 1 }),
      rbacService.listUsers({ page: 1, pageSize: 1, isActive: true }),
      rbacService.listUsers({ page: 1, pageSize: 1, isActive: false }),
      rbacService.listRoles(),
      rbacService.listLoginAttempts({ page: 1, pageSize: 1, success: false }),
    ]);
    return {
      totalUsers: totalPage.totalItems,
      activeUsers: activePage.totalItems,
      inactiveUsers: inactivePage.totalItems,
      totalRoles: roles.length,
      customRoles: roles.filter((r) => !r.isSystemRole).length,
      failedLogins: failedLoginsPage.totalItems,
    };
  },
};
