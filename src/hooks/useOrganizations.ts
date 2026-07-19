import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationService } from "@/services/organization.service";
import type { CreateOrgPayload, OrgListQuery, OrgStatus } from "@/types/organization";

export const orgKeys = {
  all: ["organizations"] as const,
  list: (q: OrgListQuery) => ["organizations", "list", q] as const,
  detail: (id: string) => ["organizations", "detail", id] as const,
};

export function useOrganizations(query: OrgListQuery) {
  return useQuery({
    queryKey: orgKeys.list(query),
    queryFn: () => organizationService.list(query),
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: orgKeys.detail(id),
    queryFn: () => organizationService.get(id),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrgPayload) => organizationService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useUpdateOrgStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: OrgStatus }) =>
      organizationService.updateStatus(ids, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}

export function useDeleteOrganizations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => organizationService.remove(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  });
}
