import { useInfiniteQuery } from "@tanstack/react-query";
import { ipdrService } from "@/services/ipdr.service";
import { ipdrListParams } from "@/lib/ipdr";

/** Keyed on the organisation and the exact params (pinned window), so an
 * account switch or a filter change never paints the previous answer. */
export function useIpdrConnections(
  org: string | null,
  params: Record<string, string>,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["ipdr", org, "connections", params] as const,
    queryFn: ({ pageParam }) => ipdrService.list(ipdrListParams(params, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
