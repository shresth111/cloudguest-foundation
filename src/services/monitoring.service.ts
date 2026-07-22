import { api } from "@/services/api";
import { routerService } from "@/services/router.service";
import type {
  Alert,
  AlertEvaluationResult,
  AlertListQuery,
  AlertRule,
  AlertRuleListQuery,
  AlertStatus,
  CreateAlertRulePayload,
  CreateIncidentPayload,
  CreateNotificationChannelPayload,
  CreateSlaTargetPayload,
  DashboardSummary,
  EventTimelineQuery,
  HealthCheck,
  HealthHistoryQuery,
  Incident,
  IncidentListQuery,
  IncidentStatus,
  NotificationChannel,
  NotificationChannelListQuery,
  NotificationLog,
  NotificationLogListQuery,
  PaginatedResult,
  PlatformDashboard,
  PlatformDashboardQuery,
  ServiceHealth,
  SlaReport,
  SlaReportListQuery,
  SlaTargetWithLatestReport,
  TimelineEntry,
  TopologyCounts,
  UpdateAlertRulePayload,
  UpdateIncidentPayload,
  UpdateNotificationChannelPayload,
  ZtpAnalytics,
  ZtpAnalyticsQuery,
  ZtpDashboard,
  ZtpListQuery,
} from "@/types/monitoring";

// ============================================================================
// Backend wire shapes
// ============================================================================

interface BackendServiceHealth {
  component: string;
  status: string;
  last_checked_at: string | null;
  consecutive_failure_count: number;
  updated_at: string;
}

interface BackendHealthCheck {
  component: string;
  status: string;
  checked_at: string;
  response_time_ms: number | null;
  details: Record<string, unknown> | null;
  error_message: string | null;
}

interface BackendDashboardSummary {
  overall_status: string;
  components: BackendServiceHealth[];
}

interface BackendHealthHistory {
  items: BackendHealthCheck[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendTimelineEntry {
  occurred_at: string;
  category: string;
  severity: string;
  event_type: string;
  source_domain: string;
  message: string;
  organization_id: string | null;
  location_id: string | null;
  router_id: string | null;
  metadata: Record<string, unknown>;
}

interface BackendAlertRule {
  id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  trigger_type: string;
  target_component: string | null;
  condition_config: Record<string, unknown>;
  severity: string;
  is_active: boolean;
  notification_channel_ids?: string[];
  created_at: string;
  updated_at: string;
}

interface BackendAlert {
  id: string;
  rule_id: string;
  status: string;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by_user_id: string | null;
  resolved_at: string | null;
  organization_id: string | null;
  location_id: string | null;
  router_id: string | null;
  message: string;
  related_health_check_id: string | null;
  related_event_id: string | null;
  severity: string;
}

interface BackendNotificationChannel {
  id: string;
  organization_id: string | null;
  channel_type: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendNotificationLog {
  id: string;
  channel_id: string;
  alert_id: string | null;
  sent_at: string;
  status: string;
  error_message: string | null;
  response_summary: string | null;
}

interface BackendIncident {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  organization_id: string | null;
  assigned_to_user_id: string | null;
  opened_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_notes: string | null;
}

interface BackendSlaTarget {
  id: string;
  organization_id: string | null;
  component: string | null;
  target_percentage: number;
  measurement_window_days: number;
}

interface BackendSlaReport {
  id: string;
  sla_target_id: string;
  period_start: string;
  period_end: string;
  achieved_percentage: number;
  total_checks: number;
  healthy_checks: number;
  average_response_time_ms: number | null;
  generated_at: string;
}

interface BackendSlaTargetWithLatestReport {
  target: BackendSlaTarget;
  latest_report: BackendSlaReport | null;
}

interface BackendRouterLifecycleEntry {
  router_id: string | null;
  enrollment_id: string | null;
  serial_number: string;
  mac_address: string | null;
  model: string;
  name: string | null;
  organization_id: string | null;
  location_id: string | null;
  router_status: string | null;
  enrollment_status: string | null;
  lifecycle_stage: string;
  last_seen_at: string | null;
  latest_job_type: string | null;
  latest_job_status: string | null;
  latest_job_attempts: number | null;
  latest_job_max_attempts: number | null;
}

interface BackendZtpDashboard {
  stage_counts: Record<string, number>;
  pending_enrollment_count: number;
  items: BackendRouterLifecycleEntry[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendZtpAnalytics {
  success_rate_percentage: number | null;
  succeeded_job_count: number;
  terminal_job_count: number;
  failure_breakdown: Array<{ job_type: string; failure_count: number }>;
  failure_samples: Array<{
    job_id: string;
    router_id: string;
    job_type: string;
    attempts: number;
    max_attempts: number;
    error_message: string | null;
    scheduled_at: string;
  }>;
  retry_jobs: Array<{
    job_id: string;
    router_id: string;
    job_type: string;
    status: string;
    attempts: number;
    max_attempts: number;
    attempts_remaining: number;
    scheduled_at: string;
  }>;
  average_activation_seconds: number | null;
  activation_sample_size: number;
}

interface BackendPlatformDashboard {
  overall_health_status: string;
  health_components: BackendServiceHealth[];
  alert_counts_by_severity: Record<string, number>;
  alert_counts_by_status: Record<string, number>;
  device_counts_by_status: Record<string, number>;
  lifecycle_stage_counts: Record<string, number>;
  pending_enrollment_count: number;
  average_response_time_ms: number | null;
  availability_percentage: number | null;
  visitors: number | null;
  unique_guests: number | null;
}

// ============================================================================
// Converters
// ============================================================================

function toServiceHealth(h: BackendServiceHealth): ServiceHealth {
  return {
    component: h.component,
    status: h.status as ServiceHealth["status"],
    lastCheckedAt: h.last_checked_at,
    consecutiveFailureCount: h.consecutive_failure_count,
    updatedAt: h.updated_at,
  };
}

function toHealthCheck(h: BackendHealthCheck): HealthCheck {
  return {
    component: h.component,
    status: h.status as HealthCheck["status"],
    checkedAt: h.checked_at,
    responseTimeMs: h.response_time_ms,
    details: h.details,
    errorMessage: h.error_message,
  };
}

function toTimelineEntry(e: BackendTimelineEntry): TimelineEntry {
  return {
    occurredAt: e.occurred_at,
    category: e.category as TimelineEntry["category"],
    severity: e.severity as TimelineEntry["severity"],
    eventType: e.event_type,
    sourceDomain: e.source_domain,
    message: e.message,
    organizationId: e.organization_id,
    locationId: e.location_id,
    routerId: e.router_id,
    metadata: e.metadata,
  };
}

function toAlertRule(r: BackendAlertRule): AlertRule {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    organizationId: r.organization_id,
    triggerType: r.trigger_type as AlertRule["triggerType"],
    targetComponent: r.target_component,
    conditionConfig: r.condition_config,
    severity: r.severity as AlertRule["severity"],
    isActive: r.is_active,
    notificationChannelIds: r.notification_channel_ids ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toAlert(a: BackendAlert): Alert {
  return {
    id: a.id,
    ruleId: a.rule_id,
    status: a.status as AlertStatus,
    triggeredAt: a.triggered_at,
    acknowledgedAt: a.acknowledged_at,
    acknowledgedByUserId: a.acknowledged_by_user_id,
    resolvedAt: a.resolved_at,
    organizationId: a.organization_id,
    locationId: a.location_id,
    routerId: a.router_id,
    message: a.message,
    relatedHealthCheckId: a.related_health_check_id,
    relatedEventId: a.related_event_id,
    severity: a.severity as Alert["severity"],
  };
}

function toNotificationChannel(c: BackendNotificationChannel): NotificationChannel {
  return {
    id: c.id,
    organizationId: c.organization_id,
    channelType: c.channel_type as NotificationChannel["channelType"],
    name: c.name,
    isActive: c.is_active,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function toNotificationLog(l: BackendNotificationLog): NotificationLog {
  return {
    id: l.id,
    channelId: l.channel_id,
    alertId: l.alert_id,
    sentAt: l.sent_at,
    status: l.status as NotificationLog["status"],
    errorMessage: l.error_message,
    responseSummary: l.response_summary,
  };
}

function toIncident(i: BackendIncident): Incident {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    status: i.status as IncidentStatus,
    severity: i.severity as Incident["severity"],
    organizationId: i.organization_id,
    assignedToUserId: i.assigned_to_user_id,
    openedAt: i.opened_at,
    resolvedAt: i.resolved_at,
    closedAt: i.closed_at,
    resolutionNotes: i.resolution_notes,
  };
}

function toSlaTargetWithLatestReport(
  p: BackendSlaTargetWithLatestReport,
): SlaTargetWithLatestReport {
  return {
    target: {
      id: p.target.id,
      organizationId: p.target.organization_id,
      component: p.target.component,
      targetPercentage: p.target.target_percentage,
      measurementWindowDays: p.target.measurement_window_days,
    },
    latestReport: p.latest_report
      ? {
          id: p.latest_report.id,
          slaTargetId: p.latest_report.sla_target_id,
          periodStart: p.latest_report.period_start,
          periodEnd: p.latest_report.period_end,
          achievedPercentage: p.latest_report.achieved_percentage,
          totalChecks: p.latest_report.total_checks,
          healthyChecks: p.latest_report.healthy_checks,
          averageResponseTimeMs: p.latest_report.average_response_time_ms,
          generatedAt: p.latest_report.generated_at,
        }
      : null,
  };
}

function toSlaReport(r: BackendSlaReport): SlaReport {
  return {
    id: r.id,
    slaTargetId: r.sla_target_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    achievedPercentage: r.achieved_percentage,
    totalChecks: r.total_checks,
    healthyChecks: r.healthy_checks,
    averageResponseTimeMs: r.average_response_time_ms,
    generatedAt: r.generated_at,
  };
}

function toLifecycleEntry(e: BackendRouterLifecycleEntry) {
  return {
    routerId: e.router_id,
    enrollmentId: e.enrollment_id,
    serialNumber: e.serial_number,
    macAddress: e.mac_address,
    model: e.model,
    name: e.name,
    organizationId: e.organization_id,
    locationId: e.location_id,
    routerStatus: e.router_status,
    enrollmentStatus: e.enrollment_status,
    lifecycleStage: e.lifecycle_stage as ZtpDashboard["items"][number]["lifecycleStage"],
    lastSeenAt: e.last_seen_at,
    latestJobType: e.latest_job_type,
    latestJobStatus: e.latest_job_status,
    latestJobAttempts: e.latest_job_attempts,
    latestJobMaxAttempts: e.latest_job_max_attempts,
  };
}

function toZtpDashboard(d: BackendZtpDashboard): ZtpDashboard {
  return {
    stageCounts: d.stage_counts,
    pendingEnrollmentCount: d.pending_enrollment_count,
    items: d.items.map(toLifecycleEntry),
    page: d.page,
    pageSize: d.page_size,
    totalItems: d.total_items,
    totalPages: d.total_pages,
    hasNext: d.has_next,
    hasPrevious: d.has_previous,
  };
}

function toZtpAnalytics(a: BackendZtpAnalytics): ZtpAnalytics {
  return {
    successRatePercentage: a.success_rate_percentage,
    succeededJobCount: a.succeeded_job_count,
    terminalJobCount: a.terminal_job_count,
    failureBreakdown: a.failure_breakdown.map((f) => ({
      jobType: f.job_type,
      failureCount: f.failure_count,
    })),
    failureSamples: a.failure_samples.map((f) => ({
      jobId: f.job_id,
      routerId: f.router_id,
      jobType: f.job_type,
      attempts: f.attempts,
      maxAttempts: f.max_attempts,
      errorMessage: f.error_message,
      scheduledAt: f.scheduled_at,
    })),
    retryJobs: a.retry_jobs.map((r) => ({
      jobId: r.job_id,
      routerId: r.router_id,
      jobType: r.job_type,
      status: r.status,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      attemptsRemaining: r.attempts_remaining,
      scheduledAt: r.scheduled_at,
    })),
    averageActivationSeconds: a.average_activation_seconds,
    activationSampleSize: a.activation_sample_size,
  };
}

function toPlatformDashboard(d: BackendPlatformDashboard): PlatformDashboard {
  return {
    overallHealthStatus: d.overall_health_status as PlatformDashboard["overallHealthStatus"],
    healthComponents: d.health_components.map(toServiceHealth),
    alertCountsBySeverity: d.alert_counts_by_severity,
    alertCountsByStatus: d.alert_counts_by_status,
    deviceCountsByStatus: d.device_counts_by_status,
    lifecycleStageCounts: d.lifecycle_stage_counts,
    pendingEnrollmentCount: d.pending_enrollment_count,
    averageResponseTimeMs: d.average_response_time_ms,
    availabilityPercentage: d.availability_percentage,
    visitors: d.visitors,
    uniqueGuests: d.unique_guests,
  };
}

// ============================================================================
// Service
// ============================================================================

export const monitoringService = {
  // -- Health Engine --------------------------------------------------------

  async getHealthDashboard(): Promise<DashboardSummary> {
    const { data } = await api.get<BackendDashboardSummary>("/monitoring/health");
    return {
      overallStatus: data.overall_status as HealthCheck["status"],
      components: data.components.map(toServiceHealth),
    };
  },

  async getHealthHistory(q: HealthHistoryQuery): Promise<PaginatedResult<HealthCheck>> {
    const { data } = await api.get<BackendHealthHistory>(`/monitoring/health/${q.component}`, {
      params: { page: q.page, page_size: q.pageSize },
    });
    return {
      items: data.items.map(toHealthCheck),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async runHealthChecks(): Promise<HealthCheck[]> {
    const { data } = await api.post<{ results: BackendHealthCheck[] }>("/monitoring/health/run");
    return data.results.map(toHealthCheck);
  },

  // -- Event Engine -----------------------------------------------------------

  async getEventTimeline(q: EventTimelineQuery): Promise<TimelineEntry[]> {
    const { data } = await api.get<{ items: BackendTimelineEntry[] }>("/events", {
      params: {
        organization_id: q.organizationId,
        category: q.category,
        severity: q.severity,
        start_date: q.startDate,
        end_date: q.endDate,
        limit: q.limit,
      },
      paramsSerializer: { indexes: null },
    });
    return data.items.map(toTimelineEntry);
  },

  // -- Alert Rules --------------------------------------------------------

  async listAlertRules(q: AlertRuleListQuery): Promise<PaginatedResult<AlertRule>> {
    const { data } = await api.get<{
      items: BackendAlertRule[];
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    }>("/alerts/rules", {
      params: {
        organization_id: q.organizationId,
        is_active: q.isActive,
        page: q.page,
        page_size: q.pageSize,
      },
    });
    return {
      items: data.items.map(toAlertRule),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getAlertRule(id: string): Promise<AlertRule> {
    const { data } = await api.get<BackendAlertRule>(`/alerts/rules/${id}`);
    return toAlertRule(data);
  },

  async createAlertRule(payload: CreateAlertRulePayload): Promise<AlertRule> {
    const { data } = await api.post<BackendAlertRule>("/alerts/rules", {
      name: payload.name,
      description: payload.description,
      organization_id: payload.organizationId,
      trigger_type: payload.triggerType,
      target_component: payload.targetComponent,
      condition_config: payload.conditionConfig,
      severity: payload.severity,
      is_active: payload.isActive,
      notification_channel_ids: payload.notificationChannelIds,
    });
    return toAlertRule(data);
  },

  async updateAlertRule(id: string, payload: UpdateAlertRulePayload): Promise<AlertRule> {
    const { data } = await api.put<BackendAlertRule>(`/alerts/rules/${id}`, {
      name: payload.name,
      description: payload.description,
      trigger_type: payload.triggerType,
      target_component: payload.targetComponent,
      condition_config: payload.conditionConfig,
      severity: payload.severity,
      is_active: payload.isActive,
      notification_channel_ids: payload.notificationChannelIds,
    });
    return toAlertRule(data);
  },

  async deleteAlertRule(id: string): Promise<void> {
    await api.delete(`/alerts/rules/${id}`);
  },

  // -- Alerts ---------------------------------------------------------------

  async listAlerts(q: AlertListQuery): Promise<PaginatedResult<Alert>> {
    const { data } = await api.get<{
      items: BackendAlert[];
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    }>("/alerts", {
      params: {
        organization_id: q.organizationId,
        router_id: q.routerId,
        status: q.status,
        severity: q.severity,
        page: q.page,
        page_size: q.pageSize,
      },
    });
    return {
      items: data.items.map(toAlert),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getAlert(id: string): Promise<Alert> {
    const { data } = await api.get<BackendAlert>(`/alerts/${id}`);
    return toAlert(data);
  },

  async acknowledgeAlert(id: string): Promise<Alert> {
    const { data } = await api.post<BackendAlert>(`/alerts/${id}/acknowledge`);
    return toAlert(data);
  },

  async resolveAlert(id: string): Promise<Alert> {
    const { data } = await api.post<BackendAlert>(`/alerts/${id}/resolve`);
    return toAlert(data);
  },

  async evaluateAlertRules(): Promise<AlertEvaluationResult> {
    const { data } = await api.post<{ triggered: BackendAlert[]; resolved: BackendAlert[] }>(
      "/alerts/evaluate",
    );
    return {
      triggered: data.triggered.map(toAlert),
      resolved: data.resolved.map(toAlert),
    };
  },

  // -- Notification Channels -------------------------------------------------

  async listNotificationChannels(
    q: NotificationChannelListQuery,
  ): Promise<PaginatedResult<NotificationChannel>> {
    const { data } = await api.get<{
      items: BackendNotificationChannel[];
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    }>("/notifications/channels", {
      params: {
        organization_id: q.organizationId,
        is_active: q.isActive,
        page: q.page,
        page_size: q.pageSize,
      },
    });
    return {
      items: data.items.map(toNotificationChannel),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async createNotificationChannel(
    payload: CreateNotificationChannelPayload,
  ): Promise<NotificationChannel> {
    const { data } = await api.post<BackendNotificationChannel>("/notifications/channels", {
      organization_id: payload.organizationId,
      channel_type: payload.channelType,
      name: payload.name,
      config: payload.config,
      is_active: payload.isActive,
    });
    return toNotificationChannel(data);
  },

  async updateNotificationChannel(
    id: string,
    payload: UpdateNotificationChannelPayload,
  ): Promise<NotificationChannel> {
    const { data } = await api.put<BackendNotificationChannel>(
      `/notifications/channels/${id}`,
      { name: payload.name, config: payload.config, is_active: payload.isActive },
    );
    return toNotificationChannel(data);
  },

  async deleteNotificationChannel(id: string): Promise<void> {
    await api.delete(`/notifications/channels/${id}`);
  },

  async listNotificationLogs(
    q: NotificationLogListQuery,
  ): Promise<PaginatedResult<NotificationLog>> {
    const { data } = await api.get<{
      items: BackendNotificationLog[];
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    }>("/notifications/logs", {
      params: {
        channel_id: q.channelId,
        alert_id: q.alertId,
        status: q.status,
        page: q.page,
        page_size: q.pageSize,
      },
    });
    return {
      items: data.items.map(toNotificationLog),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  // -- Incidents --------------------------------------------------------------

  async listIncidents(q: IncidentListQuery): Promise<PaginatedResult<Incident>> {
    const { data } = await api.get<{
      items: BackendIncident[];
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    }>("/incidents", {
      params: {
        organization_id: q.organizationId,
        status: q.status,
        severity: q.severity,
        page: q.page,
        page_size: q.pageSize,
      },
    });
    return {
      items: data.items.map(toIncident),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getIncident(id: string): Promise<Incident> {
    const { data } = await api.get<BackendIncident>(`/incidents/${id}`);
    return toIncident(data);
  },

  async createIncident(payload: CreateIncidentPayload): Promise<Incident> {
    const { data } = await api.post<BackendIncident>("/incidents", {
      title: payload.title,
      description: payload.description,
      severity: payload.severity,
      organization_id: payload.organizationId,
      assigned_to_user_id: payload.assignedToUserId,
    });
    return toIncident(data);
  },

  async updateIncident(id: string, payload: UpdateIncidentPayload): Promise<Incident> {
    const { data } = await api.put<BackendIncident>(`/incidents/${id}`, {
      title: payload.title,
      description: payload.description,
      status: payload.status,
      assigned_to_user_id: payload.assignedToUserId,
      resolution_notes: payload.resolutionNotes,
    });
    return toIncident(data);
  },

  async attachAlertToIncident(incidentId: string, alertId: string): Promise<Incident> {
    const { data } = await api.post<BackendIncident>(`/incidents/${incidentId}/alerts`, {
      alert_id: alertId,
    });
    return toIncident(data);
  },

  async listIncidentAlerts(incidentId: string): Promise<Alert[]> {
    const { data } = await api.get<{ items: BackendAlert[] }>(`/incidents/${incidentId}/alerts`);
    return data.items.map(toAlert);
  },

  // -- SLA Monitoring -----------------------------------------------------

  async listSlaTargets(organizationId?: string): Promise<SlaTargetWithLatestReport[]> {
    const { data } = await api.get<{ items: BackendSlaTargetWithLatestReport[] }>("/sla", {
      params: { organization_id: organizationId },
    });
    return data.items.map(toSlaTargetWithLatestReport);
  },

  async createSlaTarget(payload: CreateSlaTargetPayload) {
    const { data } = await api.post<BackendSlaTarget>("/sla/targets", {
      organization_id: payload.organizationId,
      component: payload.component,
      target_percentage: payload.targetPercentage,
      measurement_window_days: payload.measurementWindowDays,
    });
    return {
      id: data.id,
      organizationId: data.organization_id,
      component: data.component,
      targetPercentage: data.target_percentage,
      measurementWindowDays: data.measurement_window_days,
    };
  },

  async listSlaReports(q: SlaReportListQuery): Promise<PaginatedResult<SlaReport>> {
    const { data } = await api.get<{
      items: BackendSlaReport[];
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    }>(`/sla/${q.targetId}/reports`, {
      params: { page: q.page, page_size: q.pageSize },
    });
    return {
      items: data.items.map(toSlaReport),
      page: data.page,
      pageSize: data.page_size,
      totalItems: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async generateSlaReport(targetId: string, periodDays?: number): Promise<SlaReport> {
    const { data } = await api.post<BackendSlaReport>(`/sla/${targetId}/generate-report`, {
      period_days: periodDays,
    });
    return toSlaReport(data);
  },

  // -- ZTP Device Fleet -----------------------------------------------------

  async getZtpDashboard(q: ZtpListQuery): Promise<ZtpDashboard> {
    const { data } = await api.get<BackendZtpDashboard>("/ztp/dashboard", {
      params: { organization_id: q.organizationId, page: q.page, page_size: q.pageSize },
    });
    return toZtpDashboard(data);
  },

  async getZtpAnalytics(q: ZtpAnalyticsQuery): Promise<ZtpAnalytics> {
    const { data } = await api.get<BackendZtpAnalytics>("/ztp/analytics", {
      params: {
        organization_id: q.organizationId,
        start_date: q.startDate,
        end_date: q.endDate,
        retry_page: q.retryPage,
        retry_page_size: q.retryPageSize,
        failure_sample_limit: q.failureSampleLimit,
      },
    });
    return toZtpAnalytics(data);
  },

  // -- Platform Dashboard (Overview tab) -----------------------------------

  async getPlatformDashboard(q: PlatformDashboardQuery = {}): Promise<PlatformDashboard> {
    const { data } = await api.get<BackendPlatformDashboard>("/monitoring/dashboard", {
      params: {
        organization_id: q.organizationId,
        start_date: q.startDate,
        end_date: q.endDate,
      },
    });
    return toPlatformDashboard(data);
  },

  // -- Topology counts (real org/location/router totals, no fabricated
  // per-router telemetry -- see TopologyView's plan write-up) --------------

  async getTopologyCounts(): Promise<TopologyCounts> {
    const orgs = await routerService.organizations();
    const locations = await routerService.locations();
    const routerCounts = await Promise.allSettled(
      locations.map(async (loc) => {
        const { data } = await api.get<{ total_items: number }>(
          `/locations/${loc.id}/routers`,
          { params: { page_size: 1 }, headers: { "X-Organization-Id": loc.organizationId } },
        );
        return data.total_items;
      }),
    );
    return {
      organizations: orgs.length,
      locations: locations.length,
      routers: routerCounts
        .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
        .reduce((sum, r) => sum + r.value, 0),
    };
  },
};
