import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestTeamService } from "@/services/guest-team.service";
import type { CreateGuestTeamPayload } from "@/types/guest-team";

export const guestTeamKeys = {
  list: ["guest-teams", "list"] as const,
  detail: (id: string) => ["guest-teams", "detail", id] as const,
  kpis: ["guest-teams", "kpis"] as const,
  organizations: ["guest-teams", "organizations"] as const,
};

export const useGuestTeams = () =>
  useQuery({ queryKey: guestTeamKeys.list, queryFn: guestTeamService.list });

export const useGuestTeamDetail = (id: string, organizationId: string) =>
  useQuery({
    queryKey: guestTeamKeys.detail(id),
    queryFn: () => guestTeamService.get(id, organizationId),
    enabled: !!id && !!organizationId,
  });

export const useGuestTeamKpis = () =>
  useQuery({ queryKey: guestTeamKeys.kpis, queryFn: guestTeamService.kpis });

export const useGuestTeamOrganizations = () =>
  useQuery({ queryKey: guestTeamKeys.organizations, queryFn: guestTeamService.organizations });

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: guestTeamKeys.list });
  qc.invalidateQueries({ queryKey: guestTeamKeys.kpis });
}

export function useCreateGuestTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGuestTeamPayload) => guestTeamService.create(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRevokeGuestTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId, reason }: { id: string; organizationId: string; reason?: string }) =>
      guestTeamService.revoke(id, organizationId, reason),
    onSuccess: () => invalidateAll(qc),
  });
}
