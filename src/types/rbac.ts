export type RbacUserStatus = "active" | "disabled" | "invited" | "locked";

export interface RbacUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  organizationId: string;
  organizationName: string;
  locationIds: string[];
  departmentId: string;
  departmentName: string;
  designation: string;
  roleId: string;
  roleName: string;
  status: RbacUserStatus;
  lastLoginAt?: number;
  mfaEnabled: boolean;
  language: string;
  timezone: string;
  avatarColor: string;
  createdAt: number;
}

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "import"
  | "approve"
  | "publish"
  | "configure";

export const PERMISSION_ACTIONS: PermissionAction[] = [
  "view", "create", "edit", "delete", "export", "import", "approve", "publish", "configure",
];

export type RbacModule =
  | "dashboard"
  | "organizations"
  | "locations"
  | "routers"
  | "guests"
  | "portal"
  | "monitoring"
  | "analytics"
  | "billing"
  | "white_label"
  | "ai_assistant"
  | "support"
  | "audit"
  | "settings"
  | "api"
  | "integrations";

export const RBAC_MODULES: { key: RbacModule; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "organizations", label: "Organizations" },
  { key: "locations", label: "Locations" },
  { key: "routers", label: "Routers" },
  { key: "guests", label: "Guest WiFi" },
  { key: "portal", label: "Captive Portal" },
  { key: "monitoring", label: "Monitoring" },
  { key: "analytics", label: "Analytics" },
  { key: "billing", label: "Billing" },
  { key: "white_label", label: "White Label" },
  { key: "ai_assistant", label: "AI Assistant" },
  { key: "support", label: "Support" },
  { key: "audit", label: "Audit Logs" },
  { key: "settings", label: "Platform Settings" },
  { key: "api", label: "API" },
  { key: "integrations", label: "Integrations" },
];

export type RbacPermissions = Partial<Record<RbacModule, Partial<Record<PermissionAction, boolean>>>>;

export type RoleStatus = "active" | "archived";

export interface RbacRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  usersAssigned: number;
  permissions: RbacPermissions;
  status: RoleStatus;
  createdAt: number;
}

export interface RbacDepartment {
  id: string;
  name: string;
  members: number;
}

export interface RbacUserGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  roleId: string;
}

export interface RbacInvitation {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  organizationName: string;
  status: "pending" | "accepted" | "expired";
  invitedBy: string;
  invitedAt: number;
  expiresAt: number;
}

export interface RbacSession {
  id: string;
  userId: string;
  userName: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  loginAt: number;
  current: boolean;
}

export interface RbacLoginEvent {
  id: string;
  userId: string;
  userName: string;
  loginAt: number;
  logoutAt?: number;
  browser: string;
  device: string;
  os: string;
  ipAddress: string;
  mfaUsed: boolean;
  outcome: "success" | "failed";
  reason?: string;
}

export interface RbacLocationNode {
  id: string;
  name: string;
  children?: RbacLocationNode[];
}

export interface RbacKpis {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  totalRoles: number;
  customRoles: number;
  pendingInvites: number;
  activeSessions: number;
  failedLogins24h: number;
}

export interface RbacPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  expiryDays: number;
  historyCount: number;
  lockoutAttempts: number;
  lockoutMinutes: number;
}

export interface RbacMfaState {
  enabled: boolean;
  methods: Array<"email" | "sms" | "authenticator">;
  lastVerifiedAt?: number;
  backupCodesRemaining: number;
}
