/** IPLOGS-SELFSERVE queries. A 404 (flag off) resolves to `null`, so callers
 * render nothing and the page is exactly what it was before. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipLogsService } from "@/services/isp-partner/iplogs";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorStatus } from "@/lib/isp-partner/errors";

export const ipLogsKeys = {
  all: ["isp", "ip-logs"] as const,
  status: (id: string) => ["isp", "ip-logs", "status", id] as const,
  script: (id: string) => ["isp", "ip-logs", "script", id] as const,
  fleet: (customer?: string) => ["isp", "ip-logs", "fleet", customer ?? "all"] as const,
};

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (ispErrorStatus(e) === 404) return null;
    throw e;
  }
}

export function useIpLogsStatus(routerId: string) {
  return useQuery({
    queryKey: ipLogsKeys.status(routerId),
    queryFn: () => orNull(ipLogsService.status(routerId)),
    retry: retryUnless4xx,
    enabled: !!routerId,
    refetchInterval: 30_000,
  });
}

export function useIpLogsScript(routerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ipLogsKeys.script(routerId),
    queryFn: () => ipLogsService.script(routerId),
    retry: retryUnless4xx,
    enabled: enabled && !!routerId,
    staleTime: 0,
  });
}

export function useIpLogsFleet(customerId?: string) {
  return useQuery({
    queryKey: ipLogsKeys.fleet(customerId),
    queryFn: () => orNull(ipLogsService.fleet(customerId)),
    retry: retryUnless4xx,
    refetchInterval: 60_000,
  });
}

export function useIpLogsToggle(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) =>
      on ? ipLogsService.enable(routerId) : ipLogsService.disable(routerId),
    onSuccess: (data) => {
      qc.setQueryData(ipLogsKeys.status(routerId), data);
      void qc.invalidateQueries({ queryKey: ipLogsKeys.all });
    },
  });
}
