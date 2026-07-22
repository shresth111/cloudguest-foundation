import { api } from "@/services/api";
import type {
  AccessCheckQuery,
  AccessCheckResult,
  AccessRuleType,
  CreateDeviceRulePayload,
  CreateGuestRulePayload,
  DeviceAccessRule,
  GuestAccessKpis,
  GuestAccessRule,
} from "@/types/guest-access";

interface BackendOrgListItem {
  id: string;
  name: string;
}

interface BackendListResponse<T> {
  items: T[];
  total_items: number;
}

interface BackendGuestAccessRule {
  id: string;
  organization_id: string;
  location_id: string | null;
  identifier: string;
  rule_type: AccessRuleType;
  reason: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendDeviceAccessRule {
  id: string;
  organization_id: string;
  location_id: string | null;
  mac_address: string;
  rule_type: AccessRuleType;
  reason: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BackendAccessCheckResponse {
  allowed: boolean;
  rule_type: AccessRuleType | null;
  matched_rule_id: string | null;
  reason: string | null;
}

async function fetchAllOrganizations(): Promise<BackendOrgListItem[]> {
  const { data } = await api.get<BackendListResponse<BackendOrgListItem>>("/organizations", {
    params: { page_size: 100 },
  });
  return data.items;
}

/**
 * No bulk cross-org listing endpoint exists for /guest-access/* -- fans out
 * one call per organization and concatenates client-side, the same
 * `fanOutPerOrg` pattern guest.service.ts already uses for the sibling
 * guest/session domain (its own docstring already names access-rules and
 * teams as future consumers of this exact pattern).
 */
async function fanOutPerOrg<T>(
  path: string,
  toRow: (raw: unknown, org: BackendOrgListItem) => T,
): Promise<T[]> {
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<unknown>>(path, {
        params: { page_size: 100 },
        headers: { "X-Organization-Id": org.id },
      });
      return data.items.map((raw) => toRow(raw, org));
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<T[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

function toGuestRule(r: BackendGuestAccessRule, org: BackendOrgListItem): GuestAccessRule {
  return {
    id: r.id,
    organizationId: r.organization_id,
    organizationName: org.name,
    locationId: r.location_id,
    identifier: r.identifier,
    ruleType: r.rule_type,
    reason: r.reason,
    expiresAt: r.expires_at,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toDeviceRule(r: BackendDeviceAccessRule, org: BackendOrgListItem): DeviceAccessRule {
  return {
    id: r.id,
    organizationId: r.organization_id,
    organizationName: org.name,
    locationId: r.location_id,
    macAddress: r.mac_address,
    ruleType: r.rule_type,
    reason: r.reason,
    expiresAt: r.expires_at,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const guestAccessService = {
  organizations: fetchAllOrganizations,

  async listGuestRules(): Promise<GuestAccessRule[]> {
    return fanOutPerOrg<GuestAccessRule>("/guest-access/rules", (raw, org) =>
      toGuestRule(raw as BackendGuestAccessRule, org),
    );
  },

  async listDeviceRules(): Promise<DeviceAccessRule[]> {
    return fanOutPerOrg<DeviceAccessRule>("/guest-access/device-rules", (raw, org) =>
      toDeviceRule(raw as BackendDeviceAccessRule, org),
    );
  },

  async kpis(): Promise<GuestAccessKpis> {
    const [guestRules, deviceRules] = await Promise.all([
      guestAccessService.listGuestRules(),
      guestAccessService.listDeviceRules(),
    ]);
    return {
      totalGuestRules: guestRules.length,
      totalDeviceRules: deviceRules.length,
      activeRules:
        guestRules.filter((r) => r.isActive).length +
        deviceRules.filter((r) => r.isActive).length,
      vipCount:
        guestRules.filter((r) => r.ruleType === "vip" && r.isActive).length +
        deviceRules.filter((r) => r.ruleType === "vip" && r.isActive).length,
    };
  },

  async createGuestRule(payload: CreateGuestRulePayload): Promise<GuestAccessRule> {
    const { data } = await api.post<BackendGuestAccessRule>(
      "/guest-access/rules",
      {
        organization_id: payload.organizationId,
        location_id: payload.locationId ?? null,
        identifier: payload.identifier,
        rule_type: payload.ruleType,
        reason: payload.reason ?? null,
        expires_at: payload.expiresAt ?? null,
      },
      { headers: { "X-Organization-Id": payload.organizationId } },
    );
    const orgs = await fetchAllOrganizations();
    const org = orgs.find((o) => o.id === payload.organizationId);
    return toGuestRule(data, org ?? { id: payload.organizationId, name: "" });
  },

  async createDeviceRule(payload: CreateDeviceRulePayload): Promise<DeviceAccessRule> {
    const { data } = await api.post<BackendDeviceAccessRule>(
      "/guest-access/device-rules",
      {
        organization_id: payload.organizationId,
        location_id: payload.locationId ?? null,
        mac_address: payload.macAddress,
        rule_type: payload.ruleType,
        reason: payload.reason ?? null,
        expires_at: payload.expiresAt ?? null,
      },
      { headers: { "X-Organization-Id": payload.organizationId } },
    );
    const orgs = await fetchAllOrganizations();
    const org = orgs.find((o) => o.id === payload.organizationId);
    return toDeviceRule(data, org ?? { id: payload.organizationId, name: "" });
  },

  async deactivateGuestRule(id: string, organizationId: string): Promise<void> {
    await api.post(
      `/guest-access/rules/${id}/deactivate`,
      {},
      { headers: { "X-Organization-Id": organizationId } },
    );
  },

  async deleteGuestRule(id: string, organizationId: string): Promise<void> {
    await api.delete(`/guest-access/rules/${id}`, {
      headers: { "X-Organization-Id": organizationId },
    });
  },

  async deactivateDeviceRule(id: string, organizationId: string): Promise<void> {
    await api.post(
      `/guest-access/device-rules/${id}/deactivate`,
      {},
      { headers: { "X-Organization-Id": organizationId } },
    );
  },

  async deleteDeviceRule(id: string, organizationId: string): Promise<void> {
    await api.delete(`/guest-access/device-rules/${id}`, {
      headers: { "X-Organization-Id": organizationId },
    });
  },

  async checkAccess(query: AccessCheckQuery): Promise<AccessCheckResult> {
    const { data } = await api.post<BackendAccessCheckResponse>(
      "/guest-access/check",
      {
        organization_id: query.organizationId,
        location_id: query.locationId ?? null,
        identifier: query.identifier ?? null,
        mac_address: query.macAddress ?? null,
      },
      { headers: { "X-Organization-Id": query.organizationId } },
    );
    return {
      allowed: data.allowed,
      ruleType: data.rule_type,
      matchedRuleId: data.matched_rule_id,
      reason: data.reason,
    };
  },
};
