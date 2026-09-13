import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analyticsService } from "@/services/analytics.service";
import { locationService } from "@/services/location.service";
import { resolveOrganizationId } from "@/services/organization-id";
import type {
  AnalyticsSettings,
  DateRangePreset,
  ReportFormat,
  ReportType,
  ScheduledReport,
} from "@/types/analytics";

export function useAnalyticsSnapshot(range: DateRangePreset) {
  return useQuery({
    queryKey: ["analytics", "snapshot", range],
    queryFn: () => analyticsService.getSnapshot(range),
    staleTime: 30_000,
  });
}

/**
 * The current session's own organization id, resolved once via the shared
 * `/me/organizations` resolver. The customer Analytics pages
 * (analytics.guest/network/device/isp/executive) need it because the
 * `/analytics/*` endpoints use `RequireOrganization` (a hard requirement,
 * not the optional `CurrentOrganization` most domains use) — an explicit
 * org id is passed rather than relying on the request interceptor, so the
 * global-super-admin-on-the-customer-dashboard case (who would otherwise
 * send `X-Organization-Scope: all` and 400 against `RequireOrganization`)
 * still resolves to a single org. `retry: false` because a session that
 * belongs to no org is a stable answer, not a transient failure.
 */
export function useResolvedOrganizationId() {
  return useQuery({
    queryKey: ["analytics", "resolved-organization-id"],
    queryFn: () => resolveOrganizationId(),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useDomainGuestAnalytics(organizationId?: string, locationId?: string) {
  return useQuery({
    queryKey: ["analytics", "domain-guests", organizationId, locationId],
    queryFn: () => analyticsService.getDomainGuestAnalytics(organizationId!, locationId),
    enabled: !!organizationId,
  });
}

export function useDomainNetworkAnalytics(organizationId?: string, locationId?: string) {
  return useQuery({
    queryKey: ["analytics", "domain-network", organizationId, locationId],
    queryFn: () => analyticsService.getDomainNetworkAnalytics(organizationId!, locationId),
    enabled: !!organizationId,
  });
}

export function useDomainAuthAnalytics(organizationId?: string, locationId?: string) {
  return useQuery({
    queryKey: ["analytics", "domain-auth", organizationId, locationId],
    queryFn: () => analyticsService.getDomainAuthAnalytics(organizationId!, locationId),
    enabled: !!organizationId,
  });
}

export function useDomainRouterAnalytics(organizationId?: string, locationId?: string) {
  return useQuery({
    queryKey: ["analytics", "domain-routers", organizationId, locationId],
    queryFn: () => analyticsService.getDomainRouterAnalytics(organizationId!, locationId),
    enabled: !!organizationId,
  });
}

export function useAnalyticsOrganizations() {
  return useQuery({
    queryKey: ["analytics", "organizations"],
    queryFn: () => locationService.organizations(),
    staleTime: 60_000,
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
