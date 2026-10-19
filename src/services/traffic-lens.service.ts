/**
 * Customer-dashboard calls for Traffic Lens. Read-only: status and summary
 * for one venue. Shapes: the "Customer API" section of
 * wyfy-specs/flow-visibility/API.md.
 *
 * The organisation comes from the usual X-Organization-Id context that `api`
 * already sends; the venue is in the path and the server checks it is the
 * caller's. The refusals that matter to the screen are told apart in
 * `lensRefusal`: 402 (add-on off, or the licence lapsed) and 403/404 (not
 * this caller's to see).
 *
 * Nothing here may call the Master routes (`/platform/traffic-flow`).
 *
 * On the demo host every call is answered from `lib/traffic-lens-demo.ts`
 * fixtures; nothing reaches the backend.
 */
import { api, requestErrorOf } from "./api";
import { isDemoSession } from "@/lib/demo-host";
import {
  demoLensFindings,
  demoLensGeo,
  demoLensStatus,
  demoLensSummary,
} from "@/lib/traffic-lens-demo";
import {
  lensRangeBounds,
  lensRefusalFrom,
  type LensRange,
  type LensRefusal,
} from "@/lib/traffic-lens-customer";
import type { LensStatus, LensSummary } from "@/types/traffic-lens";
import type { FlowGeoSummary } from "@/types/traffic-flow-geo";
import type { FindingsResponse } from "@/types/traffic-lens-findings";

const base = (locationId: string) => `/traffic-flow/locations/${encodeURIComponent(locationId)}`;

/** Bands in the timeline: as many as there are band colours (see
 * LENS_SERIES_COLORS); a further service folds into "Other". */
export const LENS_TIMELINE_SERIES = 4;

/** Query params for the summary. The range is sent as explicit bounds so
 * every block on the page describes the same period. */
export function lensSummaryParams(range: LensRange, now: number): Record<string, string> {
  const { since, until } = lensRangeBounds(range, now);
  return {
    since,
    until,
    limit: "10",
    series: String(LENS_TIMELINE_SERIES),
  };
}

/** Query params for the by-country view: the same explicit bounds as the
 * summary. The venue is in the path, never also a parameter. */
export function lensGeoParams(range: LensRange, now: number): Record<string, string> {
  const { since, until } = lensRangeBounds(range, now);
  return { since, until, limit: "10", networks: "5" };
}

/** Why a request was refused, when it was a refusal and not a failure.
 * The decision itself is `lensRefusalFrom` (pure, tested). */
export function lensRefusal(err: unknown): LensRefusal {
  const e = requestErrorOf(err);
  return e ? lensRefusalFrom(e.status, e.data?.error_code) : null;
}

export const trafficLensService = {
  async status(locationId: string): Promise<LensStatus> {
    if (isDemoSession()) return demoLensStatus(locationId);
    const { data } = await api.get<LensStatus>(`${base(locationId)}/status`);
    return data;
  },

  async summary(locationId: string, params: Record<string, string>): Promise<LensSummary> {
    if (isDemoSession()) return demoLensSummary(locationId, params);
    const { data } = await api.get<LensSummary>(`${base(locationId)}/summary`, { params });
    return data;
  },

  /** By country and network, for the venue as a whole. */
  async geo(locationId: string, params: Record<string, string>): Promise<FlowGeoSummary> {
    if (isDemoSession()) return demoLensGeo(locationId, params);
    const { data } = await api.get<FlowGeoSummary>(`${base(locationId)}/geo`, { params });
    return data;
  },

  /** The venue's findings for the same period as the summary (API.md,
   * "Findings API"). Computed by the server when asked; nothing is stored. */
  async findings(
    locationId: string,
    period: { since: string; until: string },
  ): Promise<FindingsResponse> {
    if (isDemoSession()) return demoLensFindings(locationId, period);
    const { data } = await api.get<FindingsResponse>(`${base(locationId)}/findings`, {
      params: period,
    });
    return data;
  },
};
