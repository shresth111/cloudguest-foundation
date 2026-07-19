export type FeatureStatus = "enabled" | "disabled" | "upgrade_required";

export interface FeatureCard {
  key: string;
  name: string;
  description: string;
  category: string;
  status: FeatureStatus;
}

export interface ModuleLimits {
  locations: number;
  routers: number;
  nas: number;
  guests: number;
  concurrentSessions: number;
  staff: number;
  apiKeys: number;
  storageGb: number;
  smsCredits: number;
  emailCredits: number;
}

export interface UsageSnapshot {
  locations: number;
  routers: number;
  nas: number;
  guests: number;
  bandwidthGb: number;
  storageGb: number;
  emails: number;
  sms: number;
  apiCalls: number;
}

export interface NasGroup {
  id: string;
  name: string;
  description: string;
  policyId?: string;
  nasCount: number;
}

export interface NasDevice {
  id: string;
  nasIdentifier: string;
  routerIdentity: string;
  name: string;
  serialNumber: string;
  model: string;
  routerOsVersion: string;
  publicIp: string;
  privateIp: string;
  locationId: string;
  locationName: string;
  groupId?: string;
  status: "online" | "offline" | "degraded";
  description?: string;
}

export interface FeaturePolicy {
  id: string;
  name: string;
  description: string;
  features: Record<string, boolean>;
  routerOps: Record<string, boolean>;
  assignments: PolicyAssignment[];
  updatedAt: string;
}

export type PolicyAssignmentScope = "customer" | "location" | "nas_group" | "nas";
export interface PolicyAssignment {
  scope: PolicyAssignmentScope;
  targetId: string;
  targetLabel: string;
}

export interface IntegrationRow {
  key: string;
  name: string;
  category: string;
  enabled: boolean;
  configured: boolean;
}

export interface ApiKeyRow {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed?: string;
}

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
}

export interface SecurityConfig {
  mfaRequired: boolean;
  passwordMinLength: number;
  passwordRotationDays: number;
  sessionTimeoutMinutes: number;
  ipAllowlist: string[];
  allowedDomains: string[];
}

export interface NotificationChannel {
  key: "email" | "sms" | "push" | "webhook";
  enabled: boolean;
  events: string[];
}

export interface TenantAuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  meta?: string;
}

export const ROUTER_OPS = [
  "view",
  "restart",
  "backup",
  "restore",
  "export_config",
  "push_config",
  "terminal",
  "upgrade_os",
  "factory_reset",
  "delete",
] as const;

export const ROUTER_OP_LABELS: Record<(typeof ROUTER_OPS)[number], string> = {
  view: "View router",
  restart: "Restart router",
  backup: "Backup router",
  restore: "Restore router",
  export_config: "Export config",
  push_config: "Push config",
  terminal: "Open terminal",
  upgrade_os: "Upgrade RouterOS",
  factory_reset: "Factory reset",
  delete: "Delete router",
};
