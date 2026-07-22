import { api } from "@/services/api";
import type { AuthMethod, Policy, PolicyKpis, PolicyScope, PolicyStatus } from "@/types/policy";

// PolicyType.ACCESS is backend's generic, dependency-free policy type --
// GenericPolicyRules accepts any JSON object with no typed schema (see
// backend/app/domains/policy/constants.py's module docstring). The full
// composite Policy shape this UI edits (bandwidth/quota/device/authMethods/
// timeWindow/targets) has no dedicated backend type of its own, so it is
// persisted whole as one version's `rules` blob under this type.
const POLICY_TYPE = "access";

interface BackendPolicy {
  id: string;
  organization_id: string | null;
  policy_type: string;
  name: string;
  description: string | null;
  is_active: boolean;
  current_version_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendPolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  status: "draft" | "published";
  rules: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
}

interface BackendPolicyDetail extends BackendPolicy {
  versions: BackendPolicyVersion[];
}

interface BackendPolicyListResponse {
  items: BackendPolicy[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

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

function latestVersion(detail: BackendPolicyDetail): BackendPolicyVersion | undefined {
  return [...detail.versions].sort((a, b) => b.version_number - a.version_number)[0];
}

function toPolicy(detail: BackendPolicyDetail): Policy {
  const version = latestVersion(detail);
  const rules = (version?.rules ?? {}) as Partial<PolicyRules>;
  // Backend has no "reactivate" endpoint (only /deactivate), so an
  // is_active=false policy has no path back to active -- it always reads
  // as archived here, honestly reflecting that real constraint.
  const status: PolicyStatus = !detail.is_active
    ? "archived"
    : version?.status === "published"
      ? "active"
      : "draft";
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

async function fetchDetail(id: string): Promise<BackendPolicyDetail> {
  const { data } = await api.get<BackendPolicyDetail>(`/policies/${id}`);
  return data;
}

// These pages have no organization selector -- they browse and manage
// policies platform-wide, so calls deliberately omit X-Organization-Id.
// CurrentOrganization then resolves to null server-side (see
// backend/app/domains/rbac/dependencies.py), which is what makes list
// return every organization's policies and create produce a platform-wide
// policy definition; RequirePermission still gates who may call these at
// all.
export const policyService = {
  async list(scope?: PolicyScope): Promise<Policy[]> {
    const { data } = await api.get<BackendPolicyListResponse>("/policies", {
      params: { policy_type: POLICY_TYPE, page: 1, page_size: 100 },
    });
    const details = await Promise.all(data.items.map((item) => fetchDetail(item.id)));
    const policies = details.map(toPolicy);
    return scope ? policies.filter((p) => p.scope === scope) : policies;
  },

  async get(id: string): Promise<Policy | undefined> {
    try {
      return toPolicy(await fetchDetail(id));
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
    const { data: policy } = await api.post<BackendPolicy>("/policies", {
      policy_type: POLICY_TYPE,
      name: input.name,
      description: input.description ?? null,
    });
    const { data: version } = await api.post<BackendPolicyVersion>(
      `/policies/${policy.id}/versions`,
      { rules: toRules(input) },
    );
    if (input.status !== "draft") {
      await api.post(`/policies/${policy.id}/versions/${version.id}/publish`);
    }
    if (input.status === "archived") {
      await api.post(`/policies/${policy.id}/deactivate`);
    }
    return toPolicy(await fetchDetail(policy.id));
  },

  async update(id: string, patch: Partial<Policy>): Promise<Policy> {
    const current = toPolicy(await fetchDetail(id));
    const merged: Policy = { ...current, ...patch };
    const { data: version } = await api.post<BackendPolicyVersion>(
      `/policies/${id}/versions`,
      { rules: toRules(merged) },
    );
    if (merged.status !== "draft") {
      await api.post(`/policies/${id}/versions/${version.id}/publish`);
    }
    if (merged.status === "archived" && current.status !== "archived") {
      await api.post(`/policies/${id}/deactivate`);
    }
    return toPolicy(await fetchDetail(id));
  },

  async remove(id: string): Promise<void> {
    // Policy has no hard delete -- deactivate is the real, honest
    // equivalent (see backend/app/domains/policy/router.py).
    await api.post(`/policies/${id}/deactivate`);
  },
};
