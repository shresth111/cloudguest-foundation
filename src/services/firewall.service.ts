import { api } from "@/services/api";
import type {
  CreateFirewallRulePayload,
  FirewallAction,
  FirewallChain,
  FirewallProtocol,
  FirewallRule,
  FirewallRuleListQuery,
  FirewallRuleListResult,
  UpdateFirewallRulePayload,
} from "@/types/firewall";

interface BackendFirewallRule {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  chain: string;
  action: string;
  protocol: string;
  source_address: string | null;
  destination_address: string | null;
  source_port: number | null;
  destination_port: number | null;
  in_interface: string | null;
  priority: number;
  comment: string | null;
  is_enabled: boolean;
  created_at: string;
}

interface BackendFirewallRuleListResponse {
  items: BackendFirewallRule[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toFirewallRule(r: BackendFirewallRule): FirewallRule {
  return {
    id: r.id,
    routerId: r.router_id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    name: r.name,
    chain: r.chain as FirewallChain,
    action: r.action as FirewallAction,
    protocol: r.protocol as FirewallProtocol,
    sourceAddress: r.source_address,
    destinationAddress: r.destination_address,
    sourcePort: r.source_port,
    destinationPort: r.destination_port,
    inInterface: r.in_interface,
    priority: r.priority,
    comment: r.comment,
    isEnabled: r.is_enabled,
    createdAt: r.created_at,
  };
}

export const firewallService = {
  async list(q: FirewallRuleListQuery): Promise<FirewallRuleListResult> {
    const { data } = await api.get<BackendFirewallRuleListResponse>("/firewall-rules", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
    });
    return {
      rows: data.items.map(toFirewallRule),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async create(payload: CreateFirewallRulePayload): Promise<FirewallRule> {
    const { data } = await api.post<BackendFirewallRule>("/firewall-rules", {
      router_id: payload.routerId,
      name: payload.name,
      chain: payload.chain ?? "forward",
      action: payload.action ?? "accept",
      protocol: payload.protocol ?? "all",
      source_address: payload.sourceAddress,
      destination_address: payload.destinationAddress,
      source_port: payload.sourcePort,
      destination_port: payload.destinationPort,
      in_interface: payload.inInterface,
      priority: payload.priority ?? 100,
      comment: payload.comment,
      is_enabled: payload.isEnabled ?? true,
    });
    return toFirewallRule(data);
  },

  async update(id: string, payload: UpdateFirewallRulePayload): Promise<FirewallRule> {
    const { data } = await api.put<BackendFirewallRule>(`/firewall-rules/${id}`, {
      name: payload.name,
      chain: payload.chain,
      action: payload.action,
      protocol: payload.protocol,
      source_address: payload.sourceAddress,
      destination_address: payload.destinationAddress,
      source_port: payload.sourcePort,
      destination_port: payload.destinationPort,
      in_interface: payload.inInterface,
      priority: payload.priority,
      comment: payload.comment,
      is_enabled: payload.isEnabled,
    });
    return toFirewallRule(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/firewall-rules/${id}`);
  },
};
