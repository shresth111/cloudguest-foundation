import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { netLogsService } from "@/services/netlogs.service";
import { netLogsListParams } from "@/lib/netlogs";

/**
 * NetLogs queries. Keyed on the organisation, the `X-Location-Id` sent and
 * the exact params (whose `since`/`until` come from a pinned `now`), so a
 * venue switch, an account switch or a filter change can never paint the
 * previous answer, and "Load more" pages share one window.
 */
export const netLogsKeys = {
  all: ["netlogs"] as const,
  list: (org: string | null, header: string | null, params: Record<string, string>) =>
    ["netlogs", org, header, "list", params] as const,
  summary: (org: string | null, header: string | null, params: Record<string, string>) =>
    ["netlogs", org, header, "summary", params] as const,
};

export function useNetLogsList(
  org: string | null,
  header: string | null,
  params: Record<string, string>,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: netLogsKeys.list(org, header, params),
    queryFn: ({ pageParam }) => netLogsService.list(netLogsListParams(params, pageParam), header),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useNetLogsSummary(
  org: string | null,
  header: string | null,
  params: Record<string, string>,
  enabled = true,
) {
  return useQuery({
    queryKey: netLogsKeys.summary(org, header, params),
    queryFn: () => netLogsService.summary(params, header),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
