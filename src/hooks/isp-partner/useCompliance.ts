/** Queries/mutations for `/isp/compliance/*` (lane JAZE-3). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { complianceService, type CgnatQuery } from "@/services/isp-partner/compliance";

export const complianceKeys = {
  all: ["isp", "compliance"] as const,
  counters: (c: string) => ["isp", "compliance", "counters", c] as const,
  natFeed: ["isp", "compliance", "nat-feed"] as const,
  cgnat: (q: CgnatQuery) => ["isp", "compliance", "cgnat", q] as const,
  settings: ["isp", "compliance", "settings"] as const,
  kyc: (id: string) => ["isp", "compliance", "kyc", id] as const,
  trai: (p: string) => ["isp", "compliance", "trai", p] as const,
  agr: (s: string, u: string) => ["isp", "compliance", "agr", s, u] as const,
  catalogue: ["isp", "compliance", "catalogue"] as const,
  report: (k: string, s: string, u: string) => ["isp", "compliance", "report", k, s, u] as const,
  schedules: ["isp", "compliance", "schedules"] as const,
};

export function useComplianceCounters(customerId = "", enabled = true) {
  return useQuery({
    queryKey: complianceKeys.counters(customerId),
    queryFn: () => complianceService.counters(customerId || undefined),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useNatFeed(enabled = true) {
  return useQuery({
    queryKey: complianceKeys.natFeed,
    queryFn: () => complianceService.natFeed(),
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useCgnatLookup(q: CgnatQuery | null) {
  return useQuery({
    queryKey: complianceKeys.cgnat(q ?? ({} as CgnatQuery)),
    queryFn: () => complianceService.cgnatLookup(q as CgnatQuery),
    enabled: q !== null,
    retry: false,
    staleTime: Infinity,
  });
}

export function useComplianceSettings(enabled = true) {
  return useQuery({
    queryKey: complianceKeys.settings,
    queryFn: () => complianceService.settings(),
    enabled,
  });
}

export function useSubscriberKyc(subscriberId: string | null) {
  return useQuery({
    queryKey: complianceKeys.kyc(subscriberId ?? ""),
    queryFn: () => complianceService.kyc(subscriberId as string),
    enabled: !!subscriberId,
  });
}

export function useTraiPmr(period: string) {
  return useQuery({
    queryKey: complianceKeys.trai(period),
    queryFn: () => complianceService.traiPmr(period),
    enabled: /^\d{4}-\d{2}$/.test(period),
  });
}

export function useAgr(since: string, until: string) {
  return useQuery({
    queryKey: complianceKeys.agr(since, until),
    queryFn: () => complianceService.agr(since || undefined, until || undefined),
  });
}

export function useReportCatalogue() {
  return useQuery({
    queryKey: complianceKeys.catalogue,
    queryFn: () => complianceService.catalogue(),
    staleTime: 5 * 60_000,
  });
}

export function useComplianceReport(key: string, since: string, until: string) {
  return useQuery({
    queryKey: complianceKeys.report(key, since, until),
    queryFn: () => complianceService.report(key, since, until),
    enabled: !!key,
    placeholderData: keepPreviousData,
  });
}

export function useReportSchedules(enabled = true) {
  return useQuery({
    queryKey: complianceKeys.schedules,
    queryFn: () => complianceService.schedules(),
    enabled,
  });
}

/** One mutation helper: invalidates the compliance cache on success. */
export function useComplianceMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceKeys.all }),
  });
}
