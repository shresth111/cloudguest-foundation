import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import type {
  GuestMixData,
  InsightRangeDays,
  LocationComparisonData,
  LoginFunnelData,
  PeakHoursData,
} from "./insights.types";

/**
 * Data hooks for the venue-insight widgets. This file is the widgets' only
 * seam to the network -- the render test stubs it whole.
 *
 * Demo sessions have no backend tenant, so every hook is disabled there and
 * the widgets say so. Nothing here ever returns sample numbers: a failed read
 * is an error state, never zeros.
 */

const BASE = "/analytics/venue-insights";

export const insightKeys = {
  all: ["customer", "insights"] as const,
  venue: (kind: string, locationId: string, days: number) =>
    ["customer", "insights", kind, locationId, days] as const,
  locations: (days: number) => ["customer", "insights", "locations", days] as const,
};

function windowParams(days: number) {
  // Rounded to the minute so a refetch a few seconds later reads the same
  // window the cache key describes.
  const end = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const start = new Date(end.getTime() - days * 86_400_000);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

// Checked here, not trusted: a body of the wrong shape (an old backend, a
// proxy error page, a paginated envelope) made the heatmap throw on
// `data.cells` during render, and a render error on one card takes the
// whole dashboard down with it. A wrong shape is a failed read instead,
// which each card already shows as its error state.
const num = (v: unknown) => typeof v === "number";
const VENUE_SHAPES: Record<string, (d: Record<string, unknown>) => boolean> = {
  "peak-hours": (d) => Array.isArray(d.cells) && num(d.total_sessions),
  "guest-mix": (d) => num(d.unique_guests) && num(d.new_guests) && num(d.returning_guests),
  "login-funnel": (d) =>
    Array.isArray(d.methods) &&
    num(d.otp_codes_sent) &&
    funnelStageOk(d.portal_opened) &&
    funnelStageOk(d.internet_confirmed),
};

// Each extra funnel stage is `{available: false, message}` or
// `{available: true, count, ...}`. Anything else (an older backend that
// omits the stage, a stage with no count) fails the read rather than
// rendering NaN.
function funnelStageOk(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (s.available === false) return typeof s.message === "string";
  return s.available === true && num(s.count);
}

async function getVenueInsight<T>(path: string, locationId: string, days: number): Promise<T> {
  const orgId = await resolveOrgId();
  const { data } = await api.get<T>(`${BASE}/${path}`, {
    params: { location_id: locationId, ...windowParams(days) },
    headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId },
  });
  const valid = VENUE_SHAPES[path];
  if (
    !data ||
    typeof data !== "object" ||
    (valid && !valid(data as unknown as Record<string, unknown>))
  ) {
    throw new Error(`Unexpected ${BASE}/${path} response`);
  }
  return data;
}

const QUERY_DEFAULTS = {
  staleTime: 5 * 60_000,
  retry: 1,
  refetchOnWindowFocus: false,
} as const;

export interface InsightQuery<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  isDemo: boolean;
  refetch: () => void;
}

function useVenueInsight<T>(
  kind: string,
  path: string,
  locationId: string,
  days: InsightRangeDays,
): InsightQuery<T> {
  const demo = useIsDemo();
  const q = useQuery({
    queryKey: insightKeys.venue(kind, locationId, days),
    queryFn: () => getVenueInsight<T>(path, locationId, days),
    enabled: !!locationId && !demo,
    ...QUERY_DEFAULTS,
  });
  return {
    data: q.data,
    isLoading: q.isLoading,
    isError: q.isError,
    isDemo: demo,
    refetch: () => void q.refetch(),
  };
}

export function usePeakHours(locationId: string, days: InsightRangeDays) {
  return useVenueInsight<PeakHoursData>("peak-hours", "peak-hours", locationId, days);
}

export function useGuestMix(locationId: string, days: InsightRangeDays) {
  return useVenueInsight<GuestMixData>("guest-mix", "guest-mix", locationId, days);
}

export function useLoginFunnel(locationId: string, days: InsightRangeDays) {
  return useVenueInsight<LoginFunnelData>("login-funnel", "login-funnel", locationId, days);
}

export function useLocationComparison(
  days: InsightRangeDays,
): InsightQuery<LocationComparisonData> {
  const demo = useIsDemo();
  const q = useQuery({
    queryKey: insightKeys.locations(days),
    queryFn: async () => {
      const orgId = await resolveOrgId();
      const { data } = await api.get<LocationComparisonData>(`${BASE}/locations`, {
        params: windowParams(days),
        headers: { "X-Organization-Id": orgId },
      });
      if (!data || !Array.isArray(data.locations)) {
        throw new Error(`Unexpected ${BASE}/locations response`);
      }
      return data;
    },
    enabled: !demo,
    ...QUERY_DEFAULTS,
  });
  return {
    data: q.data,
    isLoading: q.isLoading,
    isError: q.isError,
    isDemo: demo,
    refetch: () => void q.refetch(),
  };
}
