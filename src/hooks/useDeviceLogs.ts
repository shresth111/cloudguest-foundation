import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deviceLogParams, deviceLogsService } from "@/services/deviceLogs.service";
import type { DeviceLogFilters } from "@/types/deviceLogs";

export const deviceLogKeys = {
  all: ["device-logs"] as const,
  list: (filters: DeviceLogFilters, at: number) => ["device-logs", "list", filters, at] as const,
  overview: ["device-logs", "overview"] as const,
  router: (id: string) => ["device-logs", "router", id] as const,
};

/** `at` pins the time window: it changes only on an explicit refresh, so
 * paging never shifts the window under the operator. */
export function useDeviceLogs(filters: DeviceLogFilters, at: number) {
  return useInfiniteQuery({
    queryKey: deviceLogKeys.list(filters, at),
    queryFn: ({ pageParam }) => deviceLogsService.list(deviceLogParams(filters, at, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    retry: 1,
  });
}

export function useDeviceLogsOverview() {
  return useQuery({
    queryKey: deviceLogKeys.overview,
    queryFn: () => deviceLogsService.overview(),
    retry: 1,
  });
}

export function useRouterLogging(routerId: string | null) {
  return useQuery({
    queryKey: deviceLogKeys.router(routerId ?? ""),
    queryFn: () => deviceLogsService.router(routerId as string),
    enabled: !!routerId,
    retry: 1,
  });
}

export function useRouterLoggingWrite(routerId: string) {
  const qc = useQueryClient();
  const onSuccess = (detail: Awaited<ReturnType<typeof deviceLogsService.apply>>) => {
    qc.setQueryData(deviceLogKeys.router(routerId), detail);
    void qc.invalidateQueries({ queryKey: deviceLogKeys.overview });
  };
  return {
    apply: useMutation({ mutationFn: () => deviceLogsService.apply(routerId), onSuccess }),
    remove: useMutation({ mutationFn: () => deviceLogsService.remove(routerId), onSuccess }),
  };
}
