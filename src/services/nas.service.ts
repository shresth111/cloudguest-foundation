import { api, type AppError } from "@/services/api";
import type {
  CreateNasPayload,
  NasClient,
  NasClientSecretReveal,
  NasStatus,
  UpdateNasPayload,
} from "@/types/nas";

interface BackendNasClient {
  id: string;
  nas_code: string | null;
  router_id: string;
  organization_id: string;
  location_id: string;
  nas_identifier: string;
  status: NasStatus;
  is_active: boolean;
  name: string | null;
  description: string | null;
  ip_address: string | null;
  vendor: string;
  created_at: string;
  updated_at: string;
}

interface BackendNasSecretReveal extends BackendNasClient {
  shared_secret: string;
}

interface BackendOrgListItem {
  id: string;
  name: string;
}

interface BackendListResponse<T> {
  items: T[];
  total_items: number;
}

interface BackendPagedListResponse<T> extends BackendListResponse<T> {
  page: number;
  page_size: number;
  has_next: boolean;
}

interface BackendLocation {
  id: string;
  name: string;
}

function toNasClient(
  n: BackendNasClient,
  locationName: string,
  organizationName: string,
): NasClient {
  return {
    id: n.id,
    nasCode: n.nas_code,
    routerId: n.router_id,
    organizationId: n.organization_id,
    organizationName,
    locationId: n.location_id,
    locationName,
    nasIdentifier: n.nas_identifier,
    status: n.status,
    isActive: n.is_active,
    name: n.name,
    description: n.description,
    ipAddress: n.ip_address,
    vendor: n.vendor,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}

function toNasSecretReveal(
  n: BackendNasSecretReveal,
  locationName: string,
  organizationName: string,
): NasClientSecretReveal {
  return { ...toNasClient(n, locationName, organizationName), sharedSecret: n.shared_secret };
}

async function fetchAllOrganizations(): Promise<BackendOrgListItem[]> {
  const { data } = await api.get<BackendListResponse<BackendOrgListItem>>("/organizations", {
    params: { page_size: 100 },
  });
  return data.items;
}

/**
 * NOTE: deliberately never sends an `X-Organization-Id` header here. The
 * backend's `CurrentOrganization` dependency treats a present header as "act
 * as a member of this org" and 403s unless the caller has an *active*
 * `organization_members` row for it -- which a Super Admin (a global RBAC
 * role, not a per-org membership) generally does not have. Omitting the
 * header makes `CurrentOrganization` resolve to `None`, which every one of
 * these services' underlying methods (see `guest/service.py`) treats as
 * "no tenant scoping, return/act on everything the permission allows" --
 * exactly the super-admin console's intent. Confirmed live: the header
 * variant 403s on this deployment's demo org, the header-less variant works.
 */
async function fetchAllLocations(): Promise<
  Array<{ id: string; name: string; organizationId: string; organizationName: string }>
> {
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<BackendLocation>>(
        `/organizations/${org.id}/locations`,
        { params: { page_size: 100 } },
      );
      return data.items.map((l) => ({
        id: l.id,
        name: l.name,
        organizationId: org.id,
        organizationName: org.name,
      }));
    }),
  );
  return settled
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Array<{ id: string; name: string; organizationId: string; organizationName: string }>
      > => r.status === "fulfilled",
    )
    .flatMap((r) => r.value);
}

/**
 * `GET /radius/nas` (unprefixed by location) genuinely lists every NAS
 * client the caller's permissions allow -- confirmed live (200, paginated
 * envelope) with no `X-Organization-Id` header. Paginates through in
 * 100-item pages rather than fanning out per location/org.
 */
async function fetchAllNasRaw(): Promise<BackendNasClient[]> {
  const items: BackendNasClient[] = [];
  let page = 1;
  for (;;) {
    const { data } = await api.get<BackendPagedListResponse<BackendNasClient>>("/radius/nas", {
      params: { page, page_size: 100 },
    });
    items.push(...data.items);
    if (!data.has_next) break;
    page += 1;
  }
  return items;
}

export const nasService = {
  async listByLocation(locationId: string): Promise<NasClient[]> {
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return [];
    const { data } = await api.get<BackendListResponse<BackendNasClient>>(
      `/locations/${locationId}/nas`,
      { params: { page_size: 100 } },
    );
    // Delete is a soft delete server-side (status flips to "deleted", the row
    // is never removed) -- the list endpoint keeps returning it forever, so
    // filter it out here rather than showing a dead registration indefinitely.
    return data.items
      .filter((n) => n.status !== "deleted")
      .map((n) => toNasClient(n, loc.name, loc.organizationName));
  },

  async listAll(): Promise<NasClient[]> {
    const [raw, locations] = await Promise.all([fetchAllNasRaw(), fetchAllLocations()]);
    const byLocationId = new Map(locations.map((l) => [l.id, l]));
    return raw
      .filter((n) => n.status !== "deleted")
      .map((n) => {
        const loc = byLocationId.get(n.location_id);
        return toNasClient(n, loc?.name ?? "", loc?.organizationName ?? "");
      });
  },

  async get(nasId: string): Promise<NasClient | null> {
    try {
      const { data } = await api.get<BackendNasClient>(`/radius/nas/${nasId}`);
      const locations = await fetchAllLocations();
      const loc = locations.find((l) => l.id === data.location_id);
      return toNasClient(data, loc?.name ?? "", loc?.organizationName ?? "");
    } catch (err) {
      if ((err as AppError).status === 404) return null;
      throw err;
    }
  },

  async getByRouterId(routerId: string): Promise<NasClient | null> {
    try {
      const { data } = await api.get<BackendNasClient>(`/routers/${routerId}/nas`);
      const locations = await fetchAllLocations();
      const loc = locations.find((l) => l.id === data.location_id);
      return toNasClient(data, loc?.name ?? "", loc?.organizationName ?? "");
    } catch (err) {
      if ((err as AppError).status === 404) return null;
      throw err;
    }
  },

  /**
   * `locationId` is kept as a parameter for API-compatibility with the
   * existing (unwired-but-real) `NasDevicesPanel`/`useCreateNas` consumer,
   * but the backend actually resolves organization/location from
   * `router_id` server-side (`RadiusService.register_nas` denormalizes both
   * from the router at registration time) -- it's used here only to resolve
   * a friendly location/org name for the returned reveal, with the
   * response's own `location_id` as a fallback source of truth.
   */
  async create(locationId: string, payload: CreateNasPayload): Promise<NasClientSecretReveal> {
    const { data } = await api.post<BackendNasSecretReveal>("/radius/nas", {
      router_id: payload.routerId,
      nas_identifier: payload.nasIdentifier,
      shared_secret: payload.sharedSecret,
      name: payload.name,
      description: payload.description,
      ip_address: payload.ipAddress,
    });
    const locations = await fetchAllLocations();
    const loc =
      locations.find((l) => l.id === data.location_id) ??
      locations.find((l) => l.id === locationId);
    return toNasSecretReveal(data, loc?.name ?? "", loc?.organizationName ?? "");
  },

  async update(nasId: string, payload: UpdateNasPayload): Promise<NasClient> {
    const { data } = await api.put<BackendNasClient>(`/radius/nas/${nasId}`, {
      name: payload.name,
      description: payload.description,
      ip_address: payload.ipAddress,
    });
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === data.location_id);
    return toNasClient(data, loc?.name ?? "", loc?.organizationName ?? "");
  },

  async activate(nasId: string): Promise<void> {
    await api.post(`/radius/nas/${nasId}/activate`);
  },

  async disable(nasId: string, reason?: string): Promise<void> {
    await api.post(`/radius/nas/${nasId}/disable`, { reason });
  },

  async regenerateSecret(nasId: string): Promise<NasClientSecretReveal> {
    const { data } = await api.post<BackendNasSecretReveal>(
      `/radius/nas/${nasId}/regenerate-secret`,
    );
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === data.location_id);
    return toNasSecretReveal(data, loc?.name ?? "", loc?.organizationName ?? "");
  },

  async remove(nasId: string): Promise<void> {
    await api.delete(`/radius/nas/${nasId}`);
  },
};
