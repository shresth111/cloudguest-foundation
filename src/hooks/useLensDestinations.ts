import { useMutation, useQuery } from "@tanstack/react-query";
import { resolveActiveOrganizationId } from "@/services/api";
import { trafficLensDestinationsService } from "@/services/traffic-lens-destinations.service";

/**
 * Every Destinations request writes an audit row on the server. These hooks
 * therefore fetch ONLY when the person asks: no retry, no refetch on focus,
 * reconnect or remount, and nothing goes stale on its own.
 *
 * The organisation is in the key as well as the venue, so a session that
 * switches organisation can never be shown the previous one's rows.
 */
const ASKED_FOR_ONLY = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const;

type Params = Record<string, string> | null;

export const lensDestinationKeys = {
  search: (org: string | null, locationId: string, params: Params) =>
    ["traffic-lens-destinations", org, locationId, "search", params] as const,
  service: (org: string | null, locationId: string, params: Params) =>
    ["traffic-lens-destinations", org, locationId, "service", params] as const,
};

/** Disabled until a search has been submitted (`params` non-null). */
export function useLensDestinationSearch(locationId: string, params: Params) {
  return useQuery({
    queryKey: lensDestinationKeys.search(resolveActiveOrganizationId(), locationId, params),
    queryFn: () =>
      trafficLensDestinationsService.search(locationId, params as Record<string, string>),
    enabled: !!locationId && params !== null,
    ...ASKED_FOR_ONLY,
  });
}

export function useLensDestinationExport(locationId: string) {
  return useMutation({
    mutationFn: (params: Record<string, string>) =>
      trafficLensDestinationsService.exportCsv(locationId, params),
  });
}

/** Disabled until a service row is opened (`params` non-null). */
export function useLensServiceDestinations(locationId: string, params: Params) {
  return useQuery({
    queryKey: lensDestinationKeys.service(resolveActiveOrganizationId(), locationId, params),
    queryFn: () =>
      trafficLensDestinationsService.serviceDestinations(
        locationId,
        params as Record<string, string>,
      ),
    enabled: !!locationId && params !== null,
    ...ASKED_FOR_ONLY,
  });
}
