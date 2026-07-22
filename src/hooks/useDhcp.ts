import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dhcpService } from "@/services/dhcp.service";
import type { CreateDhcpPoolPayload, DhcpPoolListQuery, UpdateDhcpPoolPayload } from "@/types/dhcp";

export const dhcpKeys = {
  list: (q: DhcpPoolListQuery) => ["dhcp", "list", q] as const,
};

export const useDhcpPools = (q: DhcpPoolListQuery) =>
  useQuery({ queryKey: dhcpKeys.list(q), queryFn: () => dhcpService.list(q) });

export function useCreateDhcpPool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDhcpPoolPayload) => dhcpService.create(payload),
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
    mutationFn: (id: string) => dhcpService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dhcp", "list"] }),
  });
}
