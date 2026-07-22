// Shared plumbing for simple, single-typed Policy CRUD pages (as opposed to
// policy.service.ts's composite group/location/user "access" policy model,
// which has its own scope/target machinery this doesn't need). Backs
// authn-policy.service.ts / bandwidth-policy.service.ts /
// routing-policy.service.ts -- each configures this with its own
// policy_type and typed rules shape.
//
// Real backend calls only (backend/app/domains/policy/router.py): create ->
// version -> optionally publish, list -> per-item detail fetch (list
// responses carry no `rules`), deactivate for delete/archive. See
// policy.service.ts's own file comments for the identical reasoning on
// each of these choices (no PolicyAssignment wiring, no reactivate path,
// platform-wide X-Organization-Id omission).
import { api } from "@/services/api";
import type { PolicyStatus } from "@/types/policy";

export interface BackendPolicy {
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

export interface BackendPolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  status: "draft" | "published";
  rules: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
}

export interface BackendPolicyDetail extends BackendPolicy {
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

export function latestVersion(detail: BackendPolicyDetail): BackendPolicyVersion | undefined {
  return [...detail.versions].sort((a, b) => b.version_number - a.version_number)[0];
}

// Backend has no "reactivate" endpoint (only /deactivate) -- an
// is_active=false policy has no path back to active, so it always reads as
// archived here regardless of version status, honestly reflecting that
// real constraint (identical to policy.service.ts's toPolicy).
export function statusOf(detail: BackendPolicyDetail): PolicyStatus {
  const version = latestVersion(detail);
  if (!detail.is_active) return "archived";
  return version?.status === "published" ? "active" : "draft";
}

export async function fetchPolicyDetail(id: string): Promise<BackendPolicyDetail> {
  const { data } = await api.get<BackendPolicyDetail>(`/policies/${id}`);
  return data;
}

export async function listPolicyDetails(policyType: string): Promise<BackendPolicyDetail[]> {
  const { data } = await api.get<BackendPolicyListResponse>("/policies", {
    params: { policy_type: policyType, page: 1, page_size: 100 },
  });
  return Promise.all(data.items.map((item) => fetchPolicyDetail(item.id)));
}

export async function createPolicyWithRules(args: {
  policyType: string;
  name: string;
  description: string | null;
  rules: object;
  publish: boolean;
}): Promise<BackendPolicyDetail> {
  const { data: policy } = await api.post<BackendPolicy>("/policies", {
    policy_type: args.policyType,
    name: args.name,
    description: args.description,
  });
  const { data: version } = await api.post<BackendPolicyVersion>(
    `/policies/${policy.id}/versions`,
    { rules: args.rules },
  );
  if (args.publish) {
    await api.post(`/policies/${policy.id}/versions/${version.id}/publish`);
  }
  return fetchPolicyDetail(policy.id);
}

// Backend has no PATCH /policies/{id} -- name/description are set only at
// creation (see router.py: create/get/list/deactivate/version endpoints
// only). Updating a policy means publishing a new rules version and/or
// deactivating; name/description are immutable thereafter.
export async function updatePolicyRules(args: {
  id: string;
  rules: object;
  publish: boolean;
  archive: boolean;
}): Promise<BackendPolicyDetail> {
  const { data: version } = await api.post<BackendPolicyVersion>(
    `/policies/${args.id}/versions`,
    { rules: args.rules },
  );
  if (args.publish) {
    await api.post(`/policies/${args.id}/versions/${version.id}/publish`);
  }
  if (args.archive) {
    await api.post(`/policies/${args.id}/deactivate`);
  }
  return fetchPolicyDetail(args.id);
}

export async function deactivatePolicy(id: string): Promise<void> {
  await api.post(`/policies/${id}/deactivate`);
}
