/** REVENUE-HUB + CHURN-RISK queries. Under ["isp", "revenue"], so a zone
 * switch (which resets ["isp"]) refetches them. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { revenueService } from "@/services/isp-partner/revenue";
import type { RevFilters, RevMetric, RiskReason } from "@/services/isp-partner/revenue-types";

export const revKeys = {
  probe: ["isp", "revenue", "probe"] as const,
  summary: (f: RevFilters) => ["isp", "revenue", "summary", f] as const,
  list: (f: RevFilters, m: RevMetric, page: number) =>
    ["isp", "revenue", "list", f, m, page] as const,
  riskSummary: (f: RevFilters) => ["isp", "revenue", "risk-summary", f] as const,
  risk: (f: RevFilters, r: RiskReason | null, page: number) =>
    ["isp", "revenue", "risk", f, r, page] as const,
};

/** True while ISP_REVENUE_HUB_ENABLED is on and the role reads billing. */
export function useRevenueEnabled(): { enabled: boolean; loading: boolean } {
  const { can } = usePartner();
  const allowed = can("isp_billing.read");
  const q = useQuery({
    queryKey: revKeys.probe,
    queryFn: () => revenueService.probe(),
    enabled: allowed,
    retry: false,
    staleTime: 10 * 60_000,
  });
  return { enabled: allowed && q.isSuccess, loading: allowed && q.isLoading };
}

export function useRevenueSummary(f: RevFilters) {
  return useQuery({
    queryKey: revKeys.summary(f),
    queryFn: () => revenueService.summary(f),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useRevenueList(f: RevFilters, metric: RevMetric | null, page: number) {
  return useQuery({
    queryKey: revKeys.list(f, metric ?? "active", page),
    queryFn: () => revenueService.list(f, metric ?? "active", page),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled: !!metric,
  });
}

export function useRiskSummary(f: RevFilters) {
  return useQuery({
    queryKey: revKeys.riskSummary(f),
    queryFn: () => revenueService.riskSummary(f),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useRiskList(
  f: RevFilters,
  reason: RiskReason | null,
  page: number,
  enabled = true,
) {
  return useQuery({
    queryKey: revKeys.risk(f, reason, page),
    queryFn: () => revenueService.risk(f, reason, page),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled,
  });
}
