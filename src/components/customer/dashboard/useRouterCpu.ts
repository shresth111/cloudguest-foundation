import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { dashboardRangeWindow, type DashboardRange } from "@/lib/dashboard-range";

/**
 * The Dashboard's Router CPU card: CPU over time for each MikroTik router
 * at the venue, in ONE request.
 *
 * Backend: `GET /analytics/venue-insights/router-cpu`
 * (`app/domains/analytics/router_cpu.py`). It reads `router_health_snapshots`
 * (the RouterOS-API sweep every 600s, the SNMP sweep every 300s) and
 * downsamples server-side to at most 60 buckets per router, so the body
 * stays small at every range. MikroTik only, by the owner's call: Omada
 * and Aruba rows never write a snapshot and are not in `routers` at all.
 * `routers: []` means "no MikroTik here" and the card does not render.
 *
 * The body is checked, not trusted: a wrong-shaped body (an older backend
 * without this route, a proxy page, a paginated envelope) once took the
 * whole dashboard down when a card read a missing field during render. A
 * wrong shape is a failed read here, which the card shows as its own
 * error state.
 */

export interface RouterCpuPoint {
  bucket_start: string;
  cpu_avg: number | null;
  cpu_max: number | null;
  memory_avg: number | null;
}

export interface RouterCpuLatest {
  recorded_at: string;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
  is_stale: boolean;
}

export interface RouterCpuRouter {
  router_id: string;
  router_name: string;
  status: string;
  latest: RouterCpuLatest | null;
  points: RouterCpuPoint[];
}

export interface RouterCpuData {
  location_id: string;
  window_start: string;
  window_end: string;
  bucket_seconds: number;
  stale_after_seconds: number;
  high_cpu_percent: number;
  routers: RouterCpuRouter[];
}

const PATH = "/analytics/venue-insights/router-cpu";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

function pointOk(v: unknown): boolean {
  return (
    isObj(v) &&
    typeof v.bucket_start === "string" &&
    isNumOrNull(v.cpu_avg) &&
    isNumOrNull(v.cpu_max) &&
    isNumOrNull(v.memory_avg)
  );
}

function latestOk(v: unknown): boolean {
  if (v === null) return true;
  return (
    isObj(v) &&
    typeof v.recorded_at === "string" &&
    isNumOrNull(v.cpu_usage_percent) &&
    isNumOrNull(v.memory_usage_percent) &&
    typeof v.is_stale === "boolean"
  );
}

/** The shape check every body passes before the card sees it. */
export function isRouterCpuData(v: unknown): v is RouterCpuData {
  return (
    isObj(v) &&
    isNum(v.bucket_seconds) &&
    isNum(v.high_cpu_percent) &&
    Array.isArray(v.routers) &&
    v.routers.every(
      (r) =>
        isObj(r) &&
        typeof r.router_id === "string" &&
        typeof r.router_name === "string" &&
        latestOk(r.latest) &&
        Array.isArray(r.points) &&
        r.points.every(pointOk),
    )
  );
}

/** The page's range as a query window, rounded to the minute so a refetch
 * a few seconds later asks for the same window its cache key names. */
function windowFor(range: DashboardRange) {
  const w = dashboardRangeWindow(range);
  const end = new Date(Math.floor(w.end.getTime() / 60_000) * 60_000);
  return { start_date: w.start.toISOString(), end_date: end.toISOString() };
}

async function getRouterCpu(locationId: string, range: DashboardRange): Promise<RouterCpuData> {
  const orgId = await resolveOrgId();
  const { data } = await api.get<unknown>(PATH, {
    params: { location_id: locationId, ...windowFor(range) },
    headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId },
  });
  if (!isRouterCpuData(data)) throw new Error(`Unexpected ${PATH} response`);
  return data;
}

/** Demo workspace only (no backend tenant): one router with a believable
 * daily curve, through the same render path as real data. */
export function demoRouterCpu(locationId: string, range: DashboardRange, now = Date.now()) {
  const span = range === "24h" ? 86_400_000 : range === "7d" ? 7 * 86_400_000 : 30 * 86_400_000;
  const bucket = range === "24h" ? 1800 : range === "7d" ? 10800 : 43200;
  const n = Math.floor(span / (bucket * 1000));
  const points: RouterCpuPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const at = new Date(now - i * bucket * 1000);
    const hour = at.getHours();
    const busy = hour >= 18 && hour <= 23;
    const cpu = (busy ? 46 : hour >= 9 ? 28 : 11) + ((i * 7) % 9);
    points.push({
      bucket_start: at.toISOString(),
      cpu_avg: cpu,
      cpu_max: Math.min(100, cpu + 14 + (i % 5) * 3),
      memory_avg: 41 + (i % 4),
    });
  }
  const last = points[points.length - 1];
  return {
    location_id: locationId,
    window_start: new Date(now - span).toISOString(),
    window_end: new Date(now).toISOString(),
    bucket_seconds: bucket,
    stale_after_seconds: 1800,
    high_cpu_percent: 80,
    routers: [
      {
        router_id: "demo-router-1",
        router_name: "Lobby router",
        status: "online",
        latest: {
          recorded_at: new Date(now - 4 * 60_000).toISOString(),
          cpu_usage_percent: last?.cpu_avg ?? 24,
          memory_usage_percent: last?.memory_avg ?? 42,
          is_stale: false,
        },
        points,
      },
    ],
  } satisfies RouterCpuData;
}

export interface RouterCpuQuery {
  data: RouterCpuData | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** `enabled` is false at venues that cannot have a MikroTik (Aruba-only,
 * controller-only): they make no request at all. */
export function useRouterCpu(
  locationId: string,
  range: DashboardRange,
  enabled: boolean,
): RouterCpuQuery {
  const demo = useIsDemo();
  const q = useQuery({
    queryKey: ["customer", "dashboard", "router-cpu", locationId, range] as const,
    queryFn: () => getRouterCpu(locationId, range),
    enabled: enabled && !!locationId && !demo,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const demoBody = useMemo(
    () => (demo && enabled ? demoRouterCpu(locationId, range) : undefined),
    [demo, enabled, locationId, range],
  );
  if (demoBody) {
    return {
      data: demoBody,
      isLoading: false,
      isError: false,
      refetch: () => {},
    };
  }
  return {
    data: q.data,
    isLoading: q.isLoading && enabled,
    isError: q.isError,
    refetch: () => void q.refetch(),
  };
}
