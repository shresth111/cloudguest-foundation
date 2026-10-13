import { useMutation, useQuery } from "@tanstack/react-query";
import { sameSearch } from "@/hooks/useFlowDestinations";
import { trafficFlowRecordsService } from "@/services/traffic-flow-records.service";

/**
 * Every flow-record search and download writes an audit row on the server,
 * and a row here places a device's address beside the address it reached.
 * These hooks therefore fetch ONLY when the operator asks: no retry, no
 * refetch on focus, reconnect or remount, and nothing goes stale on its own.
 */
const ASKED_FOR_ONLY = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const;

type Params = Record<string, string> | null;

export const flowRecordKeys = {
  search: (params: Params) => ["traffic-flow-records", "search", params] as const,
};

/** Disabled until a search has been submitted (`params` non-null). */
export function useFlowRecordSearch(params: Params) {
  return useQuery({
    queryKey: flowRecordKeys.search(params),
    queryFn: () => trafficFlowRecordsService.search(params as Record<string, string>),
    enabled: params !== null,
    // A re-sort keeps the page on screen (dimmed) until its answer arrives.
    // Only a re-sort: another venue, range or filter never borrows rows.
    placeholderData: (previous, previousQuery) =>
      sameSearch(previousQuery?.queryKey[2], params) ? previous : undefined,
    ...ASKED_FOR_ONLY,
  });
}

export function useFlowRecordExport() {
  return useMutation({
    mutationFn: (params: Record<string, string>) => trafficFlowRecordsService.exportCsv(params),
  });
}
