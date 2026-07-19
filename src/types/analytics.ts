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
