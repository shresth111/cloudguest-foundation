import { api } from "@/services/api";
import { provisioningService } from "@/services/provisioning.service";
import type { IspLink } from "@/types/isp";
import type { ProvisionJob } from "@/types/provisioning";
import type {
  FleetBasicWanApplyResult,
  FleetBasicWanPreview,
  FleetBootstrapMode,
  FleetBootstrapScriptPreview,
  FleetCompatibilityReport,
  FleetConfigurationPlan,
  FleetDiscoverResult,
  FleetFinalVerificationResult,
  FleetGuestInterfaceAvailabilityResult,
  FleetGuestNetworkRequest,
  FleetPlanApplyResult,
  FleetPlanPrepareResult,
  FleetPlanRenderResult,
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

interface BackendBootstrapScriptPreview {
  router_id: string;
  location_code: string;
  mode: string;
  revert_window_minutes: number | null;
  lines: string[];
  script: string;
  line_count: number;
  token_expires_at: string;
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

function toGuestNetworkRequest(body: {
  guest_interfaces: string[];
  vlan_mode: boolean;
  vlans: Array<{
    vlan_id: number;
    name: string;
    subnet_cidr: string;
    enable_hotspot: boolean;
  }>;
  parent_bridge: string | null;
}): FleetGuestNetworkRequest {
  return {
    guestInterfaces: body.guest_interfaces,
    vlanMode: body.vlan_mode,
    vlans: body.vlans.map((v) => ({
      vlanId: v.vlan_id,
      name: v.name,
      subnetCidr: v.subnet_cidr,
      enableHotspot: v.enable_hotspot,
    })),
    parentBridge: body.parent_bridge,
  };
}

function guestNetworkPayload(request: FleetGuestNetworkRequest) {
  return {
    guest_interfaces: request.guestInterfaces,
    vlan_mode: request.vlanMode,
    vlans: request.vlans.map((v) => ({
      vlan_id: v.vlanId,
      name: v.name,
      subnet_cidr: v.subnetCidr,
      enable_hotspot: v.enableHotspot,
    })),
    parent_bridge: request.parentBridge,
  };
}

interface BackendGuestAvailabilityResponse {
  router_id: string;
  snapshot_id: string;
  interfaces: Array<{
    name: string;
    status: string;
    detail: string | null;
    bridge: string | null;
  }>;
  recommendation: {
    recommended_interfaces: string[];
    parent_bridge_hint: string | null;
    message: string | null;
  };
}

interface BackendPlanConflict {
  code: string;
  status: string;
  summary: string;
  detail: string | null;
  cidrs: string[];
}

interface BackendPlanAction {
  seq: number;
  rule_id: string;
  action_type: string;
  resource_kind: string;
  routeros_path: string;
  resource_ref: string;
  summary: string;
  risk: string;
}

interface BackendConfigurationPlan {
  id: string;
  router_id: string;
  snapshot_id: string;
  status: string;
  engine_version: string;
  requested_config: {
    guest_interfaces: string[];
    vlan_mode: boolean;
    vlans: Array<{
      vlan_id: number;
      name: string;
      subnet_cidr: string;
      enable_hotspot: boolean;
    }>;
    parent_bridge: string | null;
  };
  actions: BackendPlanAction[];
  conflicts: BackendPlanConflict[];
  decisions: Array<{
    code: string;
    summary: string;
    detail: string | null;
    options: string[];
  }>;
  summary: {
    action_count: number;
    conflict_count: number;
    decision_count: number;
    highest_risk: string;
  };
}

function toPlan(plan: BackendConfigurationPlan): FleetConfigurationPlan {
  return {
    id: plan.id,
    routerId: plan.router_id,
    snapshotId: plan.snapshot_id,
    status: plan.status as FleetConfigurationPlan["status"],
    engineVersion: plan.engine_version,
    requestedConfig: toGuestNetworkRequest(plan.requested_config),
    actions: plan.actions.map((a) => ({
      seq: a.seq,
      ruleId: a.rule_id,
      actionType: a.action_type,
      resourceKind: a.resource_kind,
      routerosPath: a.routeros_path,
      resourceRef: a.resource_ref,
      summary: a.summary,
      risk: a.risk as FleetConfigurationPlan["actions"][number]["risk"],
    })),
    conflicts: plan.conflicts.map((c) => ({
      code: c.code,
      status: c.status as FleetConfigurationPlan["conflicts"][number]["status"],
      summary: c.summary,
      detail: c.detail,
      cidrs: c.cidrs,
    })),
    decisions: plan.decisions.map((d) => ({
      code: d.code,
      summary: d.summary,
      detail: d.detail,
      options: d.options,
    })),
    summary: {
      actionCount: plan.summary.action_count,
      conflictCount: plan.summary.conflict_count,
      decisionCount: plan.summary.decision_count,
      highestRisk: plan.summary.highest_risk as FleetConfigurationPlan["summary"]["highestRisk"],
    },
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
  async previewBootstrap(
    routerId: string,
    mode: FleetBootstrapMode,
    organizationId?: string,
  ): Promise<FleetBootstrapScriptPreview> {
    const { data } = await api.get<BackendBootstrapScriptPreview>(
      `/routers/${routerId}/bootstrap/preview`,
      { ...orgHeaders(organizationId), params: { mode } },
    );
    return {
      routerId: data.router_id,
      locationCode: data.location_code,
      // Trust the server's echo over the requested value -- the script text
      // must never be shown under a mode it was not rendered for.
      mode: data.mode === "remote" ? "remote" : "onsite",
      revertWindowMinutes: data.revert_window_minutes,
      lines: data.lines,
      script: data.script,
      lineCount: data.line_count,
      tokenExpiresAt: data.token_expires_at,
    };
  },

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

  async getGuestInterfaceAvailability(
    routerId: string,
    organizationId?: string,
  ): Promise<FleetGuestInterfaceAvailabilityResult> {
    const { data } = await api.get<BackendGuestAvailabilityResponse>(
      `/routers/${routerId}/guest/interfaces/availability`,
      orgHeaders(organizationId),
    );
    return {
      routerId: data.router_id,
      snapshotId: data.snapshot_id,
      interfaces: data.interfaces.map((i) => ({
        name: i.name,
        status: i.status as FleetGuestInterfaceAvailabilityResult["interfaces"][number]["status"],
        detail: i.detail,
        bridge: i.bridge,
      })),
      recommendation: {
        recommendedInterfaces: data.recommendation.recommended_interfaces,
        parentBridgeHint: data.recommendation.parent_bridge_hint,
        message: data.recommendation.message,
      },
    };
  },

  async buildConfigurationPlan(
    routerId: string,
    requestedConfig: FleetGuestNetworkRequest,
    organizationId?: string,
    snapshotId?: string,
  ): Promise<FleetConfigurationPlan> {
    const { data } = await api.post<BackendConfigurationPlan>(
      `/routers/${routerId}/plans`,
      { requested_config: guestNetworkPayload(requestedConfig) },
      {
        ...orgHeaders(organizationId),
        params: snapshotId ? { snapshot_id: snapshotId } : undefined,
      },
    );
    return toPlan(data);
  },

  async getConfigurationPlan(
    routerId: string,
    planId: string,
    organizationId?: string,
  ): Promise<FleetConfigurationPlan> {
    const { data } = await api.get<BackendConfigurationPlan>(
      `/routers/${routerId}/plans/${planId}`,
      orgHeaders(organizationId),
    );
    return toPlan(data);
  },

  async approveConfigurationPlan(
    routerId: string,
    planId: string,
    organizationId?: string,
  ): Promise<FleetConfigurationPlan> {
    const { data } = await api.post<BackendConfigurationPlan>(
      `/routers/${routerId}/plans/${planId}/approve`,
      undefined,
      orgHeaders(organizationId),
    );
    return toPlan(data);
  },

  async renderConfigurationPlan(
    routerId: string,
    planId: string,
    organizationId?: string,
  ): Promise<FleetPlanRenderResult> {
    const { data } = await api.post<{
      plan_id: string;
      config_version_id: string;
      config_version_number: number;
      status: string;
      profiles_used: string[];
      secret_refs: string[];
      line_count: number;
      requires_safety_net: boolean;
    }>(`/routers/${routerId}/plans/${planId}/render`, undefined, orgHeaders(organizationId));
    return {
      planId: data.plan_id,
      configVersionId: data.config_version_id,
      configVersionNumber: data.config_version_number,
      status: data.status as FleetPlanRenderResult["status"],
      profilesUsed: data.profiles_used,
      secretRefs: data.secret_refs,
      lineCount: data.line_count,
      requiresSafetyNet: data.requires_safety_net,
    };
  },

  async prepareConfigurationPlan(
    routerId: string,
    planId: string,
    organizationId?: string,
  ): Promise<FleetPlanPrepareResult> {
    const { data } = await api.post<{
      plan_id: string;
      pre_apply_backup_version_id: string;
      pre_apply_backup_version_number: number;
      status: string;
      requires_safety_net: boolean;
    }>(`/routers/${routerId}/plans/${planId}/prepare`, undefined, orgHeaders(organizationId));
    return {
      planId: data.plan_id,
      preApplyBackupVersionId: data.pre_apply_backup_version_id,
      preApplyBackupVersionNumber: data.pre_apply_backup_version_number,
      status: data.status as FleetPlanPrepareResult["status"],
      requiresSafetyNet: data.requires_safety_net,
    };
  },

  async applyConfigurationPlan(
    routerId: string,
    planId: string,
    organizationId?: string,
  ): Promise<FleetPlanApplyResult> {
    const { data } = await api.post<{
      plan_id: string;
      config_version_id: string;
      provisioning_job_id: string;
      status: string;
      config_version_status: string;
    }>(`/routers/${routerId}/plans/${planId}/apply`, undefined, orgHeaders(organizationId));
    return {
      planId: data.plan_id,
      configVersionId: data.config_version_id,
      provisioningJobId: data.provisioning_job_id,
      status: data.status as FleetPlanApplyResult["status"],
      configVersionStatus: data.config_version_status,
    };
  },

  async verifyPlanFinal(
    routerId: string,
    planId: string,
    organizationId?: string,
  ): Promise<FleetFinalVerificationResult> {
    const { data } = await api.post<{
      plan_id: string;
      verification_run_id: string;
      overall: string;
      checks: BackendWanVerificationCheck[];
      checklist: {
        total: number;
        passing: number;
        failing: number;
        not_checked: number;
      };
      safety_net_removed: boolean;
    }>(`/routers/${routerId}/plans/${planId}/verify/final`, undefined, orgHeaders(organizationId));
    return {
      planId: data.plan_id,
      verificationRunId: data.verification_run_id,
      overall: data.overall as FleetFinalVerificationResult["overall"],
      checks: data.checks.map((c) => ({
        name: c.name,
        status: c.status,
        observed: c.observed,
        expected: c.expected,
        detail: c.detail,
        durationMs: c.duration_ms,
      })),
      checklist: {
        total: data.checklist.total,
        passing: data.checklist.passing,
        failing: data.checklist.failing,
        notChecked: data.checklist.not_checked,
      },
      safetyNetRemoved: data.safety_net_removed,
    };
  },
};
