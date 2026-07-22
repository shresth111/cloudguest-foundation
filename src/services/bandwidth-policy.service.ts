import {
  createPolicyWithRules,
  deactivatePolicy,
  listPolicyDetails,
  statusOf,
  updatePolicyRules,
  type BackendPolicyDetail,
} from "@/services/policy-engine";
import type {
  BandwidthPolicy,
  BandwidthPolicyKpis,
  SaveBandwidthPolicyInput,
} from "@/types/bandwidth-policy";

const POLICY_TYPE = "bandwidth";

interface BandwidthRules {
  download_rate_kbps: number;
  upload_rate_kbps: number;
  burst_download_kbps?: number | null;
  burst_upload_kbps?: number | null;
  burst_threshold_kbps?: number | null;
  burst_time_seconds?: number | null;
  priority?: number | null;
}

function toBandwidthPolicy(detail: BackendPolicyDetail): BandwidthPolicy {
  const version = [...detail.versions].sort((a, b) => b.version_number - a.version_number)[0];
  const rules = (version?.rules ?? {}) as Partial<BandwidthRules>;
  return {
    id: detail.id,
    name: detail.name,
    description: detail.description ?? undefined,
    status: statusOf(detail),
    downloadRateKbps: rules.download_rate_kbps ?? 0,
    uploadRateKbps: rules.upload_rate_kbps ?? 0,
    burstDownloadKbps: rules.burst_download_kbps ?? undefined,
    burstUploadKbps: rules.burst_upload_kbps ?? undefined,
    burstThresholdKbps: rules.burst_threshold_kbps ?? undefined,
    burstTimeSeconds: rules.burst_time_seconds ?? undefined,
    priority: rules.priority ?? undefined,
    createdAt: new Date(detail.created_at).getTime(),
    updatedAt: new Date(detail.updated_at).getTime(),
  };
}

function toRules(input: SaveBandwidthPolicyInput): BandwidthRules {
  return {
    download_rate_kbps: input.downloadRateKbps,
    upload_rate_kbps: input.uploadRateKbps,
    burst_download_kbps: input.burstDownloadKbps ?? null,
    burst_upload_kbps: input.burstUploadKbps ?? null,
    burst_threshold_kbps: input.burstThresholdKbps ?? null,
    burst_time_seconds: input.burstTimeSeconds ?? null,
    priority: input.priority ?? null,
  };
}

export const bandwidthPolicyService = {
  async list(): Promise<BandwidthPolicy[]> {
    const details = await listPolicyDetails(POLICY_TYPE);
    return details.map(toBandwidthPolicy);
  },

  async kpis(): Promise<BandwidthPolicyKpis> {
    const policies = await bandwidthPolicyService.list();
    return {
      total: policies.length,
      active: policies.filter((p) => p.status === "active").length,
      draft: policies.filter((p) => p.status === "draft").length,
    };
  },

  async save(input: SaveBandwidthPolicyInput): Promise<BandwidthPolicy> {
    if (input.id) {
      const detail = await updatePolicyRules({
        id: input.id,
        rules: toRules(input),
        publish: input.status !== "draft",
        archive: input.status === "archived",
      });
      return toBandwidthPolicy(detail);
    }
    const detail = await createPolicyWithRules({
      policyType: POLICY_TYPE,
      name: input.name,
      description: input.description ?? null,
      rules: toRules(input),
      publish: input.status !== "draft",
    });
    return toBandwidthPolicy(detail);
  },

  async remove(id: string): Promise<void> {
    await deactivatePolicy(id);
  },
};
