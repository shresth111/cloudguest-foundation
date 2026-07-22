import { api } from "@/services/api";
import type {
  CreateVlanPayload,
  UpdateVlanPayload,
  Vlan,
  VlanKpis,
  VlanListQuery,
  VlanListResult,
} from "@/types/vlan";

interface BackendVlan {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  vlan_id: number;
  name: string;
  gateway_ip_address: string | null;
  cidr: string | null;
  interface: string | null;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
}

interface BackendVlanListResponse {
  items: BackendVlan[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toVlan(v: BackendVlan): Vlan {
  return {
    id: v.id,
    routerId: v.router_id,
    organizationId: v.organization_id,
    locationId: v.location_id,
    vlanId: v.vlan_id,
    name: v.name,
    gatewayIpAddress: v.gateway_ip_address,
    cidr: v.cidr,
    interface: v.interface,
    description: v.description,
    isEnabled: v.is_enabled,
    createdAt: v.created_at,
  };
}

export const vlanService = {
  async list(q: VlanListQuery): Promise<VlanListResult> {
    const { data } = await api.get<BackendVlanListResponse>("/vlans", {
      params: {
        router_id: q.routerId,
        location_id: q.locationId,
        page: q.page,
        page_size: q.pageSize,
      },
    });
    return {
      rows: data.items.map(toVlan),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async get(id: string): Promise<Vlan> {
    const { data } = await api.get<BackendVlan>(`/vlans/${id}`);
    return toVlan(data);
  },

  async getKpis(): Promise<VlanKpis> {
    // No dedicated stats endpoint exists -- fetch a large page and compute
    // real counts client-side, same convention as other list-derived KPIs.
    const { data } = await api.get<BackendVlanListResponse>("/vlans", {
      params: { page: 1, page_size: 100 },
    });
    const enabled = data.items.filter((v) => v.is_enabled).length;
    return {
      total: data.total_items,
      enabled,
      disabled: data.items.length - enabled,
    };
  },

  async create(payload: CreateVlanPayload): Promise<Vlan> {
    const { data } = await api.post<BackendVlan>("/vlans", {
      router_id: payload.routerId,
      vlan_id: payload.vlanId,
      name: payload.name,
      gateway_ip_address: payload.gatewayIpAddress,
      cidr: payload.cidr,
      interface: payload.interface,
      description: payload.description,
      is_enabled: payload.isEnabled ?? true,
    });
    return toVlan(data);
  },

  async update(id: string, payload: UpdateVlanPayload): Promise<Vlan> {
    const { data } = await api.put<BackendVlan>(`/vlans/${id}`, {
      vlan_id: payload.vlanId,
      name: payload.name,
      gateway_ip_address: payload.gatewayIpAddress,
      cidr: payload.cidr,
      interface: payload.interface,
      description: payload.description,
      is_enabled: payload.isEnabled,
    });
    return toVlan(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/vlans/${id}`);
  },
};
