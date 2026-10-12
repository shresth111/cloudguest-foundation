import { useQuery } from "@tanstack/react-query";
import { resolveActiveOrganizationId } from "@/services/api";
import {
  lensRefusal,
  lensSummaryParams,
  trafficLensService,
} from "@/services/traffic-lens.service";
import type { LensRange } from "@/lib/traffic-lens-customer";

/** The organisation is in the key as well as the venue, so a session that
 * switches organisation can never be served the previous tenant's rows. */
export const trafficLensKeys = {
  all: ["traffic-lens"] as const,
  status: (org: string | null, locationId: string) =>
    ["traffic-lens", org, locationId, "status"] as const,
  summary: (org: string | null, locationId: string, range: LensRange, at: number) =>
    ["traffic-lens", org, locationId, "summary", range, at] as const,
};

/** A refusal (add-on off, not this caller's venue) is an answer, not a
 * failure: retrying it only delays the screen that explains it. */
const retryUnlessRefused = (failureCount: number, err: unknown) =>
  lensRefusal(err) === null && failureCount < 1;

/** Which empty state, if any, the venue is in. Cheap; no traffic figures. */
export function useTrafficLensStatus(locationId: string, enabled: boolean) {
  return useQuery({
    queryKey: trafficLensKeys.status(resolveActiveOrganizationId(), locationId),
    queryFn: () => trafficLensService.status(locationId),
    enabled: enabled && !!locationId,
    staleTime: 60_000,
    retry: retryUnlessRefused,
  });
}

/** `at` pins the range: it changes only on an explicit refresh or a new
 * range, so the totals, timeline and lists never describe different periods. */
export function useTrafficLensSummary(
  locationId: string,
  range: LensRange,
  at: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: trafficLensKeys.summary(resolveActiveOrganizationId(), locationId, range, at),
    queryFn: () => trafficLensService.summary(locationId, lensSummaryParams(range, at)),
    enabled: enabled && !!locationId,
    retry: retryUnlessRefused,
  });
}
