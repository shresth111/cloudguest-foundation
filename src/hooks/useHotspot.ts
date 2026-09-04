import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hotspotService } from "@/services/hotspot.service";
import type {
  CreateHotspotProfilePayload,
  HotspotProfileListQuery,
  UpdateHotspotProfilePayload,
} from "@/types/hotspot";

export const hotspotKeys = {
  list: (q: HotspotProfileListQuery) => ["hotspot", "list", q] as const,
};

export const useHotspotProfiles = (q: HotspotProfileListQuery, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: hotspotKeys.list(q),
    queryFn: () => hotspotService.list(q),
    enabled: options?.enabled,
  });

export function useCreateHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateHotspotProfilePayload) => hotspotService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
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
    },
  });
}

export function useDeleteHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => hotspotService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
    },
  });
}
