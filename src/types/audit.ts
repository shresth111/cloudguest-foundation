export type AuditSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AuditStatus = "success" | "failure" | "warning" | "pending";

export type AuditCategory =
  | "authentication"
  | "security"
  | "configuration"
  | "network"
  | "system"
  | "billing"
  | "api"
  | "user"
  | "guest";

export type AuditAction =
  // authentication
  | "user.login"
  | "user.logout"
  | "user.password_reset"
  | "user.mfa_enabled"
  | "user.mfa_disabled"
  // security
  | "security.failed_login"
  | "security.multiple_failed_logins"
  | "security.permission_changed"
  | "security.suspicious_activity"
  | "security.unauthorized_access"
  | "security.api_key_created"
  | "security.api_key_deleted"
  // configuration
  | "config.settings_changed"
  | "config.branding_updated"
  | "config.feature_flag_toggled"
  // network / routers
  | "router.added"
  | "router.updated"
  | "router.deleted"
  | "router.online"
  | "router.offline"
  | "network.wireguard_connected"
  | "network.wireguard_disconnected"
  | "network.radius_authentication"
  | "network.authentication_failed"
  | "portal.published"
  // guest
  | "guest.login"
  | "guest.logout"
  | "guest.session_started"
  | "guest.session_ended"
  // billing
  | "billing.updated"
  | "billing.subscription_changed"
  | "billing.invoice_created"
  // system
  | "system.server_started"
  | "system.server_restarted"
  | "system.backup_completed"
  | "system.backup_failed"
  | "system.database_migration"
  | "system.cache_cleared"
  | "system.queue_restarted"
  | "system.redis_connected"
  | "system.redis_failed"
  | "system.api_restarted"
  // org/location
  | "org.created"
  | "location.added"
  // api
  | "api.request";

export interface AuditActor {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface AuditContext {
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  location?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: AuditActor;
  organizationId: string;
  organizationName: string;
  locationId?: string;
  locationName?: string;
  module: string;
  action: AuditAction;
  category: AuditCategory;
  resource: string;
  resourceId?: string;
  status: AuditStatus;
  severity: AuditSeverity;
  message: string;
  context: AuditContext;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  stackTrace?: string;
  pinned?: boolean;
}

export interface AuditKpis {
  totalLogs: number;
  securityEvents: number;
  loginEvents: number;
  configurationChanges: number;
  apiActivities: number;
  failedLogins: number;
  criticalEvents: number;
  todaysActivities: number;
}

export interface AuditFilters {
  search?: string;
  organizationId?: string;
  locationId?: string;
  userId?: string;
  category?: AuditCategory | "all";
  action?: AuditAction | "all";
  module?: string | "all";
  severity?: AuditSeverity | "all";
  status?: AuditStatus | "all";
  ipAddress?: string;
  device?: string;
  browser?: string;
  from?: string;
  to?: string;
}

export interface PaginatedLogs {
  rows: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditAnalytics {
  daily: { date: string; total: number; security: number; api: number }[];
  weekly: { week: string; total: number }[];
  monthly: { month: string; total: number }[];
  loginTrend: { date: string; success: number; failed: number }[];
  apiUsage: { hour: string; requests: number }[];
  configChanges: { date: string; changes: number }[];
  userActivity: { name: string; value: number }[];
  categoryBreakdown: { category: string; value: number }[];
}

export interface RetentionSettings {
  retentionDays: number;
  autoCleanup: boolean;
  archiveEnabled: boolean;
  archiveAfterDays: number;
  storageUsedMb: number;
  storageQuotaMb: number;
}

export interface UserActivityRecord {
  userId: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string;
  activeSessions: number;
  devices: string[];
  browsers: string[];
  os: string[];
  loginHistory: { at: string; ip: string; device: string; status: AuditStatus }[];
  logoutHistory: { at: string; ip: string }[];
}
