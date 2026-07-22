import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authnPolicyService } from "@/services/authn-policy.service";
import type { SaveAuthnPolicyInput } from "@/types/authn-policy";

const K = {
  list: ["authn-policy", "list"] as const,
  kpis: ["authn-policy", "kpis"] as const,
};

export const useAuthnPolicies = () =>
  useQuery({ queryKey: K.list, queryFn: authnPolicyService.list });

export const useAuthnPolicyKpis = () =>
  useQuery({ queryKey: K.kpis, queryFn: authnPolicyService.kpis });

export function useSaveAuthnPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveAuthnPolicyInput) => authnPolicyService.save(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authn-policy"] }),
  });
}

export function useDeleteAuthnPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authnPolicyService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authn-policy"] }),
  });
}
