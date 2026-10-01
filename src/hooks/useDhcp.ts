import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dhcpService } from "@/services/dhcp.service";
import type { CreateDhcpPoolPayload, DhcpPoolListQuery, UpdateDhcpPoolPayload } from "@/types/dhcp";

export const dhcpKeys = {
  list: (q: DhcpPoolListQuery) => ["dhcp", "list", q] as const,
};

export const useDhcpPools = (q: DhcpPoolListQuery, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: dhcpKeys.list(q),
    queryFn: () => dhcpService.list(q),
    enabled: options?.enabled,
  });

export function useCreateDhcpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDhcpPoolPayload) => dhcpService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp", "list"] }),
  });
}

export function usePushDhcpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => dhcpService.push(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp", "list"] }),
  });
}

export function useUpdateDhcpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDhcpPoolPayload }) =>
      dhcpService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp", "list"] }),
  });
}

export function useDeleteDhcpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => dhcpService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp", "list"] }),
  });
}

/** The router's DHCP leases, live -- for the firewall device picker. No
 * retry: a router that cannot be read is "unknown" to the picker at once,
 * not after three timeouts. */
export const useRouterDhcpLeases = (
  routerId: string,
  organizationId?: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: ["dhcp", "leases", routerId] as const,
    queryFn: () => dhcpService.listLeases(routerId, organizationId),
    enabled: !!routerId && (options?.enabled ?? true),
    retry: false,
    staleTime: 30_000,
  });

export function useKeepLeaseAddress(routerId: string, organizationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ macAddress, ipAddress }: { macAddress: string; ipAddress: string }) =>
      dhcpService.keepLeaseAddress(routerId, macAddress, ipAddress, organizationId),
    onSettled: () => qc.invalidateQueries({ queryKey: ["dhcp", "leases", routerId] }),
  });
}
