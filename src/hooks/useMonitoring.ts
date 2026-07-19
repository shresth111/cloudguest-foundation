import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoring.service";
import type {
  AlertStatus,
  Incident,
  MonitoringSettings,
} from "@/types/monitoring";

const KEY = {
  kpis: ["monitoring", "kpis"] as const,
  overview: ["monitoring", "overview"] as const,
  routers: ["monitoring", "routers"] as const,
  series: ["monitoring", "series"] as const,
  alerts: ["monitoring", "alerts"] as const,
  incidents: ["monitoring", "incidents"] as const,
  health: ["monitoring", "health"] as const,
  notifications: ["monitoring", "notifications"] as const,
  settings: ["monitoring", "settings"] as const,
};

export const useMonitoringKpis = (refetchMs = 15000) =>
  useQuery({ queryKey: KEY.kpis, queryFn: monitoringService.getKpis, refetchInterval: refetchMs });

export const useNetworkOverview = () =>
  useQuery({ queryKey: KEY.overview, queryFn: monitoringService.getNetworkOverview, refetchInterval: 20000 });

export const useLiveRouters = (refetchMs: number | false = 10000) =>
  useQuery({ queryKey: KEY.routers, queryFn: monitoringService.getLiveRouters, refetchInterval: refetchMs });

export const usePerformanceSeries = () =>
  useQuery({ queryKey: KEY.series, queryFn: monitoringService.getPerformanceSeries, refetchInterval: 30000 });

export const useAlerts = () => useQuery({ queryKey: KEY.alerts, queryFn: monitoringService.getAlerts });
export const useIncidents = () => useQuery({ queryKey: KEY.incidents, queryFn: monitoringService.getIncidents });
export const useServiceHealth = () =>
  useQuery({ queryKey: KEY.health, queryFn: monitoringService.getServiceHealth, refetchInterval: 30000 });

export const useMonitoringNotifications = () =>
  useQuery({ queryKey: KEY.notifications, queryFn: monitoringService.getNotifications });

export const useMonitoringSettings = () =>
  useQuery({ queryKey: KEY.settings, queryFn: monitoringService.getSettings });

export function useSetAlertStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AlertStatus }) => monitoringService.setAlertStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.alerts }),
  });
}

export function useAssignAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, engineer }: { id: string; engineer: string }) => monitoringService.assignAlert(id, engineer),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.alerts }),
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Incident> }) => monitoringService.updateIncident(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.incidents }),
  });
}

export function useAddIncidentNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, author, message }: { id: string; author: string; message: string }) =>
      monitoringService.addIncidentNote(id, { author, message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.incidents }),
  });
}

export function useUpdateMonitoringSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<MonitoringSettings>) => monitoringService.updateSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.settings }),
  });
}

export function useRestartRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => monitoringService.restartRouter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.routers }),
  });
}
