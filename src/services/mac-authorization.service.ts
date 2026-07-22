import { api } from "@/services/api";
import type {
  CreateMacAuthorizationPayload,
  MacAuthorizationEntry,
  MacAuthorizationKpis,
  MacAuthorizationListQuery,
  MacAuthorizationListResult,
  UpdateMacAuthorizationPayload,
} from "@/types/mac-authorization";

interface BackendMacAuthorizationEntry {
  id: string;
  organization_id: string;
  location_id: string | null;
  // May arrive pre-masked by the backend's masking layer for callers
  // without unmask privileges (see app.common.masking.MaskedMac) --
  // rendered as-is, never assumed to be the full address.
  mac_address: string;
  authorization_type: string;
  expires_at: string | null;
  comment: string | null;
  is_enabled: boolean;
  created_at: string;
}

interface BackendMacAuthorizationListResponse {
  items: BackendMacAuthorizationEntry[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toEntry(e: BackendMacAuthorizationEntry): MacAuthorizationEntry {
  return {
    id: e.id,
    organizationId: e.organization_id,
    locationId: e.location_id,
    macAddress: e.mac_address,
    authorizationType: e.authorization_type as MacAuthorizationEntry["authorizationType"],
    expiresAt: e.expires_at,
    comment: e.comment,
    isEnabled: e.is_enabled,
    createdAt: e.created_at,
  };
}

let cachedOrganizationId: string | null = null;
// create_entry requires an organization context (raises
// OrganizationRequiredError otherwise -- see
// backend/app/domains/mac_authorization/service.py), so every call here
// threads X-Organization-Id, same pattern as settings.service.ts's
// resolveOrganizationId.
async function resolveOrganizationId(): Promise<string> {
  if (cachedOrganizationId) return cachedOrganizationId;
  const { data } = await api.get<{ items: Array<{ id: string }> }>("/organizations", {
    params: { page_size: 1 },
  });
  const id = data.items[0]?.id;
  if (!id) throw new Error("No organization found for the current session");
  cachedOrganizationId = id;
  return id;
}

export const macAuthorizationService = {
  async list(q: MacAuthorizationListQuery): Promise<MacAuthorizationListResult> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendMacAuthorizationListResponse>(
      "/mac-authorization/entries",
      {
        params: { location_id: q.locationId, page: q.page, page_size: q.pageSize },
        headers: { "X-Organization-Id": orgId },
      },
    );
    return {
      rows: data.items.map(toEntry),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getKpis(): Promise<MacAuthorizationKpis> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendMacAuthorizationListResponse>(
      "/mac-authorization/entries",
      { params: { page: 1, page_size: 100 }, headers: { "X-Organization-Id": orgId } },
    );
    const enabled = data.items.filter((e) => e.is_enabled).length;
    return {
      total: data.total_items,
      enabled,
      disabled: data.items.length - enabled,
    };
  },

  async create(payload: CreateMacAuthorizationPayload): Promise<MacAuthorizationEntry> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendMacAuthorizationEntry>(
      "/mac-authorization/entries",
      {
        mac_address: payload.macAddress,
        authorization_type: payload.authorizationType,
        location_id: payload.locationId ?? null,
        expires_at: payload.expiresAt ?? null,
        comment: payload.comment ?? null,
        is_enabled: payload.isEnabled ?? true,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toEntry(data);
  },

  async update(
    id: string,
    payload: UpdateMacAuthorizationPayload,
  ): Promise<MacAuthorizationEntry> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.put<BackendMacAuthorizationEntry>(
      `/mac-authorization/entries/${id}`,
      {
        mac_address: payload.macAddress,
        authorization_type: payload.authorizationType,
        location_id: payload.locationId,
        expires_at: payload.expiresAt,
        comment: payload.comment,
        is_enabled: payload.isEnabled,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toEntry(data);
  },

  async remove(id: string): Promise<void> {
    const orgId = await resolveOrganizationId();
    await api.delete(`/mac-authorization/entries/${id}`, {
      headers: { "X-Organization-Id": orgId },
    });
  },
};
