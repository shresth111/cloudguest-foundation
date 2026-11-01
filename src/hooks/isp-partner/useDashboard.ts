/** DASH-1 queries. Under ["isp", "dashboard"], so a zone switch resets them. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/isp-partner/dashboard";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import type { DashFilters, DashTile } from "@/services/isp-partner/dashboard-types";

export const dashKeys = {
  summary: (f: DashFilters) => ["isp", "dashboard", "summary", f] as const,
  list: (f: DashFilters, tile: DashTile, page: number) =>
    ["isp", "dashboard", "list", f, tile, page] as const,
};

export function useSubscriberDashboard(f: DashFilters, enabled = true) {
  return useQuery({
    queryKey: dashKeys.summary(f),
    queryFn: () => dashboardService.summary(f),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useDashboardList(f: DashFilters, tile: DashTile | null, page: number) {
  return useQuery({
    queryKey: dashKeys.list(f, tile ?? "total", page),
    queryFn: () => dashboardService.list(f, tile ?? "total", page),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled: !!tile,
  });
}
