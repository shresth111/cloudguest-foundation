import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  CreatePortForwardingPayload,
  PortForwardingKpis,
  PortForwardingListQuery,
  PortForwardingListResult,
  PortForwardingRule,
  UpdatePortForwardingPayload,
} from "@/types/port-forwarding";

interface BackendPortForwardingRule {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  protocol: string;
  source_address: string | null;
  destination_address: string | null;
  destination_port: number;
  internal_address: string;
  internal_port: number;
  description: string | null;
  is_enabled: boolean;
  created_at: string;
}

interface BackendPortForwardingListResponse {
  items: BackendPortForwardingRule[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toRule(r: BackendPortForwardingRule): PortForwardingRule {
  return {
    id: r.id,
    routerId: r.router_id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    name: r.name,
    protocol: r.protocol,
    sourceAddress: r.source_address,
    destinationAddress: r.destination_address,
    destinationPort: r.destination_port,
    internalAddress: r.internal_address,
    internalPort: r.internal_port,
    description: r.description,
    isEnabled: r.is_enabled,
    createdAt: r.created_at,
  };
}

function orgHeaders(organizationId?: string) {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : {};
}

// `create_port_forwarding_rule`/`list_port_forwarding_rules`/etc. all resolve
// their tenant scope from CurrentOrganization (X-Organization-Id) -- absent
// it, RequirePermission falls back to checking for a GLOBAL-scope grant,
// which an ordinary customer/org-owner session never holds, so every call
// here 403'd for a real customer ("'firewall.read' is required at global
// scope") -- surfaced as the customer dashboard's Port Forwarding page never
// having been backend-wired in the first place. `organizationId` is optional
// and left unset by the master console's platform-wide /network view (which
// deliberately spans every org), and threaded by the customer dashboard's
// location-scoped PortForwardingManagement -- same convention as
// dhcp.service.ts's orgHeaders.
export const portForwardingService = {
  async list(q: PortForwardingListQuery): Promise<PortForwardingListResult> {
    // The demo account's token isn't a real backend session -- every call
    // here 401'd on a plain page load (spamming the console the moment
    // Port Forwarding is opened in the demo). No curated demo fixture
    // exists for this domain, so this honestly reports zero rather than
    // inventing fake rules, same convention as dhcp.service.ts/
    // vlan.service.ts's own demo guards.
    if (isDemo()) {
      return { rows: [], total: 0, totalPages: 1, hasNext: false, hasPrevious: false };
    }
    const { data } = await api.get<BackendPortForwardingListResponse>("/port-forwarding/rules", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
      ...orgHeaders(q.organizationId),
    });
    return {
      rows: data.items.map(toRule),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getKpis(organizationId?: string): Promise<PortForwardingKpis> {
    if (isDemo()) return { total: 0, enabled: 0, disabled: 0 };
    // No dedicated stats endpoint -- fetch a large page and compute real
    // counts client-side, same convention as vlan.service.ts's getKpis.
    const { data } = await api.get<BackendPortForwardingListResponse>("/port-forwarding/rules", {
      params: { page: 1, page_size: 100 },
      ...orgHeaders(organizationId),
    });
    const enabled = data.items.filter((r) => r.is_enabled).length;
    return {
      total: data.total_items,
      enabled,
      disabled: data.items.length - enabled,
    };
  },

  async create(payload: CreatePortForwardingPayload): Promise<PortForwardingRule> {
    const { data } = await api.post<BackendPortForwardingRule>(
      "/port-forwarding/rules",
      {
        router_id: payload.routerId,
        name: payload.name,
        protocol: payload.protocol ?? "both",
        source_address: payload.sourceAddress ?? null,
        destination_address: payload.destinationAddress ?? null,
        destination_port: payload.destinationPort,
        internal_address: payload.internalAddress,
        internal_port: payload.internalPort,
        description: payload.description ?? null,
        is_enabled: payload.isEnabled ?? true,
      },
      orgHeaders(payload.organizationId),
    );
    return toRule(data);
  },

  async update(
    id: string,
    payload: UpdatePortForwardingPayload,
    organizationId?: string,
  ): Promise<PortForwardingRule> {
    const { data } = await api.put<BackendPortForwardingRule>(
      `/port-forwarding/rules/${id}`,
      {
        name: payload.name,
        protocol: payload.protocol,
        source_address: payload.sourceAddress,
        destination_address: payload.destinationAddress,
        destination_port: payload.destinationPort,
        internal_address: payload.internalAddress,
        internal_port: payload.internalPort,
        description: payload.description,
        is_enabled: payload.isEnabled,
      },
      orgHeaders(organizationId),
    );
    return toRule(data);
  },

  async remove(id: string, organizationId?: string): Promise<void> {
    await api.delete(`/port-forwarding/rules/${id}`, orgHeaders(organizationId));
  },
};
