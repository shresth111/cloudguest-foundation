import { api } from "@/services/api";
import type {
  CreateDhcpPoolPayload,
  DhcpPool,
  DhcpPoolListQuery,
  DhcpPoolListResult,
  UpdateDhcpPoolPayload,
} from "@/types/dhcp";

interface BackendDhcpPool {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  interface: string | null;
  address_range_start: string;
  address_range_end: string;
  gateway_ip_address: string | null;
  dns_primary: string | null;
  dns_secondary: string | null;
  lease_time_seconds: number;
  is_enabled: boolean;
  created_at: string;
}

interface BackendDhcpPoolListResponse {
  items: BackendDhcpPool[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toDhcpPool(p: BackendDhcpPool): DhcpPool {
  return {
    id: p.id,
    routerId: p.router_id,
    organizationId: p.organization_id,
    locationId: p.location_id,
    name: p.name,
    interface: p.interface,
    addressRangeStart: p.address_range_start,
    addressRangeEnd: p.address_range_end,
    gatewayIpAddress: p.gateway_ip_address,
    dnsPrimary: p.dns_primary,
    dnsSecondary: p.dns_secondary,
    leaseTimeSeconds: p.lease_time_seconds,
    isEnabled: p.is_enabled,
    createdAt: p.created_at,
  };
}

export const dhcpService = {
  async list(q: DhcpPoolListQuery): Promise<DhcpPoolListResult> {
    const { data } = await api.get<BackendDhcpPoolListResponse>("/dhcp-pools", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
    });
    return {
      rows: data.items.map(toDhcpPool),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async create(payload: CreateDhcpPoolPayload): Promise<DhcpPool> {
    const { data } = await api.post<BackendDhcpPool>("/dhcp-pools", {
      router_id: payload.routerId,
      name: payload.name,
      address_range_start: payload.addressRangeStart,
      address_range_end: payload.addressRangeEnd,
      interface: payload.interface,
      gateway_ip_address: payload.gatewayIpAddress,
      dns_primary: payload.dnsPrimary,
      dns_secondary: payload.dnsSecondary,
      lease_time_seconds: payload.leaseTimeSeconds,
      is_enabled: payload.isEnabled ?? true,
    });
    return toDhcpPool(data);
  },

  async update(id: string, payload: UpdateDhcpPoolPayload): Promise<DhcpPool> {
    const { data } = await api.put<BackendDhcpPool>(`/dhcp-pools/${id}`, {
      name: payload.name,
      address_range_start: payload.addressRangeStart,
      address_range_end: payload.addressRangeEnd,
      interface: payload.interface,
      gateway_ip_address: payload.gatewayIpAddress,
      dns_primary: payload.dnsPrimary,
      dns_secondary: payload.dnsSecondary,
      lease_time_seconds: payload.leaseTimeSeconds,
      is_enabled: payload.isEnabled,
    });
    return toDhcpPool(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/dhcp-pools/${id}`);
  },
};
