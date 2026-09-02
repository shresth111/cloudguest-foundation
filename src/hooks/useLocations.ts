import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { locationService } from "@/services/location.service";
import type {
  CreateLocationPayload,
  LocationListQuery,
  LocationStatus,
  ProvisionLocationPayload,
  UpdateLocationPayload,
} from "@/types/location";

export const locationKeys = {
  all: ["locations"] as const,
  list: (q: LocationListQuery) => ["locations", "list", q] as const,
  allRows: ["locations", "all"] as const,
  detail: (id: string) => ["locations", "detail", id] as const,
};

/**
 * Location mutations have to clear two independent caches. `locationKeys.all`
 * covers the operator console's own lists, but the customer workspace reads
 * locations from a different tree entirely (`["workspace","customer",orgId]`
 * and `["workspace","locationResources",id]` -- see WorkspaceContext and
 * useWorkspace). Invalidating only the first is why a deleted location kept
 * showing in the workspace switcher, tree and grid until a full reload.
 */
function invalidateLocationCaches(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: locationKeys.all });
  qc.invalidateQueries({ queryKey: ["workspace"] });
}

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
    onSuccess: () => invalidateLocationCaches(qc),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
      organizationId,
    }: {
      id: string;
      patch: UpdateLocationPayload;
      organizationId?: string;
    }) => locationService.update(id, patch, organizationId),
    onSuccess: (_data, vars) => {
      invalidateLocationCaches(qc);
      qc.invalidateQueries({ queryKey: locationKeys.detail(vars.id) });
    },
  });
}

export function useUpdateLocationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: LocationStatus }) =>
      locationService.updateStatus(ids, status),
    onSuccess: () => invalidateLocationCaches(qc),
  });
}

export function useDeleteLocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => locationService.remove(ids),
    onSuccess: () => invalidateLocationCaches(qc),
  });
}

export function useProvisionLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProvisionLocationPayload) => locationService.provisionLocation(payload),
    onSuccess: () => {
      invalidateLocationCaches(qc);
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}
