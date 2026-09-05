import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { networkDiagnosticsService } from "@/services/network-diagnostics.service";

const K = {
  /** Prefixed by router so an invalidate below hits every page size. */
  runs: (routerId: string, pageSize?: number) =>
    ["network-diagnostics", "runs", routerId, pageSize ?? "default"] as const,
};

export const DIAGNOSTIC_RUNS_QUERY_PREFIX = ["network-diagnostics", "runs"] as const;

interface DiagnosticRunsOptions {
  /** Additional gate on top of "we have a router id" -- the customer page
   * uses it to skip the fetch entirely in demo mode, where there is no
   * real router and the request would 401. */
  enabled?: boolean;
  pageSize?: number;
}

/**
 * A router's recorded diagnostic runs.
 *
 * The customer dashboard's Connection Tools page used to hold this in a
 * bare `useState` with a `catch { setRuns([]) }` -- so a 403 or a dropped
 * connection was indistinguishable from "this router has never been
 * checked", and the list never refetched because its effect depended on
 * `[selectedRouterId]` alone with exhaustive-deps disabled. Both screens
 * now share this query, so a run made anywhere invalidates both.
 */
export const useDiagnosticRuns = (
  routerId: string,
  organizationId?: string,
  options?: DiagnosticRunsOptions,
) =>
  useQuery({
    queryKey: K.runs(routerId, options?.pageSize),
    queryFn: () =>
      networkDiagnosticsService.listRuns(routerId, organizationId, 1, options?.pageSize),
    enabled: !!routerId && (options?.enabled ?? true),
  });

/** Invalidate every cached page size for this router. */
const invalidateRuns = (qc: ReturnType<typeof useQueryClient>, routerId: string) =>
  qc.invalidateQueries({ queryKey: [...DIAGNOSTIC_RUNS_QUERY_PREFIX, routerId] });

export const usePingRouter = (routerId: string, organizationId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: string) =>
      networkDiagnosticsService.ping(routerId, target, organizationId),
    onSuccess: () => invalidateRuns(qc, routerId),
  });
};

export const useTracerouteRouter = (routerId: string, organizationId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: string) =>
      networkDiagnosticsService.traceroute(routerId, target, organizationId),
    onSuccess: () => invalidateRuns(qc, routerId),
  });
};
