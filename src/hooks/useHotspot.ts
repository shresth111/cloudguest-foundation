import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hotspotService } from "@/services/hotspot.service";
import type {
  CreateHotspotProfilePayload,
  HotspotProfileListQuery,
  UpdateHotspotProfilePayload,
} from "@/types/hotspot";

export const hotspotKeys = {
  list: (q: HotspotProfileListQuery) => ["hotspot", "list", q] as const,
  kpis: (organizationId?: string) => ["hotspot", "kpis", organizationId] as const,
};

export const useHotspotProfiles = (q: HotspotProfileListQuery, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: hotspotKeys.list(q),
    queryFn: () => hotspotService.list(q),
    enabled: options?.enabled,
  });

export const useHotspotKpis = (organizationId?: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: hotspotKeys.kpis(organizationId),
    queryFn: () => hotspotService.getKpis(organizationId),
    enabled: options?.enabled,
  });

export function useCreateHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateHotspotProfilePayload) => hotspotService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
      qc.invalidateQueries({ queryKey: ["hotspot", "kpis"] });
    },
  });
}

export function useUpdateHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      organizationId,
    }: {
      id: string;
      payload: UpdateHotspotProfilePayload;
      organizationId?: string;
    }) => hotspotService.update(id, payload, organizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
      qc.invalidateQueries({ queryKey: ["hotspot", "kpis"] });
    },
  });
}

export function useDeleteHotspotProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      hotspotService.remove(id, organizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotspot", "list"] });
      qc.invalidateQueries({ queryKey: ["hotspot", "kpis"] });
    },
  });
}
