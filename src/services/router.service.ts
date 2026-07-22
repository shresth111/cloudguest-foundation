import { api, type AppError } from "@/services/api";
import type {
  CreateRouterPayload,
  ProvisioningToken,
  RouterDevice,
  RouterListQuery,
  RouterListResult,
  RouterStatus,
  WireGuardPeer,
  WireGuardTunnelSecrets,
} from "@/types/router";

interface BackendRouter {
  id: string;
  location_id: string;
  organization_id: string;
  name: string;
  serial_number: string;
  mac_address: string;
  model: string;
  vendor: string;
  routeros_version: string | null;
  management_ip_address: string | null;
  public_ip_address: string | null;
  status: RouterStatus;
  last_seen_at: string | null;
  last_health_check_at: string | null;
  health_status: "healthy" | "unhealthy" | null;
  has_api_credentials: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BackendOrgListItem {
  id: string;
  name: string;
}

interface BackendListResponse<T> {
  items: T[];
  total_items: number;
}

interface BackendWireGuardPeer {
  id: string;
  router_id: string;
  server_id: string;
  tunnel_ip_address: string;
  public_key: string;
  status: "pending" | "active" | "revoked";
  rotation_count: number;
  last_handshake_at: string | null;
  health_status: "healthy" | "stale" | "unknown" | "revoked";
  created_at: string;
  updated_at: string;
}

interface BackendWireGuardTunnelSecrets extends BackendWireGuardPeer {
  peer_private_key: string;
  hub_public_key: string;
  hub_endpoint_host: string;
  hub_endpoint_port: number;
  tunnel_network_cidr: string;
  persistent_keepalive_seconds: number;
}

function toRouter(r: BackendRouter, locationName: string, organizationName: string): RouterDevice {
  return {
    id: r.id,
    locationId: r.location_id,
    locationName,
    organizationId: r.organization_id,
    organizationName,
    name: r.name,
    serialNumber: r.serial_number,
    macAddress: r.mac_address,
    model: r.model,
    vendor: r.vendor,
    routerOsVersion: r.routeros_version,
    managementIpAddress: r.management_ip_address,
    publicIpAddress: r.public_ip_address,
    status: r.status,
    lastSeenAt: r.last_seen_at,
    lastHealthCheckAt: r.last_health_check_at,
    healthStatus: r.health_status,
    hasApiCredentials: r.has_api_credentials,
    settings: r.settings,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toWireGuardPeer(p: BackendWireGuardPeer): WireGuardPeer {
  return {
    id: p.id,
    routerId: p.router_id,
    serverId: p.server_id,
    tunnelIpAddress: p.tunnel_ip_address,
    publicKey: p.public_key,
    status: p.status,
    rotationCount: p.rotation_count,
    lastHandshakeAt: p.last_handshake_at,
    healthStatus: p.health_status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

function toWireGuardSecrets(p: BackendWireGuardTunnelSecrets): WireGuardTunnelSecrets {
  return {
    ...toWireGuardPeer(p),
    peerPrivateKey: p.peer_private_key,
    hubPublicKey: p.hub_public_key,
    hubEndpointHost: p.hub_endpoint_host,
    hubEndpointPort: p.hub_endpoint_port,
    tunnelNetworkCidr: p.tunnel_network_cidr,
    persistentKeepaliveSeconds: p.persistent_keepalive_seconds,
  };
}

async function fetchAllOrganizations(): Promise<BackendOrgListItem[]> {
  const { data } = await api.get<BackendListResponse<BackendOrgListItem>>("/organizations", {
    params: { page_size: 100 },
  });
  return data.items;
}

interface BackendLocation {
  id: string;
  name: string;
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

/**
 * There is no backend endpoint to list routers across every location at
 * once -- only `GET /locations/{id}/routers` (location-scoped). Fans out
 * one call per location and concatenates client-side, same pattern (and
 * same graceful `allSettled` degradation for locations the caller can't
 * reach) as `location.service.ts`'s own `fetchAllLocations`.
 */
async function fetchAllRouters(): Promise<RouterDevice[]> {
  const locations = await fetchAllLocations();
  const settled = await Promise.allSettled(
    locations.map(async (loc) => {
      const { data } = await api.get<BackendListResponse<BackendRouter>>(
        `/locations/${loc.id}/routers`,
        { params: { page_size: 100 }, headers: { "X-Organization-Id": loc.organizationId } },
      );
      return data.items.map((r) => toRouter(r, loc.name, loc.organizationName));
    }),
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<RouterDevice[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

export const routerService = {
  async list(q: RouterListQuery): Promise<RouterListResult> {
    let rows =
      q.locationId && q.locationId !== "all"
        ? await (async () => {
            const locations = await fetchAllLocations();
            const loc = locations.find((l) => l.id === q.locationId);
            const { data } = await api.get<BackendListResponse<BackendRouter>>(
              `/locations/${q.locationId}/routers`,
              { params: { page_size: 100 }, headers: { "X-Organization-Id": loc?.organizationId } },
            );
            return data.items.map((r) => toRouter(r, loc?.name ?? "", loc?.organizationName ?? ""));
          })()
        : await fetchAllRouters();

    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.serialNumber.toLowerCase().includes(s) ||
          (r.publicIpAddress ?? "").includes(s) ||
          r.locationName.toLowerCase().includes(s) ||
          r.organizationName.toLowerCase().includes(s),
      );
    }
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    if (q.organizationId && q.organizationId !== "all")
      rows = rows.filter((r) => r.organizationId === q.organizationId);

    const total = rows.length;
    const start = (q.page - 1) * q.pageSize;
    rows = rows.slice(start, start + q.pageSize);
    return { rows, total };
  },

  async get(id: string): Promise<RouterDevice | null> {
    const { data } = await api.get<BackendRouter>(`/routers/${id}`);
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === data.location_id);
    return toRouter(data, loc?.name ?? "", loc?.organizationName ?? "");
  },

  async create(payload: CreateRouterPayload): Promise<RouterDevice> {
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === payload.locationId);
    const { data } = await api.post<BackendRouter>(
      `/locations/${payload.locationId}/routers`,
      {
        name: payload.name,
        serial_number: payload.serialNumber,
        mac_address: payload.macAddress,
        model: payload.model,
        vendor: payload.vendor,
        management_ip_address: payload.managementIpAddress,
        public_ip_address: payload.publicIpAddress,
        api_username: payload.apiUsername,
        api_secret: payload.apiSecret,
        settings: payload.settings ?? {},
      },
      { headers: { "X-Organization-Id": loc?.organizationId } },
    );
    return toRouter(data, loc?.name ?? "", loc?.organizationName ?? "");
  },

  async updateStatus(ids: string[], status: RouterStatus): Promise<void> {
    const endpoint = status === "suspended" ? "suspend" : "reinstate";
    await Promise.all(ids.map((id) => api.post(`/routers/${id}/${endpoint}`)));
  },

  async remove(ids: string[]): Promise<void> {
    // Decommission -- the real backend never hard-deletes a router.
    await Promise.all(ids.map((id) => api.delete(`/routers/${id}`)));
  },

  async generateProvisioningToken(routerId: string): Promise<ProvisioningToken> {
    const { data } = await api.post<{ router_id: string; token: string; expires_at: string }>(
      `/routers/${routerId}/provisioning-token`,
    );
    return { routerId: data.router_id, token: data.token, expiresAt: data.expires_at };
  },

  async getWireGuardPeer(routerId: string): Promise<WireGuardPeer | null> {
    try {
      const { data } = await api.get<BackendWireGuardPeer>(`/routers/${routerId}/wireguard-peer`);
      return toWireGuardPeer(data);
    } catch (err) {
      if ((err as AppError).status === 404) return null;
      throw err;
    }
  },

  async createWireGuardPeer(routerId: string): Promise<WireGuardTunnelSecrets> {
    const { data } = await api.post<BackendWireGuardTunnelSecrets>(
      `/routers/${routerId}/wireguard-peer`,
    );
    return toWireGuardSecrets(data);
  },

  async rotateWireGuardPeer(routerId: string): Promise<WireGuardTunnelSecrets> {
    const { data } = await api.post<BackendWireGuardTunnelSecrets>(
      `/routers/${routerId}/wireguard-peer/rotate`,
    );
    return toWireGuardSecrets(data);
  },

  async revokeWireGuardPeer(routerId: string): Promise<void> {
    await api.delete(`/routers/${routerId}/wireguard-peer`);
  },

  async organizations(): Promise<{ id: string; name: string }[]> {
    return fetchAllOrganizations();
  },

  async locations(): Promise<{ id: string; name: string; organizationId: string }[]> {
    return fetchAllLocations();
  },

  models(): string[] {
    // A model picker's suggestion list -- UI furniture, not app-state; the
    // real backend field is a plain free-text string, not an enum.
    return [
      "MikroTik CCR2004-1G-12S+2XS",
      "MikroTik CCR2116-12G-4S+",
      "MikroTik RB5009UG+S+IN",
      "MikroTik hEX S",
      "MikroTik hAP ax3",
      "MikroTik CRS326-24G-2S+",
    ];
  },
};
