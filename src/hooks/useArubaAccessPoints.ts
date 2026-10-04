import { useQuery } from "@tanstack/react-query";
import { isDemo } from "@/services/customer.service";
import { arubaAccessPointsService } from "@/services/aruba-access-points.service";
import type { ArubaAccessPointsState } from "@/lib/aruba-access-points";

/**
 * The access points of an Aruba Instant On venue. Pass `undefined` for any
 * other venue: the query is then disabled and NO request is made, so a
 * MikroTik or Omada page's network traffic is unchanged.
 *
 * The demo account has no Instant On venue and no fixture for one, so it is
 * never asked either.
 */
export function useArubaAccessPoints(locationId: string | undefined): ArubaAccessPointsState {
  const enabled = !!locationId && !isDemo();
  const q = useQuery({
    queryKey: ["aruba-access-points", locationId],
    queryFn: () => arubaAccessPointsService.list(locationId!),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 0,
  });
  if (!enabled) return { status: "unavailable" };
  if (q.isLoading || !q.data) return { status: "loading" };
  return q.data;
}
