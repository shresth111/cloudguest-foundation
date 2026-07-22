import { api } from "@/services/api";
import type {
  AnalyticsKpis,
  AnalyticsSettings,
  AnalyticsSnapshot,
  AuthAnalytics,
  DateRangePreset,
  DeviceAnalytics,
  DomainAuthAnalytics,
  DomainGuestAnalytics,
  DomainNetworkAnalytics,
  DomainRouterAnalytics,
  GuestAnalytics,
  NetworkAnalytics,
  OrganizationAnalyticsRow,
  ReportFormat,
  ReportType,
  RouterAnalytics,
  ScheduledReport,
} from "@/types/analytics";

/**
 * Real wiring notes (backend: backend/app/domains/analytics):
 *
 * - KPIs + router online/offline counts + revenue come from the real,
 *   platform-wide `GET /dashboard/super-admin/unified` endpoint.
 * - The Organizations table is real, fanned out per-organization against
 *   `GET /dashboard/organization` (same "one call per org" convention
 *   location.service.ts's fetchAllLocations already uses).
 * - Guests/Network/Devices/Auth per-metric time series and the Locations
 *   table have NO platform-wide backend equivalent: the matching endpoints
 *   (`/analytics/routers|network|guests|authentication`,
 *   `/dashboard/location`) are all organization- or location-scoped, and
 *   these overview pages select neither. Rather than fabricate numbers,
 *   those sections return real, honest zeros/empty arrays. Wiring them for
 *   real needs an org/location selector added to these pages -- a frontend
 *   scope change, not a backend gap.
 * - `range` currently has no effect on the real KPIs/organizations calls
 *   (the super-admin dashboard has no date-range parameter); kept in the
 *   signature so callers don't need to change.
 * - Scheduled reports and on-demand report generation ARE fully real, via
 *   `/reports/templates` + `/reports/schedule` + `/reports` (see below).
 */

interface BackendGrowthPoint {
  delta_percent: number | null;
}

interface BackendSuperAdminDashboard {
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
  guest_growth: BackendGrowthPoint;
}

interface BackendUnifiedDashboard {
  platform: BackendSuperAdminDashboard;
  total_revenue: number | null;
}

interface BackendOrgListItem {
  id: string;
  name: string;
}

interface BackendOrganizationDashboard {
  guest_count_unique: number;
  router_count: number;
  location_count: number;
}

interface BackendListResponse<T> {
  items: T[];
}

async function fetchOrganizationRows(): Promise<OrganizationAnalyticsRow[]> {
  const { data } = await api.get<BackendListResponse<BackendOrgListItem>>("/organizations", {
    params: { page_size: 12 },
  });
  const settled = await Promise.allSettled(
    data.items.map(async (org): Promise<OrganizationAnalyticsRow> => {
      const { data: dash } = await api.get<BackendOrganizationDashboard>(
        "/dashboard/organization",
        { headers: { "X-Organization-Id": org.id } },
      );
      return {
        id: org.id,
        name: org.name,
        activeUsers: dash.guest_count_unique,
        activeRouters: dash.router_count,
        activeLocations: dash.location_count,
        // Unavailable: no billing/subscription data at org level (see
        // backend dashboard_schemas.RevenueMetricsResponse) and
        // customer_growth is platform-wide only, not per-organization.
        revenue: 0,
        monthlyGrowth: 0,
      };
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<OrganizationAnalyticsRow> => r.status === "fulfilled")
    .map((r) => r.value);
}

function emptyGuestAnalytics(): GuestAnalytics {
  return {
    daily: [],
    weekly: [],
    monthly: [],
    newVsReturning: [],
    loginSuccessRate: 0,
    loginMethods: [],
    peakHours: [],
    topLocations: [],
    growthTrend: [],
  };
}

function emptyNetworkAnalytics(): NetworkAnalytics {
  return {
    bandwidth: [],
    peakBandwidthHours: [],
    internetUtilization: [],
    routerHealthScore: [],
    packetLoss: [],
    latency: [],
    uptime: [],
  };
}

function emptyDeviceAnalytics(): DeviceAnalytics {
  return { deviceTypes: [], operatingSystems: [], browsers: [], vendors: [] };
}

function emptyAuthAnalytics(): AuthAnalytics {
  return {
    methods: { otp: 0, voucher: 0, pms: 0, social: 0, email: 0, clickThrough: 0 },
    successFailTrend: [],
    loginTrends: [],
  };
}

// ---------------------------------------------------------------------------
// Real, org/location-scoped domain analytics -- GET /analytics/{routers,
// network,guests,authentication} all require organization_id (RequireOrganization,
// not optional like most other domains' CurrentOrganization dependency), so
// every function below takes an explicit organizationId. Used by the
// analytics.guest/.network/.device/.isp pages, which add their own org/
// location picker since (unlike the platform-wide overview page) there's no
// honest way to call these without one.
// ---------------------------------------------------------------------------

interface BackendDeviceBreakdownItem {
  label: string;
  session_count: number;
}

interface BackendGuestAnalyticsResponse {
  window_start: string;
  window_end: string;
  new_guests: number;
  returning_guests: number;
  unique_guests: number;
  repeat_visits: number;
  guest_retention: {
    available: boolean;
    retention_rate_percent: number | null;
    period_days: number;
  };
  average_data_usage_bytes: number | null;
  average_session_duration_seconds: number | null;
  top_devices: { mac_address: string; session_count: number; unique_guest_count: number }[];
  top_locations: { location_id: string; location_name: string; session_count: number }[];
  devices: {
    sessions_total: number;
    sessions_with_data: number;
    by_os: BackendDeviceBreakdownItem[];
    by_browser: BackendDeviceBreakdownItem[];
    by_device_type: BackendDeviceBreakdownItem[];
  };
  languages: {
    sessions_total: number;
    sessions_with_data: number;
    by_language: Record<string, unknown>[];
  };
}

interface BackendNetworkAnalyticsResponse {
  window_start: string;
  window_end: string;
  download_bytes: number;
  upload_bytes: number;
  total_bytes: number;
  peak_bandwidth: { available: boolean; peak_bytes: number | null; bucket_start: string | null };
  average_speed_bytes_per_second: number | null;
  network_availability: {
    available_router_count: number;
    total_router_count: number;
    availability_percent: number | null;
  };
  top_consumers: { guest_id: string; identifier: string; total_bytes: number }[];
  top_locations: { location_id: string; location_name: string; total_bytes: number }[];
  top_routers: { router_id: string; router_name: string; total_bytes: number }[];
  traffic_trend: { metric: string; current_value: number; delta_percent: number | null }[];
}

interface BackendAuthAnalyticsResponse {
  window_start: string;
  window_end: string;
  otp: { total_requests: number; successful_count: number; failed_count: number; success_rate: number };
  voucher: { redeemed_count: number; failed_attempts_recorded: number };
  authentication_success_total: number;
  authentication_failure_total: number;
  authentication_trends: { date: string; success_count: number; failure_count: number }[];
  failed_login_reasons: { reason: string; count: number }[];
  auth_methods: { auth_method: string; successful_attempts: number; failed_attempts: number }[];
}

interface BackendRouterAnalyticsResponse {
  window_start: string;
  window_end: string;
  routers: {
    router_id: string;
    router_name: string;
    status: string;
    cpu_usage_percent_current: number | null;
    memory_usage_percent_current: number | null;
    uptime_seconds: number | null;
    connected_clients_count: number | null;
    bandwidth_total_bytes: number;
    internet_available: boolean;
    wireguard: { available: boolean; status: string | null };
    radius_success_count: number;
    radius_failure_count: number;
  }[];
}

function toDeviceBreakdown(items: BackendDeviceBreakdownItem[]) {
  return items.map((i) => ({ label: i.label, sessionCount: i.session_count }));
}

async function domainAnalyticsParams(organizationId: string, locationId?: string) {
  return {
    headers: { "X-Organization-Id": organizationId },
    params: locationId ? { location_id: locationId } : undefined,
  };
}

export const analyticsService = {
  async getDomainGuestAnalytics(
    organizationId: string,
    locationId?: string,
  ): Promise<DomainGuestAnalytics> {
    const { data } = await api.get<BackendGuestAnalyticsResponse>(
      "/analytics/guests",
      await domainAnalyticsParams(organizationId, locationId),
    );
    return {
      windowStart: data.window_start,
      windowEnd: data.window_end,
      newGuests: data.new_guests,
      returningGuests: data.returning_guests,
      uniqueGuests: data.unique_guests,
      repeatVisits: data.repeat_visits,
      retention: {
        available: data.guest_retention.available,
        retentionRatePercent: data.guest_retention.retention_rate_percent,
        periodDays: data.guest_retention.period_days,
      },
      averageDataUsageBytes: data.average_data_usage_bytes,
      averageSessionDurationSeconds: data.average_session_duration_seconds,
      topDevices: data.top_devices.map((d) => ({
        macAddress: d.mac_address,
        sessionCount: d.session_count,
        uniqueGuestCount: d.unique_guest_count,
      })),
      topLocations: data.top_locations.map((l) => ({
        locationId: l.location_id,
        locationName: l.location_name,
        sessionCount: l.session_count,
      })),
      devices: {
        sessionsTotal: data.devices.sessions_total,
        sessionsWithData: data.devices.sessions_with_data,
        byOs: toDeviceBreakdown(data.devices.by_os),
        byBrowser: toDeviceBreakdown(data.devices.by_browser),
        byDeviceType: toDeviceBreakdown(data.devices.by_device_type),
      },
      languages: {
        sessionsTotal: data.languages.sessions_total,
        sessionsWithData: data.languages.sessions_with_data,
        byLanguage: data.languages.by_language,
      },
    };
  },

  async getDomainNetworkAnalytics(
    organizationId: string,
    locationId?: string,
  ): Promise<DomainNetworkAnalytics> {
    const { data } = await api.get<BackendNetworkAnalyticsResponse>(
      "/analytics/network",
      await domainAnalyticsParams(organizationId, locationId),
    );
    return {
      windowStart: data.window_start,
      windowEnd: data.window_end,
      downloadBytes: data.download_bytes,
      uploadBytes: data.upload_bytes,
      totalBytes: data.total_bytes,
      peakBandwidth: {
        available: data.peak_bandwidth.available,
        peakBytes: data.peak_bandwidth.peak_bytes,
        bucketStart: data.peak_bandwidth.bucket_start,
      },
      averageSpeedBytesPerSecond: data.average_speed_bytes_per_second,
      networkAvailability: {
        availableRouterCount: data.network_availability.available_router_count,
        totalRouterCount: data.network_availability.total_router_count,
        availabilityPercent: data.network_availability.availability_percent,
      },
      topConsumers: data.top_consumers.map((c) => ({
        guestId: c.guest_id,
        identifier: c.identifier,
        totalBytes: c.total_bytes,
      })),
      topLocations: data.top_locations.map((l) => ({
        locationId: l.location_id,
        locationName: l.location_name,
        totalBytes: l.total_bytes,
      })),
      topRouters: data.top_routers.map((r) => ({
        routerId: r.router_id,
        routerName: r.router_name,
        totalBytes: r.total_bytes,
      })),
      trafficTrend: data.traffic_trend.map((t) => ({
        metric: t.metric,
        currentValue: t.current_value,
        deltaPercent: t.delta_percent,
      })),
    };
  },

  async getDomainAuthAnalytics(
    organizationId: string,
    locationId?: string,
  ): Promise<DomainAuthAnalytics> {
    const { data } = await api.get<BackendAuthAnalyticsResponse>(
      "/analytics/authentication",
      await domainAnalyticsParams(organizationId, locationId),
    );
    return {
      windowStart: data.window_start,
      windowEnd: data.window_end,
      otp: {
        totalRequests: data.otp.total_requests,
        successfulCount: data.otp.successful_count,
        failedCount: data.otp.failed_count,
        successRate: data.otp.success_rate,
      },
      voucher: {
        redeemedCount: data.voucher.redeemed_count,
        failedAttemptsRecorded: data.voucher.failed_attempts_recorded,
      },
      successTotal: data.authentication_success_total,
      failureTotal: data.authentication_failure_total,
      trends: data.authentication_trends.map((t) => ({
        date: t.date,
        successCount: t.success_count,
        failureCount: t.failure_count,
      })),
      failureReasons: data.failed_login_reasons,
      authMethods: data.auth_methods.map((m) => ({
        authMethod: m.auth_method,
        successfulAttempts: m.successful_attempts,
        failedAttempts: m.failed_attempts,
      })),
    };
  },

  async getDomainRouterAnalytics(
    organizationId: string,
    locationId?: string,
  ): Promise<DomainRouterAnalytics> {
    const { data } = await api.get<BackendRouterAnalyticsResponse>(
      "/analytics/routers",
      await domainAnalyticsParams(organizationId, locationId),
    );
    return {
      windowStart: data.window_start,
      windowEnd: data.window_end,
      routers: data.routers.map((r) => ({
        routerId: r.router_id,
        routerName: r.router_name,
        status: r.status,
        cpuUsagePercent: r.cpu_usage_percent_current,
        memoryUsagePercent: r.memory_usage_percent_current,
        uptimeSeconds: r.uptime_seconds,
        connectedClients: r.connected_clients_count,
        bandwidthTotalBytes: r.bandwidth_total_bytes,
        internetAvailable: r.internet_available,
        wireguard: { available: r.wireguard.available, status: r.wireguard.status },
        radiusSuccessCount: r.radius_success_count,
        radiusFailureCount: r.radius_failure_count,
      })),
    };
  },

  async getSnapshot(_range: DateRangePreset = "last30"): Promise<AnalyticsSnapshot> {
    const [{ data: unified }, organizations] = await Promise.all([
      api.get<BackendUnifiedDashboard>("/dashboard/super-admin/unified"),
      fetchOrganizationRows(),
    ]);
    const platform = unified.platform;

    const kpis: AnalyticsKpis = {
      totalOrganizations: platform.total_organizations,
      totalLocations: platform.total_locations,
      totalRouters: platform.total_routers,
      activeRouters: platform.routers_online,
      totalGuests: platform.total_guests,
      // Best available proxy: concurrent active sessions, not unique
      // "active guests" -- there is no platform-wide unique-guest gauge.
      activeGuests: platform.active_sessions,
      totalSessions: platform.total_sessions,
      // Unavailable platform-wide (OrganizationDashboardResponse has it
      // per-org, no platform aggregate exists).
      avgSessionDuration: 0,
      dailyLogins: platform.todays_guests,
      monthlyLogins: platform.monthly_guests,
      revenue: unified.total_revenue ?? 0,
      growthRate: platform.guest_growth.delta_percent ?? 0,
    };

    const routers: RouterAnalytics = {
      online: platform.routers_online,
      offline: platform.routers_offline,
      // No platform-wide CPU/memory/temperature/WAN/WireGuard/RADIUS
      // aggregate exists (those are per-router, via monitoring).
      avgCpu: 0,
      avgMemory: 0,
      avgTemperature: 0,
      wanAvailability: 0,
      wireguardHealth: 0,
      radiusHealth: 0,
      performance: [],
      cpuTrend: [],
      memoryTrend: [],
      healthScoreTrend: [],
    };

    return {
      kpis,
      guests: emptyGuestAnalytics(),
      network: emptyNetworkAnalytics(),
      routers,
      locations: [],
      organizations,
      devices: emptyDeviceAnalytics(),
      auth: emptyAuthAnalytics(),
    };
  },

  async listScheduledReports(): Promise<ScheduledReport[]> {
    const [{ data: templates }, { data: schedules }] = await Promise.all([
      api.get<BackendListResponse<BackendReportTemplate>>("/reports/templates", {
        params: { page_size: 100 },
      }),
      api.get<BackendListResponse<BackendScheduledReport>>("/reports/schedule", {
        params: { page_size: 100 },
      }),
    ]);
    const templateById = new Map(templates.items.map((t) => [t.id, t]));
    return schedules.items.map((s) => toScheduledReport(s, templateById.get(s.template_id)));
  },

  async createScheduledReport(
    input: Omit<ScheduledReport, "id" | "nextRunAt">,
  ): Promise<ScheduledReport> {
    const backendType = REPORT_TYPE_TO_BACKEND[input.type];
    if (!backendType) {
      throw new Error(
        `Scheduled reports need a real backend report type; "${input.type}" has no equivalent ` +
          `(backend only has dashboard/organization/location/router/guest/network/revenue/health).`,
      );
    }
    const orgId = await resolveDefaultOrganizationId();
    const headers = orgId ? { "X-Organization-Id": orgId } : undefined;

    const { data: template } = await api.post<BackendReportTemplate>(
      "/reports/templates",
      { name: input.name, report_type: backendType, config: {}, is_active: true },
      { headers },
    );
    const { data: schedule } = await api.post<BackendScheduledReport>(
      "/reports/schedule",
      {
        template_id: template.id,
        frequency: input.frequency,
        recipient_emails: input.recipients,
        export_format: input.format,
        is_active: input.enabled,
      },
      { headers },
    );
    return toScheduledReport(schedule, template);
  },

  async toggleScheduledReport(id: string, enabled: boolean): Promise<void> {
    await api.put(`/reports/schedule/${id}`, { is_active: enabled });
  },

  async deleteScheduledReport(id: string): Promise<void> {
    await api.delete(`/reports/schedule/${id}`);
  },

  async generateReport(input: {
    type: ReportType;
    format: ReportFormat;
    range: DateRangePreset;
  }): Promise<{ url: string; filename: string }> {
    const backendType = REPORT_TYPE_TO_BACKEND[input.type];
    if (!backendType) {
      // No backend ReportType for audit/billing/monitoring -- those
      // domains don't compose into the Report Engine (see
      // backend/app/domains/analytics/constants.py's ReportType docstring).
      const filename = `${input.type}-report-${Date.now()}.${input.format}`;
      return { url: `#unavailable/${filename}`, filename };
    }

    const orgId = ORG_SCOPED_REPORT_TYPES.has(backendType)
      ? await resolveDefaultOrganizationId()
      : null;
    const headers = orgId ? { "X-Organization-Id": orgId } : undefined;

    const days = RANGE_DAYS[input.range] ?? 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);

    const response = await api.post<Blob>(
      "/reports",
      {
        report_type: backendType,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        export_format: input.format,
      },
      { headers, responseType: "blob" },
    );
    const disposition = (response.headers as Record<string, string>)["content-disposition"];
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? `${input.type}-report-${Date.now()}.${input.format}`;
    const url = URL.createObjectURL(response.data);
    return { url, filename };
  },

  // AnalyticsSettings (default dashboard/date-range/refresh/timezone/chart
  // style) is a pure UI preference with no matching backend concept
  // anywhere in the analytics domain -- kept as local, in-memory state.
  async getSettings(): Promise<AnalyticsSettings> {
    return { ...settings };
  },

  async updateSettings(next: AnalyticsSettings): Promise<AnalyticsSettings> {
    settings = { ...next };
    return { ...settings };
  },
};

// ---------------------------------------------------------------------------
// Reports (real): backend/app/domains/analytics/report_router.py + schemas
// ---------------------------------------------------------------------------

interface BackendReportTemplate {
  id: string;
  name: string;
  report_type: string;
  organization_id: string | null;
  is_active: boolean;
}

interface BackendScheduledReport {
  id: string;
  template_id: string;
  organization_id: string;
  frequency: string;
  recipient_emails: string[];
  export_format: string;
  next_run_at: string;
  last_run_at: string | null;
  is_active: boolean;
}

// Only these six ReportType values exist on both sides -- backend also has
// "dashboard"/"health" (no frontend equivalent yet); frontend also has
// "audit"/"billing"/"monitoring" (no backend ReportType composes those).
const REPORT_TYPE_TO_BACKEND: Partial<Record<ReportType, string>> = {
  guest: "guest",
  router: "router",
  network: "network",
  organization: "organization",
  location: "location",
  revenue: "revenue",
};

const BACKEND_TO_REPORT_TYPE: Record<string, ReportType> = {
  guest: "guest",
  router: "router",
  network: "network",
  organization: "organization",
  location: "location",
  revenue: "revenue",
  // No direct frontend equivalent for these two -- approximated.
  dashboard: "organization",
  health: "monitoring",
};

const ORG_SCOPED_REPORT_TYPES = new Set(["organization", "router", "guest", "network"]);

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

function toScheduledReport(
  s: BackendScheduledReport,
  template: BackendReportTemplate | undefined,
): ScheduledReport {
  return {
    id: s.id,
    name: template?.name ?? "Untitled report",
    type: template ? (BACKEND_TO_REPORT_TYPE[template.report_type] ?? "organization") : "organization",
    frequency: s.frequency as ScheduledReport["frequency"],
    recipients: s.recipient_emails,
    format: s.export_format as ReportFormat,
    enabled: s.is_active,
    lastRunAt: s.last_run_at ?? undefined,
    nextRunAt: s.next_run_at,
  };
}

let cachedOrgId: string | null | undefined;
async function resolveDefaultOrganizationId(): Promise<string | null> {
  if (cachedOrgId !== undefined) return cachedOrgId;
  try {
    const { data } = await api.get<BackendListResponse<{ id: string }>>("/organizations", {
      params: { page_size: 1 },
    });
    cachedOrgId = data.items[0]?.id ?? null;
  } catch {
    cachedOrgId = null;
  }
  return cachedOrgId;
}

let settings: AnalyticsSettings = {
  defaultDashboard: "overview",
  defaultDateRange: "last30",
  autoRefreshSec: 60,
  timezone: "UTC",
  chartStyle: "smooth",
};
