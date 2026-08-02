import { api, type AppError } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  CreateRouterPayload,
  DeviceInterface,
  ProvisioningToken,
  RouterDevice,
  RouterListQuery,
  RouterListResult,
  RouterStatus,
  WireGuardPeer,
  WireGuardTunnelSecrets,
} from "@/types/router";

// Same demo-session gap already fixed in location.service.ts/
// organization.service.ts/billing.service.ts -- the Master Console's demo
// sign-in issues a token the real backend never accepts, so every real call
// this file makes (routed through fetchAllOrganizations() below) 401ed.
// That left both Router Fleet (master.routers.tsx, which used to skip this
// service entirely and show an always-the-same hardcoded fleet regardless
// of account -- see that route's own comment) and the real Device Console's
// router picker (master.console.tsx, which does call routerService.list())
// with nothing to show under a demo session.
const DEMO_ORGS: { id: string; name: string }[] = [
  { id: "org-001", name: "Acme Corp" },
  { id: "org-002", name: "Blue Cedar Cafes" },
];

const DEMO_ROUTERS: RouterDevice[] = [
  { id: "router-demo-1", locationId: "loc-demo-001", locationName: "Downtown Branch", organizationId: "org-001", organizationName: "Acme Corp", name: "HT001-CORE", serialNumber: "SN-DEMO-001", macAddress: "AA:BB:CC:DD:EE:01", model: "RB5009UG+S+", vendor: "MikroTik", routerOsVersion: "7.14", managementIpAddress: "10.20.0.1", publicIpAddress: "203.0.113.10", status: "online", lastSeenAt: new Date().toISOString(), lastHealthCheckAt: new Date().toISOString(), healthStatus: "healthy", hasApiCredentials: true, settings: {}, createdAt: new Date(Date.now() - 90 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: "router-demo-2", locationId: "loc-demo-002", locationName: "Airport Kiosk", organizationId: "org-002", organizationName: "Blue Cedar Cafes", name: "BCC-KIOSK-01", serialNumber: "SN-DEMO-002", macAddress: "AA:BB:CC:DD:EE:02", model: "hAP ax²", vendor: "MikroTik", routerOsVersion: "7.13", managementIpAddress: "10.20.0.2", publicIpAddress: "203.0.113.11", status: "online", lastSeenAt: new Date().toISOString(), lastHealthCheckAt: new Date().toISOString(), healthStatus: "healthy", hasApiCredentials: true, settings: {}, createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
];

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
  if (isDemo()) return DEMO_ORGS;
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
  if (isDemo()) return DEMO_ROUTERS;
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
  /**
   * Location-scoped router listing for callers that already know both the
   * location and its organization id (e.g. the customer dashboard's ISP
   * Details page, which gets `locationId` from the route and
   * `organizationId` from `customer.service.ts`'s `resolveOrgId()`) --
   * skips `list()`'s own `fetchAllLocations()` -> `fetchAllOrganizations()`
   * fan-out entirely. That fan-out hits the platform-wide `GET
   * /organizations` (GLOBAL scope only), which an ordinary customer/
   * org-owner session 403s on -- the identical gap `resolveOrgId()`'s own
   * docstring documents for MAC authorization, applied here to routers.
   */
  async listForLocation(locationId: string, organizationId: string): Promise<RouterDevice[]> {
    if (isDemo()) return DEMO_ROUTERS.filter((r) => r.locationId === locationId);
    const { data } = await api.get<BackendListResponse<BackendRouter>>(
      `/locations/${locationId}/routers`,
      { params: { page_size: 100 }, headers: { "X-Organization-Id": organizationId } },
    );
    return data.items.map((r) => toRouter(r, "", ""));
  },

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

  /** Real, immediate `/system reboot` on the physical device -- every
   * connected guest drops and the router is unreachable for its normal
   * ~1-2 minute boot cycle. Throws (via the shared api instance's
   * interceptor) on a real failure -- caller must catch/toast. */
  async reboot(routerId: string): Promise<void> {
    await api.post(`/routers/${routerId}/reboot`);
  },

  /** Decrypted RouterOS connection details for Master Console's "Remote
   * Access" panel (WinBox/API login) -- `routers.manage`-gated, and every
   * call is audited server-side (`AuditAction.ROUTER_CREDENTIALS_REVEALED`)
   * since this hands back a real secret, not just metadata. `host` is the
   * router's WireGuard tunnel IP when one exists (the only address
   * reliably reachable for a remote router behind NAT/CGNAT). */
  async getDeviceConnection(routerId: string): Promise<{ host: string | null; username: string | null; password: string | null }> {
    const { data } = await api.get<{ host: string | null; username: string | null; password: string | null }>(
      `/routers/${routerId}/device-connection`,
    );
    return data;
  },

  /** Mints a short-lived, single-router-scoped token for the WebFig proxy
   * iframe below (see backend router.py's create_webfig_session -- the
   * real routers.manage authorization happens there; the token itself is
   * a narrow capability, not the caller's own session). */
  async createWebfigSession(routerId: string): Promise<{ sessionToken: string; expiresIn: number }> {
    const { data } = await api.post<{ session_token: string; expires_in: number }>(`/routers/${routerId}/webfig-session`);
    return { sessionToken: data.session_token, expiresIn: data.expires_in };
  },

  /** Base URL for the WebFig proxy iframe -- resolved against this app's
   * own API base (relative in production, so no CORS/mixed-origin issue),
   * with the session token as a query param since an <iframe src> can't
   * carry an Authorization header. */
  webfigProxyUrl(routerId: string, sessionToken: string): string {
    const base = (api.defaults.baseURL ?? "/api/v1").replace(/\/$/, "");
    return `${base}/routers/${routerId}/webfig/?session=${encodeURIComponent(sessionToken)}`;
  },

  async getDeviceInterfaces(routerId: string, organizationId?: string): Promise<DeviceInterface[]> {
    interface BackendDeviceInterface {
      name: string;
      type: string | null;
      running: boolean;
      disabled: boolean;
      bridge: string | null;
      has_ip_address: boolean;
    }
    const { data } = await api.get<{ interfaces: BackendDeviceInterface[] }>(
      `/routers/${routerId}/device-interfaces`,
      organizationId ? { headers: { "X-Organization-Id": organizationId } } : {},
    );
    return data.interfaces.map((i) => ({
      name: i.name,
      type: i.type,
      running: i.running,
      disabled: i.disabled,
      bridge: i.bridge,
      hasIpAddress: i.has_ip_address,
    }));
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
