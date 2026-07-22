import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vlanService } from "@/services/vlan.service";
import type { CreateVlanPayload, UpdateVlanPayload, VlanListQuery } from "@/types/vlan";

export const vlanKeys = {
  list: (q: VlanListQuery) => ["vlan", "list", q] as const,
  kpis: ["vlan", "kpis"] as const,
};

export const useVlans = (q: VlanListQuery) =>
  useQuery({ queryKey: vlanKeys.list(q), queryFn: () => vlanService.list(q) });

export const useVlanKpis = () =>
  useQuery({ queryKey: vlanKeys.kpis, queryFn: vlanService.getKpis });

export function useCreateVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVlanPayload) => vlanService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vlan", "list"] });
      qc.invalidateQueries({ queryKey: vlanKeys.kpis });
    },
  });
}

export function useUpdateVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVlanPayload }) =>
      vlanService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vlan", "list"] });
      qc.invalidateQueries({ queryKey: vlanKeys.kpis });
    },
  });
}

export function useDeleteVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vlanService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vlan", "list"] });
      qc.invalidateQueries({ queryKey: vlanKeys.kpis });
    },
  });
}
