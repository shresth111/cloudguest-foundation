import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portForwardingService } from "@/services/port-forwarding.service";
import type {
  CreatePortForwardingPayload,
  PortForwardingListQuery,
  UpdatePortForwardingPayload,
} from "@/types/port-forwarding";

export const portForwardingKeys = {
  list: (q: PortForwardingListQuery) => ["port-forwarding", "list", q] as const,
  kpis: ["port-forwarding", "kpis"] as const,
};

export const usePortForwardingRules = (q: PortForwardingListQuery) =>
  useQuery({ queryKey: portForwardingKeys.list(q), queryFn: () => portForwardingService.list(q) });

export const usePortForwardingKpis = () =>
  useQuery({ queryKey: portForwardingKeys.kpis, queryFn: portForwardingService.getKpis });

export function useCreatePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePortForwardingPayload) => portForwardingService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
      qc.invalidateQueries({ queryKey: portForwardingKeys.kpis });
    },
  });
}

export function useUpdatePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePortForwardingPayload }) =>
      portForwardingService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
      qc.invalidateQueries({ queryKey: portForwardingKeys.kpis });
    },
  });
}

export function useDeletePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portForwardingService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
      qc.invalidateQueries({ queryKey: portForwardingKeys.kpis });
    },
  });
}
