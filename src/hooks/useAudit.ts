import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditService } from "@/services/audit.service";
import type { AuditAction, AuditCategory, AuditFilters, AuditLog, RetentionSettings } from "@/types/audit";

const K = {
  list: (f: AuditFilters, page: number, pageSize: number, sortKey: string, sortDir: string) =>
    ["audit", "list", f, page, pageSize, sortKey, sortDir] as const,
  kpis: ["audit", "kpis"] as const,
  timeline: (limit: number) => ["audit", "timeline", limit] as const,
  category: (c: AuditCategory, limit: number) => ["audit", "category", c, limit] as const,
  actions: (a: AuditAction[]) => ["audit", "actions", a] as const,
  live: ["audit", "live"] as const,
  users: ["audit", "users"] as const,
  analytics: ["audit", "analytics"] as const,
  retention: ["audit", "retention"] as const,
  detail: (id: string) => ["audit", "detail", id] as const,
};

export function useAuditList(
  filters: AuditFilters,
  page: number,
  pageSize: number,
  sort: { key: keyof AuditLog | "actor" | "context"; dir: "asc" | "desc" },
) {
  return useQuery({
    queryKey: K.list(filters, page, pageSize, sort.key as string, sort.dir),
    queryFn: () => auditService.list(filters, page, pageSize, sort),
    staleTime: 15_000,
  });
}

export const useAuditKpis = () =>
  useQuery({ queryKey: K.kpis, queryFn: () => auditService.kpis(), staleTime: 30_000 });

export const useAuditTimeline = (limit = 40) =>
  useQuery({ queryKey: K.timeline(limit), queryFn: () => auditService.timeline(limit), staleTime: 20_000 });

export const useAuditByCategory = (category: AuditCategory, limit = 40) =>
  useQuery({ queryKey: K.category(category, limit), queryFn: () => auditService.byCategory(category, limit), staleTime: 20_000 });

export const useAuditByActions = (actions: AuditAction[]) =>
  useQuery({ queryKey: K.actions(actions), queryFn: () => auditService.byAction(actions, 60), staleTime: 20_000 });

export const useAuditLive = () =>
  useQuery({ queryKey: K.live, queryFn: () => auditService.liveFeed(), refetchInterval: 5_000, staleTime: 0 });

export const useAuditUsers = () =>
  useQuery({ queryKey: K.users, queryFn: () => auditService.userActivity(), staleTime: 30_000 });

export const useAuditAnalytics = () =>
  useQuery({ queryKey: K.analytics, queryFn: () => auditService.analytics(), staleTime: 60_000 });

export const useAuditRetention = () =>
  useQuery({ queryKey: K.retention, queryFn: () => auditService.retention(), staleTime: 60_000 });

export function useUpdateRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: RetentionSettings) => auditService.updateRetention(v),
    onSuccess: (data) => qc.setQueryData(K.retention, data),
  });
}

export function usePinAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => auditService.pin(v.id, v.pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit", "list"] }),
  });
}

export function useAuditDetail(id: string | null) {
  return useQuery({
    queryKey: id ? K.detail(id) : ["audit", "detail", "none"],
    queryFn: () => (id ? auditService.get(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}
