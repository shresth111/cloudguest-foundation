import { api } from "@/services/api";
import type {
  ConfigVersion,
  ConfigVersionApplyResult,
  ConfigVersionDiff,
  ConfigVersionListResult,
  ConfigVersionSummary,
  NetworkConfigPreview,
} from "@/types/network-config";

interface BackendPreview {
  router_id: string;
  rendered_content: string;
  dhcp_pool_count: number;
  vlan_count: number;
  port_forwarding_rule_count: number;
  hotspot_profile_count: number;
  qos_traffic_rule_count: number;
  dns_record_count: number;
  firewall_rule_count: number;
}

interface BackendVersionSummary {
  id: string;
  router_id: string;
  profile_id: string | null;
  version_number: number;
  status: string;
  is_backup: boolean;
  rollback_of_version_id: string | null;
  applied_at: string | null;
  created_at: string;
}

interface BackendVersion extends BackendVersionSummary {
  rendered_content: string;
}

interface BackendVersionListResponse {
  items: BackendVersionSummary[];
  total_items: number;
  total_pages: number;
}

interface BackendDiff {
  from_version_id: string;
  from_version_number: number;
  to_version_id: string;
  to_version_number: number;
  diff_lines: string[];
}

interface BackendApplyResult {
  version: BackendVersion;
  job: { id: string; status: string };
}

function toPreview(p: BackendPreview): NetworkConfigPreview {
  return {
    routerId: p.router_id,
    renderedContent: p.rendered_content,
    dhcpPoolCount: p.dhcp_pool_count,
    vlanCount: p.vlan_count,
    portForwardingRuleCount: p.port_forwarding_rule_count,
    hotspotProfileCount: p.hotspot_profile_count,
    qosTrafficRuleCount: p.qos_traffic_rule_count,
    dnsRecordCount: p.dns_record_count,
    firewallRuleCount: p.firewall_rule_count,
  };
}

function toVersionSummary(v: BackendVersionSummary): ConfigVersionSummary {
  return {
    id: v.id,
    routerId: v.router_id,
    profileId: v.profile_id,
    versionNumber: v.version_number,
    status: v.status,
    isBackup: v.is_backup,
    rollbackOfVersionId: v.rollback_of_version_id,
    appliedAt: v.applied_at,
    createdAt: v.created_at,
  };
}

function toVersion(v: BackendVersion): ConfigVersion {
  return { ...toVersionSummary(v), renderedContent: v.rendered_content };
}

// Router-scoped calls omit X-Organization-Id, matching router.service.ts's
// real WireGuard peer calls -- see connected-device.service.ts's comment.
export const networkConfigService = {
  async preview(routerId: string): Promise<NetworkConfigPreview> {
    const { data } = await api.get<BackendPreview>(`/network-config/routers/${routerId}/preview`);
    return toPreview(data);
  },

  async push(routerId: string): Promise<ConfigVersionApplyResult> {
    const { data } = await api.post<BackendApplyResult>(
      `/network-config/routers/${routerId}/push`,
    );
    return { version: toVersion(data.version), job: data.job };
  },

  async listVersions(routerId: string, page = 1, pageSize = 25): Promise<ConfigVersionListResult> {
    const { data } = await api.get<BackendVersionListResponse>(
      `/network-config/routers/${routerId}/versions`,
      { params: { page, page_size: pageSize } },
    );
    return {
      rows: data.items.map(toVersionSummary),
      total: data.total_items,
      totalPages: data.total_pages,
    };
  },

  async getVersion(routerId: string, versionId: string): Promise<ConfigVersion> {
    const { data } = await api.get<BackendVersion>(
      `/network-config/routers/${routerId}/versions/${versionId}`,
    );
    return toVersion(data);
  },

  async diffVersions(
    routerId: string,
    versionId: string,
    otherVersionId: string,
  ): Promise<ConfigVersionDiff> {
    const { data } = await api.get<BackendDiff>(
      `/network-config/routers/${routerId}/versions/${versionId}/diff/${otherVersionId}`,
    );
    return {
      fromVersionId: data.from_version_id,
      fromVersionNumber: data.from_version_number,
      toVersionId: data.to_version_id,
      toVersionNumber: data.to_version_number,
      diffLines: data.diff_lines,
    };
  },

  async rollback(routerId: string, targetVersionId: string): Promise<ConfigVersionApplyResult> {
    const { data } = await api.post<BackendApplyResult>(
      `/network-config/routers/${routerId}/versions/${targetVersionId}/rollback`,
    );
    return { version: toVersion(data.version), job: data.job };
  },
};
