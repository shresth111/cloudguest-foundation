import { api } from "@/services/api";
import type {
  CreateHotspotProfilePayload,
  HotspotProfile,
  HotspotProfileListQuery,
  HotspotProfileListResult,
  UpdateHotspotProfilePayload,
} from "@/types/hotspot";

interface BackendHotspotProfile {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  session_timeout_minutes: number | null;
  idle_timeout_minutes: number | null;
  upload_limit_kbps: number | null;
  download_limit_kbps: number | null;
  walled_garden_hosts: string[];
  is_enabled: boolean;
  created_at: string;
}

interface BackendHotspotProfileListResponse {
  items: BackendHotspotProfile[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toHotspotProfile(p: BackendHotspotProfile): HotspotProfile {
  return {
    id: p.id,
    routerId: p.router_id,
    organizationId: p.organization_id,
    locationId: p.location_id,
    name: p.name,
    sessionTimeoutMinutes: p.session_timeout_minutes,
    idleTimeoutMinutes: p.idle_timeout_minutes,
    uploadLimitKbps: p.upload_limit_kbps,
    downloadLimitKbps: p.download_limit_kbps,
    walledGardenHosts: p.walled_garden_hosts,
    isEnabled: p.is_enabled,
    createdAt: p.created_at,
  };
}

// Tenant scope rides on `X-Organization-Id`, which the api client attaches to
// every request from an organization-scoped session (see
// `attachOrganizationHeader` in services/api.ts) and deliberately omits for a
// GLOBAL-scope one, so a master-console view still spans every organization.
// Nothing here sets that header by hand any more and no method takes an
// `organizationId`. Do not re-add one: the caller then has to *resolve* the id
// before it can read, that resolution ends up in the React Query key, and the
// key changing once it settles fired every read on these pages twice.

// This module's own comment used to claim "no X-Organization-Id header
// needed once router_id is given" -- that's not true. `create_hotspot_profile`
// /`list_hotspot_profiles`/etc. all resolve their tenant scope from
// CurrentOrganization (X-Organization-Id) -- absent it, RequirePermission
// falls back to checking for a GLOBAL-scope grant, which an ordinary
// customer/org-owner session never holds, so every call here 403'd for a
// real customer ("'hotspot.read' is required at global scope") -- surfaced
// as the customer dashboard's Hotspot Settings page never having been
// backend-wired in the first place (it rendered decorative, non-persisted
// toggles instead).
export const hotspotService = {
  async list(q: HotspotProfileListQuery): Promise<HotspotProfileListResult> {
    const { data } = await api.get<BackendHotspotProfileListResponse>("/hotspot-profiles", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
    });
    return {
      rows: data.items.map(toHotspotProfile),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async get(id: string): Promise<HotspotProfile> {
    const { data } = await api.get<BackendHotspotProfile>(`/hotspot-profiles/${id}`);
    return toHotspotProfile(data);
  },

  // There is deliberately no getKpis() here any more. It re-issued list()'s
  // own URL verbatim -- a second, byte-identical request on every page load --
  // and then reported the true server `total_items` next to enabled/disabled
  // counted over at most the 100 rows it received, so past 100 profiles the
  // three tiles stopped summing. HotspotManagement derives its tiles from the
  // list response it already has, and says on the tile when the rows it
  // counted do not cover the total. GET /hotspot-profiles has no `is_enabled`
  // filter to get an exact count from, and caps page_size at 100.

  async create(payload: CreateHotspotProfilePayload): Promise<HotspotProfile> {
    const { data } = await api.post<BackendHotspotProfile>("/hotspot-profiles", {
      router_id: payload.routerId,
      name: payload.name,
      session_timeout_minutes: payload.sessionTimeoutMinutes ?? null,
      idle_timeout_minutes: payload.idleTimeoutMinutes ?? null,
      upload_limit_kbps: payload.uploadLimitKbps ?? null,
      download_limit_kbps: payload.downloadLimitKbps ?? null,
      walled_garden_hosts: payload.walledGardenHosts ?? [],
      is_enabled: payload.isEnabled ?? true,
    });
    return toHotspotProfile(data);
  },

  async update(id: string, payload: UpdateHotspotProfilePayload): Promise<HotspotProfile> {
    const { data } = await api.put<BackendHotspotProfile>(`/hotspot-profiles/${id}`, {
      name: payload.name,
      session_timeout_minutes: payload.sessionTimeoutMinutes,
      idle_timeout_minutes: payload.idleTimeoutMinutes,
      upload_limit_kbps: payload.uploadLimitKbps,
      download_limit_kbps: payload.downloadLimitKbps,
      walled_garden_hosts: payload.walledGardenHosts,
      is_enabled: payload.isEnabled,
    });
    return toHotspotProfile(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/hotspot-profiles/${id}`);
  },
};
