import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestService } from "@/services/guest.service";
import type {
  AccessCheckQuery,
  CreateAccessRulePayload,
  CreateGuestTeamPayload,
  GuestListQuery,
  ReconnectPayload,
  SessionListQuery,
} from "@/types/guest";

export const guestKeys = {
  root: ["guests"] as const,
  list: (q: GuestListQuery) => ["guests", "list", q] as const,
  detail: (id: string) => ["guests", "detail", id] as const,
  sessions: (q: SessionListQuery) => ["guests", "sessions", q] as const,
  sessionsFor: (id: string) => ["guests", "sessions-for", id] as const,
  accessRules: ["guests", "access-rules"] as const,
  teams: ["guests", "teams"] as const,
  team: (id: string) => ["guests", "teams", id] as const,
  analyticsSummary: ["guests", "analytics", "summary"] as const,
  analyticsTopLocations: ["guests", "analytics", "top-locations"] as const,
  analyticsTopDevices: ["guests", "analytics", "top-devices"] as const,
  analyticsOtpSuccessRate: ["guests", "analytics", "otp-success-rate"] as const,
};

export function useGuestList(query: GuestListQuery) {
  return useQuery({ queryKey: guestKeys.list(query), queryFn: () => guestService.list(query) });
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: guestKeys.detail(id),
    queryFn: () => guestService.get(id),
    enabled: !!id,
  });
}

export function useSessions(query: SessionListQuery) {
  return useQuery({
    queryKey: guestKeys.sessions(query),
    queryFn: () => guestService.listSessions(query),
  });
}

export function useGuestSessions(id: string) {
  return useQuery({
    queryKey: guestKeys.sessionsFor(id),
    queryFn: () => guestService.sessionsForGuest(id),
    enabled: !!id,
  });
}

export function useAccessRules() {
  return useQuery({
    queryKey: guestKeys.accessRules,
    queryFn: () => guestService.listAccessRules(),
  });
}

export function useGuestTeams() {
  return useQuery({ queryKey: guestKeys.teams, queryFn: () => guestService.listTeams() });
}

export function useGuestTeam(id: string) {
  return useQuery({
    queryKey: guestKeys.team(id),
    queryFn: () => guestService.getTeam(id),
    enabled: !!id,
  });
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: guestKeys.analyticsSummary,
    queryFn: () => guestService.analyticsSummary(),
  });
}

export function useAnalyticsTopLocations() {
  return useQuery({
    queryKey: guestKeys.analyticsTopLocations,
    queryFn: () => guestService.analyticsTopLocations(),
  });
}

export function useAnalyticsTopDevices() {
  return useQuery({
    queryKey: guestKeys.analyticsTopDevices,
    queryFn: () => guestService.analyticsTopDevices(),
  });
}

export function useAnalyticsOtpSuccessRate() {
  return useQuery({
    queryKey: guestKeys.analyticsOtpSuccessRate,
    queryFn: () => guestService.analyticsOtpSuccessRate(),
  });
}

export function useBlockGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, reason }: { guestId: string; reason: string }) =>
      guestService.block(guestId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function useUnblockGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (guestId: string) => guestService.unblock(guestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function useReconnectGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, payload }: { guestId: string; payload: ReconnectPayload }) =>
      guestService.reconnect(guestId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function useDisconnectSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) =>
      guestService.disconnectSession(sessionId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function useTerminateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) =>
      guestService.terminateSession(sessionId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function usePauseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: string; reason?: string }) =>
      guestService.pauseSession(sessionId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function useResumeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => guestService.resumeSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function useExtendSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      additionalMinutes,
    }: {
      sessionId: string;
      additionalMinutes: number;
    }) => guestService.extendSession(sessionId, additionalMinutes),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}

export function useCreateAccessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAccessRulePayload) => guestService.createAccessRule(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.accessRules }),
  });
}

export function useDeactivateAccessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, ruleId }: { kind: "identifier" | "device"; ruleId: string }) =>
      guestService.deactivateAccessRule(kind, ruleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.accessRules }),
  });
}

export function useDeleteAccessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, ruleId }: { kind: "identifier" | "device"; ruleId: string }) =>
      guestService.deleteAccessRule(kind, ruleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.accessRules }),
  });
}

export function useCheckAccess() {
  return useMutation({
    mutationFn: (query: AccessCheckQuery) => guestService.checkAccess(query),
  });
}

export function useCreateGuestTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGuestTeamPayload) => guestService.createTeam(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.teams }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, guestId }: { teamId: string; guestId: string }) =>
      guestService.removeTeamMember(teamId, guestId),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.teams }),
  });
}

export function useRevokeGuestTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => guestService.revokeTeam(teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.teams }),
  });
}
