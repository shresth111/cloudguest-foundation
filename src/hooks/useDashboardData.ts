import { useQuery } from "@tanstack/react-query";
import { superAdminService } from "@/services/superadmin.service";

export const dashKeys = {
  unified: ["sa", "unified"] as const,
  revenue: (months: number) => ["sa", "revenue", months] as const,
  recentOrgs: ["sa", "recent-orgs"] as const,
  recentLocations: ["sa", "recent-locations"] as const,
  recentRouters: ["sa", "recent-routers"] as const,
  recentAudit: ["sa", "recent-audit"] as const,
};

export const useUnifiedDashboard = () =>
  useQuery({ queryKey: dashKeys.unified, queryFn: superAdminService.getUnifiedDashboard });

export const useRevenueDashboard = (months = 12) =>
  useQuery({
    queryKey: dashKeys.revenue(months),
    queryFn: () => superAdminService.getRevenueDashboard(months),
  });

export const useRecentOrgs = () =>
  useQuery({ queryKey: dashKeys.recentOrgs, queryFn: () => superAdminService.getRecentOrgs() });

export const useRecentLocations = () =>
  useQuery({
    queryKey: dashKeys.recentLocations,
    queryFn: () => superAdminService.getRecentLocations(),
  });

export const useRecentRouters = () =>
  useQuery({
    queryKey: dashKeys.recentRouters,
    queryFn: () => superAdminService.getRecentRouters(),
  });

export const useRecentAudit = () =>
  useQuery({ queryKey: dashKeys.recentAudit, queryFn: () => superAdminService.getRecentAudit() });
