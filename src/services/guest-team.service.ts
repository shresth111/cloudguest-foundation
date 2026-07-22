import { api } from "@/services/api";
import type {
  CreateGuestTeamPayload,
  GuestTeam,
  GuestTeamDetail,
  GuestTeamKpis,
  GuestTeamStatus,
  GuestTeamSummary,
} from "@/types/guest-team";

interface BackendOrgListItem {
  id: string;
  name: string;
}

interface BackendListResponse<T> {
  items: T[];
  total_items: number;
}

interface BackendGuestTeam {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  team_code: string;
  status: GuestTeamStatus;
  max_members: number | null;
  shared_data_limit_mb: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendGuestTeamSummary {
  member_count: number;
  active_session_count: number;
  total_bandwidth_bytes: number;
  shared_data_limit_mb: number | null;
  remaining_shared_quota_mb: number | null;
  quota_exceeded: boolean;
}

interface BackendGuestTeamDetail extends BackendGuestTeam {
  summary: BackendGuestTeamSummary;
}

async function fetchAllOrganizations(): Promise<BackendOrgListItem[]> {
  const { data } = await api.get<BackendListResponse<BackendOrgListItem>>("/organizations", {
    params: { page_size: 100 },
  });
  return data.items;
}

/**
 * No bulk cross-org listing endpoint exists for /guest-teams -- fans out
 * one call per organization and concatenates client-side, the same
 * pattern guest.service.ts already uses for the sibling guest domain.
 */
async function fanOutPerOrg<T>(
  toRow: (raw: BackendGuestTeam, org: BackendOrgListItem) => T,
): Promise<T[]> {
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<BackendGuestTeam>>("/guest-teams", {
        params: { page_size: 100 },
        headers: { "X-Organization-Id": org.id },
      });
      return data.items.map((raw) => toRow(raw, org));
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<T[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

function toTeam(t: BackendGuestTeam, org: BackendOrgListItem): GuestTeam {
  return {
    id: t.id,
    organizationId: t.organization_id,
    organizationName: org.name,
    locationId: t.location_id,
    name: t.name,
    teamCode: t.team_code,
    status: t.status,
    maxMembers: t.max_members,
    sharedDataLimitMb: t.shared_data_limit_mb,
    expiresAt: t.expires_at,
    revokedAt: t.revoked_at,
    revokedReason: t.revoked_reason,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function toSummary(s: BackendGuestTeamSummary): GuestTeamSummary {
  return {
    memberCount: s.member_count,
    activeSessionCount: s.active_session_count,
    totalBandwidthBytes: s.total_bandwidth_bytes,
    sharedDataLimitMb: s.shared_data_limit_mb,
    remainingSharedQuotaMb: s.remaining_shared_quota_mb,
    quotaExceeded: s.quota_exceeded,
  };
}

export const guestTeamService = {
  organizations: fetchAllOrganizations,

  async list(): Promise<GuestTeam[]> {
    return fanOutPerOrg<GuestTeam>(toTeam);
  },

  async get(id: string, organizationId: string): Promise<GuestTeamDetail> {
    const { data } = await api.get<BackendGuestTeamDetail>(`/guest-teams/${id}`, {
      headers: { "X-Organization-Id": organizationId },
    });
    const orgs = await fetchAllOrganizations();
    const org = orgs.find((o) => o.id === organizationId);
    return {
      ...toTeam(data, org ?? { id: organizationId, name: "" }),
      summary: toSummary(data.summary),
    };
  },

  async kpis(): Promise<GuestTeamKpis> {
    const teams = await guestTeamService.list();
    const details = await Promise.allSettled(
      teams.map((t) => guestTeamService.get(t.id, t.organizationId)),
    );
    const totalMembers = details
      .filter((r): r is PromiseFulfilledResult<GuestTeamDetail> => r.status === "fulfilled")
      .reduce((sum, r) => sum + r.value.summary.memberCount, 0);
    return {
      total: teams.length,
      active: teams.filter((t) => t.status === "active").length,
      revoked: teams.filter((t) => t.status === "revoked").length,
      totalMembers,
    };
  },

  async create(payload: CreateGuestTeamPayload): Promise<GuestTeam> {
    const { data } = await api.post<BackendGuestTeam>(
      "/guest-teams",
      {
        organization_id: payload.organizationId,
        location_id: payload.locationId ?? null,
        name: payload.name,
        max_members: payload.maxMembers ?? null,
        shared_data_limit_mb: payload.sharedDataLimitMb ?? null,
        expires_at: payload.expiresAt ?? null,
      },
      { headers: { "X-Organization-Id": payload.organizationId } },
    );
    const orgs = await fetchAllOrganizations();
    const org = orgs.find((o) => o.id === payload.organizationId);
    return toTeam(data, org ?? { id: payload.organizationId, name: "" });
  },

  async revoke(id: string, organizationId: string, reason?: string): Promise<void> {
    await api.post(
      `/guest-teams/${id}/revoke`,
      { reason: reason ?? null },
      { headers: { "X-Organization-Id": organizationId } },
    );
  },

  async removeMember(
    teamId: string,
    guestId: string,
    organizationId: string,
    reason?: string,
  ): Promise<void> {
    await api.delete(`/guest-teams/${teamId}/members/${guestId}`, {
      data: { reason: reason ?? null },
      headers: { "X-Organization-Id": organizationId },
    });
  },
};
