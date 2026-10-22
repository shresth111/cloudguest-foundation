/**
 * The venue twin calls (API_CONTRACT §10).
 *
 * These are the partner console's OWN calls, not a customer component's. They
 * go straight to `/isp/venue/...`, which the request shim passes through
 * untouched: the shim's rewrite exists for the customer views that still call
 * customer paths, and new code has no reason to take that detour.
 *
 * The twin resolves the customer and location from the X-Isp-* headers the
 * venue scope pins, and answers the ORIGINAL handler's body. So the response
 * shape is the customer domain's own -- `BackendVlan` below is the same wire
 * shape `services/vlan.service.ts` reads, mapped here rather than imported
 * because that module's mapper is private and this module must not edit a
 * customer service to borrow it.
 *
 * WHY A ROUTER ID IS ALWAYS REQUIRED HERE
 * ---------------------------------------
 * VLANs live ON a router, and an ISP manages each location's MikroTiks
 * separately. There is no "the router" to default to, so every call names one;
 * the backend refuses a router that is not under the pinned location with a
 * 404. A screen that let the picker go empty would be asking the API a
 * question it cannot answer.
 */
import { api } from "@/services/api";
import type { DhcpPool, DhcpPoolListResult } from "@/types/dhcp";
import type { Vlan, VlanListResult } from "@/types/vlan";

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
  port_mode: "trunk" | "access";
  enable_hotspot: boolean;
  nat_enabled: boolean;
  description: string | null;
  is_enabled: boolean;
  device_push_status: "pending" | "provisioning" | "active" | "failed";
  device_push_error: string | null;
  device_pushed_at: string | null;
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
    portMode: v.port_mode,
    enableHotspot: v.enable_hotspot,
    natEnabled: v.nat_enabled,
    description: v.description,
    isEnabled: v.is_enabled,
    devicePushStatus: v.device_push_status,
    devicePushError: v.device_push_error,
    devicePushedAt: v.device_pushed_at,
    createdAt: v.created_at,
  };
}

export interface VenueVlanQuery {
  routerId: string;
  page?: number;
  pageSize?: number;
}

export const venueVlanService = {
  async list(q: VenueVlanQuery): Promise<VlanListResult> {
    const { data } = await api.get<BackendVlanListResponse>("/isp/venue/vlans", {
      params: {
        isp_router_id: q.routerId,
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

  async push(id: string): Promise<Vlan> {
    const { data } = await api.post<BackendVlan>(`/isp/venue/vlans/${id}/push`);
    return toVlan(data);
  },
};

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
  device_push_status: "pending" | "active" | "failed";
  device_push_error: string | null;
  device_pushed_at: string | null;
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
    devicePushStatus: p.device_push_status,
    devicePushError: p.device_push_error,
    devicePushedAt: p.device_pushed_at,
    createdAt: p.created_at,
  };
}

export const venueDhcpService = {
  async list(q: VenueVlanQuery): Promise<DhcpPoolListResult> {
    const { data } = await api.get<BackendDhcpPoolListResponse>("/isp/venue/dhcp-pools", {
      params: { isp_router_id: q.routerId, page: q.page, page_size: q.pageSize },
    });
    return {
      rows: data.items.map(toDhcpPool),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async push(id: string): Promise<DhcpPool> {
    const { data } = await api.post<BackendDhcpPool>(`/isp/venue/dhcp-pools/${id}/push`);
    return toDhcpPool(data);
  },
};
