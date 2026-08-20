import { api } from "@/services/api";
import { provisioningService } from "@/services/provisioning.service";
import type { IspLink } from "@/types/isp";
import type { ProvisionJob } from "@/types/provisioning";
import type {
  FleetBasicWanApplyResult,
  FleetBasicWanPreview,
  FleetCompatibilityReport,
  FleetDiscoverResult,
  FleetRouterSnapshot,
  FleetWanInputDraft,
  FleetWanVerificationGate,
  FleetWanVerificationResult,
} from "@/types/router-fleet-wizard";

function orgHeaders(organizationId?: string) {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : {};
}

interface BackendCompatibilityCheck {
  name: string;
  status: string;
  detail: string;
}

interface BackendCompatibilityReport {
  overall: string;
  checks: BackendCompatibilityCheck[];
}

interface BackendInterfaceSnapshot {
  name: string;
  type: string | null;
  running: boolean | null;
  disabled: boolean | null;
  comment: string | null;
  is_wyfy_managed: boolean;
}

interface BackendBridgeSnapshot {
  name: string;
  comment: string | null;
  is_wyfy_managed: boolean;
  ports: string[];
}

interface BackendIpAddressSnapshot {
  address: string | null;
  interface: string | null;
  comment: string | null;
  is_wyfy_managed: boolean;
}

interface BackendRouterSnapshot {
  id: string;
  router_id: string;
  captured_at: string;
  status: string;
  model: string | null;
  routeros_version: string | null;
  architecture: string | null;
  total_memory_bytes: number | null;
  free_memory_bytes: number | null;
  interfaces: BackendInterfaceSnapshot[];
  bridges: BackendBridgeSnapshot[];
  ip_addresses: BackendIpAddressSnapshot[];
  error_detail: string | null;
}

interface BackendDiscoverResult {
  snapshot: BackendRouterSnapshot;
  compatibility: BackendCompatibilityReport;
}

interface BackendWanVerificationCheck {
  name: string;
  status: string;
  observed: string | null;
  expected: string | null;
  detail: string | null;
  duration_ms: number;
}

interface BackendWanLinkVerification {
  isp_link_id: string;
  slot: number;
  overall: string;
  checks: BackendWanVerificationCheck[];
}

interface BackendWanVerificationResult {
  router_id: string;
  run_group_id: string;
  gate_passes: boolean;
  links: BackendWanLinkVerification[];
}

interface BackendWanVerificationGate {
  router_id: string;
  passes: boolean;
  run_group_id: string | null;
  message: string | null;
}

interface BackendIspLink {
  id: string;
  router_id: string;
  provider_name: string;
  connection_mode: string;
  role: string;
  is_enabled: boolean;
  priority: number;
  interface: string | null;
  gateway_ip_address: string | null;
}

function toIspLink(l: BackendIspLink): IspLink {
  return {
    id: l.id,
    routerId: l.router_id,
    organizationId: "",
    locationId: "",
    providerName: l.provider_name,
    linkType: "other",
    connectionMode: l.connection_mode as IspLink["connectionMode"],
    role: l.role as IspLink["role"],
    isActiveUplink: false,
    autoFailback: true,
    isEnabled: l.is_enabled,
    priority: l.priority,
    interface: l.interface,
    gatewayIpAddress: l.gateway_ip_address,
    dnsPrimary: null,
    dnsSecondary: null,
    downloadBandwidthMbps: null,
    uploadBandwidthMbps: null,
    healthStatus: "unknown",
    healthStatusSource: "automated",
    unhealthySince: null,
    latencyMs: null,
    packetLossPercentage: null,
    currentDownloadMbps: null,
    currentUploadMbps: null,
    lastCheckedAt: null,
    consecutiveUnhealthyCount: 0,
    createdAt: "",
  };
}

interface BackendBasicWanPreview {
  router_id: string;
  rendered_content: string;
  wan_link_count: number;
}

interface BackendBasicWanApplyResult {
  version: { id: string };
  job: { id: string };
  wan_link_count: number;
}

function toCompatibility(c: BackendCompatibilityReport): FleetCompatibilityReport {
  return {
    overall: c.overall as FleetCompatibilityReport["overall"],
    checks: c.checks.map((check) => ({
      name: check.name,
      status: check.status as FleetCompatibilityReport["checks"][number]["status"],
      detail: check.detail,
    })),
  };
}

function toSnapshot(s: BackendRouterSnapshot): FleetRouterSnapshot {
  return {
    id: s.id,
    routerId: s.router_id,
    capturedAt: s.captured_at,
    status: s.status as FleetRouterSnapshot["status"],
    model: s.model,
    routerOsVersion: s.routeros_version,
    architecture: s.architecture,
    totalMemoryBytes: s.total_memory_bytes,
    freeMemoryBytes: s.free_memory_bytes,
    interfaces: s.interfaces.map((i) => ({
      name: i.name,
      type: i.type,
      running: i.running,
      disabled: i.disabled,
      comment: i.comment,
      isWyfyManaged: i.is_wyfy_managed,
    })),
    bridges: s.bridges.map((b) => ({
      name: b.name,
      comment: b.comment,
      isWyfyManaged: b.is_wyfy_managed,
      ports: b.ports,
    })),
    ipAddresses: s.ip_addresses.map((ip) => ({
      address: ip.address,
      interface: ip.interface,
      comment: ip.comment,
      isWyfyManaged: ip.is_wyfy_managed,
    })),
    errorDetail: s.error_detail,
  };
}

export const routerFleetWizardService = {
  async discover(routerId: string, organizationId?: string): Promise<FleetDiscoverResult> {
    const { data } = await api.post<BackendDiscoverResult>(
      `/routers/${routerId}/discover`,
      undefined,
      { ...orgHeaders(organizationId), params: { trigger: "wizard_discovery" } },
    );
    return {
      snapshot: toSnapshot(data.snapshot),
      compatibility: toCompatibility(data.compatibility),
    };
  },

  async getCompatibility(
    routerId: string,
    organizationId?: string,
  ): Promise<FleetCompatibilityReport> {
    const { data } = await api.get<BackendCompatibilityReport>(
      `/routers/${routerId}/compatibility`,
      orgHeaders(organizationId),
    );
    return toCompatibility(data);
  },

  async getLatestSnapshot(
    routerId: string,
    organizationId?: string,
  ): Promise<FleetRouterSnapshot | null> {
    const { data } = await api.get<{ snapshots: BackendRouterSnapshot[] }>(
      `/routers/${routerId}/snapshots`,
      { ...orgHeaders(organizationId), params: { limit: 1 } },
    );
    const row = data.snapshots[0];
    return row ? toSnapshot(row) : null;
  },

  async previewBasicWan(
    routerId: string,
    lanBridge = "bridge1",
    organizationId?: string,
  ): Promise<FleetBasicWanPreview> {
    const { data } = await api.get<BackendBasicWanPreview>(
      `/routers/${routerId}/wan/basic/preview`,
      { ...orgHeaders(organizationId), params: { lan_bridge: lanBridge } },
    );
    return {
      routerId: data.router_id,
      renderedContent: data.rendered_content,
      wanLinkCount: data.wan_link_count,
    };
  },

  async applyBasicWan(
    routerId: string,
    args: { lanBridge?: string; staticAddresses?: { linkId: string; staticAddress: string }[] },
    organizationId?: string,
  ): Promise<FleetBasicWanApplyResult> {
    const { data } = await api.post<BackendBasicWanApplyResult>(
      `/routers/${routerId}/wan/basic/apply`,
      {
        lan_bridge: args.lanBridge ?? "bridge1",
        static_addresses: (args.staticAddresses ?? []).map((s) => ({
          link_id: s.linkId,
          static_address: s.staticAddress,
        })),
      },
      orgHeaders(organizationId),
    );
    return {
      versionId: data.version.id,
      jobId: data.job.id,
      wanLinkCount: data.wan_link_count,
    };
  },

  async verifyWan(routerId: string, organizationId?: string): Promise<FleetWanVerificationResult> {
    const { data } = await api.post<BackendWanVerificationResult>(
      `/routers/${routerId}/verify/wan`,
      undefined,
      orgHeaders(organizationId),
    );
    return {
      routerId: data.router_id,
      runGroupId: data.run_group_id,
      gatePasses: data.gate_passes,
      links: data.links.map((link) => ({
        ispLinkId: link.isp_link_id,
        slot: link.slot,
        overall: link.overall as FleetWanVerificationResult["links"][number]["overall"],
        checks: link.checks.map((c) => ({
          name: c.name,
          status: c.status,
          observed: c.observed,
          expected: c.expected,
          detail: c.detail,
          durationMs: c.duration_ms,
        })),
      })),
    };
  },

  async getWanVerificationGate(
    routerId: string,
    organizationId?: string,
  ): Promise<FleetWanVerificationGate> {
    const { data } = await api.get<BackendWanVerificationGate>(
      `/routers/${routerId}/verify/wan/gate`,
      orgHeaders(organizationId),
    );
    return {
      routerId: data.router_id,
      passes: data.passes,
      runGroupId: data.run_group_id,
      message: data.message,
    };
  },

  getProvisionJob(jobId: string): Promise<ProvisionJob> {
    return provisioningService.getJob(jobId);
  },

  async listIspLinks(routerId: string, organizationId: string): Promise<IspLink[]> {
    const { data } = await api.get<{ items: BackendIspLink[] }>("/isp/links", {
      params: { router_id: routerId, page: 1, page_size: 25 },
      headers: { "X-Organization-Id": organizationId },
    });
    return data.items.map(toIspLink);
  },

  async syncWanLinks(
    routerId: string,
    organizationId: string,
    drafts: FleetWanInputDraft[],
  ): Promise<IspLink[]> {
    const existing = await this.listIspLinks(routerId, organizationId);
    const enabled = drafts.filter((d) => d.isEnabled && d.interface.trim());
    const results: IspLink[] = [];

    for (let i = 0; i < enabled.length; i++) {
      const draft = enabled[i];
      const payload = {
        router_id: routerId,
        provider_name: draft.providerName || `WAN ${i + 1}`,
        link_type: "other",
        connection_mode: draft.connectionMode,
        role: draft.role,
        priority: i,
        interface: draft.interface,
        gateway_ip_address: draft.gatewayIpAddress || null,
        auto_failback: true,
      };
      const match = existing[i];
      if (match) {
        const { data } = await api.put<BackendIspLink>(`/isp/links/${match.id}`, payload, {
          headers: { "X-Organization-Id": organizationId },
        });
        results.push(toIspLink(data));
      } else {
        const { data } = await api.post<BackendIspLink>("/isp/links", payload, {
          headers: { "X-Organization-Id": organizationId },
        });
        results.push(toIspLink(data));
      }
    }

    return results;
  },
};
