import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { firewallService } from "@/services/firewall.service";
import type {
  CreateFirewallRulePayload,
  FirewallRuleListQuery,
  UpdateFirewallRulePayload,
} from "@/types/firewall";

export const firewallKeys = {
  list: (q: FirewallRuleListQuery) => ["firewall", "list", q] as const,
};

export const useFirewallRules = (q: FirewallRuleListQuery) =>
  useQuery({ queryKey: firewallKeys.list(q), queryFn: () => firewallService.list(q) });

export function useCreateFirewallRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFirewallRulePayload) => firewallService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firewall", "list"] }),
  });
}

export function useUpdateFirewallRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFirewallRulePayload }) =>
      firewallService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firewall", "list"] }),
  });
}

export function useDeleteFirewallRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => firewallService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["firewall", "list"] }),
  });
}
