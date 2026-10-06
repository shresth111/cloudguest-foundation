import api from "@/services/api";
import type {
  DeviceLogFilters,
  DeviceLogPage,
  DeviceLogsOverview,
  RouterLoggingDetail,
} from "@/types/deviceLogs";

const WINDOW_MS: Record<DeviceLogFilters["window"], number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/** Query params for GET /platform/device-logs. The window is turned into an
 * explicit `since` at request time so a "Load more" page uses the same
 * bounds as the first page (the cursor carries the rest). */
export function deviceLogParams(
  filters: DeviceLogFilters,
  now: number,
  cursor?: string | null,
): Record<string, string> {
  const params: Record<string, string> = {
    since: new Date(now - WINDOW_MS[filters.window]).toISOString(),
    until: new Date(now).toISOString(),
    limit: "100",
  };
  if (filters.organizationId) params.organization_id = filters.organizationId;
  if (filters.locationId) params.location_id = filters.locationId;
  if (filters.routerId) params.router_id = filters.routerId;
  if (filters.maxSeverity !== "") params.max_severity = filters.maxSeverity;
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.unattributed) params.unattributed = "true";
  if (cursor) params.cursor = cursor;
  return params;
}

export const deviceLogsService = {
  async list(params: Record<string, string>): Promise<DeviceLogPage> {
    const { data } = await api.get<DeviceLogPage>("/platform/device-logs", { params });
    return data;
  },

  async overview(): Promise<DeviceLogsOverview> {
    const { data } = await api.get<DeviceLogsOverview>("/platform/device-logs/status");
    return data;
  },

  async router(routerId: string): Promise<RouterLoggingDetail> {
    const { data } = await api.get<RouterLoggingDetail>(
      `/platform/device-logs/routers/${encodeURIComponent(routerId)}`,
    );
    return data;
  },

  /** Writes remote logging onto the router over the RouterOS API, then reads
   * it back. The response carries the read-back verdict -- a 200 is NOT by
   * itself "configured"; `status.verified_ok` is. */
  async apply(routerId: string): Promise<RouterLoggingDetail> {
    const { data } = await api.post<RouterLoggingDetail>(
      `/platform/device-logs/routers/${encodeURIComponent(routerId)}/apply`,
    );
    return data;
  },

  async remove(routerId: string): Promise<RouterLoggingDetail> {
    const { data } = await api.post<RouterLoggingDetail>(
      `/platform/device-logs/routers/${encodeURIComponent(routerId)}/remove`,
    );
    return data;
  },
};
