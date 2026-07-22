import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routingPolicyService } from "@/services/routing-policy.service";
import type { SaveRoutingPolicyInput } from "@/types/routing-policy";

const K = {
  list: ["routing-policy", "list"] as const,
  kpis: ["routing-policy", "kpis"] as const,
};

export const useRoutingPolicies = () =>
  useQuery({ queryKey: K.list, queryFn: routingPolicyService.list });

export const useRoutingPolicyKpis = () =>
  useQuery({ queryKey: K.kpis, queryFn: routingPolicyService.kpis });

export function useSaveRoutingPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveRoutingPolicyInput) => routingPolicyService.save(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routing-policy"] }),
  });
}

export function useDeleteRoutingPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => routingPolicyService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routing-policy"] }),
  });
}
