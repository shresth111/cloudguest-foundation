import { api } from "@/services/api";
import { organizationService } from "@/services/organization.service";
import { locationService } from "@/services/location.service";
import { routerService } from "@/services/router.service";
import { auditService } from "@/services/audit.service";
import type {
  AuditRow,
  GrowthPoint,
  LocationRow,
  OrgRow,
  PlatformDashboard,
  PlatformHealth,
  RevenueDashboard,
  RevenueTrendPoint,
  RouterRow,
  UnifiedDashboard,
} from "@/types/dashboard";

interface BackendGrowthPoint {
  metric: string;
  current_value: number;
  previous_value: number | null;
  delta: number | null;
  delta_percent: number | null;
  direction: string;
}

interface BackendPlatformDashboard {
  total_organizations: number;
  total_locations: number;
  total_routers: number;
  routers_online: number;
  routers_offline: number;
  total_guests: number;
  todays_guests: number;
  monthly_guests: number;
  total_sessions: number;
  active_sessions: number;
  peak_concurrent_sessions: number;
  organization_growth: BackendGrowthPoint;
  location_growth: BackendGrowthPoint;
  router_growth: BackendGrowthPoint;
  guest_growth: BackendGrowthPoint;
  network_growth: BackendGrowthPoint;
  trial_customers: number;
  paid_customers: number;
}

interface BackendPlatformHealth {
  overall_health_status: string;
  alert_counts_by_severity: Record<string, number>;
  alert_counts_by_status: Record<string, number>;
  device_counts_by_status: Record<string, number>;
  average_response_time_ms: number | null;
  availability_percentage: number | null;
}

interface BackendUnifiedDashboard {
  platform: BackendPlatformDashboard;
  operations: BackendPlatformHealth;
  license_status_breakdown: Record<string, number>;
  total_revenue: number | null;
  mrr: number | null;
  arr: number | null;
}

interface BackendRevenueTrendPoint {
  month: string;
  gross_amount: number;
  refunded_amount: number;
  net_amount: number;
}

interface BackendSuperAdminBillingDashboard {
  revenue: {
    total_revenue: number;
    total_refunded: number;
    mrr: number;
    arr: number;
    active_paying_subscription_count: number;
    trend: BackendRevenueTrendPoint[];
  };
  subscriptions: {
    counts_by_status: Record<string, number>;
    counts_by_plan_type: Record<string, number>;
    churn: { churn_rate: number | null };
  };
}

function toGrowthPoint(g: BackendGrowthPoint): GrowthPoint {
  return {
    metric: g.metric,
    currentValue: g.current_value,
    previousValue: g.previous_value,
    delta: g.delta,
    deltaPercent: g.delta_percent,
    direction: g.direction,
  };
}

function toPlatformDashboard(p: BackendPlatformDashboard): PlatformDashboard {
  return {
    totalOrganizations: p.total_organizations,
    totalLocations: p.total_locations,
    totalRouters: p.total_routers,
    routersOnline: p.routers_online,
    routersOffline: p.routers_offline,
    totalGuests: p.total_guests,
    todaysGuests: p.todays_guests,
    monthlyGuests: p.monthly_guests,
    totalSessions: p.total_sessions,
    activeSessions: p.active_sessions,
    peakConcurrentSessions: p.peak_concurrent_sessions,
    organizationGrowth: toGrowthPoint(p.organization_growth),
    locationGrowth: toGrowthPoint(p.location_growth),
    routerGrowth: toGrowthPoint(p.router_growth),
    guestGrowth: toGrowthPoint(p.guest_growth),
    networkGrowth: toGrowthPoint(p.network_growth),
    trialCustomers: p.trial_customers,
    paidCustomers: p.paid_customers,
  };
}

function toPlatformHealth(h: BackendPlatformHealth): PlatformHealth {
  return {
    overallHealthStatus: h.overall_health_status,
    alertCountsBySeverity: h.alert_counts_by_severity,
    alertCountsByStatus: h.alert_counts_by_status,
    deviceCountsByStatus: h.device_counts_by_status,
    averageResponseTimeMs: h.average_response_time_ms,
    availabilityPercentage: h.availability_percentage,
  };
}

export const superAdminService = {
  async getUnifiedDashboard(): Promise<UnifiedDashboard> {
    const { data } = await api.get<BackendUnifiedDashboard>("/dashboard/super-admin/unified");
    return {
      platform: toPlatformDashboard(data.platform),
      operations: toPlatformHealth(data.operations),
      licenseStatusBreakdown: data.license_status_breakdown,
      totalRevenue: data.total_revenue,
      mrr: data.mrr,
      arr: data.arr,
    };
  },

  async getRevenueDashboard(months = 12): Promise<RevenueDashboard> {
    const { data } = await api.get<BackendSuperAdminBillingDashboard>(
      "/billing/dashboard/super-admin",
      { params: { months } },
    );
    return {
      totalRevenue: data.revenue.total_revenue,
      totalRefunded: data.revenue.total_refunded,
      mrr: data.revenue.mrr,
      arr: data.revenue.arr,
      activePayingSubscriptionCount: data.revenue.active_paying_subscription_count,
      trend: data.revenue.trend.map(
        (t): RevenueTrendPoint => ({
          month: t.month,
          grossAmount: t.gross_amount,
          refundedAmount: t.refunded_amount,
          netAmount: t.net_amount,
        }),
      ),
      subscriptionsByStatus: data.subscriptions.counts_by_status,
      subscriptionsByPlanType: data.subscriptions.counts_by_plan_type,
      churnRate: data.subscriptions.churn.churn_rate,
    };
  },

  async getRecentOrgs(limit = 5): Promise<OrgRow[]> {
    const { rows } = await organizationService.list({ page: 1, pageSize: limit });
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      plan: o.subscriptionTier,
      status: o.status,
      createdAt: o.createdAt,
    }));
  },

  async getRecentLocations(limit = 5): Promise<LocationRow[]> {
    const all = await locationService.listAll();
    return [...all]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        name: l.name,
        organizationName: l.organizationName,
        city: l.city,
        createdAt: l.createdAt,
      }));
  },

  async getRecentRouters(limit = 5): Promise<RouterRow[]> {
    const { rows } = await routerService.list({ page: 1, pageSize: 1000 });
    return [...rows]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        name: r.name,
        serialNumber: r.serialNumber,
        model: r.model,
        organizationName: r.organizationName,
        status: r.status,
        createdAt: r.createdAt,
      }));
  },

  async getRecentAudit(limit = 8): Promise<AuditRow[]> {
    const { rows } = await auditService.list({ page: 1, pageSize: limit });
    return rows.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      description: a.description,
      createdAt: a.createdAt,
    }));
  },
};
