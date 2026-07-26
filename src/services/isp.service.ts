import { api } from "@/services/api";
import type {
  CreateIspLinkPayload,
  CreateIspRoutingRulePayload,
  IspHealthCheck,
  IspHealthCheckListQuery,
  IspHealthCheckListResult,
  IspLink,
  IspLinkListQuery,
  IspLinkListResult,
  IspLinkRole,
  IspRoutingRule,
  IspRoutingRuleListQuery,
  IspRoutingRuleListResult,
  IspRoutingRuleType,
  UpdateIspLinkPayload,
  UpdateIspRoutingRulePayload,
} from "@/types/isp";

// Every route in app.domains.isp.router resolves CurrentOrganization from
// X-Organization-Id and gates on RequirePermission("isp.*") -- omitting the
// header doesn't loosen scoping, it falls back to GLOBAL-scope permission
// checking, which an ordinary customer/org-owner session never holds, so
// every call below 403ed ("Permission denied: 'isp.read' is required at
// global scope") before this fix, on every method, not only writes. Same
// missing-header class of bug as mac-authorization.service.ts's own
// resolveOrganizationId() (this module keeps its own local copy rather than
// importing customer.service.ts's resolveOrgId() -- same "each real service
// stays self-contained" precedent that file's own comment documents), fixed
// there first.
let cachedOrganizationId: string | null = null;
async function resolveOrganizationId(): Promise<string> {
  if (cachedOrganizationId) return cachedOrganizationId;
  const { data } = await api.get<Array<{ organization_id: string; status: string }>>(
    "/me/organizations",
  );
  const membership = data.find((m) => m.status === "active") ?? data[0];
  if (!membership) throw new Error("No organization found for the current session");
  cachedOrganizationId = membership.organization_id;
  return cachedOrganizationId;
}

interface BackendIspLink {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  provider_name: string;
  link_type: string;
  role: string;
  is_active_uplink: boolean;
  auto_failback: boolean;
  is_enabled: boolean;
  priority: number;
  interface: string | null;
  gateway_ip_address: string | null;
  dns_primary: string | null;
  dns_secondary: string | null;
  download_bandwidth_mbps: number | null;
  upload_bandwidth_mbps: number | null;
  health_status: string;
  latency_ms: number | null;
  packet_loss_percentage: number | null;
  last_checked_at: string | null;
  consecutive_unhealthy_count: number;
  created_at: string;
}

interface BackendIspLinkListResponse {
  items: BackendIspLink[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendIspRoutingRule {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  isp_link_id: string;
  rule_type: string;
  name: string;
  description: string | null;
  priority: number;
  is_enabled: boolean;
  vlan_id: number | null;
  source_mac_address: string | null;
  ip_address: string | null;
  source_cidr: string | null;
  interface_name: string | null;
  policy_id: string | null;
  created_at: string;
}

interface BackendIspRoutingRuleListResponse {
  items: BackendIspRoutingRule[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toIspLink(l: BackendIspLink): IspLink {
  return {
    id: l.id,
    routerId: l.router_id,
    organizationId: l.organization_id,
    locationId: l.location_id,
    providerName: l.provider_name,
    linkType: l.link_type,
    role: l.role as IspLinkRole,
    isActiveUplink: l.is_active_uplink,
    autoFailback: l.auto_failback,
    isEnabled: l.is_enabled,
    priority: l.priority,
    interface: l.interface,
    gatewayIpAddress: l.gateway_ip_address,
    dnsPrimary: l.dns_primary,
    dnsSecondary: l.dns_secondary,
    downloadBandwidthMbps: l.download_bandwidth_mbps,
    uploadBandwidthMbps: l.upload_bandwidth_mbps,
    healthStatus: l.health_status,
    latencyMs: l.latency_ms,
    packetLossPercentage: l.packet_loss_percentage,
    lastCheckedAt: l.last_checked_at,
    consecutiveUnhealthyCount: l.consecutive_unhealthy_count,
    createdAt: l.created_at,
  };
}

interface BackendIspHealthCheck {
  id: string;
  isp_link_id: string;
  checked_at: string;
  status: string;
  latency_ms: number | null;
  packet_loss_percentage: number | null;
  error_message: string | null;
}

interface BackendIspHealthCheckListResponse {
  items: BackendIspHealthCheck[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  availability_percentage: number | null;
}

function toIspHealthCheck(h: BackendIspHealthCheck): IspHealthCheck {
  return {
    id: h.id,
    ispLinkId: h.isp_link_id,
    checkedAt: h.checked_at,
    status: h.status,
    latencyMs: h.latency_ms,
    packetLossPercentage: h.packet_loss_percentage,
    errorMessage: h.error_message,
  };
}

function toIspRoutingRule(r: BackendIspRoutingRule): IspRoutingRule {
  return {
    id: r.id,
    routerId: r.router_id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    ispLinkId: r.isp_link_id,
    ruleType: r.rule_type as IspRoutingRuleType,
    name: r.name,
    description: r.description,
    priority: r.priority,
    isEnabled: r.is_enabled,
    vlanId: r.vlan_id,
    sourceMacAddress: r.source_mac_address,
    ipAddress: r.ip_address,
    sourceCidr: r.source_cidr,
    interfaceName: r.interface_name,
    policyId: r.policy_id,
    createdAt: r.created_at,
  };
}

export const ispService = {
  async listLinks(q: IspLinkListQuery): Promise<IspLinkListResult> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendIspLinkListResponse>("/isp/links", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
      headers: { "X-Organization-Id": orgId },
    });
    return {
      rows: data.items.map(toIspLink),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async createLink(payload: CreateIspLinkPayload): Promise<IspLink> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspLink>(
      "/isp/links",
      {
        router_id: payload.routerId,
        provider_name: payload.providerName,
        link_type: payload.linkType ?? "other",
        role: payload.role,
        priority: payload.priority ?? 0,
        interface: payload.interface,
        gateway_ip_address: payload.gatewayIpAddress,
        dns_primary: payload.dnsPrimary,
        dns_secondary: payload.dnsSecondary,
        download_bandwidth_mbps: payload.downloadBandwidthMbps,
        upload_bandwidth_mbps: payload.uploadBandwidthMbps,
        auto_failback: payload.autoFailback ?? true,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toIspLink(data);
  },

  async updateLink(id: string, payload: UpdateIspLinkPayload): Promise<IspLink> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.put<BackendIspLink>(
      `/isp/links/${id}`,
      {
        provider_name: payload.providerName,
        link_type: payload.linkType,
        role: payload.role,
        priority: payload.priority,
        interface: payload.interface,
        gateway_ip_address: payload.gatewayIpAddress,
        dns_primary: payload.dnsPrimary,
        dns_secondary: payload.dnsSecondary,
        download_bandwidth_mbps: payload.downloadBandwidthMbps,
        upload_bandwidth_mbps: payload.uploadBandwidthMbps,
        auto_failback: payload.autoFailback,
        is_enabled: payload.isEnabled,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toIspLink(data);
  },

  async removeLink(id: string): Promise<void> {
    const orgId = await resolveOrganizationId();
    await api.delete(`/isp/links/${id}`, { headers: { "X-Organization-Id": orgId } });
  },

  async checkLinkHealth(id: string): Promise<IspLink> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspLink>(
      `/isp/links/${id}/check-health`,
      undefined,
      { headers: { "X-Organization-Id": orgId } },
    );
    return toIspLink(data);
  },

  async listHealthChecks(
    linkId: string,
    q: IspHealthCheckListQuery = {},
  ): Promise<IspHealthCheckListResult> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendIspHealthCheckListResponse>(
      `/isp/links/${linkId}/health-checks`,
      {
        params: { page: q.page ?? 1, page_size: q.pageSize ?? 10 },
        headers: { "X-Organization-Id": orgId },
      },
    );
    return {
      rows: data.items.map(toIspHealthCheck),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
      availabilityPercentage: data.availability_percentage,
    };
  },

  async triggerFailover(routerId: string, reason?: string): Promise<IspLink> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspLink>(
      `/isp/routers/${routerId}/failover`,
      { reason: reason ?? "manual_admin_trigger" },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toIspLink(data);
  },

  async triggerFailback(routerId: string, reason?: string): Promise<IspLink> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspLink>(
      `/isp/routers/${routerId}/failback`,
      { reason: reason ?? "manual_admin_trigger" },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toIspLink(data);
  },

  async listRoutingRules(q: IspRoutingRuleListQuery): Promise<IspRoutingRuleListResult> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendIspRoutingRuleListResponse>("/isp-routing/rules", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
      headers: { "X-Organization-Id": orgId },
    });
    return {
      rows: data.items.map(toIspRoutingRule),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async createRoutingRule(payload: CreateIspRoutingRulePayload): Promise<IspRoutingRule> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspRoutingRule>(
      "/isp-routing/rules",
      {
        router_id: payload.routerId,
        isp_link_id: payload.ispLinkId,
        rule_type: payload.ruleType,
        name: payload.name,
        description: payload.description,
        priority: payload.priority ?? 0,
        is_enabled: payload.isEnabled ?? true,
        vlan_id: payload.vlanId,
        source_mac_address: payload.sourceMacAddress,
        ip_address: payload.ipAddress,
        source_cidr: payload.sourceCidr,
        interface_name: payload.interfaceName,
        policy_id: payload.policyId,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toIspRoutingRule(data);
  },

  async updateRoutingRule(id: string, payload: UpdateIspRoutingRulePayload): Promise<IspRoutingRule> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.put<BackendIspRoutingRule>(
      `/isp-routing/rules/${id}`,
      {
        isp_link_id: payload.ispLinkId,
        rule_type: payload.ruleType,
        name: payload.name,
        description: payload.description,
        priority: payload.priority,
        is_enabled: payload.isEnabled,
        vlan_id: payload.vlanId,
        source_mac_address: payload.sourceMacAddress,
        ip_address: payload.ipAddress,
        source_cidr: payload.sourceCidr,
        interface_name: payload.interfaceName,
        policy_id: payload.policyId,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toIspRoutingRule(data);
  },

  async removeRoutingRule(id: string): Promise<void> {
    const orgId = await resolveOrganizationId();
    await api.delete(`/isp-routing/rules/${id}`, { headers: { "X-Organization-Id": orgId } });
  },
};
