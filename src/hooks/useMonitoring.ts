import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoring.service";
import { routerService } from "@/services/router.service";
import type {
  AlertListQuery,
  AlertRuleListQuery,
  CreateAlertRulePayload,
  CreateIncidentPayload,
  CreateNotificationChannelPayload,
  CreateSlaTargetPayload,
  EventTimelineQuery,
  HealthHistoryQuery,
  IncidentListQuery,
  NotificationChannelListQuery,
  NotificationLogListQuery,
  PlatformDashboardQuery,
  SlaReportListQuery,
  UpdateAlertRulePayload,
  UpdateIncidentPayload,
  UpdateNotificationChannelPayload,
  ZtpAnalyticsQuery,
  ZtpListQuery,
} from "@/types/monitoring";

export const monitoringKeys = {
  health: ["monitoring", "health"] as const,
  healthHistory: (q: HealthHistoryQuery) => ["monitoring", "health-history", q] as const,
  events: (q: EventTimelineQuery) => ["monitoring", "events", q] as const,
  alertRules: (q: AlertRuleListQuery) => ["monitoring", "alert-rules", q] as const,
  alertRule: (id: string) => ["monitoring", "alert-rule", id] as const,
  alerts: (q: AlertListQuery) => ["monitoring", "alerts", q] as const,
  alert: (id: string) => ["monitoring", "alert", id] as const,
  channels: (q: NotificationChannelListQuery) => ["monitoring", "channels", q] as const,
  logs: (q: NotificationLogListQuery) => ["monitoring", "logs", q] as const,
  incidents: (q: IncidentListQuery) => ["monitoring", "incidents", q] as const,
  incident: (id: string) => ["monitoring", "incident", id] as const,
  incidentAlerts: (id: string) => ["monitoring", "incident-alerts", id] as const,
  slaTargets: (organizationId?: string) => ["monitoring", "sla-targets", organizationId] as const,
  slaReports: (q: SlaReportListQuery) => ["monitoring", "sla-reports", q] as const,
  ztpDashboard: (q: ZtpListQuery) => ["monitoring", "ztp-dashboard", q] as const,
  ztpAnalytics: (q: ZtpAnalyticsQuery) => ["monitoring", "ztp-analytics", q] as const,
  platformDashboard: (q: PlatformDashboardQuery) => ["monitoring", "dashboard", q] as const,
  topology: ["monitoring", "topology"] as const,
};

// -- Health -------------------------------------------------------------------

export function useHealthDashboard(refetchMs: number | false = 30000) {
  return useQuery({
    queryKey: monitoringKeys.health,
    queryFn: () => monitoringService.getHealthDashboard(),
    refetchInterval: refetchMs,
  });
}

export function useHealthHistory(q: HealthHistoryQuery) {
  return useQuery({
    queryKey: monitoringKeys.healthHistory(q),
    queryFn: () => monitoringService.getHealthHistory(q),
    enabled: !!q.component,
  });
}

export function useRunHealthChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => monitoringService.runHealthChecks(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: monitoringKeys.health });
      qc.invalidateQueries({ queryKey: ["monitoring", "dashboard"] });
    },
  });
}

// -- Events ---------------------------------------------------------------

export function useEventTimeline(q: EventTimelineQuery) {
  return useQuery({
    queryKey: monitoringKeys.events(q),
    queryFn: () => monitoringService.getEventTimeline(q),
  });
}

// -- Alert Rules ------------------------------------------------------------

export function useAlertRules(q: AlertRuleListQuery) {
  return useQuery({
    queryKey: monitoringKeys.alertRules(q),
    queryFn: () => monitoringService.listAlertRules(q),
  });
}

export function useAlertRule(id: string) {
  return useQuery({
    queryKey: monitoringKeys.alertRule(id),
    queryFn: () => monitoringService.getAlertRule(id),
    enabled: !!id,
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAlertRulePayload) => monitoringService.createAlertRule(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "alert-rules"] }),
  });
}

export function useUpdateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAlertRulePayload }) =>
      monitoringService.updateAlertRule(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "alert-rules"] }),
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitoringService.deleteAlertRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "alert-rules"] }),
  });
}

// -- Alerts -------------------------------------------------------------------

export function useAlerts(q: AlertListQuery) {
  return useQuery({
    queryKey: monitoringKeys.alerts(q),
    queryFn: () => monitoringService.listAlerts(q),
  });
}

export function useAlert(id: string) {
  return useQuery({
    queryKey: monitoringKeys.alert(id),
    queryFn: () => monitoringService.getAlert(id),
    enabled: !!id,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitoringService.acknowledgeAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "alerts"] }),
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitoringService.resolveAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "alerts"] }),
  });
}

export function useEvaluateAlertRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => monitoringService.evaluateAlertRules(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "alerts"] }),
  });
}

// -- Notification Channels -------------------------------------------------

export function useNotificationChannels(q: NotificationChannelListQuery) {
  return useQuery({
    queryKey: monitoringKeys.channels(q),
    queryFn: () => monitoringService.listNotificationChannels(q),
  });
}

export function useCreateNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateNotificationChannelPayload) =>
      monitoringService.createNotificationChannel(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "channels"] }),
  });
}

export function useUpdateNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateNotificationChannelPayload }) =>
      monitoringService.updateNotificationChannel(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "channels"] }),
  });
}

export function useDeleteNotificationChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitoringService.deleteNotificationChannel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "channels"] }),
  });
}

export function useNotificationLogs(q: NotificationLogListQuery) {
  return useQuery({
    queryKey: monitoringKeys.logs(q),
    queryFn: () => monitoringService.listNotificationLogs(q),
  });
}

// -- Incidents ----------------------------------------------------------------

export function useIncidents(q: IncidentListQuery) {
  return useQuery({
    queryKey: monitoringKeys.incidents(q),
    queryFn: () => monitoringService.listIncidents(q),
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: monitoringKeys.incident(id),
    queryFn: () => monitoringService.getIncident(id),
    enabled: !!id,
  });
}

export function useIncidentAlerts(incidentId: string) {
  return useQuery({
    queryKey: monitoringKeys.incidentAlerts(incidentId),
    queryFn: () => monitoringService.listIncidentAlerts(incidentId),
    enabled: !!incidentId,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIncidentPayload) => monitoringService.createIncident(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "incidents"] }),
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateIncidentPayload }) =>
      monitoringService.updateIncident(id, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["monitoring", "incidents"] });
      qc.invalidateQueries({ queryKey: monitoringKeys.incident(vars.id) });
    },
  });
}

export function useAttachAlertToIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, alertId }: { incidentId: string; alertId: string }) =>
      monitoringService.attachAlertToIncident(incidentId, alertId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: monitoringKeys.incident(vars.incidentId) });
      qc.invalidateQueries({ queryKey: monitoringKeys.incidentAlerts(vars.incidentId) });
    },
  });
}

// -- SLA ------------------------------------------------------------------

export function useSlaTargets(organizationId?: string) {
  return useQuery({
    queryKey: monitoringKeys.slaTargets(organizationId),
    queryFn: () => monitoringService.listSlaTargets(organizationId),
  });
}

export function useCreateSlaTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSlaTargetPayload) => monitoringService.createSlaTarget(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring", "sla-targets"] }),
  });
}

export function useSlaReports(q: SlaReportListQuery) {
  return useQuery({
    queryKey: monitoringKeys.slaReports(q),
    queryFn: () => monitoringService.listSlaReports(q),
    enabled: !!q.targetId,
  });
}

export function useGenerateSlaReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, periodDays }: { targetId: string; periodDays?: number }) =>
      monitoringService.generateSlaReport(targetId, periodDays),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monitoring", "sla-targets"] });
      qc.invalidateQueries({ queryKey: ["monitoring", "sla-reports"] });
    },
  });
}

// -- ZTP Device Fleet -----------------------------------------------------

export function useZtpDashboard(q: ZtpListQuery) {
  return useQuery({
    queryKey: monitoringKeys.ztpDashboard(q),
    queryFn: () => monitoringService.getZtpDashboard(q),
  });
}

export function useZtpAnalytics(q: ZtpAnalyticsQuery) {
  return useQuery({
    queryKey: monitoringKeys.ztpAnalytics(q),
    queryFn: () => monitoringService.getZtpAnalytics(q),
  });
}

// -- Platform Dashboard (Overview tab) ---------------------------------------

export function usePlatformDashboard(q: PlatformDashboardQuery = {}, refetchMs: number | false = 30000) {
  return useQuery({
    queryKey: monitoringKeys.platformDashboard(q),
    queryFn: () => monitoringService.getPlatformDashboard(q),
    refetchInterval: refetchMs,
  });
}

export function useTopologyCounts() {
  return useQuery({
    queryKey: monitoringKeys.topology,
    queryFn: () => monitoringService.getTopologyCounts(),
    staleTime: 60_000,
  });
}

// -- Org/location name lookup (reuses the already-migrated Router service's
// own fan-out fetchers -- avoids showing raw UUIDs where a real name is
// cheaply available) -----------------------------------------------------

export function useOrgLocationLookup() {
  const orgs = useQuery({
    queryKey: ["monitoring", "orgs-lookup"],
    queryFn: () => routerService.organizations(),
    staleTime: 60_000,
  });
  const locations = useQuery({
    queryKey: ["monitoring", "locations-lookup"],
    queryFn: () => routerService.locations(),
    staleTime: 60_000,
  });
  return {
    organizations: orgs.data ?? [],
    locations: locations.data ?? [],
    orgName: (id: string | null | undefined) => orgs.data?.find((o) => o.id === id)?.name ?? null,
    locationName: (id: string | null | undefined) =>
      locations.data?.find((l) => l.id === id)?.name ?? null,
    isLoading: orgs.isLoading || locations.isLoading,
  };
}
