import { useQuery } from "@tanstack/react-query";
import { superAdminService } from "@/services/superadmin.service";

export const dashKeys = {
  kpis: ["sa", "kpis"] as const,
  guestTrend: ["sa", "guest-trend"] as const,
  revenue: ["sa", "revenue"] as const,
  routerHealth: ["sa", "router-health"] as const,
  auth: ["sa", "auth"] as const,
  topOrgs: ["sa", "top-orgs"] as const,
  devices: ["sa", "devices"] as const,
  daily: ["sa", "daily"] as const,
  growth: ["sa", "growth"] as const,
  recentOrgs: ["sa", "recent-orgs"] as const,
  recentLocations: ["sa", "recent-locations"] as const,
  recentRouters: ["sa", "recent-routers"] as const,
  recentSessions: ["sa", "recent-sessions"] as const,
  recentPayments: ["sa", "recent-payments"] as const,
  recentTickets: ["sa", "recent-tickets"] as const,
  recentAudit: ["sa", "recent-audit"] as const,
  notifications: ["sa", "notifications"] as const,
  search: (q: string) => ["sa", "search", q] as const,
};

export const useKpis = () => useQuery({ queryKey: dashKeys.kpis, queryFn: superAdminService.getKpis });
export const useGuestTrend = () => useQuery({ queryKey: dashKeys.guestTrend, queryFn: superAdminService.getGuestTrend });
export const useRevenue = () => useQuery({ queryKey: dashKeys.revenue, queryFn: superAdminService.getRevenueTrend });
export const useRouterHealth = () => useQuery({ queryKey: dashKeys.routerHealth, queryFn: superAdminService.getRouterHealth });
export const useAuthStats = () => useQuery({ queryKey: dashKeys.auth, queryFn: superAdminService.getAuthStats });
export const useTopOrgs = () => useQuery({ queryKey: dashKeys.topOrgs, queryFn: superAdminService.getTopOrgs });
export const useDeviceDist = () => useQuery({ queryKey: dashKeys.devices, queryFn: superAdminService.getDeviceDistribution });
export const useDailyActive = () => useQuery({ queryKey: dashKeys.daily, queryFn: superAdminService.getDailyActive });
export const useMonthlyGrowth = () => useQuery({ queryKey: dashKeys.growth, queryFn: superAdminService.getMonthlyGrowth });
export const useRecentOrgs = () => useQuery({ queryKey: dashKeys.recentOrgs, queryFn: superAdminService.getRecentOrgs });
export const useRecentLocations = () => useQuery({ queryKey: dashKeys.recentLocations, queryFn: superAdminService.getRecentLocations });
export const useRecentRouters = () => useQuery({ queryKey: dashKeys.recentRouters, queryFn: superAdminService.getRecentRouters });
export const useRecentSessions = () => useQuery({ queryKey: dashKeys.recentSessions, queryFn: superAdminService.getRecentSessions });
export const useRecentPayments = () => useQuery({ queryKey: dashKeys.recentPayments, queryFn: superAdminService.getRecentPayments });
export const useRecentTickets = () => useQuery({ queryKey: dashKeys.recentTickets, queryFn: superAdminService.getRecentTickets });
export const useRecentAudit = () => useQuery({ queryKey: dashKeys.recentAudit, queryFn: superAdminService.getRecentAudit });
export const useNotifications = () => useQuery({ queryKey: dashKeys.notifications, queryFn: superAdminService.getNotifications });
