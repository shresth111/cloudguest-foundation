import type { AuthMethod, Policy, PolicyKpis, PolicyScope, PolicyStatus } from "@/types/policy";
import {
  createPolicyWithRules,
  deactivatePolicy,
  fetchPolicyDetail,
  latestVersion,
  listPolicyDetails,
  statusOf,
  updatePolicyRules,
  type BackendPolicyDetail,
} from "@/services/policy-engine";

// PolicyType.ACCESS is backend's generic, dependency-free policy type --
// GenericPolicyRules accepts any JSON object with no typed schema (see
// backend/app/domains/policy/constants.py's module docstring). The full
// composite Policy shape this UI edits (bandwidth/quota/device/authMethods/
// timeWindow/targets) has no dedicated backend type of its own, so it is
// persisted whole as one version's `rules` blob under this type. The
// create->version->publish->deactivate plumbing itself lives in
// policy-engine.ts, shared with authn-policy.service.ts/
// bandwidth-policy.service.ts/routing-policy.service.ts -- this file only
// owns the composite rules mapping specific to PolicyType.ACCESS.
const POLICY_TYPE = "access";

type PolicyRules = Pick<
  Policy,
  | "scope"
  | "priority"
  | "bandwidth"
  | "quota"
  | "device"
  | "authMethods"
  | "timeWindow"
  | "locationIds"
  | "userIds"
  | "groupIds"
  | "vlanIds"
>;

function toPolicy(detail: BackendPolicyDetail): Policy {
  const version = latestVersion(detail);
  const rules = (version?.rules ?? {}) as Partial<PolicyRules>;
  const status: PolicyStatus = statusOf(detail);
  return {
    id: detail.id,
    scope: rules.scope ?? "location",
    name: detail.name,
    description: detail.description ?? undefined,
    status,
    priority: rules.priority ?? 0,
    bandwidth: rules.bandwidth ?? { downloadKbps: 0, uploadKbps: 0 },
    quota: rules.quota ?? {},
    device: rules.device ?? { maxDevicesPerGuest: 0, allowBYOD: false, blockedOSes: [] },
    authMethods: (rules.authMethods ?? []) as AuthMethod[],
    timeWindow: rules.timeWindow,
    locationIds: rules.locationIds ?? [],
    userIds: rules.userIds ?? [],
    groupIds: rules.groupIds ?? [],
    vlanIds: rules.vlanIds ?? [],
    createdAt: new Date(detail.created_at).getTime(),
    updatedAt: new Date(detail.updated_at).getTime(),
  };
}

function toRules(input: PolicyRules): PolicyRules {
  return {
    scope: input.scope,
    priority: input.priority,
    bandwidth: input.bandwidth,
    quota: input.quota,
    device: input.device,
    authMethods: input.authMethods,
    timeWindow: input.timeWindow,
    locationIds: input.locationIds,
    userIds: input.userIds,
    groupIds: input.groupIds,
    vlanIds: input.vlanIds,
  };
}

function targetCount(p: Policy): number {
  if (p.scope === "location") return p.locationIds.length;
  if (p.scope === "user") return p.userIds.length;
  return p.groupIds.length;
}

// These pages have no organization selector -- they browse and manage
// policies platform-wide, so calls (via policy-engine.ts) deliberately omit
// X-Organization-Id. CurrentOrganization then resolves to null server-side
// (see backend/app/domains/rbac/dependencies.py), which is what makes list
// return every organization's policies and create produce a platform-wide
// policy definition; RequirePermission still gates who may call these at
// all.
export const policyService = {
  async list(scope?: PolicyScope): Promise<Policy[]> {
    const details = await listPolicyDetails(POLICY_TYPE);
    const policies = details.map(toPolicy);
    return scope ? policies.filter((p) => p.scope === scope) : policies;
  },

  async get(id: string): Promise<Policy | undefined> {
    try {
      return toPolicy(await fetchPolicyDetail(id));
    } catch {
      return undefined;
    }
  },

  async kpis(scope?: PolicyScope): Promise<PolicyKpis> {
    const policies = await policyService.list(scope);
    return {
      total: policies.length,
      active: policies.filter((p) => p.status === "active").length,
      draft: policies.filter((p) => p.status === "draft").length,
      assignedTargets: policies.reduce((sum, p) => sum + targetCount(p), 0),
    };
  },

  async create(input: Omit<Policy, "id" | "createdAt" | "updatedAt">): Promise<Policy> {
    const detail = await createPolicyWithRules({
      policyType: POLICY_TYPE,
      name: input.name,
      description: input.description ?? null,
      rules: toRules(input),
      publish: input.status !== "draft",
    });
    if (input.status === "archived") {
      await deactivatePolicy(detail.id);
      return toPolicy(await fetchPolicyDetail(detail.id));
    }
    return toPolicy(detail);
  },

  async update(id: string, patch: Partial<Policy>): Promise<Policy> {
    const current = toPolicy(await fetchPolicyDetail(id));
    const merged: Policy = { ...current, ...patch };
    const detail = await updatePolicyRules({
      id,
      rules: toRules(merged),
      publish: merged.status !== "draft",
      archive: merged.status === "archived" && current.status !== "archived",
    });
    return toPolicy(detail);
  },

  async remove(id: string): Promise<void> {
    // Policy has no hard delete -- deactivate is the real, honest
    // equivalent (see backend/app/domains/policy/router.py).
    await deactivatePolicy(id);
  },
};
