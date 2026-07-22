import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nasService } from "@/services/nas.service";
import type { CreateNasPayload, UpdateNasPayload } from "@/types/nas";

export const nasKeys = {
  all: ["nas"] as const,
  byLocation: (locationId: string) => ["nas", "location", locationId] as const,
  detail: (nasId: string) => ["nas", "detail", nasId] as const,
  byRouter: (routerId: string) => ["nas", "router", routerId] as const,
};

export function useLocationNas(locationId: string) {
  return useQuery({
    queryKey: nasKeys.byLocation(locationId),
    queryFn: () => nasService.listByLocation(locationId),
    enabled: !!locationId,
  });
}

export function useAllNas() {
  return useQuery({
    queryKey: nasKeys.all,
    queryFn: () => nasService.listAll(),
  });
}

export function useNas(nasId: string) {
  return useQuery({
    queryKey: nasKeys.detail(nasId),
    queryFn: () => nasService.get(nasId),
    enabled: !!nasId,
  });
}

export function useNasByRouter(routerId: string) {
  return useQuery({
    queryKey: nasKeys.byRouter(routerId),
    queryFn: () => nasService.getByRouterId(routerId),
    enabled: !!routerId,
  });
}

export function useCreateNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, payload }: { locationId: string; payload: CreateNasPayload }) =>
      nasService.create(locationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

export function useUpdateNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nasId, payload }: { nasId: string; payload: UpdateNasPayload }) =>
      nasService.update(nasId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

export function useActivateNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nasId: string) => nasService.activate(nasId),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

export function useDisableNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nasId, reason }: { nasId: string; reason?: string }) =>
      nasService.disable(nasId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

export function useRegenerateNasSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nasId: string) => nasService.regenerateSecret(nasId),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

export function useDeleteNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nasId: string) => nasService.remove(nasId),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}
