import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestService } from "@/services/guest.service";
import { organizationService } from "@/services/organization.service";
import type { CreateGuestTeamPayload, GuestTeam } from "@/types/guest";

// This used to be a standalone service (guest-team.service.ts) duplicating
// guest.service.ts's already-real team CRUD against the same /guest-teams/*
// backend. Consolidated onto guest.service.ts -- this file now only adds
// the organizationName enrichment and member-count KPI aggregation the
// dedicated /guests/teams page needs, which guest.service.ts's own
// consumers (GuestTeamsPanel.tsx, embedded in guests.index.tsx) don't.

export interface EnrichedGuestTeam extends GuestTeam {
  organizationName: string;
}

async function fetchEnrichedTeams(): Promise<EnrichedGuestTeam[]> {
  const [teams, orgs] = await Promise.all([
    guestService.listTeams(),
    organizationService.list({ page: 1, pageSize: 100 }),
  ]);
  const nameById = new Map(orgs.rows.map((o) => [o.id, o.name]));
  return teams.map((t) => ({ ...t, organizationName: nameById.get(t.organizationId) ?? "—" }));
}

export const guestTeamKeys = {
  list: ["guest-teams", "list"] as const,
  kpis: ["guest-teams", "kpis"] as const,
  organizations: ["guest-teams", "organizations"] as const,
};

export const useGuestTeams = () =>
  useQuery({ queryKey: guestTeamKeys.list, queryFn: fetchEnrichedTeams });

export const useGuestTeamKpis = () =>
  useQuery({
    queryKey: guestTeamKeys.kpis,
    queryFn: async () => {
      const teams = await fetchEnrichedTeams();
      // No bulk member-count endpoint -- guest.service.ts's getTeam() detail
      // call is the only source (summary.member_count), so KPIs fan out one
      // detail fetch per team, same convention used elsewhere in this
      // codebase for list-derived aggregates (see vlan.service.ts's
      // getKpis).
      const summaries = await Promise.all(
        teams.map((t) => guestService.getTeam(t.id).catch(() => null)),
      );
      const totalMembers = summaries.reduce((sum, s) => sum + (s?.summary.memberCount ?? 0), 0);
      return {
        total: teams.length,
        active: teams.filter((t) => t.status === "active").length,
        revoked: teams.filter((t) => t.status === "revoked").length,
        totalMembers,
      };
    },
  });

export const useGuestTeamOrganizations = () =>
  useQuery({
    queryKey: guestTeamKeys.organizations,
    queryFn: async () => {
      const { rows } = await organizationService.list({ page: 1, pageSize: 100 });
      return rows.map((o) => ({ id: o.id, name: o.name }));
    },
  });

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: guestTeamKeys.list });
  qc.invalidateQueries({ queryKey: guestTeamKeys.kpis });
}

export function useCreateGuestTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGuestTeamPayload) => guestService.createTeam(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRevokeGuestTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; organizationId: string; reason?: string }) =>
      guestService.revokeTeam(id, reason),
    onSuccess: () => invalidateAll(qc),
  });
}
