import { api } from "@/services/api";
import { isDemo, resolveOrgId } from "@/services/customer.service";
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

function orgHeaders(organizationId?: string) {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : {};
}

export const dhcpService = {
  // `create_pool`/`list_pools`/`update_pool`/`delete_pool` all resolve their
  // tenant scope from CurrentOrganization (X-Organization-Id) -- absent it,
  // RequirePermission falls back to checking for a GLOBAL-scope grant, which
  // an ordinary customer/org-owner session never holds, so every call here
  // 403'd for a real customer. That surfaced as the customer dashboard's
  // DHCP Pool page either 403ing outright or (before this domain was wired
  // in at all) never getting called in the first place. `organizationId` is
  // optional and left unset by the master console's platform-wide
  // /network/dhcp view (which deliberately spans every org), and threaded
  // by the customer dashboard's location-scoped DhcpManagement -- same
  // convention as mac-authorization.service.ts's resolveOrganizationId /
  // vlan.service.ts's resolveOrganizationId.
  async list(q: DhcpPoolListQuery): Promise<DhcpPoolListResult> {
    // The demo account's "demo-access-token" isn't a real session the
    // backend recognizes -- every call here 401'd on a plain page load
    // (DhcpManagement fires this on mount), spamming the console with
    // real failed requests on every visit to DHCP Pool in the demo. No
    // curated demo fixture exists for this domain (unlike most other
    // features), so rather than inventing fake pools, this honestly
    // reports zero -- the same empty state a real customer with no pools
    // configured yet would see, minus the 401 underneath it.
    if (isDemo()) {
      return { rows: [], total: 0, totalPages: 1, hasNext: false, hasPrevious: false };
    }
    const { data } = await api.get<BackendDhcpPoolListResponse>("/dhcp-pools", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
      ...orgHeaders(q.organizationId),
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
    const { data } = await api.post<BackendDhcpPool>(
      "/dhcp-pools",
      {
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
      },
      orgHeaders(payload.organizationId),
    );
    return toDhcpPool(data);
  },

  async update(
    id: string,
    payload: UpdateDhcpPoolPayload,
    organizationId?: string,
  ): Promise<DhcpPool> {
    const { data } = await api.put<BackendDhcpPool>(
      `/dhcp-pools/${id}`,
      {
        name: payload.name,
        address_range_start: payload.addressRangeStart,
        address_range_end: payload.addressRangeEnd,
        interface: payload.interface,
        gateway_ip_address: payload.gatewayIpAddress,
        dns_primary: payload.dnsPrimary,
        dns_secondary: payload.dnsSecondary,
        lease_time_seconds: payload.leaseTimeSeconds,
        is_enabled: payload.isEnabled,
      },
      orgHeaders(organizationId),
    );
    return toDhcpPool(data);
  },

  async remove(id: string, organizationId?: string): Promise<void> {
    await api.delete(`/dhcp-pools/${id}`, orgHeaders(organizationId));
  },
};
