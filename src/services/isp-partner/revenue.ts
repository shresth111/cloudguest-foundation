/** REVENUE-HUB + CHURN-RISK endpoints (read-only). Zone scope is added by the
 * ZONE-1 interceptor (`scope_zone_id`); the hub's own `zone_id` filter is
 * separate (a leaderboard row). */
import api from "@/services/api";
import { revParams } from "@/lib/isp-partner/revenue";
import type {
  RevFilters,
  RevList,
  RevMetric,
  RevenueSummary,
  RiskList,
  RiskReason,
  RiskSummary,
} from "@/services/isp-partner/revenue-types";

export const revenueService = {
  async probe(): Promise<{ enabled: boolean }> {
    const { data } = await api.get<{ enabled: boolean }>("/isp/revenue/probe");
    return data;
  },
  async summary(f: RevFilters): Promise<RevenueSummary> {
    const { data } = await api.get<RevenueSummary>("/isp/revenue/summary", {
      params: revParams(f),
    });
    return data;
  },
  async list(f: RevFilters, metric: RevMetric, page: number, pageSize = 50): Promise<RevList> {
    const { data } = await api.get<RevList>("/isp/revenue/list", {
      params: { ...revParams(f), metric, page, page_size: pageSize },
    });
    return data;
  },
  async riskSummary(f: RevFilters): Promise<RiskSummary> {
    const { data } = await api.get<RiskSummary>("/isp/revenue/churn-risk/summary", {
      params: revParams(f),
    });
    return data;
  },
  async risk(
    f: RevFilters,
    reason: RiskReason | null,
    page: number,
    pageSize = 50,
  ): Promise<RiskList> {
    const { data } = await api.get<RiskList>("/isp/revenue/churn-risk", {
      params: { ...revParams(f), ...(reason ? { reason } : {}), page, page_size: pageSize },
    });
    return data;
  },
};
