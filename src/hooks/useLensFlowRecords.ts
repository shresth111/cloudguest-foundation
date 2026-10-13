import { useMutation, useQuery } from "@tanstack/react-query";
import { resolveActiveOrganizationId } from "@/services/api";
import { trafficLensFlowRecordsService } from "@/services/traffic-lens-flow-records.service";

/**
 * Every connection-record search and download writes an audit row on the
 * server. These hooks therefore fetch ONLY when the person asks: no retry,
 * no refetch on focus, reconnect or remount, and nothing goes stale on its
 * own. The organisation is in the key as well as the venue, so a session
 * that switches organisation can never be shown the previous one's rows.
 */
const ASKED_FOR_ONLY = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const;

type Params = Record<string, string> | null;

export const lensFlowRecordKeys = {
  search: (org: string | null, locationId: string, params: Params) =>
    ["traffic-lens-flow-records", org, locationId, "search", params] as const,
};

/** Disabled until a search has been submitted (`params` non-null). */
export function useLensFlowRecordSearch(locationId: string, params: Params) {
  return useQuery({
    queryKey: lensFlowRecordKeys.search(resolveActiveOrganizationId(), locationId, params),
    queryFn: () =>
      trafficLensFlowRecordsService.search(locationId, params as Record<string, string>),
    enabled: !!locationId && params !== null,
    ...ASKED_FOR_ONLY,
  });
}

export function useLensFlowRecordExport(locationId: string) {
  return useMutation({
    mutationFn: (params: Record<string, string>) =>
      trafficLensFlowRecordsService.exportCsv(locationId, params),
  });
}
