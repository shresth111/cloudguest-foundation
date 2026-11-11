/** PROV-FIX endpoints (router setup fixes + self-serve monitoring).
 * Every one answers 404 while ISP_PROV_FIX_ENABLED is off. */
import api from "@/services/api";

export interface ProvFixFeatures {
  check_in_fallback: boolean;
  api_access_always_on_fresh_router: boolean;
  in_app_choices: boolean;
  heartbeat_reports_version: boolean;
  monitoring_self_serve: boolean;
  /** [POSTFIX-1]; absent on older builds. */
  package_policy_summaries?: boolean;
}

/** [POSTFIX-1] `GET /isp/package-policy-summaries`: FUP + validity start per
 * package that has a policy. Packages not listed use the defaults. */
export interface PackagePolicySummary {
  package_id: string;
  fup_limit_mb: number | null;
  fup_reset: string;
  validity_starts: "activation" | "first_login" | string;
}

export interface MonitoringStatus {
  enabled: boolean;
  applied_on_router: boolean;
  applied_at: string | null;
  last_reading_at: string | null;
  last_reading_ok: boolean | null;
  can_change: boolean;
}

/** FR-GENERATE: `GET /isp/routers/{id}/setup/access`. Whether this caller's
 * role may Generate on this router (a franchisee: only inside its zones).
 * 404 on an older build; callers then keep the old behaviour. */
export interface SetupAccess {
  isp_router_id: string;
  can_generate: boolean;
  reason: "outside_zones" | "role" | null;
}

export const provFixService = {
  async setupAccess(ispRouterId: string): Promise<SetupAccess> {
    const { data } = await api.get<SetupAccess>(`/isp/routers/${ispRouterId}/setup/access`);
    return data;
  },
  async features(): Promise<ProvFixFeatures> {
    const { data } = await api.get<ProvFixFeatures>("/isp/setup-fixes");
    return data;
  },
  async packagePolicySummaries(): Promise<{ items: PackagePolicySummary[] }> {
    const { data } = await api.get<{ items: PackagePolicySummary[] }>(
      "/isp/package-policy-summaries",
    );
    return data;
  },
  async monitoring(ispRouterId: string): Promise<MonitoringStatus> {
    const { data } = await api.get<MonitoringStatus>(`/isp/routers/${ispRouterId}/monitoring`);
    return data;
  },
  async setMonitoring(ispRouterId: string, on: boolean): Promise<MonitoringStatus> {
    const { data } = await api.post<MonitoringStatus>(
      `/isp/routers/${ispRouterId}/monitoring/${on ? "enable" : "disable"}`,
    );
    return data;
  },
};
