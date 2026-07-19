import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { policyService } from "@/services/policy.service";
import type { Policy, PolicyScope } from "@/types/policy";

export const useP olicies = () => {};

const K = {
  list: (s?: PolicyScope) => ["policy", "list", s ?? "all"] as const,
  kpis: (s?: PolicyScope) => ["policy", "kpis", s ?? "all"] as const,
};

export const usePolicies = (scope?: PolicyScope) =>
  useQuery({ queryKey: K.list(scope), queryFn: () => policyService.list(scope) });

export const usePolicyKpis = (scope?: PolicyScope) =>
  useQuery({ queryKey: K.kpis(scope), queryFn: () => policyService.kpis(scope) });

export function useSavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Policy, "id" | "createdAt" | "updatedAt"> & { id?: string },
    ) => {
      if (payload.id) return policyService.update(payload.id, payload);
      const { id: _drop, ...rest } = payload;
      return policyService.create(rest);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy"] }),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policyService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy"] }),
  });
}
