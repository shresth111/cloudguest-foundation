/** JAZE-2 endpoints (ADDENDUM_05 J3/J8/J13/J20/J21). Contract: LANE_NOTES [JAZE-2]. */
import api from "@/services/api";
import type {
  EnforcementEvent,
  FupStatus,
  IpBinding,
  IpBindingBody,
  IpPool,
  MacBinding,
  NextFreeIp,
  PackagePolicy,
  PackagePolicyBody,
  RouterActiveSessions,
  RouterHealth,
  RouterHistory,
  Tr069Optical,
  Tr069Summary,
} from "@/services/isp-partner/network-types";

export const networkService = {
  // ENFORCE-1: the usage-reporting step for the partner setup script. 404
  // while the backend's enforcement flag is off (then nothing is appended).
  async enforcementScript(ispRouterId: string): Promise<{ label: string; script: string }> {
    const { data } = await api.get<{ label: string; script: string }>(
      `/isp/routers/${ispRouterId}/enforcement-script`,
    );
    return data;
  },

  // package policy (J3)
  async getPolicy(packageId: string): Promise<PackagePolicy> {
    const { data } = await api.get<PackagePolicy>(`/isp/packages/${packageId}/policy`);
    return data;
  },
  async putPolicy(packageId: string, body: PackagePolicyBody): Promise<PackagePolicy> {
    const { data } = await api.put<PackagePolicy>(`/isp/packages/${packageId}/policy`, body);
    return data;
  },

  // FUP (J3)
  async getFup(subscriberId: string): Promise<FupStatus> {
    const { data } = await api.get<FupStatus>(`/isp/subscribers/${subscriberId}/fup`);
    return data;
  },
  async resetFup(subscriberId: string): Promise<FupStatus> {
    const { data } = await api.post<FupStatus>(`/isp/subscribers/${subscriberId}/fup/reset`, {});
    return data;
  },
  async topupFup(subscriberId: string, mb: number): Promise<FupStatus> {
    const { data } = await api.post<FupStatus>(`/isp/subscribers/${subscriberId}/fup/topup`, {
      mb,
    });
    return data;
  },

  // MAC binding (J3)
  async listMacs(subscriberId: string): Promise<MacBinding[]> {
    const { data } = await api.get<MacBinding[]>(`/isp/subscribers/${subscriberId}/mac-bindings`);
    return data ?? [];
  },
  async addMac(subscriberId: string, mac: string): Promise<MacBinding> {
    const { data } = await api.post<MacBinding>(`/isp/subscribers/${subscriberId}/mac-bindings`, {
      mac,
    });
    return data;
  },
  async deleteMac(subscriberId: string, bindingId: string): Promise<void> {
    await api.delete(`/isp/subscribers/${subscriberId}/mac-bindings/${bindingId}`);
  },

  async listEvents(subscriberId: string, limit = 50): Promise<EnforcementEvent[]> {
    const { data } = await api.get<EnforcementEvent[]>(
      `/isp/subscribers/${subscriberId}/enforcement-events`,
      { params: { limit } },
    );
    return data ?? [];
  },

  // static IP (J8)
  async listPools(locationId: string): Promise<IpPool[]> {
    const { data } = await api.get<IpPool[]>(`/isp/locations/${locationId}/ip-pools`);
    return data ?? [];
  },
  async nextFree(locationId: string, poolId: string): Promise<NextFreeIp> {
    const { data } = await api.get<NextFreeIp>(
      `/isp/locations/${locationId}/ip-pools/${poolId}/next-free`,
    );
    return data;
  },
  async listIpBindings(subscriberId: string): Promise<IpBinding[]> {
    const { data } = await api.get<IpBinding[]>(`/isp/subscribers/${subscriberId}/ip-bindings`);
    return data ?? [];
  },
  async addIpBinding(subscriberId: string, body: IpBindingBody): Promise<IpBinding> {
    const { data } = await api.post<IpBinding>(
      `/isp/subscribers/${subscriberId}/ip-bindings`,
      body,
    );
    return data;
  },
  async deleteIpBinding(subscriberId: string, bindingId: string): Promise<void> {
    await api.delete(`/isp/subscribers/${subscriberId}/ip-bindings/${bindingId}`);
  },

  // router (J13/J20)
  async routerHealthLive(routerId: string): Promise<RouterHealth> {
    const { data } = await api.get<RouterHealth>(`/isp/routers/${routerId}/health/live`);
    return data;
  },
  async routerHistory(routerId: string, hours: number): Promise<RouterHistory> {
    const { data } = await api.get<RouterHistory>(`/isp/routers/${routerId}/health/history`, {
      params: { hours },
    });
    return data;
  },
  async routerSessions(routerId: string): Promise<RouterActiveSessions> {
    const { data } = await api.get<RouterActiveSessions>(
      `/isp/routers/${routerId}/sessions/active`,
    );
    return data;
  },

  // TR-069 (J21)
  async tr069Summary(): Promise<Tr069Summary> {
    const { data } = await api.get<Tr069Summary>("/isp/tr069/summary");
    return data;
  },
  async tr069Optical(cpeId: string): Promise<Tr069Optical> {
    const { data } = await api.get<Tr069Optical>(`/isp/tr069/devices/${cpeId}/optical`);
    return data;
  },
};
