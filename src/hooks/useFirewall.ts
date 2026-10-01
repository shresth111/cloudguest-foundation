import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { firewallService } from "@/services/firewall.service";
import type {
  CreateFirewallRulePayload,
  FloodLimitPreset,
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

/** GET /firewall-rules/routers/{id}/band -- `null` is "status unknown" (the
 * endpoint is absent or unreadable), which the screens render as nothing. */
export const firewallBandKey = (routerId: string) => ["firewall", "band", routerId] as const;

export function useFirewallBand(routerId: string | undefined, organizationId?: string) {
  return useQuery({
    queryKey: firewallBandKey(routerId ?? ""),
    queryFn: () => firewallService.getBand(routerId as string, organizationId),
    enabled: !!routerId,
    staleTime: 60_000,
    retry: false,
  });
}

/** Apply one router's rules to the device. On success the returned rules
 * carry their new push status; the list is refetched either way, because a
 * FAILED push also writes status onto the rows (#304 commits the failure
 * record before it re-raises). */
export function usePushFirewallRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routerId: string) => firewallService.push(routerId),
    onSettled: (_data, _err, routerId) => {
      void qc.invalidateQueries({ queryKey: ["firewall", "list"] });
      void qc.invalidateQueries({ queryKey: firewallBandKey(routerId) });
    },
  });
}

/** Master console: prepare a router for firewall rules. */
export function useInstallFirewallBand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routerId: string) => firewallService.installBand(routerId),
    onSettled: (_data, _err, routerId) =>
      qc.invalidateQueries({ queryKey: firewallBandKey(routerId) }),
  });
}

/** GET .../flood-limit -- `null` is "unknown" (older backend, or not
 * readable), which the Firewall screen renders as no card at all. */
export const floodLimitKey = (routerId: string) => ["firewall", "flood-limit", routerId] as const;

export function useFloodLimit(routerId: string | undefined, organizationId?: string) {
  return useQuery({
    queryKey: floodLimitKey(routerId ?? ""),
    queryFn: () => firewallService.getFloodLimit(routerId as string, organizationId),
    enabled: !!routerId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useSetFloodLimit(routerId: string, organizationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preset: FloodLimitPreset) =>
      firewallService.setFloodLimit(routerId, preset, organizationId),
    onSuccess: (state) => qc.setQueryData(floodLimitKey(routerId), state),
    onSettled: () => qc.invalidateQueries({ queryKey: floodLimitKey(routerId) }),
  });
}
