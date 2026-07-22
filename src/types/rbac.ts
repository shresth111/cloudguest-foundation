export type ScopeType = "global" | "organization" | "location" | "router" | "device";

export const SCOPE_TYPE_LABEL: Record<ScopeType, string> = {
  global: "Global",
  organization: "Organization",
  location: "Location",
  router: "Router",
  device: "Device",
};

// ============================================================================
// Users
// ============================================================================

export interface RbacUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  username: string;
  phone: string | null;
  profilePhoto: string | null;
  designation: string | null;
  department: string | null;
  employeeId: string | null;
  timezone: string;
  language: string;
  status: string;
  isActive: boolean;
  isVerified: boolean;
  dataMaskingEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserOrganizationMembership {
  organizationId: string;
  organizationName: string;
  status: string;
  isPrimaryContact: boolean;
  invitedAt: string | null;
  joinedAt: string | null;
}

export interface RoleSummary {
  id: string;
  name: string;
  slug: string;
  scopeType: ScopeType;
  organizationId: string | null;
}

export interface UserDetail {
  user: RbacUser;
  organizations: UserOrganizationMembership[];
  roles: RoleSummary[];
}

export interface UserListQuery {
  search?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  temporaryPassword: string;
  phone?: string | null;
  designation?: string | null;
  department?: string | null;
  employeeId?: string | null;
  timezone?: string;
  language?: string;
  organizationId?: string | null;
  initialRoleId?: string | null;
}

export interface InviteUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone?: string | null;
  designation?: string | null;
  department?: string | null;
  employeeId?: string | null;
  timezone?: string;
  language?: string;
  organizationId?: string | null;
  initialRoleId?: string | null;
}

export interface InviteUserResult {
  user: RbacUser;
  temporaryPassword: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  profilePhoto?: string | null;
  designation?: string | null;
  department?: string | null;
  employeeId?: string | null;
  timezone?: string;
  language?: string;
  isVerified?: boolean;
  dataMaskingEnabled?: boolean;
}

// ============================================================================
// Permissions / Permission Groups (read-only, seeded)
// ============================================================================

export interface Permission {
  id: string;
  permissionGroupId: string;
  key: string;
  action: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface PermissionGroup {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

// ============================================================================
// Roles
// ============================================================================

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemRole: boolean;
  isTemplate: boolean;
  isActive: boolean;
  scopeType: ScopeType;
  organizationId: string | null;
  parentRoleId: string | null;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRolePayload {
  name: string;
  slug: string;
  description?: string | null;
  scopeType: ScopeType;
  organizationId?: string | null;
  parentRoleId?: string | null;
  isTemplate?: boolean;
  permissionKeys: string[];
  allowedScopeTypes?: ScopeType[];
}

export interface UpdateRolePayload {
  name?: string;
  description?: string | null;
  isTemplate?: boolean;
  parentRoleId?: string | null;
}

export interface CloneRolePayload {
  newName: string;
  newSlug: string;
  targetOrganizationId?: string | null;
}

// ============================================================================
// Role assignments (scoped, per user)
// ============================================================================

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  organizationId: string | null;
  locationId: string | null;
  routerId: string | null;
  grantedAt: string;
  grantedBy: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

export interface AssignRolePayload {
  roleId: string;
  scopeType: ScopeType;
  organizationId?: string | null;
  locationId?: string | null;
  routerId?: string | null;
  expiresAt?: string | null;
}

// ============================================================================
// Login attempts (admin-facing, via controller-logs authentication/admin)
// ============================================================================

export interface LoginAttemptLog {
  id: string;
  userId: string | null;
  email: string;
  ipAddress: string;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

export interface LoginAttemptListQuery {
  email?: string;
  success?: boolean;
  page: number;
  pageSize: number;
}

// ============================================================================
// Pagination (shared shape)
// ============================================================================

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================================
// KPIs (all derived from real list totals -- no fabricated counters)
// ============================================================================

export interface RbacKpis {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalRoles: number;
  customRoles: number;
  failedLogins: number;
}
