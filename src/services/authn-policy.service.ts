import {
  createPolicyWithRules,
  deactivatePolicy,
  listPolicyDetails,
  statusOf,
  updatePolicyRules,
  type BackendPolicyDetail,
} from "@/services/policy-engine";
import type { AuthnPolicy, AuthnPolicyKpis, SaveAuthnPolicyInput } from "@/types/authn-policy";

const POLICY_TYPE = "authn";

interface AuthnRules {
  max_attempts_per_window: number;
  window_minutes: number;
}

function toAuthnPolicy(detail: BackendPolicyDetail): AuthnPolicy {
  const version = [...detail.versions].sort((a, b) => b.version_number - a.version_number)[0];
  const rules = (version?.rules ?? {}) as Partial<AuthnRules>;
  return {
    id: detail.id,
    name: detail.name,
    description: detail.description ?? undefined,
    status: statusOf(detail),
    maxAttemptsPerWindow: rules.max_attempts_per_window ?? 30,
    windowMinutes: rules.window_minutes ?? 1,
    createdAt: new Date(detail.created_at).getTime(),
    updatedAt: new Date(detail.updated_at).getTime(),
  };
}

function toRules(input: SaveAuthnPolicyInput): AuthnRules {
  return {
    max_attempts_per_window: input.maxAttemptsPerWindow,
    window_minutes: input.windowMinutes,
  };
}

export const authnPolicyService = {
  async list(): Promise<AuthnPolicy[]> {
    const details = await listPolicyDetails(POLICY_TYPE);
    return details.map(toAuthnPolicy);
  },

  async kpis(): Promise<AuthnPolicyKpis> {
    const policies = await authnPolicyService.list();
    return {
      total: policies.length,
      active: policies.filter((p) => p.status === "active").length,
      draft: policies.filter((p) => p.status === "draft").length,
    };
  },

  async save(input: SaveAuthnPolicyInput): Promise<AuthnPolicy> {
    if (input.id) {
      const detail = await updatePolicyRules({
        id: input.id,
        rules: toRules(input),
        publish: input.status !== "draft",
        archive: input.status === "archived",
      });
      return toAuthnPolicy(detail);
    }
    const detail = await createPolicyWithRules({
      policyType: POLICY_TYPE,
      name: input.name,
      description: input.description ?? null,
      rules: toRules(input),
      publish: input.status !== "draft",
    });
    return toAuthnPolicy(detail);
  },

  async remove(id: string): Promise<void> {
    // No hard delete on the backend -- deactivate is the real equivalent.
    await deactivatePolicy(id);
  },
};
