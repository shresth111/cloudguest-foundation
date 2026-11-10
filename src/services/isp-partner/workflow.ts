/** RAKESH-FS: `/isp/workflow/*` (BE flag ISP_WORKFLOW_ENABLED; 404 while off). */
import api from "@/services/api";

export interface WorkflowFeatures {
  data_limit_unit: "GB";
  mb_per_gb: number;
  router_zones: boolean;
  auto_placement: boolean;
  franchisee_logins: boolean;
  is_franchisee: boolean;
}

export interface WfZone {
  id: string;
  name: string;
  city: string | null;
}

export interface WfRouter {
  isp_router_id: string;
  name: string;
  status: string | null;
  isp_customer_id: string;
  customer_name: string;
  isp_location_id: string;
  location_name: string;
  match?: "linked" | "customer_zone";
  distance?: number;
}

export interface WfPlacement {
  zone: WfZone;
  items: WfRouter[];
  suggested: WfRouter | null;
}

export interface WfZonePackages {
  zone: WfZone;
  /** true = no allowlist, every package may be sold in this zone */
  all_packages: boolean;
  items: { id: string; name: string; data_cap_mb: number | null }[];
}

export interface WfFranchisee {
  user_id: string;
  email: string | null;
  full_name: string | null;
  zones: WfZone[];
}

export const workflowService = {
  async features(): Promise<WorkflowFeatures> {
    const { data } = await api.get<WorkflowFeatures>("/isp/workflow/features");
    return data;
  },
  async routerZones(ispRouterId: string): Promise<{ zones: WfZone[] }> {
    const { data } = await api.get<{ zones: WfZone[] }>(
      `/isp/workflow/routers/${ispRouterId}/zones`,
    );
    return data;
  },
  async setRouterZones(ispRouterId: string, zoneIds: string[]): Promise<{ zones: WfZone[] }> {
    const { data } = await api.put<{ zones: WfZone[] }>(
      `/isp/workflow/routers/${ispRouterId}/zones`,
      { zone_ids: zoneIds },
    );
    return data;
  },
  async placement(zoneId: string): Promise<WfPlacement> {
    const { data } = await api.get<WfPlacement>("/isp/workflow/placement", {
      params: { zone_ref: zoneId },
    });
    return data;
  },
  async setSubscriberRouter(
    subscriberId: string,
    ispRouterId: string | null,
  ): Promise<{ router: WfRouter | null }> {
    const { data } = await api.put<{ router: WfRouter | null }>(
      `/isp/workflow/subscribers/${subscriberId}/router`,
      { isp_router_id: ispRouterId },
    );
    return data;
  },
  async zonePackages(zoneId: string): Promise<WfZonePackages> {
    const { data } = await api.get<WfZonePackages>(`/isp/workflow/zones/${zoneId}/packages`);
    return data;
  },
  async setZonePackages(zoneId: string, packageIds: string[]): Promise<WfZonePackages> {
    const { data } = await api.put<WfZonePackages>(`/isp/workflow/zones/${zoneId}/packages`, {
      package_ids: packageIds,
    });
    return data;
  },
  async franchisees(): Promise<{ items: WfFranchisee[]; enabled: boolean }> {
    const { data } = await api.get<{ items: WfFranchisee[]; enabled: boolean }>(
      "/isp/workflow/franchisees",
    );
    return data;
  },
  async setFranchiseeZones(userId: string, zoneIds: string[]): Promise<{ zones: WfZone[] }> {
    const { data } = await api.put<{ zones: WfZone[] }>(
      `/isp/workflow/franchisees/${userId}/zones`,
      { zone_ids: zoneIds },
    );
    return data;
  },
};
