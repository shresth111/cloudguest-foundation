/**
 * ISP TR-069 API (API_CONTRACT §5). Same client and headers as `isp.ts`.
 */
import api from "@/services/api";
import { cleanParams } from "@/services/isp-partner/isp";
import type {
  IspPage,
  Tr069AcsCredential,
  Tr069CustomerState,
  Tr069Device,
  Tr069DeviceDetail,
  Tr069DeviceQuery,
  Tr069DeviceUpdate,
  Tr069LocationSettings,
  Tr069Task,
  Tr069TaskQueued,
} from "@/services/isp-partner/types";

export const tr069Service = {
  async getAcs(): Promise<Tr069AcsCredential> {
    const { data } = await api.get<Tr069AcsCredential>("/isp/tr069/acs");
    return data;
  },
  async rotateAcs(): Promise<Tr069AcsCredential> {
    const { data } = await api.post<Tr069AcsCredential>("/isp/tr069/acs/rotate");
    return data;
  },

  async getCustomer(ispCustomerId: string): Promise<Tr069CustomerState> {
    const { data } = await api.get<Tr069CustomerState>(`/isp/tr069/customers/${ispCustomerId}`);
    return data;
  },
  async setCustomerEnabled(ispCustomerId: string, enabled: boolean): Promise<Tr069CustomerState> {
    const { data } = await api.put<Tr069CustomerState>(`/isp/tr069/customers/${ispCustomerId}`, {
      enabled,
    });
    return data;
  },
  async rotateCustomer(ispCustomerId: string): Promise<Tr069CustomerState> {
    const { data } = await api.post<Tr069CustomerState>(
      `/isp/tr069/customers/${ispCustomerId}/rotate`,
    );
    return data;
  },

  async getLocation(ispLocationId: string): Promise<Tr069LocationSettings> {
    const { data } = await api.get<Tr069LocationSettings>(`/isp/tr069/locations/${ispLocationId}`);
    return data;
  },
  async setLocation(
    ispLocationId: string,
    body: Tr069LocationSettings,
  ): Promise<Tr069LocationSettings> {
    const { data } = await api.put<Tr069LocationSettings>(
      `/isp/tr069/locations/${ispLocationId}`,
      body,
    );
    return data;
  },

  /** `text/plain` RouterOS script; carries a password, never cached. */
  async routerScript(ispRouterId: string): Promise<string> {
    const { data } = await api.get<string>(`/isp/tr069/routers/${ispRouterId}/script`, {
      responseType: "text",
      headers: { Accept: "text/plain" },
    });
    return typeof data === "string" ? data : String(data ?? "");
  },

  async listDevices(q: Tr069DeviceQuery): Promise<IspPage<Tr069Device>> {
    const { data } = await api.get<IspPage<Tr069Device>>("/isp/tr069/devices", {
      params: cleanParams(q),
    });
    return data;
  },
  async getDevice(cpeId: string): Promise<Tr069DeviceDetail> {
    const { data } = await api.get<Tr069DeviceDetail>(`/isp/tr069/devices/${cpeId}`);
    return data;
  },
  async updateDevice(cpeId: string, body: Tr069DeviceUpdate): Promise<Tr069Device> {
    const { data } = await api.patch<Tr069Device>(`/isp/tr069/devices/${cpeId}`, body);
    return data;
  },
  async refreshDevice(cpeId: string): Promise<Tr069TaskQueued> {
    const { data } = await api.post<Tr069TaskQueued>(`/isp/tr069/devices/${cpeId}/refresh`);
    return data;
  },
  async rebootDevice(cpeId: string): Promise<Tr069TaskQueued> {
    const { data } = await api.post<Tr069TaskQueued>(`/isp/tr069/devices/${cpeId}/reboot`);
    return data;
  },
  /** Accepts a bare array, `{ items }` or a page; the contract does not pin it. */
  async deviceTasks(cpeId: string): Promise<Tr069Task[]> {
    const { data } = await api.get<Tr069Task[] | { items: Tr069Task[] }>(
      `/isp/tr069/devices/${cpeId}/tasks`,
    );
    return Array.isArray(data) ? data : (data?.items ?? []);
  },
};
