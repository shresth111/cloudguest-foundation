import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flowGeoParams,
  flowSummaryParams,
  trafficFlowService,
} from "@/services/traffic-flow.service";
import type { FlowScope } from "@/types/traffic-flow";

export const trafficFlowKeys = {
  all: ["traffic-flow"] as const,
  status: ["traffic-flow", "status"] as const,
  config: (id: string) => ["traffic-flow", "config", id] as const,
  summary: (scope: FlowScope, at: number) => ["traffic-flow", "summary", scope, at] as const,
  geo: (scope: FlowScope, at: number) => ["traffic-flow", "geo", scope, at] as const,
};

export function useTrafficFlowStatus() {
  return useQuery({
    queryKey: trafficFlowKeys.status,
    queryFn: () => trafficFlowService.status(),
    retry: 1,
  });
}

export function useRouterFlowConfig(routerId: string | null) {
  return useQuery({
    queryKey: trafficFlowKeys.config(routerId ?? ""),
    queryFn: () => trafficFlowService.config(routerId as string),
    enabled: !!routerId,
    retry: 1,
  });
}

/** Apply / Remove answer with the verdict, not the router row, so the row
 * and the fleet table are refetched after a real write -- also after a
 * read-back that did not match, because the stored verdict changed. A dry
 * run records nothing, so it refetches nothing. */
export function useRouterFlowWrite(routerId: string) {
  const qc = useQueryClient();
  const onSuccess = () => {
    void qc.invalidateQueries({ queryKey: trafficFlowKeys.config(routerId) });
    void qc.invalidateQueries({ queryKey: trafficFlowKeys.status });
  };
  return {
    dryRun: useMutation({ mutationFn: () => trafficFlowService.apply(routerId, { dryRun: true }) }),
    apply: useMutation({
      mutationFn: () => trafficFlowService.apply(routerId, { dryRun: false }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: () => trafficFlowService.remove(routerId), onSuccess }),
  };
}

/** `at` pins the range: it changes only on an explicit refresh or a new
 * range, so the totals, timeline and lists never describe different ranges.
 * Disabled until a venue or router is picked. */
export function useFlowSummary(scope: FlowScope, at: number) {
  return useQuery({
    queryKey: trafficFlowKeys.summary(scope, at),
    queryFn: () => trafficFlowService.summary(flowSummaryParams(scope, at)),
    enabled: !!(scope.locationId || scope.routerId),
    retry: 1,
  });
}

/** By country and network, for the same pinned range as the summary. Only
 * asked for once the summary says the range was measured (`enabled`). */
export function useFlowGeo(scope: FlowScope, at: number, enabled: boolean) {
  return useQuery({
    queryKey: trafficFlowKeys.geo(scope, at),
    queryFn: () => trafficFlowService.geo(flowGeoParams(scope, at)),
    enabled: enabled && !!(scope.locationId || scope.routerId),
    retry: 1,
  });
}
