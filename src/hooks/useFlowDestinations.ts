import { useMutation, useQuery } from "@tanstack/react-query";
import { trafficFlowDestinationsService } from "@/services/traffic-flow-destinations.service";

/**
 * Every Destinations request writes an audit row on the server. These hooks
 * therefore fetch ONLY when the operator asks: no retry, no refetch on
 * focus, reconnect or remount, and nothing goes stale on its own. A new
 * search is a new `params` object (new query key), made by an explicit
 * Search, a sort click or a Refresh.
 */
const ASKED_FOR_ONLY = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const;

export const flowDestinationKeys = {
  search: (params: Record<string, string> | null) =>
    ["traffic-flow-destinations", "search", params] as const,
  service: (params: Record<string, string> | null) =>
    ["traffic-flow-destinations", "service", params] as const,
};

/** True when two requests differ at most in how they are sorted. */
export function sameSearch(
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined,
): boolean {
  if (!a || !b) return false;
  const identity = (params: Record<string, string>) =>
    JSON.stringify(
      Object.entries(params)
        .filter(([key]) => key !== "sort" && key !== "order")
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  return identity(a) === identity(b);
}

/** Disabled until a search has been submitted (`params` non-null). */
export function useDestinationSearch(params: Record<string, string> | null) {
  return useQuery({
    queryKey: flowDestinationKeys.search(params),
    queryFn: () => trafficFlowDestinationsService.search(params as Record<string, string>),
    enabled: params !== null,
    // A re-sort keeps the page on screen (dimmed) until its answer arrives.
    // Only a re-sort: another venue, range or filter never borrows rows.
    placeholderData: (previous, previousQuery) =>
      sameSearch(previousQuery?.queryKey[2], params) ? previous : undefined,
    ...ASKED_FOR_ONLY,
  });
}

export function useDestinationExport() {
  return useMutation({
    mutationFn: (params: Record<string, string>) =>
      trafficFlowDestinationsService.exportCsv(params),
  });
}

/** Disabled until a service row is opened (`params` non-null). */
export function useServiceDestinations(params: Record<string, string> | null) {
  return useQuery({
    queryKey: flowDestinationKeys.service(params),
    queryFn: () =>
      trafficFlowDestinationsService.serviceDestinations(params as Record<string, string>),
    enabled: params !== null,
    ...ASKED_FOR_ONLY,
  });
}
