import { api } from "@/services/api";
import type {
  Campaign,
  CampaignKpis,
  CampaignListQuery,
  CampaignListResult,
  CreateCampaignPayload,
  UpdateCampaignPayload,
} from "@/types/campaign";

interface BackendCampaign {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  campaign_type: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  display_rule: string;
  display_interval_days: number | null;
  target_networks: string[];
  is_skippable: boolean;
  created_at: string;
}

interface BackendCampaignListResponse {
  items: BackendCampaign[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toCampaign(c: BackendCampaign): Campaign {
  return {
    id: c.id,
    organizationId: c.organization_id,
    locationId: c.location_id,
    name: c.name,
    campaignType: c.campaign_type as Campaign["campaignType"],
    status: c.status as Campaign["status"],
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    displayRule: c.display_rule as Campaign["displayRule"],
    displayIntervalDays: c.display_interval_days,
    targetNetworks: c.target_networks,
    isSkippable: c.is_skippable,
    createdAt: c.created_at,
  };
}

// Campaigns are organization-scoped (X-Organization-Id) with an optional
// location_id filter -- this page has no org selector, so it resolves to
// the caller's first/only organization.
//
// GET /organizations is the platform-wide admin listing -- it requires
// organizations.read at GLOBAL scope, which an ordinary customer/org-owner
// session doesn't hold (only at ORGANIZATION scope, for their own org), so
// it 403s and silently broke every method on this service for a real
// customer session (see customer.service.ts's resolveOrgId doc comment for
// the full explanation -- same fix applied here, first fixed in
// ticket.service.ts's resolveOrgId).
let cachedOrganizationId: string | null = null;
async function resolveOrganizationId(): Promise<string> {
  if (cachedOrganizationId) return cachedOrganizationId;
  const { data } = await api.get<Array<{ organization_id: string; status: string }>>("/me/organizations");
  const membership = data.find((m) => m.status === "active") ?? data[0];
  if (!membership) throw new Error("No organization found for the current session");
  cachedOrganizationId = membership.organization_id;
  return cachedOrganizationId;
}

export const campaignService = {
  async getOrganizationId(): Promise<string> {
    return resolveOrganizationId();
  },

  async list(q: CampaignListQuery): Promise<CampaignListResult> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendCampaignListResponse>("/campaigns", {
      params: { location_id: q.locationId, page: q.page, page_size: q.pageSize },
      headers: { "X-Organization-Id": orgId },
    });
    return {
      rows: data.items.map(toCampaign),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async get(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendCampaign>(`/campaigns/${id}`, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async getKpis(): Promise<CampaignKpis> {
    const { rows, total } = await campaignService.list({ page: 1, pageSize: 100 });
    return {
      total,
      active: rows.filter((c) => c.status === "active").length,
      scheduled: rows.filter((c) => c.status === "scheduled").length,
      draft: rows.filter((c) => c.status === "draft").length,
    };
  },

  async create(payload: CreateCampaignPayload): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(
      "/campaigns",
      {
        location_id: payload.locationId ?? null,
        name: payload.name,
        campaign_type: payload.campaignType,
        starts_at: payload.startsAt ?? null,
        ends_at: payload.endsAt ?? null,
        display_rule: payload.displayRule ?? "every_login",
        display_interval_days: payload.displayIntervalDays ?? null,
        target_networks: payload.targetNetworks ?? [],
        is_skippable: payload.isSkippable ?? true,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toCampaign(data);
  },

  async update(id: string, payload: UpdateCampaignPayload): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.put<BackendCampaign>(
      `/campaigns/${id}`,
      {
        location_id: payload.locationId,
        name: payload.name,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
        display_rule: payload.displayRule,
        display_interval_days: payload.displayIntervalDays,
        target_networks: payload.targetNetworks,
        is_skippable: payload.isSkippable,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toCampaign(data);
  },

  async remove(id: string): Promise<void> {
    const orgId = await resolveOrganizationId();
    await api.delete(`/campaigns/${id}`, { headers: { "X-Organization-Id": orgId } });
  },

  async clone(id: string, newName: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(
      `/campaigns/${id}/clone`,
      { new_name: newName },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toCampaign(data);
  },

  async schedule(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/schedule`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async pause(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/pause`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async resume(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/resume`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async end(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/end`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },
};
