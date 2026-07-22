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
