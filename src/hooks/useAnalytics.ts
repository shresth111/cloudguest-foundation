import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyticsService } from "@/services/analytics.service";
import type { AnalyticsSettings, DateRangePreset, ReportFormat, ReportType, ScheduledReport } from "@/types/analytics";

export function useAnalyticsSnapshot(range: DateRangePreset) {
  return useQuery({
    queryKey: ["analytics", "snapshot", range],
    queryFn: () => analyticsService.getSnapshot(range),
    staleTime: 30_000,
  });
}

export function useScheduledReports() {
  return useQuery({
    queryKey: ["analytics", "scheduled"],
    queryFn: () => analyticsService.listScheduledReports(),
  });
}

export function useCreateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ScheduledReport, "id" | "nextRunAt">) =>
      analyticsService.createScheduledReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics", "scheduled"] }),
  });
}

export function useToggleScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      analyticsService.toggleScheduledReport(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics", "scheduled"] }),
  });
}

export function useDeleteScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyticsService.deleteScheduledReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics", "scheduled"] }),
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (input: { type: ReportType; format: ReportFormat; range: DateRangePreset }) =>
      analyticsService.generateReport(input),
  });
}

export function useAnalyticsSettings() {
  return useQuery({
    queryKey: ["analytics", "settings"],
    queryFn: () => analyticsService.getSettings(),
  });
}

export function useUpdateAnalyticsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: AnalyticsSettings) => analyticsService.updateSettings(next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics", "settings"] }),
  });
}
