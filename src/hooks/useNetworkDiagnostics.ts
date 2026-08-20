import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { networkDiagnosticsService } from "@/services/network-diagnostics.service";

const K = {
  runs: (routerId: string) => ["network-diagnostics", "runs", routerId] as const,
};

export const useDiagnosticRuns = (routerId: string, organizationId?: string) =>
  useQuery({
    queryKey: K.runs(routerId),
    queryFn: () => networkDiagnosticsService.listRuns(routerId, organizationId),
    enabled: !!routerId,
  });

export const usePingRouter = (routerId: string, organizationId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: string) =>
      networkDiagnosticsService.ping(routerId, target, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.runs(routerId) }),
  });
};

export const useTracerouteRouter = (routerId: string, organizationId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: string) =>
      networkDiagnosticsService.traceroute(routerId, target, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.runs(routerId) }),
  });
};
