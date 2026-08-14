import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  CreateQosRulePayload,
  QosListQuery,
  QosListResult,
  QosTrafficRule,
  UpdateQosRulePayload,
} from "@/types/qos";

interface BackendQosRule {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  protocol: string | null;
  port_range_start: number | null;
  port_range_end: number | null;
  dscp_value: number | null;
  priority: number;
  is_enabled: boolean;
  device_queue_id: string | null;
  device_push_status: "pending" | "active" | "failed";
  device_push_error: string | null;
  device_pushed_at: string | null;
  created_at: string;
}

interface BackendQosListResponse {
  items: BackendQosRule[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toRule(r: BackendQosRule): QosTrafficRule {
  return {
    id: r.id,
    routerId: r.router_id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    name: r.name,
    protocol: r.protocol,
    portRangeStart: r.port_range_start,
    portRangeEnd: r.port_range_end,
    dscpValue: r.dscp_value,
    priority: r.priority,
    isEnabled: r.is_enabled,
    deviceQueueId: r.device_queue_id,
    devicePushStatus: r.device_push_status,
    devicePushError: r.device_push_error,
    devicePushedAt: r.device_pushed_at,
    createdAt: r.created_at,
  };
}

function orgHeaders(organizationId?: string) {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : {};
}

// `create_qos_rule`/`list_qos_rules`/etc. all resolve their tenant scope
// from CurrentOrganization (X-Organization-Id) -- absent it, RequirePermission
// falls back to checking for a GLOBAL-scope grant, which an ordinary
// customer/org-owner session never holds, so every call here would 403 for a
// real customer the same way port-forwarding/dhcp/vlan did before their own
// orgHeaders fix. `organizationId` is optional and left unset by a future
// platform-wide master-console view (spans every org), and threaded by the
// customer dashboard's location-scoped QosManagement -- same convention as
// dhcp.service.ts/vlan.service.ts/port-forwarding.service.ts's own orgHeaders.
export const qosService = {
  async list(q: QosListQuery): Promise<QosListResult> {
    // The demo account's token isn't a real backend session -- every call
    // here 401'd on a plain page load (spamming the console the moment
    // VOIP Priority is opened in the demo). No curated demo fixture
    // exists for this domain, so this honestly reports zero rather than
    // inventing fake rules, same convention as dhcp.service.ts/
    // vlan.service.ts/port-forwarding.service.ts's own demo guards.
    if (isDemo()) {
      return { rows: [], total: 0, totalPages: 1, hasNext: false, hasPrevious: false };
    }
    const { data } = await api.get<BackendQosListResponse>("/qos-rules", {
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

  async create(payload: CreateQosRulePayload): Promise<QosTrafficRule> {
    const { data } = await api.post<BackendQosRule>(
      "/qos-rules",
      {
        router_id: payload.routerId,
        name: payload.name,
        protocol: payload.protocol ?? null,
        port_range_start: payload.portRangeStart ?? null,
        port_range_end: payload.portRangeEnd ?? null,
        dscp_value: payload.dscpValue ?? null,
        priority: payload.priority ?? 4,
        is_enabled: payload.isEnabled ?? true,
      },
      orgHeaders(payload.organizationId),
    );
    return toRule(data);
  },

  async update(
    id: string,
    payload: UpdateQosRulePayload,
    organizationId?: string,
  ): Promise<QosTrafficRule> {
    const { data } = await api.put<BackendQosRule>(
      `/qos-rules/${id}`,
      {
        name: payload.name,
        protocol: payload.protocol,
        port_range_start: payload.portRangeStart,
        port_range_end: payload.portRangeEnd,
        dscp_value: payload.dscpValue,
        priority: payload.priority,
        is_enabled: payload.isEnabled,
      },
      orgHeaders(organizationId),
    );
    return toRule(data);
  },

  async remove(id: string, organizationId?: string): Promise<void> {
    await api.delete(`/qos-rules/${id}`, orgHeaders(organizationId));
  },

  // Real device push: `POST /qos-rules/{id}/push` creates/updates this
  // rule's paired router queue so it actually prioritizes traffic on real
  // hardware, instead of just sitting as a database row. Returns the full
  // rule with its refreshed devicePushStatus/devicePushError so the caller
  // can update its cache without a second round trip.
  async push(id: string, organizationId?: string): Promise<QosTrafficRule> {
    const { data } = await api.post<BackendQosRule>(
      `/qos-rules/${id}/push`,
      undefined,
      orgHeaders(organizationId),
    );
    return toRule(data);
  },
};
