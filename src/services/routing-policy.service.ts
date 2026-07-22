import {
  createPolicyWithRules,
  deactivatePolicy,
  listPolicyDetails,
  statusOf,
  updatePolicyRules,
  type BackendPolicyDetail,
} from "@/services/policy-engine";
import type {
  RoutingPolicy,
  RoutingPolicyKpis,
  SaveRoutingPolicyInput,
} from "@/types/routing-policy";

const POLICY_TYPE = "routing";

function toRoutingPolicy(detail: BackendPolicyDetail): RoutingPolicy {
  const version = [...detail.versions].sort((a, b) => b.version_number - a.version_number)[0];
  return {
    id: detail.id,
    name: detail.name,
    description: detail.description ?? undefined,
    status: statusOf(detail),
    rules: version?.rules ?? {},
    createdAt: new Date(detail.created_at).getTime(),
    updatedAt: new Date(detail.updated_at).getTime(),
  };
}

export const routingPolicyService = {
  async list(): Promise<RoutingPolicy[]> {
    const details = await listPolicyDetails(POLICY_TYPE);
    return details.map(toRoutingPolicy);
  },

  async kpis(): Promise<RoutingPolicyKpis> {
    const policies = await routingPolicyService.list();
    return {
      total: policies.length,
      active: policies.filter((p) => p.status === "active").length,
      draft: policies.filter((p) => p.status === "draft").length,
    };
  },

  async save(input: SaveRoutingPolicyInput): Promise<RoutingPolicy> {
    if (input.id) {
      const detail = await updatePolicyRules({
        id: input.id,
        rules: input.rules,
        publish: input.status !== "draft",
        archive: input.status === "archived",
      });
      return toRoutingPolicy(detail);
    }
    const detail = await createPolicyWithRules({
      policyType: POLICY_TYPE,
      name: input.name,
      description: input.description ?? null,
      rules: input.rules,
      publish: input.status !== "draft",
    });
    return toRoutingPolicy(detail);
  },

  async remove(id: string): Promise<void> {
    await deactivatePolicy(id);
  },
};
