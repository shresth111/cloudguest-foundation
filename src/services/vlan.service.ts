import { api } from "@/services/api";
import { resolveOrganizationId as sharedResolveOrganizationId } from "./organization-id";
import { isDemo } from "@/services/customer.service";
import type {
  CreateVlanPayload,
  UpdateVlanPayload,
  Vlan,
  VlanDeviceInterface,
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
  nat_enabled: boolean;
  description: string | null;
  is_enabled: boolean;
  device_push_status: "pending" | "provisioning" | "active" | "failed";
  device_push_error: string | null;
  device_pushed_at: string | null;
  created_at: string;
}

interface BackendDeviceInterface {
  name: string;
  type: string | null;
  running: boolean;
  disabled: boolean;
  bridge: string | null;
  is_bridge_port: boolean;
  has_ip_address: boolean;
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
  // Delegates to the one shared resolver. This used to hold its own
  // module cache and issue its own `/me/organizations`, which is why a
  // single page load fetched that endpoint once per active service.
  // See services/organization-id.ts.
  return sharedResolveOrganizationId();
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
        confirm_takes_port: payload.confirmTakesPort ?? false,
        enable_hotspot: payload.enableHotspot ?? false,
        nat_enabled: payload.natEnabled ?? true,
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
        confirm_takes_port: payload.confirmTakesPort,
        enable_hotspot: payload.enableHotspot,
        nat_enabled: payload.natEnabled,
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

  /**
   * The router's own interface table, read live over the RouterOS API.
   *
   * The VLAN form used to ask the customer to type this name -- with
   * `bridgeLocal` as the placeholder, while the bridge on a real customer
   * router is called `bridge`. A wrong guess is only discovered at push
   * time, as a device error. This is the list that removes the guess.
   *
   * The backend answers `{ interfaces: [] }` -- not an error -- when the
   * router has no stored credentials or is unreachable, so an empty list
   * here means "couldn't read the router", not "the router has no
   * interfaces". The caller says so in the UI and offers manual entry.
   */
  async listDeviceInterfaces(routerId: string): Promise<VlanDeviceInterface[]> {
    if (isDemo()) return [];
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<{ interfaces: BackendDeviceInterface[] }>(
      "/vlans/device-interfaces",
      { params: { router_id: routerId }, headers: { "X-Organization-Id": orgId } },
    );
    return data.interfaces.map((i) => ({
      name: i.name,
      type: i.type,
      running: i.running,
      disabled: i.disabled,
      bridge: i.bridge,
      isBridgePort: i.is_bridge_port,
      hasIpAddress: i.has_ip_address,
    }));
  },

  /**
   * Realizes the VLAN on its router, over the RouterOS API.
   *
   * Creating a VLAN writes a database row and nothing else -- that is
   * deliberate, so that renaming one cannot fail with a device connection
   * error. This is the separate step that actually reaches the hardware, and
   * until it exists in the UI a "created" VLAN is only ever a row.
   *
   * Failures arrive as real non-2xx responses carrying the device's own
   * error text, so the caller's `catch` gets something worth showing. The
   * backend deliberately never returns `200 {success: false}` here: the
   * response interceptor discards `success`, so such a response would reach
   * this method as a success.
   */
  async push(id: string): Promise<Vlan> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendVlan>(`/vlans/${id}/push`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toVlan(data);
  },
};
