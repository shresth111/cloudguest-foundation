import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bandwidthPolicyService } from "@/services/bandwidth-policy.service";
import type { SaveBandwidthPolicyInput } from "@/types/bandwidth-policy";

const K = {
  list: ["bandwidth-policy", "list"] as const,
  kpis: ["bandwidth-policy", "kpis"] as const,
};

export const useBandwidthPolicies = () =>
  useQuery({ queryKey: K.list, queryFn: bandwidthPolicyService.list });

export const useBandwidthPolicyKpis = () =>
  useQuery({ queryKey: K.kpis, queryFn: bandwidthPolicyService.kpis });

export function useSaveBandwidthPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveBandwidthPolicyInput) => bandwidthPolicyService.save(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bandwidth-policy"] }),
  });
}

export function useDeleteBandwidthPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bandwidthPolicyService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bandwidth-policy"] }),
  });
}
