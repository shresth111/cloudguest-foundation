export interface GrowthPoint {
  metric: string;
  currentValue: number;
  previousValue: number | null;
  delta: number | null;
  deltaPercent: number | null;
  direction: string;
}

export interface RevenueTrendPoint {
  month: string;
  grossAmount: number;
  refundedAmount: number;
  netAmount: number;
}

export interface PlatformDashboard {
  totalOrganizations: number;
  totalLocations: number;
  totalRouters: number;
  routersOnline: number;
  routersOffline: number;
  totalGuests: number;
  todaysGuests: number;
  monthlyGuests: number;
  totalSessions: number;
  activeSessions: number;
  peakConcurrentSessions: number;
  organizationGrowth: GrowthPoint;
  locationGrowth: GrowthPoint;
  routerGrowth: GrowthPoint;
  guestGrowth: GrowthPoint;
  networkGrowth: GrowthPoint;
  trialCustomers: number;
  paidCustomers: number;
}

export interface PlatformHealth {
  overallHealthStatus: string;
  alertCountsBySeverity: Record<string, number>;
  alertCountsByStatus: Record<string, number>;
  deviceCountsByStatus: Record<string, number>;
  averageResponseTimeMs: number | null;
  availabilityPercentage: number | null;
}

export interface UnifiedDashboard {
  platform: PlatformDashboard;
  operations: PlatformHealth;
  licenseStatusBreakdown: Record<string, number>;
  totalRevenue: number | null;
  mrr: number | null;
  arr: number | null;
}

export interface RevenueDashboard {
  totalRevenue: number;
  totalRefunded: number;
  mrr: number;
  arr: number;
  activePayingSubscriptionCount: number;
  trend: RevenueTrendPoint[];
  subscriptionsByStatus: Record<string, number>;
  subscriptionsByPlanType: Record<string, number>;
  churnRate: number | null;
}

export interface OrgRow {
  id: string;
  name: string;
  plan: string | null;
  status: string;
  createdAt: string;
}

export interface LocationRow {
  id: string;
  name: string;
  organizationName: string;
  city: string;
  createdAt: string;
}

export interface RouterRow {
  id: string;
  name: string;
  serialNumber: string;
  model: string;
  organizationName: string;
  status: string;
  createdAt: string;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  description: string | null;
  createdAt: string;
}
