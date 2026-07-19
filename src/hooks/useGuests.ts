import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestService } from "@/services/guest.service";
import type { BlacklistEntry, LoginMethod, SessionListQuery, WhitelistEntry } from "@/types/guest";

export const guestKeys = {
  root: ["guests"] as const,
  kpis: ["guests", "kpis"] as const,
  analytics: ["guests", "analytics"] as const,
  list: ["guests", "list"] as const,
  detail: (id: string) => ["guests", "detail", id] as const,
  sessions: (q: SessionListQuery) => ["guests", "sessions", q] as const,
  sessionsFor: (id: string) => ["guests", "sessions-for", id] as const,
  devicesFor: (id: string) => ["guests", "devices-for", id] as const,
  blacklist: ["guests", "blacklist"] as const,
  whitelist: ["guests", "whitelist"] as const,
  policies: ["guests", "policies"] as const,
  loginMethods: ["guests", "login-methods"] as const,
};

export function useGuestKpis() {
  return useQuery({ queryKey: guestKeys.kpis, queryFn: () => guestService.kpis() });
}
export function useGuestAnalytics() {
  return useQuery({ queryKey: guestKeys.analytics, queryFn: () => guestService.analytics() });
}
export function useGuestList() {
  return useQuery({ queryKey: guestKeys.list, queryFn: () => guestService.listGuests() });
}
export function useGuest(id: string) {
  return useQuery({ queryKey: guestKeys.detail(id), queryFn: () => guestService.getGuest(id), enabled: !!id });
}
export function useSessions(q: SessionListQuery) {
  return useQuery({ queryKey: guestKeys.sessions(q), queryFn: () => guestService.listSessions(q) });
}
export function useGuestSessions(id: string) {
  return useQuery({ queryKey: guestKeys.sessionsFor(id), queryFn: () => guestService.sessionsForGuest(id), enabled: !!id });
}
export function useGuestDevices(id: string) {
  return useQuery({ queryKey: guestKeys.devicesFor(id), queryFn: () => guestService.devicesForGuest(id), enabled: !!id });
}
export function useBlacklist() {
  return useQuery({ queryKey: guestKeys.blacklist, queryFn: () => guestService.listBlacklist() });
}
export function useWhitelist() {
  return useQuery({ queryKey: guestKeys.whitelist, queryFn: () => guestService.listWhitelist() });
}
export function usePolicies() {
  return useQuery({ queryKey: guestKeys.policies, queryFn: () => guestService.listPolicies() });
}
export function useLoginMethods() {
  return useQuery({ queryKey: guestKeys.loginMethods, queryFn: () => guestService.listLoginMethods() });
}

export function useDisconnectSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => guestService.disconnectSessions(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}
export function useExtendSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) => guestService.extendSession(id, minutes),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}
export function useBlockGuests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) => guestService.blockGuests(ids, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}
export function useResetGuestAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => guestService.resetGuestAccess(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.root }),
  });
}
export function useSendMessage() {
  return useMutation({
    mutationFn: ({ id, channel, body }: { id: string; channel: "sms" | "email"; body: string }) =>
      guestService.sendMessage(id, channel, body),
  });
}
export function useAddBlacklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: Omit<BlacklistEntry, "id" | "blockedAt">) => guestService.addBlacklist(entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.blacklist }),
  });
}
export function useRemoveBlacklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => guestService.removeBlacklist(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.blacklist }),
  });
}
export function useAddWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: Omit<WhitelistEntry, "id" | "addedAt">) => guestService.addWhitelist(entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.whitelist }),
  });
}
export function useRemoveWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => guestService.removeWhitelist(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.whitelist }),
  });
}
export function useToggleLoginMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, enabled }: { method: LoginMethod; enabled: boolean }) =>
      guestService.toggleLoginMethod(method, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.loginMethods }),
  });
}
export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      guestService.updatePolicy(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: guestKeys.policies }),
  });
}
