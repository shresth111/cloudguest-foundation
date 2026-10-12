import {
  createPolicyAssignment,
  createPolicyWithRules,
  deactivatePolicy,
  deactivatePolicyAssignment,
  fetchPolicyDetail,
  getGuestGroupAssignment,
  listPolicyAssignments,
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
  // Group Policies' (CreateGroup.tsx) own per-group settings -- see
  // types/bandwidth-policy.ts's own doc comment for why these live here.
  session_timeout_minutes?: number | null;
  idle_timeout_minutes?: number | null;
  devices_per_user?: number | null;
  daily_limit_minutes?: number | null;
  login_hours?: { days: string[]; start_time: string; end_time: string } | null;
  data_limit?: { quota: number; unit: string; resets: string } | null;
  // Total venue speed. Optional on the wire: a version written before the
  // field existed simply has no such keys, which reads as "no cap".
  venue_download_rate_kbps?: number | null;
  venue_upload_rate_kbps?: number | null;
}

/** A venue rate as stored: a positive number, or `null` for no cap. Zero is
 * folded into `null` in BOTH directions of the wire -- on the per-guest keys 0
 * means unlimited, and a 0 arriving here by that habit must never be sent as
 * a cap of nothing for a whole venue. */
function venueRate(kbps: number | null | undefined): number | null {
  return typeof kbps === "number" && Number.isFinite(kbps) && kbps > 0 ? kbps : null;
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
    sessionTimeoutMinutes: rules.session_timeout_minutes ?? null,
    idleTimeoutMinutes: rules.idle_timeout_minutes ?? null,
    devicesPerUser: rules.devices_per_user ?? null,
    dailyLimitMinutes: rules.daily_limit_minutes ?? null,
    loginHours: rules.login_hours
      ? {
          days: rules.login_hours.days,
          from: rules.login_hours.start_time,
          to: rules.login_hours.end_time,
        }
      : null,
    dataLimit: rules.data_limit ?? null,
    venueDownloadRateKbps: venueRate(rules.venue_download_rate_kbps),
    venueUploadRateKbps: venueRate(rules.venue_upload_rate_kbps),
    createdAt: new Date(detail.created_at).getTime(),
    updatedAt: new Date(detail.updated_at).getTime(),
  };
}

/**
 * The rules object for one version.
 *
 * The two venue keys are written only when the caller GAVE an answer: a number
 * or `null`. Left `undefined` they are omitted here -- and `save()` below has
 * already replaced an `undefined` with the policy's stored value before this
 * runs, so "omitted" only ever reaches the wire for a policy being created,
 * where no cap is the truth.
 */
function toRules(input: SaveBandwidthPolicyInput): BandwidthRules {
  return {
    ...(input.venueDownloadRateKbps !== undefined && {
      venue_download_rate_kbps: venueRate(input.venueDownloadRateKbps),
    }),
    ...(input.venueUploadRateKbps !== undefined && {
      venue_upload_rate_kbps: venueRate(input.venueUploadRateKbps),
    }),
    download_rate_kbps: input.downloadRateKbps,
    upload_rate_kbps: input.uploadRateKbps,
    burst_download_kbps: input.burstDownloadKbps ?? null,
    burst_upload_kbps: input.burstUploadKbps ?? null,
    burst_threshold_kbps: input.burstThresholdKbps ?? null,
    burst_time_seconds: input.burstTimeSeconds ?? null,
    priority: input.priority ?? null,
    session_timeout_minutes: input.sessionTimeoutMinutes ?? null,
    idle_timeout_minutes: input.idleTimeoutMinutes ?? null,
    devices_per_user: input.devicesPerUser ?? null,
    daily_limit_minutes: input.dailyLimitMinutes ?? null,
    login_hours: input.loginHours
      ? {
          days: input.loginHours.days,
          start_time: input.loginHours.from,
          end_time: input.loginHours.to,
        }
      : null,
    data_limit: input.dataLimit ?? null,
  };
}

export const bandwidthPolicyService = {
  // organizationId, when given (e.g. the customer Policies tab), scopes
  // this to ORGANIZATION instead of the GLOBAL-only default -- see
  // policy-engine.ts's orgHeaders() comment.
  async list(organizationId?: string): Promise<BandwidthPolicy[]> {
    const details = await listPolicyDetails(POLICY_TYPE, organizationId);
    return details.map(toBandwidthPolicy);
  },

  async kpis(organizationId?: string): Promise<BandwidthPolicyKpis> {
    const policies = await bandwidthPolicyService.list(organizationId);
    return {
      total: policies.length,
      active: policies.filter((p) => p.status === "active").length,
      draft: policies.filter((p) => p.status === "draft").length,
    };
  },

  async save(input: SaveBandwidthPolicyInput, organizationId?: string): Promise<BandwidthPolicy> {
    if (input.id) {
      // A SAVE THAT SAYS NOTHING ABOUT THE VENUE TOTAL MUST NOT ERASE IT.
      //
      // A policy version is a WHOLE rules object: publishing one without the
      // two venue keys makes "no venue cap" the venue's current answer. Three
      // screens write bandwidth policies through this function and only Guest
      // WiFi Limits knows the field exists -- Access Tiers and the bandwidth
      // policy manager would each have removed a venue's total on their next
      // unrelated save, with nothing on either screen to show it had gone.
      //
      // So an `undefined` here is filled from what the policy holds now. If
      // that read fails the save fails with it: writing the version anyway
      // would be choosing "erase it" on the owner's behalf.
      let rulesInput = input;
      if (input.venueDownloadRateKbps === undefined || input.venueUploadRateKbps === undefined) {
        const current = toBandwidthPolicy(await fetchPolicyDetail(input.id, organizationId));
        rulesInput = {
          ...input,
          venueDownloadRateKbps:
            input.venueDownloadRateKbps === undefined
              ? current.venueDownloadRateKbps
              : input.venueDownloadRateKbps,
          venueUploadRateKbps:
            input.venueUploadRateKbps === undefined
              ? current.venueUploadRateKbps
              : input.venueUploadRateKbps,
        };
      }
      const detail = await updatePolicyRules({
        id: input.id,
        rules: toRules(rulesInput),
        publish: input.status !== "draft",
        archive: input.status === "archived",
        organizationId,
      });
      return toBandwidthPolicy(detail);
    }
    const detail = await createPolicyWithRules({
      policyType: POLICY_TYPE,
      name: input.name,
      description: input.description ?? null,
      rules: toRules(input),
      publish: input.status !== "draft",
      organizationId,
    });
    return toBandwidthPolicy(detail);
  },

  async remove(id: string, organizationId?: string): Promise<void> {
    await deactivatePolicy(id, organizationId);
  },

  // Every location this group's bandwidth policy is *currently* mapped to
  // (one row per active, location-scoped, target_type="none"
  // PolicyAssignment) -- the backend already supports a policy having any
  // number of these simultaneously, each its own independent assignment
  // record with its own id (createPolicyAssignment/policy-engine.ts's
  // listPolicyAssignments hits a plain, unfiltered-by-location
  // GET /policies/{id}/assignments). This is the real many-to-many read:
  // CreateGroup.tsx's "Map to locations…" modal uses it to seed which
  // checkboxes start checked across every location in the org, not just
  // the one currently active. locationMapping() below is just this,
  // filtered down to a single location, for the existing quick single-
  // location toggle.
  async listLocationMappings(
    policyId: string,
    organizationId?: string,
  ): Promise<{ assignmentId: string; locationId: string }[]> {
    const assignments = await listPolicyAssignments(policyId, organizationId);
    return assignments
      .filter(
        (a) => a.is_active && a.scope_type === "location" && a.target_type === "none" && a.scope_id,
      )
      .map((a) => ({ assignmentId: a.id, locationId: a.scope_id as string }));
  },

  // "Map group" (CreateGroup.tsx step 2) -- is this group's bandwidth
  // policy currently assigned (PolicyAssignment, scope_type="location",
  // target_type="none") to the given location? Returns the active
  // assignment's id (for unmapToLocation) or null. A policy with no
  // published version (current_version_id is null -- see toBandwidthPolicy/
  // statusOf's "draft" case) has never been assignable at all
  // (PolicyAssignmentRequiresPublishedVersionError), so callers should treat
  // a draft group as always unmapped rather than calling this.
  async locationMapping(
    policyId: string,
    locationId: string,
    organizationId?: string,
  ): Promise<string | null> {
    const mappings = await bandwidthPolicyService.listLocationMappings(policyId, organizationId);
    return mappings.find((m) => m.locationId === locationId)?.assignmentId ?? null;
  },

  // Idempotent: a group already mapped to this location is left as-is
  // (returns its existing assignment id) instead of creating a duplicate
  // active PolicyAssignment row -- the backend itself allows more than one
  // active assignment at the same scope (priority just tie-breaks them), so
  // this guard has to live on the client.
  async mapToLocation(
    policyId: string,
    locationId: string,
    organizationId?: string,
  ): Promise<string> {
    const existing = await bandwidthPolicyService.locationMapping(
      policyId,
      locationId,
      organizationId,
    );
    if (existing) return existing;
    const assignment = await createPolicyAssignment({
      policyId,
      scopeType: "location",
      scopeId: locationId,
      targetType: "none",
      organizationId,
    });
    return assignment.id;
  },

  async unmapFromLocation(
    policyId: string,
    assignmentId: string,
    organizationId?: string,
  ): Promise<void> {
    await deactivatePolicyAssignment(policyId, assignmentId, organizationId);
  },

  // "Map users" (CreateGroup.tsx step 3) -- every guest currently mapped
  // into this group at this location (a GUEST-targeted PolicyAssignment,
  // scope_type="location", target_type="guest" -- see backend/app/domains
  // /policy/constants.py's PolicyAssignmentTargetType.GUEST doc comment).
  async guestMappings(
    policyId: string,
    locationId: string,
    organizationId?: string,
  ): Promise<{ assignmentId: string; guestId: string }[]> {
    const assignments = await listPolicyAssignments(policyId, organizationId);
    return assignments
      .filter(
        (a) =>
          a.is_active &&
          a.scope_type === "location" &&
          a.scope_id === locationId &&
          a.target_type === "guest" &&
          a.target_id,
      )
      .map((a) => ({ assignmentId: a.id, guestId: a.target_id as string }));
  },

  // Idempotent, mirroring mapToLocation: a guest already mapped into this
  // group at this location is left as-is rather than creating a second
  // active row for the same (policy, location, guest) triple.
  async mapGuestToLocation(
    policyId: string,
    locationId: string,
    guestId: string,
    organizationId?: string,
  ): Promise<string> {
    const existing = await bandwidthPolicyService.guestMappings(
      policyId,
      locationId,
      organizationId,
    );
    const already = existing.find((m) => m.guestId === guestId);
    if (already) return already.assignmentId;
    const assignment = await createPolicyAssignment({
      policyId,
      scopeType: "location",
      scopeId: locationId,
      targetType: "guest",
      targetId: guestId,
      organizationId,
    });
    return assignment.id;
  },

  async unmapGuestFromLocation(
    policyId: string,
    assignmentId: string,
    organizationId?: string,
  ): Promise<void> {
    await deactivatePolicyAssignment(policyId, assignmentId, organizationId);
  },

  // "Which group is this guest already in, if any" -- one guest may only
  // be actively mapped into one group at a time (backend-enforced, see
  // policy-engine.ts's getGuestGroupAssignment doc comment). Used by
  // CreateGroup.tsx's Map users modal to show that group *before* letting
  // the user attempt (and 409 on) a second one.
  async guestCurrentGroup(
    guestId: string,
    organizationId?: string,
  ): Promise<{ policyId: string; policyName: string; assignmentId: string } | null> {
    const result = await getGuestGroupAssignment(guestId, organizationId);
    if (!result.mapped || !result.policy_id || !result.assignment_id) return null;
    return {
      policyId: result.policy_id,
      policyName: result.policy_name ?? "another group",
      assignmentId: result.assignment_id,
    };
  },
};
