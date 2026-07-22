export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  username: string;
  phone?: string | null;
  profilePhoto?: string | null;
  designation?: string | null;
  department?: string | null;
  timezone: string;
  language: string;
  status: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string | null;
}

/** One active role assignment, at whatever scope it was granted. */
export interface RoleAssignment {
  roleId: string;
  roleName: string;
  roleSlug: string;
  scopeType: "global" | "organization" | "location" | "router" | "device";
  organizationId?: string | null;
  locationId?: string | null;
  routerId?: string | null;
}

/** One organization the caller is an active member of. */
export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  isPrimaryContact: boolean;
  enabledFeatures: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
  sessionId: string;
  roles: RoleAssignment[];
  organizations: OrganizationMembership[];
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
  mfaCode?: string;
}

/** A real, self-service-only active session (see `/auth/sessions`) --
 * `deviceId` is a server-derived ip+user-agent hash, not a device
 * fingerprint; `location` is always null today (no geo-IP wired). */
export interface AuthSelfSession {
  id: string;
  deviceId: string;
  deviceName: string | null;
  ipAddress: string;
  userAgent: string;
  location: string | null;
  isCurrent: boolean;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

export interface MfaEnrollResult {
  secret: string;
  provisioningUri: string;
}
