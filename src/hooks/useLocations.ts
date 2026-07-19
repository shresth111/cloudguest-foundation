import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { locationService } from "@/services/location.service";
import type { CreateLocationPayload, LocationListQuery, LocationStatus } from "@/types/location";

export const locationKeys = {
  all: ["locations"] as const,
  list: (q: LocationListQuery) => ["locations", "list", q] as const,
  allRows: ["locations", "all"] as const,
  detail: (id: string) => ["locations", "detail", id] as const,
};

export function useLocations(query: LocationListQuery) {
  return useQuery({
    queryKey: locationKeys.list(query),
    queryFn: () => locationService.list(query),
  });
}

export function useAllLocations() {
  return useQuery({
    queryKey: locationKeys.allRows,
    queryFn: () => locationService.listAll(),
  });
}

export function useLocation(id: string) {
  return useQuery({
    queryKey: locationKeys.detail(id),
    queryFn: () => locationService.get(id),
    enabled: !!id,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLocationPayload) => locationService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}

export function useUpdateLocationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: LocationStatus }) =>
      locationService.updateStatus(ids, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}

export function useDeleteLocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => locationService.remove(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}

export function useCloneLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => locationService.clone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.all }),
  });
}
