/**
 * TanStack Query hooks for the venue twins (API_CONTRACT §10).
 *
 * Every hook here is disabled until it has a router id. That is not a
 * convenience: a venue screen cannot ask a meaningful question without one,
 * because the twin resolves the router through IspScope and 404s a router that
 * is not under the pinned location. Firing the query anyway would produce a
 * 404 the UI would have to explain for a state the UI created itself.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispKeys } from "@/hooks/isp-partner/keys";
import { venueVlanService } from "@/services/isp-partner/venue";

const DEFAULT_PAGE_SIZE = 25;

export function useVenueVlans(routerId: string | null, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return useQuery({
    queryKey: ispKeys.venueVlans(routerId ?? "", { page, pageSize }),
    queryFn: () => venueVlanService.list({ routerId: routerId!, page, pageSize }),
    enabled: Boolean(routerId),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function usePushVenueVlan(routerId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vlanId: string) => venueVlanService.push(vlanId),
    onSuccess: () => {
      if (routerId) qc.invalidateQueries({ queryKey: ["isp", "venue", "vlans", routerId] });
    },
  });
}
