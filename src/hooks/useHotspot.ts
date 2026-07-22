import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hotspotService } from "@/services/hotspot.service";
import type {
  CreateHotspotProfilePayload,
  HotspotProfileListQuery,
  UpdateHotspotProfilePayload,
} from "@/types/hotspot";

export const hotspotKeys = {
  list: (q: HotspotProfileListQuery) => ["hotspot", "list", q] as const,
  kpis: ["hotspot", "kpis"] as const,
};

export const useHotspotProfiles = (q: HotspotProfileListQuery) =>
  useQuery({ queryKey: hotspotKeys.list(q), queryFn: () => hotspotService.list(q) });

export const useHotspotKpis = () =>
  useQuery({ queryKey: hotspotKeys.kpis, queryFn: hotspotService.getKpis });

export function useCreateHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateHotspotProfilePayload) => hotspotService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
      qc.invalidateQueries({ queryKey: hotspotKeys.kpis });
    },
  });
}

export function useUpdateHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateHotspotProfilePayload }) =>
      hotspotService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
      qc.invalidateQueries({ queryKey: hotspotKeys.kpis });
    },
  });
}

export function useDeleteHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hotspotService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
      qc.invalidateQueries({ queryKey: hotspotKeys.kpis });
    },
  });
}
