import { api } from "@/services/api";
import type {
  AuthSelfSession,
  AuthSession,
  AuthTokens,
  LoginCredentials,
  MfaEnrollResult,
  OrganizationMembership,
  RoleAssignment,
  User,
} from "@/types/auth";

interface BackendUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone?: string | null;
  profile_photo?: string | null;
  designation?: string | null;
  department?: string | null;
  timezone: string;
  language: string;
  status: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string | null;
}

interface BackendTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
}

interface BackendRoleAssignment {
  role_id: string;
  role_name: string;
  role_slug: string;
  scope_type: RoleAssignment["scopeType"];
  organization_id?: string | null;
  location_id?: string | null;
  router_id?: string | null;
}

interface BackendOrganizationMembership {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  is_primary_contact: boolean;
  enabled_features: string[];
}

interface BackendLoginResponse {
  user: BackendUser;
  tokens: BackendTokens;
  session_id: string;
  roles: BackendRoleAssignment[];
  organizations: BackendOrganizationMembership[];
}

function toUser(u: BackendUser): User {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    name: `${u.first_name} ${u.last_name}`.trim(),
    email: u.email,
    username: u.username,
    phone: u.phone,
    profilePhoto: u.profile_photo,
    designation: u.designation,
    department: u.department,
    timezone: u.timezone,
    language: u.language,
    status: u.status,
    isActive: u.is_active,
    isVerified: u.is_verified,
    lastLoginAt: u.last_login_at,
  };
}

function toTokens(t: BackendTokens): AuthTokens {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    tokenType: t.token_type,
    expiresIn: t.expires_in,
    refreshExpiresIn: t.refresh_expires_in,
  };
}

function toRoles(roles: BackendRoleAssignment[]): RoleAssignment[] {
  return roles.map((r) => ({
    roleId: r.role_id,
    roleName: r.role_name,
    roleSlug: r.role_slug,
    scopeType: r.scope_type,
    organizationId: r.organization_id,
    locationId: r.location_id,
    routerId: r.router_id,
  }));
}

function toOrganizations(orgs: BackendOrganizationMembership[]): OrganizationMembership[] {
  return orgs.map((o) => ({
    organizationId: o.organization_id,
    organizationName: o.organization_name,
    organizationSlug: o.organization_slug,
    isPrimaryContact: o.is_primary_contact,
    enabledFeatures: o.enabled_features,
  }));
}

interface BackendSelfSession {
  id: string;
  device_id: string;
  device_name: string | null;
  ip_address: string;
  user_agent: string;
  location: string | null;
  is_current: boolean;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
}

function toSelfSession(s: BackendSelfSession): AuthSelfSession {
  return {
    id: s.id,
    deviceId: s.device_id,
    deviceName: s.device_name,
    ipAddress: s.ip_address,
    userAgent: s.user_agent,
    location: s.location,
    isCurrent: s.is_current,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    lastActivityAt: s.last_activity_at,
  };
}

function toSession(res: BackendLoginResponse): AuthSession {
  return {
    user: toUser(res.user),
    tokens: toTokens(res.tokens),
    sessionId: res.session_id,
    roles: toRoles(res.roles),
    organizations: toOrganizations(res.organizations),
  };
}

export const authService = {
  async login(creds: LoginCredentials): Promise<AuthSession> {
    const { data } = await api.post<BackendLoginResponse>("/auth/login", {
      email: creds.email,
      password: creds.password,
      mfa_code: creds.mfaCode,
    });
    return toSession(data);
  },

  async logout(refreshToken: string | null): Promise<void> {
    await api.post("/auth/logout", { refresh_token: refreshToken ?? undefined });
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { data } = await api.post<BackendTokens>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return toTokens(data);
  },

  async me(): Promise<User> {
    const { data } = await api.get<BackendUser>("/auth/me");
    return toUser(data);
  },

  async myPermissions(): Promise<string[]> {
    const { data } = await api.get<{ user_id: string; permissions: string[] }>("/me/permissions");
    return data.permissions;
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post("/auth/forgot-password", { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post("/auth/reset-password", { token, new_password: newPassword });
  },

  async verifyEmail(token: string): Promise<void> {
    await api.post("/auth/verify-email", { token });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  // -- Sessions (self-service only -- no admin endpoint exists to view
  // another user's sessions) -------------------------------------------------

  async listSessions(): Promise<AuthSelfSession[]> {
    const { data } = await api.get<{ sessions: BackendSelfSession[]; total: number }>(
      "/auth/sessions",
    );
    return data.sessions.map(toSelfSession);
  },

  async revokeSession(sessionId: string): Promise<void> {
    await api.delete(`/auth/sessions/${sessionId}`);
  },

  async logoutAllSessions(): Promise<void> {
    await api.delete("/auth/logout-all");
  },

  // -- MFA (self-service TOTP only) ------------------------------------------

  async enrollMfa(): Promise<MfaEnrollResult> {
    const { data } = await api.post<{ secret: string; provisioning_uri: string }>(
      "/auth/mfa/enroll",
    );
    return { secret: data.secret, provisioningUri: data.provisioning_uri };
  },

  async verifyMfa(code: string): Promise<string[]> {
    const { data } = await api.post<{ recovery_codes: string[] }>("/auth/mfa/verify", { code });
    return data.recovery_codes;
  },

  async disableMfa(password: string, code: string): Promise<void> {
    await api.post("/auth/mfa/disable", { password, code });
  },

  async regenerateMfaRecoveryCodes(code: string): Promise<string[]> {
    const { data } = await api.post<{ recovery_codes: string[] }>(
      "/auth/mfa/recovery-codes/regenerate",
      { code },
    );
    return data.recovery_codes;
  },
};
