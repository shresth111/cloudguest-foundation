import { api, requestErrorOf } from "@/services/api";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import type {
  CreateFirewallRulePayload,
  FirewallAction,
  FirewallBandPlacement,
  FirewallBandState,
  FirewallBandStatus,
  FirewallDevicePushStatus,
  FirewallPushResult,
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
  // cloud-guest#304. Optional here because a backend without that PR does
  // not send them, and "not sent" must not be read as "pending".
  device_push_status?: string | null;
  device_push_error?: string | null;
  device_pushed_at?: string | null;
}

interface BackendFirewallPushResponse {
  router_id: string;
  added: number;
  removed: number;
  unchanged: number;
  rules: BackendFirewallRule[];
}

interface BackendFirewallBandStatus {
  state: string;
  reason?: string | null;
  checked_at?: string | null;
}

interface BackendFirewallBandResponse {
  router_id: string;
  created: boolean;
}

const PUSH_STATUSES: readonly FirewallDevicePushStatus[] = ["pending", "active", "failed"];
const BAND_STATES: readonly FirewallBandState[] = ["ready", "missing", "invalid"];

function pushStatusOf(value: string | null | undefined): FirewallDevicePushStatus | null {
  return PUSH_STATUSES.find((s) => s === value) ?? null;
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
    devicePushStatus: pushStatusOf(r.device_push_status),
    devicePushError: r.device_push_error ?? null,
    devicePushedAt: r.device_pushed_at ?? null,
  };
}

export const firewallService = {
  // Same missing-X-Organization-Id gap already fixed on vlan/dhcp/guest-
  // sessions services this session -- absent it, `firewall_rules.*` falls
  // back to a GLOBAL-scope check an ordinary org-owner session never
  // holds, so every call here 403'd for a real customer (confirmed live).
  async list(q: FirewallRuleListQuery): Promise<FirewallRuleListResult> {
    // The demo account has no firewall rules and no router to push to. Zero,
    // honestly, rather than invented rules -- the same convention as
    // contentFilter.service.ts's own demo guard.
    if (isDemo()) {
      return { rows: [], total: 0, totalPages: 1, hasNext: false, hasPrevious: false };
    }
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendFirewallRuleListResponse>("/firewall-rules", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
      headers: { "X-Organization-Id": orgId },
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
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendFirewallRule>(
      "/firewall-rules",
      {
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
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toFirewallRule(data);
  },

  async update(id: string, payload: UpdateFirewallRulePayload): Promise<FirewallRule> {
    const orgId = await resolveOrgId();
    const { data } = await api.put<BackendFirewallRule>(
      `/firewall-rules/${id}`,
      {
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
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toFirewallRule(data);
  },

  async remove(id: string): Promise<void> {
    const orgId = await resolveOrgId();
    await api.delete(`/firewall-rules/${id}`, { headers: { "X-Organization-Id": orgId } });
  },

  /**
   * Puts this router's switched-on rules on the device, in order, and takes
   * off any of ours that are switched off or deleted (cloud-guest#304,
   * `firewall.execute`, ROUTER scope). Per router, never per rule: a rule's
   * position is a property of the whole set.
   *
   * Every failure is a real non-2xx and rejects with an `AppError` whose
   * `data.code` says which (see `lib/firewall-rules.ts`'s
   * `firewallPushErrorSentence`) -- never a 200 with a failure inside it.
   */
  async push(routerId: string): Promise<FirewallPushResult> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendFirewallPushResponse>(
      `/firewall-rules/routers/${routerId}/push`,
      undefined,
      { headers: { "X-Organization-Id": orgId } },
    );
    return {
      routerId: data.router_id,
      added: data.added,
      removed: data.removed,
      unchanged: data.unchanged,
      rules: data.rules.map(toFirewallRule),
    };
  },

  /**
   * Whether the router has been prepared for firewall rules (the sentinel
   * band #304's push writes into). `firewall.read`.
   *
   * Returns `null` -- "status unknown" -- when the endpoint is not there
   * (404: it lands in a PR parallel to #304, so a backend can have the push
   * without it) or the caller cannot read it (403). Anything else is a real
   * failure and rejects. Unknown never blocks the Apply button: the push
   * itself refuses with ACCESS_RULES_BAND_MISSING if the band is absent, and
   * that answer is rendered in full.
   */
  async getBand(routerId: string, organizationId?: string): Promise<FirewallBandStatus | null> {
    if (isDemo()) return null;
    const orgId = organizationId ?? (await resolveOrgId());
    try {
      const { data } = await api.get<BackendFirewallBandStatus>(
        `/firewall-rules/routers/${routerId}/band`,
        orgId ? { headers: { "X-Organization-Id": orgId } } : undefined,
      );
      const state = BAND_STATES.find((s) => s === data?.state);
      if (!state) return null;
      return { state, reason: data.reason ?? null, checkedAt: data.checked_at ?? null };
    } catch (err) {
      const status = requestErrorOf(err)?.status;
      if (status === 404 || status === 403 || status === 405) return null;
      throw err;
    }
  },

  /**
   * Master console only (`firewall.manage`, GLOBAL scope): place the band
   * above the router's established-connection accept. Idempotent -- an
   * existing band is left where it is and `created` comes back false.
   * No organization header: the route is pinned to GLOBAL scope, and a
   * platform grant is the only thing that passes it.
   */
  async installBand(routerId: string): Promise<FirewallBandPlacement> {
    const { data } = await api.post<BackendFirewallBandResponse>(
      `/firewall-rules/routers/${routerId}/band`,
    );
    return { routerId: data.router_id, created: data.created };
  },
};
