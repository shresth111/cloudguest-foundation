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

// Router ownership resolves organization/location server-side (see
// backend/app/domains/hotspot/service.py's create_profile), the same
// "no X-Organization-Id header needed once router_id is given" convention
// src/services/vlan.service.ts already established for this codebase.
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

  async getKpis(): Promise<HotspotKpis> {
    // No dedicated stats endpoint -- fetch a large page and compute real
    // counts client-side, same convention as vlanService.getKpis.
    const { data } = await api.get<BackendHotspotProfileListResponse>("/hotspot-profiles", {
      params: { page: 1, page_size: 100 },
    });
    const enabled = data.items.filter((p) => p.is_enabled).length;
    return {
      total: data.total_items,
      enabled,
      disabled: data.items.length - enabled,
    };
  },

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
