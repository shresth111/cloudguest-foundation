import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { locationService } from "@/services/location.service";
import type {
  CreateLocationPayload,
  LocationListQuery,
  LocationStatus,
  ProvisionLocationPayload,
} from "@/types/location";

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
    // `knownOrgName`, when passed, skips locationService.create()'s trailing
    // fetchAllOrganizations() lookup -- required for callers running as an
    // ordinary customer/org-owner session, where that platform-wide
    // GET /organizations 403s (see location.service.ts's create() docstring)
    // and would otherwise surface as a false "failed to create" error even
    // though the location was created successfully.
    mutationFn: ({
      payload,
      knownOrgName,
    }: {
      payload: CreateLocationPayload;
      knownOrgName?: string;
    }) => locationService.create(payload, knownOrgName),
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

export function useProvisionLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProvisionLocationPayload) => locationService.provisionLocation(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}
