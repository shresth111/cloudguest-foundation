// ============================================================================
// Health Engine
// ============================================================================

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export type HealthComponent =
  | "database"
  | "redis"
  | "api"
  | "auth"
  | "storage"
  | "celery"
  | "websocket"
  | "freeradius"
  | "wireguard";

export interface HealthCheck {
  component: string;
  status: HealthStatus;
  checkedAt: string;
  responseTimeMs: number | null;
  details: Record<string, unknown> | null;
  errorMessage: string | null;
}

export interface ServiceHealth {
  component: string;
  status: HealthStatus;
  lastCheckedAt: string | null;
  consecutiveFailureCount: number;
  updatedAt: string;
}

export interface DashboardSummary {
  overallStatus: HealthStatus;
  components: ServiceHealth[];
}

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
// Event timeline
// ============================================================================

export type EventCategory =
  | "system"
  | "security"
  | "network"
  | "authentication"
  | "provisioning"
  | "guest"
  | "audit";

export type EventSeverity = "info" | "warning" | "error" | "critical";

export interface TimelineEntry {
  occurredAt: string;
  category: EventCategory;
  severity: EventSeverity;
  eventType: string;
  sourceDomain: string;
  message: string;
  organizationId: string | null;
  locationId: string | null;
  routerId: string | null;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Alert Engine
// ============================================================================

export type AlertTriggerType = "health_status_change" | "threshold" | "event_occurred";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "triggered" | "acknowledged" | "resolved";

export type ThresholdMetric =
  | "cpu_usage_percent"
  | "memory_usage_percent"
  | "uptime_seconds"
  | "connected_clients_count";

export type ThresholdOperator = "gt" | "gte" | "lt" | "lte" | "eq";

/** Sentinel `AlertRule.targetComponent` value for a health_status_change rule
 * that watches per-router health instead of a platform HealthComponent. */
export const ALERT_TARGET_ROUTER = "router";

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  triggerType: AlertTriggerType;
  targetComponent: string | null;
  conditionConfig: Record<string, unknown>;
  severity: AlertSeverity;
  isActive: boolean;
  notificationChannelIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  status: AlertStatus;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  resolvedAt: string | null;
  organizationId: string | null;
  locationId: string | null;
  routerId: string | null;
  message: string;
  relatedHealthCheckId: string | null;
  relatedEventId: string | null;
  severity: AlertSeverity;
}

export const ALERT_STATUS_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  triggered: ["acknowledged", "resolved"],
  acknowledged: ["resolved"],
  resolved: [],
};

// ============================================================================
// Notification Engine
// ============================================================================

export type NotificationChannelType =
  | "email"
  | "sms"
  | "whatsapp"
  | "slack"
  | "teams"
  | "discord"
  | "webhook";

export type NotificationStatus = "sent" | "failed";

export interface NotificationChannel {
  id: string;
  organizationId: string | null;
  channelType: NotificationChannelType;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  channelId: string;
  alertId: string | null;
  sentAt: string;
  status: NotificationStatus;
  errorMessage: string | null;
  responseSummary: string | null;
}

// ============================================================================
// Incident Engine
// ============================================================================

export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  severity: AlertSeverity;
  organizationId: string | null;
  assignedToUserId: string | null;
  openedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNotes: string | null;
}

export const INCIDENT_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["investigating", "resolved", "closed"],
  investigating: ["open", "resolved", "closed"],
  resolved: ["investigating", "closed"],
  closed: [],
};

// ============================================================================
// SLA Monitoring
// ============================================================================

export interface SlaTarget {
  id: string;
  organizationId: string | null;
  component: string | null;
  targetPercentage: number;
  measurementWindowDays: number;
}

export interface SlaReport {
  id: string;
  slaTargetId: string;
  periodStart: string;
  periodEnd: string;
  achievedPercentage: number;
  totalChecks: number;
  healthyChecks: number;
  averageResponseTimeMs: number | null;
  generatedAt: string;
}

export interface SlaTargetWithLatestReport {
  target: SlaTarget;
  latestReport: SlaReport | null;
}

// ============================================================================
// ZTP Device Fleet
// ============================================================================

export type RouterLifecycleStage =
  | "pending"
  | "claimed"
  | "approved"
  | "provisioning"
  | "provisioned"
  | "online"
  | "offline"
  | "warning"
  | "failed";

export interface RouterLifecycleEntry {
  routerId: string | null;
  enrollmentId: string | null;
  serialNumber: string;
  macAddress: string | null;
  model: string;
  name: string | null;
  organizationId: string | null;
  locationId: string | null;
  routerStatus: string | null;
  enrollmentStatus: string | null;
  lifecycleStage: RouterLifecycleStage;
  lastSeenAt: string | null;
  latestJobType: string | null;
  latestJobStatus: string | null;
  latestJobAttempts: number | null;
  latestJobMaxAttempts: number | null;
}

export interface ZtpDashboard {
  stageCounts: Record<string, number>;
  pendingEnrollmentCount: number;
  items: RouterLifecycleEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ProvisioningFailureBreakdown {
  jobType: string;
  failureCount: number;
}

export interface ProvisioningFailureSample {
  jobId: string;
  routerId: string;
  jobType: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  scheduledAt: string;
}

export interface RetryJobEntry {
  jobId: string;
  routerId: string;
  jobType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  attemptsRemaining: number;
  scheduledAt: string;
}

export interface ZtpAnalytics {
  successRatePercentage: number | null;
  succeededJobCount: number;
  terminalJobCount: number;
  failureBreakdown: ProvisioningFailureBreakdown[];
  failureSamples: ProvisioningFailureSample[];
  retryJobs: RetryJobEntry[];
  averageActivationSeconds: number | null;
  activationSampleSize: number;
}

// ============================================================================
// Platform dashboard (Overview tab)
// ============================================================================

export interface PlatformDashboard {
  overallHealthStatus: HealthStatus;
  healthComponents: ServiceHealth[];
  alertCountsBySeverity: Record<string, number>;
  alertCountsByStatus: Record<string, number>;
  deviceCountsByStatus: Record<string, number>;
  lifecycleStageCounts: Record<string, number>;
  pendingEnrollmentCount: number;
  averageResponseTimeMs: number | null;
  availabilityPercentage: number | null;
  visitors: number | null;
  uniqueGuests: number | null;
}

// ============================================================================
// Label maps
// ============================================================================

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unhealthy: "Unhealthy",
  unknown: "Unknown",
};

export const HEALTH_COMPONENT_LABEL: Record<HealthComponent, string> = {
  database: "Database",
  redis: "Redis",
  api: "API",
  auth: "Auth",
  storage: "Storage",
  celery: "Celery",
  websocket: "WebSocket",
  freeradius: "FreeRADIUS",
  wireguard: "WireGuard",
};

export const ALERT_SEVERITY_LABEL: Record<AlertSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  triggered: "Triggered",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};

export const ALERT_TRIGGER_TYPE_LABEL: Record<AlertTriggerType, string> = {
  health_status_change: "Health status change",
  threshold: "Threshold",
  event_occurred: "Event occurred",
};

export const THRESHOLD_METRIC_LABEL: Record<ThresholdMetric, string> = {
  cpu_usage_percent: "CPU usage %",
  memory_usage_percent: "Memory usage %",
  uptime_seconds: "Uptime (seconds)",
  connected_clients_count: "Connected clients",
};

export const THRESHOLD_OPERATOR_LABEL: Record<ThresholdOperator, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
};

export const NOTIFICATION_CHANNEL_TYPE_LABEL: Record<NotificationChannelType, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  slack: "Slack",
  teams: "Microsoft Teams",
  discord: "Discord",
  webhook: "Webhook",
};

export const ROUTER_LIFECYCLE_STAGE_LABEL: Record<RouterLifecycleStage, string> = {
  pending: "Pending",
  claimed: "Claimed",
  approved: "Approved",
  provisioning: "Provisioning",
  provisioned: "Provisioned",
  online: "Online",
  offline: "Offline",
  warning: "Warning",
  failed: "Failed",
};

// ============================================================================
// List query / payload shapes (mirrors the CreateXPayload / XListQuery
// convention every prior-phase types file already uses)
// ============================================================================

export interface HealthHistoryQuery {
  component: HealthComponent;
  page: number;
  pageSize: number;
}

export interface EventTimelineQuery {
  organizationId?: string;
  category?: EventCategory[];
  severity?: EventSeverity[];
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface AlertRuleListQuery {
  organizationId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export interface CreateAlertRulePayload {
  name: string;
  description?: string | null;
  organizationId?: string | null;
  triggerType: AlertTriggerType;
  targetComponent?: string | null;
  conditionConfig: Record<string, unknown>;
  severity: AlertSeverity;
  isActive: boolean;
  notificationChannelIds: string[];
}

export type UpdateAlertRulePayload = Partial<CreateAlertRulePayload>;

export interface AlertListQuery {
  organizationId?: string;
  routerId?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  page: number;
  pageSize: number;
}

export interface AlertEvaluationResult {
  triggered: Alert[];
  resolved: Alert[];
}

export interface NotificationChannelListQuery {
  organizationId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export interface CreateNotificationChannelPayload {
  organizationId?: string | null;
  channelType: NotificationChannelType;
  name: string;
  config: Record<string, unknown>;
  isActive: boolean;
}

export interface UpdateNotificationChannelPayload {
  name?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface NotificationLogListQuery {
  channelId?: string;
  alertId?: string;
  status?: NotificationStatus;
  page: number;
  pageSize: number;
}

export interface IncidentListQuery {
  organizationId?: string;
  status?: IncidentStatus;
  severity?: AlertSeverity;
  page: number;
  pageSize: number;
}

export interface CreateIncidentPayload {
  title: string;
  description?: string | null;
  severity: AlertSeverity;
  organizationId?: string | null;
  assignedToUserId?: string | null;
}

export interface UpdateIncidentPayload {
  title?: string;
  description?: string | null;
  status?: IncidentStatus;
  assignedToUserId?: string | null;
  resolutionNotes?: string | null;
}

export interface CreateSlaTargetPayload {
  organizationId?: string | null;
  component?: string | null;
  targetPercentage: number;
  measurementWindowDays: number;
}

export interface SlaReportListQuery {
  targetId: string;
  page: number;
  pageSize: number;
}

export interface ZtpListQuery {
  organizationId?: string;
  page: number;
  pageSize: number;
}

export interface ZtpAnalyticsQuery {
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  retryPage?: number;
  retryPageSize?: number;
  failureSampleLimit?: number;
}

export interface PlatformDashboardQuery {
  organizationId?: string;
  startDate?: string;
  endDate?: string;
}

export interface TopologyCounts {
  organizations: number;
  locations: number;
  routers: number;
}
