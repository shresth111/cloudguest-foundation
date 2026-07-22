export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last90"
  | "this_month"
  | "last_month"
  | "custom";

export interface AnalyticsKpis {
  totalOrganizations: number;
  totalLocations: number;
  totalRouters: number;
  activeRouters: number;
  totalGuests: number;
  activeGuests: number;
  totalSessions: number;
  avgSessionDuration: number; // minutes
  dailyLogins: number;
  monthlyLogins: number;
  revenue: number;
  growthRate: number; // percent
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface MultiSeriesPoint {
  label: string;
  [key: string]: string | number;
}

export interface DistributionSlice {
  name: string;
  value: number;
}

export interface GuestAnalytics {
  daily: SeriesPoint[];
  weekly: SeriesPoint[];
  monthly: SeriesPoint[];
  newVsReturning: MultiSeriesPoint[];
  loginSuccessRate: number;
  loginMethods: DistributionSlice[];
  peakHours: SeriesPoint[];
  topLocations: SeriesPoint[];
  growthTrend: SeriesPoint[];
}

export interface NetworkAnalytics {
  bandwidth: MultiSeriesPoint[]; // download/upload
  peakBandwidthHours: SeriesPoint[];
  internetUtilization: SeriesPoint[];
  routerHealthScore: SeriesPoint[];
  packetLoss: SeriesPoint[];
  latency: SeriesPoint[];
  uptime: SeriesPoint[];
}

export interface RouterAnalytics {
  online: number;
  offline: number;
  avgCpu: number;
  avgMemory: number;
  avgTemperature: number;
  wanAvailability: number;
  wireguardHealth: number;
  radiusHealth: number;
  performance: MultiSeriesPoint[];
  cpuTrend: SeriesPoint[];
  memoryTrend: SeriesPoint[];
  healthScoreTrend: SeriesPoint[];
}

export interface LocationAnalyticsRow {
  id: string;
  name: string;
  city: string;
  activeGuests: number;
  trafficGb: number;
  revenue: number;
  avgSessionMin: number;
}

export interface OrganizationAnalyticsRow {
  id: string;
  name: string;
  activeUsers: number;
  activeRouters: number;
  activeLocations: number;
  revenue: number;
  monthlyGrowth: number;
}

export interface DeviceAnalytics {
  deviceTypes: DistributionSlice[]; // mobile, laptop, tablet, desktop
  operatingSystems: DistributionSlice[];
  browsers: DistributionSlice[];
  vendors: DistributionSlice[];
}

export interface AuthAnalytics {
  methods: {
    otp: number;
    voucher: number;
    pms: number;
    social: number;
    email: number;
    clickThrough: number;
  };
  successFailTrend: MultiSeriesPoint[];
  loginTrends: SeriesPoint[];
}

export interface AnalyticsSnapshot {
  kpis: AnalyticsKpis;
  guests: GuestAnalytics;
  network: NetworkAnalytics;
  routers: RouterAnalytics;
  locations: LocationAnalyticsRow[];
  organizations: OrganizationAnalyticsRow[];
  devices: DeviceAnalytics;
  auth: AuthAnalytics;
}

export type ReportType =
  | "guest"
  | "router"
  | "network"
  | "organization"
  | "location"
  | "revenue"
  | "audit"
  | "billing"
  | "monitoring";

export type ReportFormat = "pdf" | "excel" | "csv";

export interface ScheduledReport {
  id: string;
  name: string;
  type: ReportType;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  format: ReportFormat;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt: string;
}

export interface AnalyticsSettings {
  defaultDashboard: "overview" | "guests" | "network" | "routers";
  defaultDateRange: DateRangePreset;
  autoRefreshSec: number;
  timezone: string;
  chartStyle: "smooth" | "linear" | "bars";
}

// ---------------------------------------------------------------------------
// Real, org/location-scoped domain analytics (backend/app/domains/analytics's
// GET /analytics/{routers,network,guests,authentication}). Distinct from the
// SeriesPoint-trend-shaped GuestAnalytics/NetworkAnalytics/DeviceAnalytics/
// AuthAnalytics types above, which the platform-wide overview page uses with
// honest-empty fallbacks -- these types mirror what the backend actually
// returns for one org (+ optional location): point-in-time window
// aggregates and top-N breakdowns, not day-by-day trend series.
// ---------------------------------------------------------------------------

export interface DeviceBreakdownItem {
  label: string;
  sessionCount: number;
}

export interface DomainGuestAnalytics {
  windowStart: string;
  windowEnd: string;
  newGuests: number;
  returningGuests: number;
  uniqueGuests: number;
  repeatVisits: number;
  retention: { available: boolean; retentionRatePercent: number | null; periodDays: number };
  averageDataUsageBytes: number | null;
  averageSessionDurationSeconds: number | null;
  topDevices: { macAddress: string; sessionCount: number; uniqueGuestCount: number }[];
  topLocations: { locationId: string; locationName: string; sessionCount: number }[];
  devices: {
    sessionsTotal: number;
    sessionsWithData: number;
    byOs: DeviceBreakdownItem[];
    byBrowser: DeviceBreakdownItem[];
    byDeviceType: DeviceBreakdownItem[];
  };
  languages: { sessionsTotal: number; sessionsWithData: number; byLanguage: Record<string, unknown>[] };
}

export interface DomainNetworkAnalytics {
  windowStart: string;
  windowEnd: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  peakBandwidth: { available: boolean; peakBytes: number | null; bucketStart: string | null };
  averageSpeedBytesPerSecond: number | null;
  networkAvailability: { availableRouterCount: number; totalRouterCount: number; availabilityPercent: number | null };
  topConsumers: { guestId: string; identifier: string; totalBytes: number }[];
  topLocations: { locationId: string; locationName: string; totalBytes: number }[];
  topRouters: { routerId: string; routerName: string; totalBytes: number }[];
  trafficTrend: { metric: string; currentValue: number; deltaPercent: number | null }[];
}

export interface DomainAuthAnalytics {
  windowStart: string;
  windowEnd: string;
  otp: { totalRequests: number; successfulCount: number; failedCount: number; successRate: number };
  voucher: { redeemedCount: number; failedAttemptsRecorded: number };
  successTotal: number;
  failureTotal: number;
  trends: { date: string; successCount: number; failureCount: number }[];
  failureReasons: { reason: string; count: number }[];
  authMethods: { authMethod: string; successfulAttempts: number; failedAttempts: number }[];
}

export interface DomainRouterAnalytics {
  windowStart: string;
  windowEnd: string;
  routers: {
    routerId: string;
    routerName: string;
    status: string;
    cpuUsagePercent: number | null;
    memoryUsagePercent: number | null;
    uptimeSeconds: number | null;
    connectedClients: number | null;
    bandwidthTotalBytes: number;
    internetAvailable: boolean;
    wireguard: { available: boolean; status: string | null };
    radiusSuccessCount: number;
    radiusFailureCount: number;
  }[];
}
