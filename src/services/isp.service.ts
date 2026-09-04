import { api } from "@/services/api";
import { resolveOrganizationId as sharedResolveOrganizationId } from "./organization-id";
import type {
  CreateIspLinkPayload,
  CreateIspRoutingRulePayload,
  IspConnectionMode,
  IspHealthCheck,
  IspHealthCheckBucket,
  IspHealthCheckListQuery,
  IspHealthCheckListResult,
  IspHealthCheckSummary,
  IspLink,
  IspLinkListQuery,
  IspLinkListResult,
  IspLinkRole,
  IspManualHealthStatus,
  IspRoutingRule,
  IspRoutingRuleListQuery,
  IspRoutingRuleListResult,
  IspRoutingRuleType,
  IspSpeedTestResult,
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
async function resolveOrganizationId(): Promise<string> {
  // Delegates to the one shared resolver. This used to hold its own
  // module cache and issue its own `/me/organizations`, which is why a
  // single page load fetched that endpoint once per active service.
  // See services/organization-id.ts.
  return sharedResolveOrganizationId();
}

interface BackendIspLink {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  provider_name: string;
  link_type: string;
  connection_mode: string;
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
  health_status_source: string;
  unhealthy_since: string | null;
  latency_ms: number | null;
  packet_loss_percentage: number | null;
  current_download_mbps: number | null;
  current_upload_mbps: number | null;
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
    connectionMode: l.connection_mode as IspConnectionMode,
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
    healthStatusSource: l.health_status_source,
    unhealthySince: l.unhealthy_since,
    latencyMs: l.latency_ms,
    packetLossPercentage: l.packet_loss_percentage,
    currentDownloadMbps: l.current_download_mbps,
    currentUploadMbps: l.current_upload_mbps,
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
  source: string;
  latency_ms: number | null;
  packet_loss_percentage: number | null;
  error_message: string | null;
  download_mbps: number | null;
  upload_mbps: number | null;
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

interface BackendIspHealthCheckBucket {
  bucket_start: string;
  total_checks: number;
  healthy_count: number;
  degraded_count: number;
  unhealthy_count: number;
  uptime_percentage: number | null;
  avg_latency_ms: number | null;
  avg_packet_loss_percentage: number | null;
  avg_download_mbps: number | null;
  avg_upload_mbps: number | null;
  max_download_mbps: number | null;
}

interface BackendIspHealthCheckSummaryResponse {
  bucket_unit: "hour" | "day";
  start: string;
  end: string;
  buckets: BackendIspHealthCheckBucket[];
}

interface BackendIspSpeedTestResponse {
  isp_link_id: string;
  tested_at: string;
  download_mbps: number;
  upload_mbps: number | null;
  latency_ms: number | null;
  packet_loss_percentage: number | null;
  downloaded_bytes: number;
  duration_seconds: number;
}

function toIspSpeedTestResult(r: BackendIspSpeedTestResponse): IspSpeedTestResult {
  return {
    ispLinkId: r.isp_link_id,
    testedAt: r.tested_at,
    downloadMbps: r.download_mbps,
    uploadMbps: r.upload_mbps,
    latencyMs: r.latency_ms,
    packetLossPercentage: r.packet_loss_percentage,
    downloadedBytes: r.downloaded_bytes,
    durationSeconds: r.duration_seconds,
  };
}

function toIspHealthCheckBucket(b: BackendIspHealthCheckBucket): IspHealthCheckBucket {
  return {
    bucketStart: b.bucket_start,
    totalChecks: b.total_checks,
    healthyCount: b.healthy_count,
    degradedCount: b.degraded_count,
    unhealthyCount: b.unhealthy_count,
    uptimePercentage: b.uptime_percentage,
    avgLatencyMs: b.avg_latency_ms,
    avgPacketLossPercentage: b.avg_packet_loss_percentage,
    avgDownloadMbps: b.avg_download_mbps,
    avgUploadMbps: b.avg_upload_mbps,
    maxDownloadMbps: b.max_download_mbps,
  };
}

function toIspHealthCheck(h: BackendIspHealthCheck): IspHealthCheck {
  return {
    id: h.id,
    ispLinkId: h.isp_link_id,
    checkedAt: h.checked_at,
    status: h.status,
    source: h.source,
    latencyMs: h.latency_ms,
    packetLossPercentage: h.packet_loss_percentage,
    errorMessage: h.error_message,
    downloadMbps: h.download_mbps,
    uploadMbps: h.upload_mbps,
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

async function fetchLinks(q: IspLinkListQuery): Promise<IspLinkListResult> {
  const orgId = await resolveOrganizationId();
  const { data } = await api.get<BackendIspLinkListResponse>("/isp/links", {
    params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
    headers: q.locationId
      ? { "X-Organization-Id": orgId, "X-Location-Id": q.locationId }
      : { "X-Organization-Id": orgId },
  });
  return {
    rows: data.items.map(toIspLink),
    total: data.total_items,
    totalPages: data.total_pages,
    hasNext: data.has_next,
    hasPrevious: data.has_previous,
  };
}

/** Requests currently in flight, keyed by the exact query they encode.
 *
 * The customer dashboard mounts `useWanSummary` and `useBandwidthSeries`
 * side by side, and each runs its own effect issuing a byte-identical
 * `listLinks({ page: 1, pageSize: 100, locationId })`. Both hooks
 * deliberately fetch independently -- their own comments defend that, so
 * one card keeps working if the other's shape changes -- and neither goes
 * through React Query, so nothing deduplicates them. The result was two
 * identical `GET /isp/links` on every dashboard load, which is what a live
 * network capture showed.
 *
 * This shares the *in-flight* promise only, never a settled result. Two
 * callers that ask at the same moment get one request; a caller that asks
 * later gets a fresh one. So the independence the hooks rely on is intact
 * and there is no cache to go stale -- the same single-flight shape
 * `services/organization-id.ts` already uses for `/me/organizations`.
 */
const linksInFlight = new Map<string, Promise<IspLinkListResult>>();

export const ispService = {
  listLinks(q: IspLinkListQuery): Promise<IspLinkListResult> {
    // Every field the request actually varies on. `routerId`/`locationId`
    // are `undefined` for the unscoped operator view, which must not
    // collide with a location-scoped read.
    const key = JSON.stringify([q.routerId, q.locationId, q.page, q.pageSize]);
    const existing = linksInFlight.get(key);
    if (existing) return existing;

    const request = fetchLinks(q).finally(() => {
      linksInFlight.delete(key);
    });
    linksInFlight.set(key, request);
    return request;
  },

  async createLink(payload: CreateIspLinkPayload): Promise<IspLink> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspLink>(
      "/isp/links",
      {
        router_id: payload.routerId,
        provider_name: payload.providerName,
        link_type: payload.linkType ?? "other",
        connection_mode: payload.connectionMode ?? "static",
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
        connection_mode: payload.connectionMode,
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
    const { data } = await api.post<BackendIspLink>(`/isp/links/${id}/check-health`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toIspLink(data);
  },

  // A real, on-demand, multi-second action -- a genuine RouterOS
  // /tool/fetch download against the link's own router, not a quick read
  // (see backend IspService.run_speed_test's own docstring). The default
  // 20s client-side timeout (api.ts) is nowhere near enough for the
  // backend's own up-to-60s budget on a slow real WAN link, so this call
  // gets its own, much longer timeout instead.
  async runSpeedTest(id: string): Promise<IspSpeedTestResult> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspSpeedTestResponse>(
      `/isp/links/${id}/speed-test`,
      undefined,
      { headers: { "X-Organization-Id": orgId }, timeout: 75_000 },
    );
    return toIspSpeedTestResult(data);
  },

  // An admin's own manual up/down override of a link's current status --
  // the "Internet Connection" view's one real write. Never pushes
  // anything to the router itself (see backend
  // IspService.set_manual_health_status's own docstring); it only
  // records what an admin has told the platform is true right now,
  // persisted exactly like a real health-check reading.
  async setManualStatus(
    id: string,
    healthStatus: IspManualHealthStatus,
    reason?: string,
  ): Promise<IspLink> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendIspLink>(
      `/isp/links/${id}/status`,
      { health_status: healthStatus, reason: reason || undefined },
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
        params: {
          page: q.page ?? 1,
          page_size: q.pageSize ?? 10,
          start_date: q.startDate,
          end_date: q.endDate,
        },
        headers: q.locationId
          ? { "X-Organization-Id": orgId, "X-Location-Id": q.locationId }
          : { "X-Organization-Id": orgId },
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

  // Backs the history dialog's "Last 24 hours / 7 days / 30 days" uptime
  // chart -- real SQL-side time-bucketed aggregation
  // (backend IspService.get_health_check_summary), never individual
  // rows, so a 30-day window at the sweep's real 60-second cadence (~43k
  // rows per link) comes back as ~30 aggregated buckets instead.
  async getHealthCheckSummary(
    linkId: string,
    range: { startDate: string; endDate: string },
  ): Promise<IspHealthCheckSummary> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendIspHealthCheckSummaryResponse>(
      `/isp/links/${linkId}/health-checks/summary`,
      {
        params: { start_date: range.startDate, end_date: range.endDate },
        headers: { "X-Organization-Id": orgId },
      },
    );
    return {
      bucketUnit: data.bucket_unit,
      start: data.start,
      end: data.end,
      buckets: data.buckets.map(toIspHealthCheckBucket),
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

  async updateRoutingRule(
    id: string,
    payload: UpdateIspRoutingRulePayload,
  ): Promise<IspRoutingRule> {
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
