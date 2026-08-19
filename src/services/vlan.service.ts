import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
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
  port_mode: "trunk" | "access";
  enable_hotspot: boolean;
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
    portMode: v.port_mode,
    enableHotspot: v.enable_hotspot,
    description: v.description,
    isEnabled: v.is_enabled,
    createdAt: v.created_at,
  };
}

let cachedOrganizationId: string | null = null;
// list_vlans/create_vlan/etc. resolve their tenant scope from
// CurrentOrganization, which -- per app.domains.rbac.dependencies -- trusts
// the X-Organization-Id header only, resolving to None (and RequirePermission
// then checking for a GLOBAL-scope grant an ordinary org owner never holds)
// when it's absent. Every call here was missing that header entirely, so a
// real customer/org-owner session 403'd on every VLAN request with
// "'vlan.read' is required at global scope" -- read from the actual VLANs
// page as a dead Edit icon (and a page that never loaded any real rows in
// the first place). Same fix, same cause, same convention as
// mac-authorization.service.ts's resolveOrganizationId.
async function resolveOrganizationId(): Promise<string> {
  if (cachedOrganizationId) return cachedOrganizationId;
  const { data } =
    await api.get<Array<{ organization_id: string; status: string }>>("/me/organizations");
  const membership = data.find((m) => m.status === "active") ?? data[0];
  if (!membership) throw new Error("No organization found for the current session");
  cachedOrganizationId = membership.organization_id;
  return cachedOrganizationId;
}

export const vlanService = {
  async list(q: VlanListQuery): Promise<VlanListResult> {
    // The demo account's token isn't a real backend session -- every call
    // here 401'd on a plain page load (spamming the console the moment
    // VLANs is opened in the demo). No curated demo fixture exists for
    // this domain, so this honestly reports zero rather than inventing
    // fake VLANs, same convention as dhcp.service.ts's own demo guard.
    if (isDemo()) {
      return { rows: [], total: 0, totalPages: 1, hasNext: false, hasPrevious: false };
    }
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendVlanListResponse>("/vlans", {
      params: {
        router_id: q.routerId,
        location_id: q.locationId,
        page: q.page,
        page_size: q.pageSize,
      },
      headers: { "X-Organization-Id": orgId },
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
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendVlan>(`/vlans/${id}`, {
      headers: { "X-Organization-Id": orgId },
    });
    return toVlan(data);
  },

  async getKpis(): Promise<VlanKpis> {
    if (isDemo()) return { total: 0, enabled: 0, disabled: 0 };
    // No dedicated stats endpoint exists -- fetch a large page and compute
    // real counts client-side, same convention as other list-derived KPIs.
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendVlanListResponse>("/vlans", {
      params: { page: 1, page_size: 100 },
      headers: { "X-Organization-Id": orgId },
    });
    const enabled = data.items.filter((v) => v.is_enabled).length;
    return {
      total: data.total_items,
      enabled,
      disabled: data.items.length - enabled,
    };
  },

  async create(payload: CreateVlanPayload): Promise<Vlan> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendVlan>(
      "/vlans",
      {
        router_id: payload.routerId,
        vlan_id: payload.vlanId,
        name: payload.name,
        gateway_ip_address: payload.gatewayIpAddress,
        cidr: payload.cidr,
        interface: payload.interface,
        port_mode: payload.portMode ?? "trunk",
        enable_hotspot: payload.enableHotspot ?? false,
        description: payload.description,
        is_enabled: payload.isEnabled ?? true,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toVlan(data);
  },

  async update(id: string, payload: UpdateVlanPayload): Promise<Vlan> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.put<BackendVlan>(
      `/vlans/${id}`,
      {
        vlan_id: payload.vlanId,
        name: payload.name,
        gateway_ip_address: payload.gatewayIpAddress,
        cidr: payload.cidr,
        interface: payload.interface,
        port_mode: payload.portMode,
        enable_hotspot: payload.enableHotspot,
        description: payload.description,
        is_enabled: payload.isEnabled,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toVlan(data);
  },

  async remove(id: string): Promise<void> {
    const orgId = await resolveOrganizationId();
    await api.delete(`/vlans/${id}`, {
      headers: { "X-Organization-Id": orgId },
    });
  },
};
