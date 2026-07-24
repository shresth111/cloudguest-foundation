import { api } from "@/services/api";
import type {
  AccessCheckQuery,
  AccessCheckResult,
  AccessRuleType,
  AnyAccessRule,
  CreateAccessRulePayload,
  CreateGuestTeamPayload,
  DeviceAccessRule,
  Guest,
  GuestAccessRule,
  GuestAnalyticsSummary,
  GuestListQuery,
  GuestListResult,
  GuestSession,
  GuestTeam,
  GuestTeamMember,
  GuestTeamRevokeResult,
  GuestTeamSummary,
  OtpSuccessRate,
  ReconnectPayload,
  SessionListQuery,
  SessionListResult,
  TopDeviceItem,
  TopLocationItem,
} from "@/types/guest";

interface BackendOrgListItem {
  id: string;
  name: string;
}

interface BackendListResponse<T> {
  items: T[];
  total_items: number;
}

interface BackendLocation {
  id: string;
  name: string;
}

interface BackendGuest {
  id: string;
  organization_id: string;
  location_id: string | null;
  identifier: string;
  display_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  total_visit_count: number;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendGuestSession {
  id: string;
  guest_id: string;
  device_id: string | null;
  router_id: string;
  location_id: string;
  organization_id: string;
  auth_method: GuestSession["authMethod"];
  voucher_id: string | null;
  status: GuestSession["status"];
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  ip_address: string | null;
  bytes_uploaded: number;
  bytes_downloaded: number;
  data_limit_mb: number | null;
  session_timeout_minutes: number | null;
  disconnect_reason: string | null;
  user_agent: string | null;
  created_at: string;
}

interface BackendAccessRule {
  id: string;
  organization_id: string;
  location_id: string | null;
  identifier: string;
  rule_type: AccessRuleType;
  reason: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendDeviceAccessRule {
  id: string;
  organization_id: string;
  location_id: string | null;
  mac_address: string;
  rule_type: AccessRuleType;
  reason: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendAccessCheckResponse {
  allowed: boolean;
  rule_type: AccessRuleType | null;
  matched_rule_id: string | null;
  reason: string | null;
}

interface BackendGuestTeam {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  team_code: string;
  status: GuestTeam["status"];
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

interface BackendGuestTeamRevokeResponse {
  team: BackendGuestTeam;
  member_count: number;
  terminated_session_ids: string[];
  failed_member_ids: string[];
}

function toGuest(g: BackendGuest, locationName: string | null, organizationName: string): Guest {
  return {
    id: g.id,
    organizationId: g.organization_id,
    organizationName,
    locationId: g.location_id,
    locationName,
    identifier: g.identifier,
    displayName: g.display_name,
    firstSeenAt: g.first_seen_at,
    lastSeenAt: g.last_seen_at,
    totalVisitCount: g.total_visit_count,
    isBlocked: g.is_blocked,
    blockedReason: g.blocked_reason,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  };
}

function toGuestSession(
  s: BackendGuestSession,
  locationName: string,
  organizationName: string,
  routerName: string,
): GuestSession {
  return {
    id: s.id,
    guestId: s.guest_id,
    guestIdentifier: "",
    deviceId: s.device_id,
    userAgent: s.user_agent,
    routerId: s.router_id,
    routerName,
    locationId: s.location_id,
    locationName,
    organizationId: s.organization_id,
    organizationName,
    authMethod: s.auth_method,
    voucherId: s.voucher_id,
    status: s.status,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    lastActivityAt: s.last_activity_at,
    ipAddress: s.ip_address,
    bytesUploaded: s.bytes_uploaded,
    bytesDownloaded: s.bytes_downloaded,
    dataLimitMb: s.data_limit_mb,
    sessionTimeoutMinutes: s.session_timeout_minutes,
    disconnectReason: s.disconnect_reason,
    createdAt: s.created_at,
  };
}

function toAccessRule(r: BackendAccessRule): GuestAccessRule {
  return {
    kind: "identifier",
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    identifier: r.identifier,
    ruleType: r.rule_type,
    reason: r.reason,
    expiresAt: r.expires_at,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toDeviceAccessRule(r: BackendDeviceAccessRule): DeviceAccessRule {
  return {
    kind: "device",
    id: r.id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    macAddress: r.mac_address,
    ruleType: r.rule_type,
    reason: r.reason,
    expiresAt: r.expires_at,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toGuestTeam(t: BackendGuestTeam): GuestTeam {
  return {
    id: t.id,
    organizationId: t.organization_id,
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

function toGuestTeamSummary(s: BackendGuestTeamSummary): GuestTeamSummary {
  return {
    memberCount: s.member_count,
    activeSessionCount: s.active_session_count,
    totalBandwidthBytes: s.total_bandwidth_bytes,
    sharedDataLimitMb: s.shared_data_limit_mb,
    remainingSharedQuotaMb: s.remaining_shared_quota_mb,
    quotaExceeded: s.quota_exceeded,
  };
}

async function fetchAllOrganizations(): Promise<BackendOrgListItem[]> {
  const { data } = await api.get<BackendListResponse<BackendOrgListItem>>("/organizations", {
    params: { page_size: 100 },
  });
  return data.items;
}

async function fetchAllLocations(): Promise<
  Array<{ id: string; name: string; organizationId: string; organizationName: string }>
> {
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<BackendLocation>>(
        `/organizations/${org.id}/locations`,
        { params: { page_size: 100 }, headers: { "X-Organization-Id": org.id } },
      );
      return data.items.map((l) => ({
        id: l.id,
        name: l.name,
        organizationId: org.id,
        organizationName: org.name,
      }));
    }),
  );
  return settled
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Array<{ id: string; name: string; organizationId: string; organizationName: string }>
      > => r.status === "fulfilled",
    )
    .flatMap((r) => r.value);
}

interface BackendAnalyticsSummary {
  visitors: number;
  unique_guests: number;
  returning_guests: number;
  average_session_duration_seconds: number | null;
  total_bandwidth_bytes: number;
}

interface BackendTopLocationItem {
  location_id: string;
  location_name: string;
  session_count: number;
}

interface BackendTopDeviceItem {
  device_id: string;
  mac_address: string;
  session_count: number;
  unique_guest_count: number;
}

interface BackendOtpSuccessRate {
  total_attempts: number;
  successful_attempts: number;
  success_rate: number;
}

/** The guest-analytics endpoints require a mandatory start/end window -- default to a rolling 30 days. */
function analyticsWindow(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

async function settledData<T>(requests: Array<Promise<{ data: T }>>): Promise<T[]> {
  const settled = await Promise.allSettled(requests);
  return settled
    .filter((r): r is PromiseFulfilledResult<{ data: T }> => r.status === "fulfilled")
    .map((r) => r.value.data);
}

/**
 * Guests/sessions/access-rules/teams are all organization-scoped (no
 * bulk cross-org listing endpoint) -- fans out one call per organization
 * and concatenates client-side, same `allSettled` graceful-degradation
 * pattern as `router.service.ts`/`nas.service.ts`.
 */
async function fanOutPerOrg<T>(
  path: string,
  toRow: (raw: unknown, org: BackendOrgListItem) => T,
): Promise<T[]> {
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<unknown>>(path, {
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

export const guestService = {
  async list(query: GuestListQuery): Promise<GuestListResult> {
    const locations = await fetchAllLocations();
    let rows = await fanOutPerOrg<Guest>("/guests", (raw, org) => {
      const g = raw as BackendGuest;
      const loc = locations.find((l) => l.id === g.location_id);
      return toGuest(g, loc?.name ?? null, org.name);
    });
    if (query.search) {
      const s = query.search.toLowerCase();
      rows = rows.filter(
        (g) =>
          g.identifier.toLowerCase().includes(s) || (g.displayName ?? "").toLowerCase().includes(s),
      );
    }
    if (query.isBlocked && query.isBlocked !== "all") {
      rows = rows.filter((g) => g.isBlocked === query.isBlocked);
    }
    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    rows = rows.slice(start, start + query.pageSize);
    return { rows, total };
  },

  async get(guestId: string): Promise<Guest | null> {
    const { data } = await api.get<BackendGuest>(`/guests/${guestId}`);
    const locations = await fetchAllLocations();
    const orgs = await fetchAllOrganizations();
    const loc = locations.find((l) => l.id === data.location_id);
    const org = orgs.find((o) => o.id === data.organization_id);
    return toGuest(data, loc?.name ?? null, org?.name ?? "");
  },

  async block(guestId: string, reason: string): Promise<void> {
    await api.post(`/guests/${guestId}/block`, { reason });
  },

  async unblock(guestId: string): Promise<void> {
    await api.post(`/guests/${guestId}/unblock`);
  },

  async reconnect(guestId: string, payload: ReconnectPayload): Promise<void> {
    await api.post(`/guests/${guestId}/reconnect`, {
      router_id: payload.routerId,
      location_id: payload.locationId,
      device_mac: payload.deviceMac,
      ip_address: payload.ipAddress,
    });
  },

  async listSessions(query: SessionListQuery): Promise<SessionListResult> {
    const locations = await fetchAllLocations();
    let rows = await fanOutPerOrg<GuestSession>("/guest-sessions", (raw, org) => {
      const s = raw as BackendGuestSession;
      const loc = locations.find((l) => l.id === s.location_id);
      return toGuestSession(s, loc?.name ?? "", org.name, s.router_id);
    });
    if (query.status && query.status !== "all")
      rows = rows.filter((s) => s.status === query.status);
    if (query.locationId && query.locationId !== "all")
      rows = rows.filter((s) => s.locationId === query.locationId);
    if (query.search) {
      const s = query.search.toLowerCase();
      rows = rows.filter(
        (r) => (r.ipAddress ?? "").includes(s) || r.locationName.toLowerCase().includes(s),
      );
    }
    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    rows = rows.slice(start, start + query.pageSize);
    return { rows, total };
  },

  async sessionsForGuest(guestId: string): Promise<GuestSession[]> {
    const rows = await fanOutPerOrg<GuestSession>("/guest-sessions", (raw, org) => {
      const s = raw as BackendGuestSession;
      return toGuestSession(s, "", org.name, s.router_id);
    });
    return rows.filter((s) => s.guestId === guestId);
  },

  async disconnectSession(sessionId: string, reason?: string): Promise<void> {
    await api.post(`/guest-sessions/${sessionId}/disconnect`, { reason });
  },

  async terminateSession(sessionId: string, reason?: string): Promise<void> {
    await api.post(`/guest-sessions/${sessionId}/terminate`, { reason });
  },

  async pauseSession(sessionId: string, reason?: string): Promise<void> {
    await api.post(`/guest-sessions/${sessionId}/pause`, { reason });
  },

  async resumeSession(sessionId: string): Promise<void> {
    await api.post(`/guest-sessions/${sessionId}/resume`);
  },

  async extendSession(sessionId: string, additionalMinutes: number): Promise<void> {
    await api.post(`/guest-sessions/${sessionId}/extend`, {
      additional_minutes: additionalMinutes,
    });
  },

  async listAccessRules(): Promise<AnyAccessRule[]> {
    const [identifierRules, deviceRules] = await Promise.all([
      fanOutPerOrg<GuestAccessRule>("/guest-access/rules", (raw) =>
        toAccessRule(raw as BackendAccessRule),
      ),
      fanOutPerOrg<DeviceAccessRule>("/guest-access/device-rules", (raw) =>
        toDeviceAccessRule(raw as BackendDeviceAccessRule),
      ),
    ]);
    return [...identifierRules, ...deviceRules];
  },

  async createAccessRule(payload: CreateAccessRulePayload): Promise<AnyAccessRule> {
    const path =
      payload.kind === "identifier" ? "/guest-access/rules" : "/guest-access/device-rules";
    const body =
      payload.kind === "identifier"
        ? {
            organization_id: payload.organizationId,
            location_id: payload.locationId,
            identifier: payload.identifier,
            rule_type: payload.ruleType,
            reason: payload.reason,
            expires_at: payload.expiresAt,
          }
        : {
            organization_id: payload.organizationId,
            location_id: payload.locationId,
            mac_address: payload.macAddress,
            rule_type: payload.ruleType,
            reason: payload.reason,
            expires_at: payload.expiresAt,
          };
    const { data } = await api.post<BackendAccessRule | BackendDeviceAccessRule>(path, body, {
      headers: { "X-Organization-Id": payload.organizationId },
    });
    return payload.kind === "identifier"
      ? toAccessRule(data as BackendAccessRule)
      : toDeviceAccessRule(data as BackendDeviceAccessRule);
  },

  async deactivateAccessRule(kind: "identifier" | "device", ruleId: string): Promise<void> {
    const path = kind === "identifier" ? "/guest-access/rules" : "/guest-access/device-rules";
    await api.post(`${path}/${ruleId}/deactivate`);
  },

  async deleteAccessRule(kind: "identifier" | "device", ruleId: string): Promise<void> {
    const path = kind === "identifier" ? "/guest-access/rules" : "/guest-access/device-rules";
    await api.delete(`${path}/${ruleId}`);
  },

  async checkAccess(query: AccessCheckQuery): Promise<AccessCheckResult> {
    const { data } = await api.post<BackendAccessCheckResponse>(
      "/guest-access/check",
      {
        organization_id: query.organizationId,
        location_id: query.locationId,
        identifier: query.identifier,
        mac_address: query.macAddress,
      },
      { headers: { "X-Organization-Id": query.organizationId } },
    );
    return {
      allowed: data.allowed,
      ruleType: data.rule_type,
      matchedRuleId: data.matched_rule_id,
      reason: data.reason,
    };
  },

  async listTeams(): Promise<GuestTeam[]> {
    return fanOutPerOrg<GuestTeam>("/guest-teams", (raw) => toGuestTeam(raw as BackendGuestTeam));
  },

  async getTeam(teamId: string): Promise<{ team: GuestTeam; summary: GuestTeamSummary } | null> {
    const { data } = await api.get<BackendGuestTeam & { summary: BackendGuestTeamSummary }>(
      `/guest-teams/${teamId}`,
    );
    return { team: toGuestTeam(data), summary: toGuestTeamSummary(data.summary) };
  },

  async createTeam(payload: CreateGuestTeamPayload): Promise<GuestTeam> {
    const { data } = await api.post<BackendGuestTeam>(
      "/guest-teams",
      {
        organization_id: payload.organizationId,
        location_id: payload.locationId,
        name: payload.name,
        max_members: payload.maxMembers,
        shared_data_limit_mb: payload.sharedDataLimitMb,
        expires_at: payload.expiresAt,
      },
      { headers: { "X-Organization-Id": payload.organizationId } },
    );
    return toGuestTeam(data);
  },

  async removeTeamMember(teamId: string, guestId: string, reason?: string): Promise<void> {
    await api.delete(`/guest-teams/${teamId}/members/${guestId}`, { data: { reason } });
  },

  async revokeTeam(teamId: string, reason?: string): Promise<GuestTeamRevokeResult> {
    const { data } = await api.post<BackendGuestTeamRevokeResponse>(
      `/guest-teams/${teamId}/revoke`,
      { reason },
    );
    return {
      team: toGuestTeam(data.team),
      memberCount: data.member_count,
      terminatedSessionIds: data.terminated_session_ids,
      failedMemberIds: data.failed_member_ids,
    };
  },

  async analyticsSummary(): Promise<GuestAnalyticsSummary> {
    const { startDate, endDate } = analyticsWindow();
    const orgs = await fetchAllOrganizations();
    const results = await settledData<BackendAnalyticsSummary>(
      orgs.map((org) =>
        api.get<BackendAnalyticsSummary>("/guest-analytics/summary", {
          params: { start_date: startDate, end_date: endDate },
          headers: { "X-Organization-Id": org.id },
        }),
      ),
    );
    const visitors = results.reduce((sum, d) => sum + d.visitors, 0);
    const uniqueGuests = results.reduce((sum, d) => sum + d.unique_guests, 0);
    const returningGuests = results.reduce((sum, d) => sum + d.returning_guests, 0);
    const totalBandwidthBytes = results.reduce((sum, d) => sum + d.total_bandwidth_bytes, 0);
    const withDuration = results.filter((d) => d.average_session_duration_seconds != null);
    const weight = Math.max(
      1,
      withDuration.reduce((sum, d) => sum + d.visitors, 0),
    );
    const averageSessionDurationSeconds = withDuration.length
      ? withDuration.reduce(
          (sum, d) => sum + (d.average_session_duration_seconds ?? 0) * d.visitors,
          0,
        ) / weight
      : 0;
    return {
      visitors,
      uniqueGuests,
      returningGuests,
      averageSessionDurationSeconds,
      totalBandwidthBytes,
    };
  },

  async analyticsTopLocations(): Promise<TopLocationItem[]> {
    const { startDate, endDate } = analyticsWindow();
    const orgs = await fetchAllOrganizations();
    const results = await settledData<{ items: BackendTopLocationItem[] }>(
      orgs.map((org) =>
        api.get<{ items: BackendTopLocationItem[] }>("/guest-analytics/top-locations", {
          params: { start_date: startDate, end_date: endDate },
          headers: { "X-Organization-Id": org.id },
        }),
      ),
    );
    return results
      .flatMap((r) => r.items)
      .map((d) => ({
        locationId: d.location_id,
        locationName: d.location_name,
        sessionCount: d.session_count,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 10);
  },

  async analyticsTopDevices(): Promise<TopDeviceItem[]> {
    const { startDate, endDate } = analyticsWindow();
    const orgs = await fetchAllOrganizations();
    const results = await settledData<{ items: BackendTopDeviceItem[] }>(
      orgs.map((org) =>
        api.get<{ items: BackendTopDeviceItem[] }>("/guest-analytics/top-devices", {
          params: { start_date: startDate, end_date: endDate },
          headers: { "X-Organization-Id": org.id },
        }),
      ),
    );
    return results
      .flatMap((r) => r.items)
      .map((d) => ({
        deviceId: d.device_id,
        macAddress: d.mac_address,
        sessionCount: d.session_count,
        uniqueGuestCount: d.unique_guest_count,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 10);
  },

  async analyticsOtpSuccessRate(): Promise<OtpSuccessRate> {
    const { startDate, endDate } = analyticsWindow();
    const orgs = await fetchAllOrganizations();
    const results = await settledData<BackendOtpSuccessRate>(
      orgs.map((org) =>
        api.get<BackendOtpSuccessRate>("/guest-analytics/otp-success-rate", {
          params: { start_date: startDate, end_date: endDate },
          headers: { "X-Organization-Id": org.id },
        }),
      ),
    );
    const totalAttempts = results.reduce((sum, d) => sum + d.total_attempts, 0);
    const successfulAttempts = results.reduce((sum, d) => sum + d.successful_attempts, 0);
    return {
      totalAttempts,
      successfulAttempts,
      successRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : 0,
    };
  },

  async organizations(): Promise<{ id: string; name: string }[]> {
    return fetchAllOrganizations();
  },

  async locations(): Promise<{ id: string; name: string; organizationId: string }[]> {
    return fetchAllLocations();
  },
};
