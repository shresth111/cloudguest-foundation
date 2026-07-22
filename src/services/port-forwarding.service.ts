import { api } from "@/services/api";
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

export const portForwardingService = {
  async list(q: PortForwardingListQuery): Promise<PortForwardingListResult> {
    const { data } = await api.get<BackendPortForwardingListResponse>("/port-forwarding/rules", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
    });
    return {
      rows: data.items.map(toRule),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getKpis(): Promise<PortForwardingKpis> {
    // No dedicated stats endpoint -- fetch a large page and compute real
    // counts client-side, same convention as vlan.service.ts's getKpis.
    const { data } = await api.get<BackendPortForwardingListResponse>("/port-forwarding/rules", {
      params: { page: 1, page_size: 100 },
    });
    const enabled = data.items.filter((r) => r.is_enabled).length;
    return {
      total: data.total_items,
      enabled,
      disabled: data.items.length - enabled,
    };
  },

  async create(payload: CreatePortForwardingPayload): Promise<PortForwardingRule> {
    const { data } = await api.post<BackendPortForwardingRule>("/port-forwarding/rules", {
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
    });
    return toRule(data);
  },

  async update(id: string, payload: UpdatePortForwardingPayload): Promise<PortForwardingRule> {
    const { data } = await api.put<BackendPortForwardingRule>(`/port-forwarding/rules/${id}`, {
      name: payload.name,
      protocol: payload.protocol,
      source_address: payload.sourceAddress,
      destination_address: payload.destinationAddress,
      destination_port: payload.destinationPort,
      internal_address: payload.internalAddress,
      internal_port: payload.internalPort,
      description: payload.description,
      is_enabled: payload.isEnabled,
    });
    return toRule(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/port-forwarding/rules/${id}`);
  },
};
