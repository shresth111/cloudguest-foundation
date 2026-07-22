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

async function fetchAllLocations(): Promise<
  Array<{ id: string; name: string; organizationId: string; organizationName: string }>
> {
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<BackendLocation>>(
        `/organizations/${org.id}/locations`,
        { params: { page_size: 100 }, headers: { "X-Organization-Id": org.id } },
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

async function fetchLocationNas(loc: {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
}): Promise<NasClient[]> {
  const { data } = await api.get<BackendListResponse<BackendNasClient>>(
    `/locations/${loc.id}/nas`,
    {
      params: { page_size: 100 },
      headers: { "X-Organization-Id": loc.organizationId },
    },
  );
  // Delete is a soft delete server-side (status flips to "deleted", the row
  // is never removed) -- the list endpoint keeps returning it forever, so
  // filter it out here rather than showing a dead registration indefinitely.
  return data.items
    .filter((n) => n.status !== "deleted")
    .map((n) => toNasClient(n, loc.name, loc.organizationName));
}

/**
 * There is no backend endpoint to list every NAS across every location at
 * once -- only `GET /locations/{id}/nas` (location-scoped). Fans out one
 * call per location and concatenates client-side, same pattern (and same
 * graceful `allSettled` degradation for locations the caller can't reach)
 * as `router.service.ts`'s own `fetchAllRouters`.
 */
async function fetchAllNas(): Promise<NasClient[]> {
  const locations = await fetchAllLocations();
  const settled = await Promise.allSettled(locations.map((loc) => fetchLocationNas(loc)));
  return settled
    .filter((r): r is PromiseFulfilledResult<NasClient[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

export const nasService = {
  async listByLocation(locationId: string): Promise<NasClient[]> {
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return [];
    return fetchLocationNas(loc);
  },

  async listAll(): Promise<NasClient[]> {
    return fetchAllNas();
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

  async create(locationId: string, payload: CreateNasPayload): Promise<NasClientSecretReveal> {
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === locationId);
    const { data } = await api.post<BackendNasSecretReveal>(
      "/radius/nas",
      {
        router_id: payload.routerId,
        nas_identifier: payload.nasIdentifier,
        shared_secret: payload.sharedSecret,
        name: payload.name,
        description: payload.description,
        ip_address: payload.ipAddress,
      },
      { headers: { "X-Organization-Id": loc?.organizationId } },
    );
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
