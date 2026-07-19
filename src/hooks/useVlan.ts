import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vlanService } from "@/services/vlan.service";
import type { Vlan } from "@/types/vlan";

const K = {
  list: ["vlan", "list"] as const,
  kpis: ["vlan", "kpis"] as const,
};

export const useVlans = () => useQuery({ queryKey: K.list, queryFn: vlanService.list });
export const useVlanKpis = () => useQuery({ queryKey: K.kpis, queryFn: vlanService.kpis });

export function useSaveVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: (Partial<Vlan> & { id?: string }) &
        Omit<Vlan, "id" | "createdAt" | "updatedAt" | "clients" | "throughputMbps">,
    ) => {
      if (payload.id) return vlanService.update(payload.id, payload);
      return vlanService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.list });
      qc.invalidateQueries({ queryKey: K.kpis });
    },
  });
}

export function useDeleteVlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vlanService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: K.list });
      qc.invalidateQueries({ queryKey: K.kpis });
    },
  });
}
