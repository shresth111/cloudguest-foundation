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

// organizationId, when given, is sent as X-Organization-Id so
// RequirePermission resolves ORGANIZATION scope instead of defaulting to
// GLOBAL -- a real customer/org-owner session only holds policy.* at
// ORGANIZATION scope and 403s without it (same class of bug as
// customer.service.ts's listLocations()). Callers with no known org (the
// master admin Policy console, via authn-policy.service.ts/
// routing-policy.service.ts) keep the original platform-wide, no-header
// behavior, unchanged.
function orgHeaders(organizationId?: string) {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : undefined;
}

export async function fetchPolicyDetail(
  id: string,
  organizationId?: string,
): Promise<BackendPolicyDetail> {
  const { data } = await api.get<BackendPolicyDetail>(
    `/policies/${id}`,
    orgHeaders(organizationId),
  );
  return data;
}

export async function listPolicyDetails(
  policyType: string,
  organizationId?: string,
): Promise<BackendPolicyDetail[]> {
  const { data } = await api.get<BackendPolicyListResponse>("/policies", {
    params: { policy_type: policyType, page: 1, page_size: 100 },
    ...orgHeaders(organizationId),
  });
  return Promise.all(data.items.map((item) => fetchPolicyDetail(item.id, organizationId)));
}

// ============================================================================
// Session Timeout is a SESSION policy, not a bandwidth one.
//
// Lifted verbatim out of LocationPolicies.tsx (commit d5fdd91 / PR #225),
// because the identical bug existed on CreateGroup.tsx ("Access Tiers") and
// two copies of these three numbers is exactly how they drift.
//
// Both forms used to write `session_timeout_minutes` into the BANDWIDTH
// policy's rules JSON. The backend accepts that happily -- BandwidthPolicyRules
// declares the field -- but nothing on the guest side ever reads it: the
// login paths call `resolve_effective_policy(policy_type=SESSION, ...)`
// (guest/service.py's `_resolve_session_timeout_minutes`), and
// `list_candidate_assignments` filters candidates by policy_type, so a
// bandwidth policy is never even a candidate for a SESSION resolve. The
// picker saved, read back correctly on reload, and every guest still got
// the platform default of 240 minutes.
//
// PolicyType.SESSION, its typed rules schema and its assignments were all
// already built; these forms simply never wrote one. So: upsert a real
// SESSION policy alongside the bandwidth and device ones, exactly the way
// the paired DEVICE policy is already handled in both files.
//
// SessionPolicyRules is `extra="forbid"` with all four fields *required*
// (policy/schemas.py), so a write cannot patch the timeout alone -- the
// other three have to go up on every save. There is no UI for them yet;
// when there is, it belongs here.
//
// These deliberately mirror the constants the backend *actually enforces*
// today (app/domains/guest/constants.py), NOT PLATFORM_DEFAULT_RULES[SESSION]
// in policy/constants.py. Those two disagree on the concurrent-session cap:
// the policy mirror still says 3, while the enforced constant is
// DEFAULT_MAX_CONCURRENT_SESSIONS_PER_GUEST = 20 -- deliberately raised from
// 3 after a launch incident, and the mirror was never updated.
// `_enforce_concurrent_session_limit` reads the constant, not the policy, so
// writing 3 here is inert *today* -- but that lookup is being wired to the
// policy right now, and the moment it lands, every location and every access
// tier these forms have saved would silently drop from 20 back to 3 and
// reproduce that incident. Mirroring the enforced values means a save changes
// the session length and nothing else, before or after that change lands.
// ============================================================================
export const SESSION_POLICY_DEFAULTS = {
  max_concurrent_sessions_per_guest: 20,
  termination_reconnect_cooldown_minutes: 60,
  reconnect_grace_minutes: 30,
} as const;

/** The full SessionPolicyRules body for a chosen session length. All four
 * fields, because the schema forbids a partial one -- see above. */
export function sessionPolicyRules(sessionTimeoutMinutes: number) {
  return { session_timeout_minutes: sessionTimeoutMinutes, ...SESSION_POLICY_DEFAULTS };
}

export async function createPolicyWithRules(args: {
  policyType: string;
  name: string;
  description: string | null;
  rules: object;
  publish: boolean;
  organizationId?: string;
}): Promise<BackendPolicyDetail> {
  const { data: policy } = await api.post<BackendPolicy>(
    "/policies",
    {
      policy_type: args.policyType,
      name: args.name,
      description: args.description,
      // Backend's create_policy() rejects an org-scoped caller (any real
      // customer session, via requesting_organization_id resolved from
      // X-Organization-Id) whose body organization_id doesn't match --
      // and body organization_id defaults to null ("platform-wide"), which
      // *always* mismatches a real org caller and 400s as
      // CrossOrganizationPolicyAccessError. orgHeaders() alone (the header)
      // only controls RBAC scope resolution; the body field is a separate,
      // independently-checked value that must be sent too.
      organization_id: args.organizationId ?? null,
    },
    orgHeaders(args.organizationId),
  );
  const { data: version } = await api.post<BackendPolicyVersion>(
    `/policies/${policy.id}/versions`,
    { rules: args.rules },
    orgHeaders(args.organizationId),
  );
  if (args.publish) {
    await api.post(
      `/policies/${policy.id}/versions/${version.id}/publish`,
      undefined,
      orgHeaders(args.organizationId),
    );
  }
  return fetchPolicyDetail(policy.id, args.organizationId);
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
  organizationId?: string;
}): Promise<BackendPolicyDetail> {
  const { data: version } = await api.post<BackendPolicyVersion>(
    `/policies/${args.id}/versions`,
    { rules: args.rules },
    orgHeaders(args.organizationId),
  );
  if (args.publish) {
    await api.post(
      `/policies/${args.id}/versions/${version.id}/publish`,
      undefined,
      orgHeaders(args.organizationId),
    );
  }
  if (args.archive) {
    await api.post(`/policies/${args.id}/deactivate`, undefined, orgHeaders(args.organizationId));
  }
  return fetchPolicyDetail(args.id, args.organizationId);
}

export async function deactivatePolicy(id: string, organizationId?: string): Promise<void> {
  await api.post(`/policies/${id}/deactivate`, undefined, orgHeaders(organizationId));
}

// ============================================================================
// Assignments -- backing CreateGroup.tsx's "Map group" step. The backend
// (backend/app/domains/policy/router.py's /{policy_id}/assignments trio) is
// real and fully built; only the frontend never called it, so the "Map
// group" stepper icon was a static caption with no onClick at all (bug
// report: "policies>map group nhi hora hai"). Reused here rather than
// added to bandwidth-policy.service.ts's typed interface because
// authn-policy.service.ts/routing-policy.service.ts share this same
// dependency-free plumbing and could equally wire assignments later.
export interface BackendPolicyAssignment {
  id: string;
  policy_id: string;
  scope_type: string;
  scope_id: string | null;
  priority: number;
  target_type: string;
  target_id: string | null;
  is_active: boolean;
  created_at: string;
}

export async function listPolicyAssignments(
  policyId: string,
  organizationId?: string,
): Promise<BackendPolicyAssignment[]> {
  const { data } = await api.get<BackendPolicyAssignment[]>(
    `/policies/${policyId}/assignments`,
    orgHeaders(organizationId),
  );
  return data;
}

export async function createPolicyAssignment(args: {
  policyId: string;
  scopeType: string;
  scopeId?: string | null;
  priority?: number;
  targetType?: string;
  targetId?: string | null;
  organizationId?: string;
}): Promise<BackendPolicyAssignment> {
  const { data } = await api.post<BackendPolicyAssignment>(
    `/policies/${args.policyId}/assignments`,
    {
      scope_type: args.scopeType,
      scope_id: args.scopeId ?? null,
      priority: args.priority ?? 0,
      target_type: args.targetType ?? "none",
      target_id: args.targetId ?? null,
    },
    orgHeaders(args.organizationId),
  );
  return data;
}

export async function deactivatePolicyAssignment(
  policyId: string,
  assignmentId: string,
  organizationId?: string,
): Promise<void> {
  await api.delete(`/policies/${policyId}/assignments/${assignmentId}`, orgHeaders(organizationId));
}

// "Which bandwidth group is this guest currently in, if any" -- backs
// CreateGroup.tsx's Map users modal pre-check. Backend enforces a guest
// having at most one active GUEST-targeted BANDWIDTH assignment at a time
// (a second, different group would otherwise silently create two
// simultaneous, ambiguous bandwidth assignments for the same guest); this
// lets the UI show which group to unmap from *before* the user hits that
// 409, rather than a bare "could not map this guest" toast.
export interface BackendGuestGroupAssignment {
  mapped: boolean;
  policy_id: string | null;
  policy_name: string | null;
  assignment_id: string | null;
}

export async function getGuestGroupAssignment(
  guestId: string,
  organizationId?: string,
): Promise<BackendGuestGroupAssignment> {
  const { data } = await api.get<BackendGuestGroupAssignment>(
    `/policies/guest-mapping/${guestId}`,
    orgHeaders(organizationId),
  );
  return data;
}
