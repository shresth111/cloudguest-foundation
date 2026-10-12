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
 */
import { api, requestErrorOf } from "./api";
import {
  lensRangeBounds,
  lensRefusalFrom,
  type LensRange,
  type LensRefusal,
} from "@/lib/traffic-lens-customer";
import type { LensStatus, LensSummary } from "@/types/traffic-lens";

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

/** Why a request was refused, when it was a refusal and not a failure.
 * The decision itself is `lensRefusalFrom` (pure, tested). */
export function lensRefusal(err: unknown): LensRefusal {
  const e = requestErrorOf(err);
  return e ? lensRefusalFrom(e.status, e.data?.error_code) : null;
}

export const trafficLensService = {
  async status(locationId: string): Promise<LensStatus> {
    const { data } = await api.get<LensStatus>(`${base(locationId)}/status`);
    return data;
  },

  async summary(locationId: string, params: Record<string, string>): Promise<LensSummary> {
    const { data } = await api.get<LensSummary>(`${base(locationId)}/summary`, { params });
    return data;
  },
};
