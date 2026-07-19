import type {
  AnalyticsSettings,
  AnalyticsSnapshot,
  DateRangePreset,
  MultiSeriesPoint,
  ReportFormat,
  ReportType,
  ScheduledReport,
  SeriesPoint,
} from "@/types/analytics";

// deterministic pseudo-random so charts stay stable between renders
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function series(labels: string[], min: number, max: number, seed: number): SeriesPoint[] {
  const r = seeded(seed);
  return labels.map((label) => ({ label, value: Math.round(min + r() * (max - min)) }));
}

function daysBack(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  }
  return out;
}

const RANGE_DAYS: Record<DateRangePreset, number> = {
  today: 1,
  yesterday: 1,
  last7: 7,
  last30: 30,
  last90: 90,
  this_month: 30,
  last_month: 30,
  custom: 30,
};

function buildSnapshot(range: DateRangePreset): AnalyticsSnapshot {
  const days = RANGE_DAYS[range] ?? 30;
  const labels = daysBack(Math.min(days, 30));
  const weekLabels = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  const scale = days / 30;

  const bandwidth: MultiSeriesPoint[] = labels.map((label, i) => {
    const r = seeded(101 + i)();
    return {
      label,
      download: Math.round(1200 + r * 900),
      upload: Math.round(300 + r * 250),
    };
  });

  const newVsReturning: MultiSeriesPoint[] = labels.map((label, i) => {
    const r = seeded(202 + i)();
    return {
      label,
      new: Math.round(80 + r * 120),
      returning: Math.round(150 + r * 200),
    };
  });

  const performance: MultiSeriesPoint[] = labels.map((label, i) => {
    const r = seeded(303 + i)();
    return {
      label,
      throughput: Math.round(400 + r * 300),
      latency: Math.round(18 + r * 22),
    };
  });

  const successFailTrend: MultiSeriesPoint[] = labels.map((label, i) => {
    const r = seeded(404 + i)();
    return {
      label,
      success: Math.round(920 + r * 140),
      failure: Math.round(20 + r * 40),
    };
  });

  return {
    kpis: {
      totalOrganizations: 148,
      totalLocations: 612,
      totalRouters: 1_284,
      activeRouters: 1_231,
      totalGuests: 84_320,
      activeGuests: Math.round(3_820 * (0.7 + Math.random() * 0.3)),
      totalSessions: Math.round(148_920 * scale),
      avgSessionDuration: 42,
      dailyLogins: Math.round(5_230 * (0.9 + Math.random() * 0.2)),
      monthlyLogins: Math.round(152_400 * scale),
      revenue: Math.round(184_500 * scale),
      growthRate: 12.4,
    },
    guests: {
      daily: series(labels, 400, 1_800, 11),
      weekly: series(weekLabels, 3_200, 7_800, 12),
      monthly: series(monthLabels.slice(0, 12), 12_000, 32_000, 13),
      newVsReturning,
      loginSuccessRate: 96.4,
      loginMethods: [
        { name: "OTP", value: 42 },
        { name: "Social", value: 21 },
        { name: "Email", value: 14 },
        { name: "Voucher", value: 11 },
        { name: "PMS", value: 8 },
        { name: "Click-through", value: 4 },
      ],
      peakHours: hourLabels.map((label, i) => ({
        label,
        value: Math.round(50 + Math.sin((i / 24) * Math.PI * 2) * 40 + Math.random() * 30),
      })),
      topLocations: [
        { label: "The Grand Hotel", value: 4_820 },
        { label: "Skyline Tower", value: 4_310 },
        { label: "Harbor Mall", value: 3_910 },
        { label: "Central Cafe", value: 3_120 },
        { label: "Riverside Resort", value: 2_780 },
        { label: "Metro Airport T2", value: 2_540 },
      ],
      growthTrend: series(monthLabels.slice(0, 12), 8_000, 26_000, 14),
    },
    network: {
      bandwidth,
      peakBandwidthHours: hourLabels.map((label, i) => ({
        label,
        value: Math.round(200 + Math.sin((i / 24) * Math.PI * 2) * 150 + Math.random() * 80),
      })),
      internetUtilization: series(labels, 45, 92, 21),
      routerHealthScore: series(labels, 82, 99, 22),
      packetLoss: series(labels, 0, 4, 23),
      latency: series(labels, 12, 48, 24),
      uptime: series(labels, 98, 100, 25),
    },
    routers: {
      online: 1_231,
      offline: 53,
      avgCpu: 42,
      avgMemory: 58,
      avgTemperature: 51,
      wanAvailability: 99.6,
      wireguardHealth: 98.2,
      radiusHealth: 99.1,
      performance,
      cpuTrend: series(labels, 25, 78, 31),
      memoryTrend: series(labels, 40, 82, 32),
      healthScoreTrend: series(labels, 80, 99, 33),
    },
    locations: [
      { id: "loc-1", name: "The Grand Hotel", city: "London", activeGuests: 482, trafficGb: 1_240, revenue: 18_400, avgSessionMin: 54 },
      { id: "loc-2", name: "Skyline Tower", city: "New York", activeGuests: 431, trafficGb: 1_120, revenue: 16_200, avgSessionMin: 48 },
      { id: "loc-3", name: "Harbor Mall", city: "Dubai", activeGuests: 391, trafficGb: 980, revenue: 14_900, avgSessionMin: 39 },
      { id: "loc-4", name: "Central Cafe", city: "Berlin", activeGuests: 312, trafficGb: 720, revenue: 9_800, avgSessionMin: 32 },
      { id: "loc-5", name: "Riverside Resort", city: "Bangkok", activeGuests: 278, trafficGb: 640, revenue: 8_600, avgSessionMin: 61 },
      { id: "loc-6", name: "Metro Airport T2", city: "Singapore", activeGuests: 254, trafficGb: 590, revenue: 7_900, avgSessionMin: 22 },
    ],
    organizations: [
      { id: "org-1", name: "Aurora Hospitality", activeUsers: 12_400, activeRouters: 184, activeLocations: 62, revenue: 42_800, monthlyGrowth: 14.2 },
      { id: "org-2", name: "Northwind Retail", activeUsers: 9_820, activeRouters: 142, activeLocations: 48, revenue: 31_500, monthlyGrowth: 9.4 },
      { id: "org-3", name: "Skyway Airports", activeUsers: 8_120, activeRouters: 88, activeLocations: 12, revenue: 28_200, monthlyGrowth: 6.1 },
      { id: "org-4", name: "Meridian Cafes", activeUsers: 6_310, activeRouters: 96, activeLocations: 74, revenue: 19_400, monthlyGrowth: 11.8 },
      { id: "org-5", name: "Harbor Malls Group", activeUsers: 5_820, activeRouters: 72, activeLocations: 26, revenue: 17_100, monthlyGrowth: 4.5 },
      { id: "org-6", name: "Riviera Resorts", activeUsers: 4_520, activeRouters: 58, activeLocations: 18, revenue: 15_800, monthlyGrowth: 13.6 },
    ],
    devices: {
      deviceTypes: [
        { name: "Mobile", value: 62 },
        { name: "Laptop", value: 22 },
        { name: "Tablet", value: 11 },
        { name: "Desktop", value: 5 },
      ],
      operatingSystems: [
        { name: "iOS", value: 38 },
        { name: "Android", value: 34 },
        { name: "Windows", value: 18 },
        { name: "macOS", value: 8 },
        { name: "Linux", value: 2 },
      ],
      browsers: [
        { name: "Chrome", value: 48 },
        { name: "Safari", value: 32 },
        { name: "Edge", value: 9 },
        { name: "Firefox", value: 6 },
        { name: "Other", value: 5 },
      ],
      vendors: [
        { name: "Apple", value: 44 },
        { name: "Samsung", value: 22 },
        { name: "Xiaomi", value: 9 },
        { name: "Huawei", value: 7 },
        { name: "Dell", value: 6 },
        { name: "Lenovo", value: 6 },
        { name: "Other", value: 6 },
      ],
    },
    auth: {
      methods: { otp: 42, voucher: 11, pms: 8, social: 21, email: 14, clickThrough: 4 },
      successFailTrend,
      loginTrends: series(labels, 3_800, 7_400, 51),
    },
  };
}

// --- API surface (mock) ------------------------------------------------------

const DELAY = 320;
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), DELAY));

export const analyticsService = {
  async getSnapshot(range: DateRangePreset = "last30"): Promise<AnalyticsSnapshot> {
    return wait(buildSnapshot(range));
  },

  async listScheduledReports(): Promise<ScheduledReport[]> {
    return wait([...scheduledReports]);
  },

  async createScheduledReport(input: Omit<ScheduledReport, "id" | "nextRunAt">): Promise<ScheduledReport> {
    const created: ScheduledReport = {
      ...input,
      id: `sr-${Date.now()}`,
      nextRunAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    };
    scheduledReports.unshift(created);
    return wait(created);
  },

  async toggleScheduledReport(id: string, enabled: boolean): Promise<void> {
    const r = scheduledReports.find((s) => s.id === id);
    if (r) r.enabled = enabled;
    return wait(undefined);
  },

  async deleteScheduledReport(id: string): Promise<void> {
    const idx = scheduledReports.findIndex((s) => s.id === id);
    if (idx >= 0) scheduledReports.splice(idx, 1);
    return wait(undefined);
  },

  async generateReport(input: {
    type: ReportType;
    format: ReportFormat;
    range: DateRangePreset;
  }): Promise<{ url: string; filename: string }> {
    const filename = `${input.type}-report-${Date.now()}.${input.format}`;
    return wait({ url: `#mock/${filename}`, filename });
  },

  async getSettings(): Promise<AnalyticsSettings> {
    return wait({ ...settings });
  },

  async updateSettings(next: AnalyticsSettings): Promise<AnalyticsSettings> {
    Object.assign(settings, next);
    return wait({ ...settings });
  },
};

let settings: AnalyticsSettings = {
  defaultDashboard: "overview",
  defaultDateRange: "last30",
  autoRefreshSec: 60,
  timezone: "UTC",
  chartStyle: "smooth",
};

const scheduledReports: ScheduledReport[] = [
  {
    id: "sr-1",
    name: "Weekly guest summary",
    type: "guest",
    frequency: "weekly",
    recipients: ["ops@cloudguest.io"],
    format: "pdf",
    enabled: true,
    lastRunAt: new Date(Date.now() - 6 * 24 * 3600_000).toISOString(),
    nextRunAt: new Date(Date.now() + 1 * 24 * 3600_000).toISOString(),
  },
  {
    id: "sr-2",
    name: "Monthly revenue rollup",
    type: "revenue",
    frequency: "monthly",
    recipients: ["finance@cloudguest.io", "cfo@cloudguest.io"],
    format: "excel",
    enabled: true,
    lastRunAt: new Date(Date.now() - 20 * 24 * 3600_000).toISOString(),
    nextRunAt: new Date(Date.now() + 10 * 24 * 3600_000).toISOString(),
  },
  {
    id: "sr-3",
    name: "Daily router health",
    type: "router",
    frequency: "daily",
    recipients: ["noc@cloudguest.io"],
    format: "csv",
    enabled: false,
    nextRunAt: new Date(Date.now() + 3600_000).toISOString(),
  },
];
