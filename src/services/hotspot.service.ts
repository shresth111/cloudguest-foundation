import { api } from "@/services/api";
import type {
  CreateHotspotProfilePayload,
  HotspotKpis,
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

function orgHeaders(organizationId?: string) {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : {};
}

// This module's own comment used to claim "no X-Organization-Id header
// needed once router_id is given" -- that's not true. `create_hotspot_profile`
// /`list_hotspot_profiles`/etc. all resolve their tenant scope from
// CurrentOrganization (X-Organization-Id) -- absent it, RequirePermission
// falls back to checking for a GLOBAL-scope grant, which an ordinary
// customer/org-owner session never holds, so every call here 403'd for a
// real customer ("'hotspot.read' is required at global scope") -- surfaced
// as the customer dashboard's Hotspot Settings page never having been
// backend-wired in the first place (it rendered decorative, non-persisted
// toggles instead). `organizationId` is optional and left unset by the
// master console's platform-wide /network/hotspot view (which deliberately
// spans every org), and threaded by the customer dashboard's location-scoped
// HotspotManagement -- same convention as dhcp.service.ts's orgHeaders.
export const hotspotService = {
  async list(q: HotspotProfileListQuery): Promise<HotspotProfileListResult> {
    const { data } = await api.get<BackendHotspotProfileListResponse>("/hotspot-profiles", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
      ...orgHeaders(q.organizationId),
    });
    return {
      rows: data.items.map(toHotspotProfile),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async get(id: string, organizationId?: string): Promise<HotspotProfile> {
    const { data } = await api.get<BackendHotspotProfile>(
      `/hotspot-profiles/${id}`,
      orgHeaders(organizationId),
    );
    return toHotspotProfile(data);
  },

  async getKpis(organizationId?: string): Promise<HotspotKpis> {
    // No dedicated stats endpoint -- fetch a large page and compute real
    // counts client-side, same convention as vlanService.getKpis.
    const { data } = await api.get<BackendHotspotProfileListResponse>("/hotspot-profiles", {
      params: { page: 1, page_size: 100 },
      ...orgHeaders(organizationId),
    });
    const enabled = data.items.filter((p) => p.is_enabled).length;
    return {
      total: data.total_items,
      enabled,
      disabled: data.items.length - enabled,
    };
  },

  async create(payload: CreateHotspotProfilePayload): Promise<HotspotProfile> {
    const { data } = await api.post<BackendHotspotProfile>(
      "/hotspot-profiles",
      {
        router_id: payload.routerId,
        name: payload.name,
        session_timeout_minutes: payload.sessionTimeoutMinutes ?? null,
        idle_timeout_minutes: payload.idleTimeoutMinutes ?? null,
        upload_limit_kbps: payload.uploadLimitKbps ?? null,
        download_limit_kbps: payload.downloadLimitKbps ?? null,
        walled_garden_hosts: payload.walledGardenHosts ?? [],
        is_enabled: payload.isEnabled ?? true,
      },
      orgHeaders(payload.organizationId),
    );
    return toHotspotProfile(data);
  },

  async update(
    id: string,
    payload: UpdateHotspotProfilePayload,
    organizationId?: string,
  ): Promise<HotspotProfile> {
    const { data } = await api.put<BackendHotspotProfile>(
      `/hotspot-profiles/${id}`,
      {
        name: payload.name,
        session_timeout_minutes: payload.sessionTimeoutMinutes,
        idle_timeout_minutes: payload.idleTimeoutMinutes,
        upload_limit_kbps: payload.uploadLimitKbps,
        download_limit_kbps: payload.downloadLimitKbps,
        walled_garden_hosts: payload.walledGardenHosts,
        is_enabled: payload.isEnabled,
      },
      orgHeaders(organizationId),
    );
    return toHotspotProfile(data);
  },

  async remove(id: string, organizationId?: string): Promise<void> {
    await api.delete(`/hotspot-profiles/${id}`, orgHeaders(organizationId));
  },
};
