import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nasService } from "@/services/nas.service";

export const nasKeys = {
  byLocation: (locationId: string) => ["nas", "location", locationId] as const,
  detail: (locationId: string, nasId: string) => ["nas", "location", locationId, nasId] as const,
};

export function useLocationNas(locationId: string) {
  return useQuery({
    queryKey: nasKeys.byLocation(locationId),
    queryFn: () => nasService.listByLocation(locationId),
    enabled: !!locationId,
  });
}

export function useNas(locationId: string, nasId: string) {
  return useQuery({
    queryKey: nasKeys.detail(locationId, nasId),
    queryFn: () => nasService.get(locationId, nasId),
    enabled: !!locationId && !!nasId,
  });
}

export function useRunNasOperation(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nasId, op }: { nasId: string; op: string }) =>
      nasService.runOperation(locationId, nasId, op),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.byLocation(locationId) }),
  });
}
