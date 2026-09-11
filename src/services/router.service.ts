import { api, type AppError } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  CreateRouterPayload,
  DeviceInterface,
  OnboardControllerPayload,
  OnboardControllerResult,
  ProvisioningToken,
  RouterDevice,
  RouterListQuery,
  RouterListResult,
  RouterStatus,
  WireGuardPeer,
  WireGuardTunnelAllocation,
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
  {
    id: "router-demo-1",
    locationId: "loc-demo-001",
    locationName: "Downtown Branch",
    organizationId: "org-001",
    organizationName: "Acme Corp",
    name: "HT001-CORE",
    serialNumber: "SN-DEMO-001",
    macAddress: "AA:BB:CC:DD:EE:01",
    model: "RB5009UG+S+",
    vendor: "MikroTik",
    routerOsVersion: "7.14",
    managementIpAddress: "10.20.0.1",
    publicIpAddress: "203.0.113.10",
    status: "online",
    lastSeenAt: new Date().toISOString(),
    lastHealthCheckAt: new Date().toISOString(),
    healthStatus: "healthy",
    hasApiCredentials: true,
    settings: {},
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "router-demo-2",
    locationId: "loc-demo-002",
    locationName: "Airport Kiosk",
    organizationId: "org-002",
    organizationName: "Blue Cedar Cafes",
    name: "BCC-KIOSK-01",
    serialNumber: "SN-DEMO-002",
    macAddress: "AA:BB:CC:DD:EE:02",
    model: "hAP ax²",
    vendor: "MikroTik",
    routerOsVersion: "7.13",
    managementIpAddress: "10.20.0.2",
    publicIpAddress: "203.0.113.11",
    status: "online",
    lastSeenAt: new Date().toISOString(),
    lastHealthCheckAt: new Date().toISOString(),
    healthStatus: "healthy",
    hasApiCredentials: true,
    settings: {},
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
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

/** `app/domains/wireguard/schemas.py::WireGuardTunnelCreateResponse`,
 * verified field-by-field against the backend on 2026-09-01. `reused` and
 * `hub_tunnel_ip_address` are NOT optional there (both have concrete
 * defaults and are populated on every branch of
 * `allocate_external_wireguard_peer`); `peer_private_key` really is
 * nullable, and is null on both reuse branches. */
interface BackendWireGuardTunnelAllocation extends BackendWireGuardPeer {
  peer_private_key: string | null;
  reused: boolean;
  hub_public_key: string;
  hub_endpoint_host: string;
  hub_endpoint_port: number;
  tunnel_network_cidr: string;
  hub_tunnel_ip_address: string;
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

function toWireGuardAllocation(p: BackendWireGuardTunnelAllocation): WireGuardTunnelAllocation {
  return {
    ...toWireGuardPeer(p),
    peerPrivateKey: p.peer_private_key ?? null,
    reused: p.reused === true,
    hubPublicKey: p.hub_public_key,
    hubEndpointHost: p.hub_endpoint_host,
    hubEndpointPort: p.hub_endpoint_port,
    tunnelNetworkCidr: p.tunnel_network_cidr,
    hubTunnelIpAddress: p.hub_tunnel_ip_address,
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
async function fetchAllRouters(): Promise<{
  routers: RouterDevice[];
  unreachableLocationCount: number;
}> {
  if (isDemo()) return { routers: DEMO_ROUTERS, unreachableLocationCount: 0 };
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

  // The rejected ones used to be dropped on the floor. Keeping the page up
  // when one location fails is right; not saying so is not -- a router
  // missing from a fleet list is the one thing nobody notices, and an
  // operator counting devices has no way to tell a short list from a
  // complete one. Counted here and surfaced by the caller.
  const rejected = settled.filter((r) => r.status === "rejected");
  if (rejected.length > 0) {
    console.warn(
      `[fleet] ${rejected.length} of ${locations.length} locations could not be read; ` +
        "their routers are missing from this list",
      rejected.map((r) => (r as PromiseRejectedResult).reason),
    );
  }

  return {
    routers: settled
      .filter((r): r is PromiseFulfilledResult<RouterDevice[]> => r.status === "fulfilled")
      .flatMap((r) => r.value),
    unreachableLocationCount: rejected.length,
  };
}

export interface RouterModelGroup {
  series: string;
  models: string[];
}

// A comprehensive, real MikroTik hardware catalog grouped by product series
// -- like models() below, this is a model *picker's* suggestion list, UI
// furniture, not app-state: the real backend field is a plain free-text
// VARCHAR(100), not an enum, so a technician can always type a model that
// isn't in this list (unreleased hardware, a niche SKU we missed, etc).
// Entries are written as "<friendly name> (<RB/CCR/CRS code>)" (or just the
// code, for series where the code *is* the common name) so search-by-code
// and search-by-name both work against the same string.
export const MIKROTIK_MODEL_GROUPS: RouterModelGroup[] = [
  {
    series: "hEX / hAP -- Home & SOHO",
    models: [
      "MikroTik hEX (RB750Gr3)",
      "MikroTik hEX lite (RB750r2)",
      "MikroTik hEX PoE (RB960PGS)",
      "MikroTik hEX PoE lite (RB750UPr2)",
      "MikroTik hEX S",
      "MikroTik hAP lite (RB941-2nD)",
      "MikroTik hAP mini (RB931-2nD)",
      "MikroTik hAP (RB951Ui-2nD)",
      "MikroTik hAP ac (RB962UiGS-5HacT2HnT)",
      "MikroTik hAP ac2 (RBD52G-5HacD2HnD)",
      "MikroTik hAP ac3 (RBD53iG-5HacD2HnD)",
      "MikroTik hAP ax2 (C52iG-5HaxD2HaxD)",
      "MikroTik hAP ax3",
      "MikroTik hAP ax lite (L41G-2axD)",
    ],
  },
  {
    series: "RB450 / RB951 / RB4011 / RB5009 -- Enterprise Desktop",
    models: [
      "MikroTik RB450Gx4",
      "MikroTik RB951G-2HnD",
      "MikroTik RB4011iGS+RM",
      "MikroTik RB4011iGS+5HacQ2HnD-IN",
      "MikroTik RB5009UG+S+IN",
      "MikroTik RB5009UPr+S+IN",
    ],
  },
  {
    series: "CCR -- Cloud Core Router",
    models: [
      "MikroTik CCR1009-7G-1C-1S+",
      "MikroTik CCR1016-12G",
      "MikroTik CCR1036-8G-2S+",
      "MikroTik CCR1072-1G-8S+",
      "MikroTik CCR2004-1G-12S+2XS",
      "MikroTik CCR2004-16G-2S+",
      "MikroTik CCR2116-12G-4S+",
      "MikroTik CCR2216-1G-12XS-2XQ",
    ],
  },
  {
    series: "CRS -- Cloud Router Switch",
    models: [
      "MikroTik CRS106-1C-5S",
      "MikroTik CRS112-8G-4S-IN",
      "MikroTik CRS125-24G-1S-IN",
      "MikroTik CRS226-24G-2S+IN",
      "MikroTik CRS305-1G-4S+IN",
      "MikroTik CRS309-1G-8S+IN",
      "MikroTik CRS310-1G-5S-4S+IN",
      "MikroTik CRS317-1G-16S+",
      "MikroTik CRS326-24G-2S+",
      "MikroTik CRS328-24P-4S+RM",
      "MikroTik CRS354-48G-4S+2Q+RM",
      "MikroTik CRS518-16XS-2XQ",
    ],
  },
  {
    series: "CSS -- Cloud Smart Switch",
    models: ["MikroTik CSS106-1G-4P-1S", "MikroTik CSS326-24G-2S+", "MikroTik CSS610-8G-2S+IN"],
  },
  {
    series: "wAP / cAP -- Wireless Access Points",
    models: [
      "MikroTik wAP (RBwAPr-2nD)",
      "MikroTik wAP ac (RBwAPG-5HacD2HnD)",
      "MikroTik wAP LTE kit",
      "MikroTik cAP ac",
      "MikroTik cAP ax",
      "MikroTik cAP lite",
    ],
  },
  {
    series: "LtAP / Chateau / Audience -- LTE & Consumer",
    models: [
      "MikroTik LtAP mini LTE kit",
      "MikroTik LtAP LTE6 kit",
      "MikroTik Chateau LTE6",
      "MikroTik Chateau LTE12",
      "MikroTik Chateau 5G",
      "MikroTik Chateau ax",
      "MikroTik Audience",
      "MikroTik Audience LTE6 kit",
    ],
  },
];

// TP-Link Omada controller + access-point hardware, same shape and same
// purpose as MIKROTIK_MODEL_GROUPS above: a *suggestion* list for the model
// picker, not a validated enum (`model` is an unconstrained VARCHAR(100)
// server-side, see RouterCreateRequest).
//
// Kept as a separate list rather than appended to the MikroTik one, because
// pushing Omada hardware through a picker headed "hEX / hAP -- Home & SOHO"
// would be actively misleading, and because MikroTik and Omada are parallel
// deployments -- a venue is one or the other, so an operator adding an Omada
// controller should never be scrolling past RouterBOARDs to find it.
//
// "Omada Software Controller" is a first-class entry on purpose. A software
// controller is the most common deployment and it is not a box: it has no
// model plate, so without an explicit option for it an operator would either
// type something ad hoc or pick a hardware SKU that is not there. Note that
// `RouterCreateRequest` still requires a serial number and a 17-character MAC
// -- see CR-004 in /Users/shresth/wyfy-omada/CHANGE-REQUESTS.md, which asks
// the backend what those should be for a software controller rather than
// having the UI invent them.
export const OMADA_MODEL_GROUPS: RouterModelGroup[] = [
  {
    series: "Controllers",
    models: [
      "Omada Software Controller",
      "Omada Cloud-Based Controller",
      "TP-Link OC200",
      "TP-Link OC300",
      "TP-Link OC400",
    ],
  },
  {
    series: "EAP -- Indoor access points",
    models: [
      "TP-Link EAP225",
      "TP-Link EAP245",
      "TP-Link EAP610",
      "TP-Link EAP613",
      "TP-Link EAP650",
      "TP-Link EAP653",
      "TP-Link EAP670",
      "TP-Link EAP772",
      "TP-Link EAP783",
    ],
  },
  {
    series: "EAP -- Outdoor & wall-plate",
    models: [
      "TP-Link EAP225-Outdoor",
      "TP-Link EAP610-Outdoor",
      "TP-Link EAP650-Outdoor",
      "TP-Link EAP225-Wall",
      "TP-Link EAP235-Wall",
      "TP-Link EAP655-Wall",
    ],
  },
  {
    series: "Omada gateways & switches",
    models: [
      "TP-Link ER605",
      "TP-Link ER707-M2",
      "TP-Link ER7206",
      "TP-Link ER8411",
      "TP-Link SG2008P",
      "TP-Link SG2210MP",
      "TP-Link SG3428X",
    ],
  },
];

/** The suggestion list for a vendor. Defaults to MikroTik for any vendor
 * string this build does not know, which is the safe direction: an unknown
 * vendor still gets a working free-text picker rather than an empty one. */
export function routerModelGroupsForVendor(vendor: string | undefined): RouterModelGroup[] {
  return vendor === "tplink_omada" ? OMADA_MODEL_GROUPS : MIKROTIK_MODEL_GROUPS;
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
    let unreachableLocationCount = 0;
    let rows =
      q.locationId && q.locationId !== "all"
        ? await (async () => {
            // When the caller already knows the organization, go straight to
            // the location's routers. The lookup below exists only to
            // recover organizationId/name from the location id, and it runs
            // the platform-wide GET /organizations + a locations call per
            // org -- so a customer dashboard showing N locations paid for
            // that whole fan-out N times over, once per location card, to
            // learn something it already had in hand.
            if (q.organizationId && q.organizationId !== "all") {
              const { data } = await api.get<BackendListResponse<BackendRouter>>(
                `/locations/${q.locationId}/routers`,
                {
                  params: { page_size: 100 },
                  headers: { "X-Organization-Id": q.organizationId },
                },
              );
              return data.items.map((r) => toRouter(r, "", ""));
            }
            const locations = await fetchAllLocations();
            const loc = locations.find((l) => l.id === q.locationId);
            const { data } = await api.get<BackendListResponse<BackendRouter>>(
              `/locations/${q.locationId}/routers`,
              { params: { page_size: 100 }, headers: { "X-Organization-Id": loc?.organizationId } },
            );
            return data.items.map((r) => toRouter(r, loc?.name ?? "", loc?.organizationName ?? ""));
          })()
        : await (async () => {
            const fleet = await fetchAllRouters();
            unreachableLocationCount = fleet.unreachableLocationCount;
            return fleet.routers;
          })();

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
    return { rows, total, unreachableLocationCount };
  },

  async get(id: string): Promise<RouterDevice | null> {
    const { data } = await api.get<BackendRouter>(`/routers/${id}`);
    const locations = await fetchAllLocations();
    const loc = locations.find((l) => l.id === data.location_id);
    return toRouter(data, loc?.name ?? "", loc?.organizationName ?? "");
  },

  /**
   * Registration, then -- only if the operator filled in the optional
   * "API Access" step -- the credential push.
   *
   * Two calls, not one, because `POST /locations/{id}/routers` no longer
   * accepts `api_username`/`api_secret` at all. That endpoint is gated on
   * `routers.create` at ORGANIZATION scope, which `organization-owner` (the
   * role every provisioned venue owner holds) has in full, so a credential
   * field on its request schema was settable by a venue owner. The backend
   * moved both fields onto `PUT /platform/routers/{id}/management-access`,
   * which is GLOBAL-scope-only.
   *
   * This wizard is only ever rendered from `/routers` and `/master/routers`,
   * both of which already require a global-scope role assignment
   * (`_authenticated.tsx`'s `isOperator` gate and `master.tsx`'s), so the
   * second call is reachable by every caller that can reach the first.
   *
   * The credential push is deliberately NOT swallowed: if it fails, the
   * router exists but the platform holds no credential for it, and the
   * operator has to know that rather than find out when the control plane
   * later cannot reach the device.
   */
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
        settings: payload.settings ?? {},
      },
      { headers: { "X-Organization-Id": loc?.organizationId } },
    );
    if (payload.apiUsername || payload.apiSecret) {
      await api.put(`/platform/routers/${data.id}/management-access`, {
        ...(payload.apiUsername ? { api_username: payload.apiUsername } : {}),
        ...(payload.apiSecret ? { api_secret: payload.apiSecret } : {}),
      });
    }
    return toRouter(data, loc?.name ?? "", loc?.organizationName ?? "");
  },

  /**
   * Register a TP-Link Omada controller: the fleet device row and the network
   * integration that drives it, created together -- contract §11.6.
   *
   * ## Why this lives here and not in `network-integration.service.ts`
   *
   * Because its caller is the Router Fleet's device-add wizard and its
   * product is a fleet device. The customer-facing integration service is
   * deliberately kept free of any router reference (its own contract test
   * asserts that, per §10: an operator on the customer Integrations page must
   * never be offered a "view router" affordance, because the row behind it is
   * synthetic and would send them chasing hardware nobody installed). This is
   * the Master side, where the fleet row is the entire point.
   *
   * ## No organization header
   *
   * A `/platform/` route, GLOBAL-scoped like every other one in this domain.
   * Attaching `X-Organization-Id` here would narrow a platform operator to a
   * single tenant while looking like it worked. The tenant is in the body
   * instead, and the backend re-checks the location against it.
   *
   * ## The longer timeout
   *
   * Same reasoning as the connection test: this is a write, but the backend
   * validates the controller URL by resolving it before it stores anything,
   * and the controller may be at the far end of a hotel's ADSL line.
   */
  async onboardController(payload: OnboardControllerPayload): Promise<OnboardControllerResult> {
    const { data } = await api.post<{
      integration: {
        id: string;
        name: string;
        status: string;
        portal_url_scheme?: string | null;
        portal_url_host_and_query?: string | null;
        portal_readiness_gaps?: string[] | null;
      };
      router_id: string;
      router_serial_number: string;
      router_vendor: string;
      synthetic_identity: boolean;
    }>(
      "/network-integrations/platform/onboard",
      {
        organization_id: payload.organizationId,
        location_id: payload.locationId,
        provider: "omada",
        name: payload.name,
        controller_model: payload.controllerModel,
        base_url: payload.baseUrl,
        auth_mode: payload.authMode,
        // Top-level, matching `_CredentialFields` on the backend -- see
        // `network-integration.service.ts`'s note on why a nested object here
        // is silently dropped rather than rejected. The app pair goes only
        // with Open API; the hotspot operator pair goes with BOTH modes,
        // because the controller only lets a guest online through the
        // operator login -- an Open API controller onboarded without it
        // could never authorise anyone (see `credentialsForMode`).
        ...(payload.authMode === "openapi"
          ? {
              ...(payload.clientId ? { client_id: payload.clientId } : {}),
              ...(payload.clientSecret ? { client_secret: payload.clientSecret } : {}),
            }
          : {}),
        ...(payload.username ? { username: payload.username } : {}),
        ...(payload.password ? { password: payload.password } : {}),
        // Certificate trust and the Omada ID, omitted unless set so the
        // backend's `strict` default stands.
        ...(payload.controllerId?.trim() ? { controller_id: payload.controllerId.trim() } : {}),
        ...(payload.tlsMode ? { tls_mode: payload.tlsMode } : {}),
        ...(payload.tlsMode === "pinned" && payload.tlsPinnedSha256
          ? { tls_pinned_sha256: payload.tlsPinnedSha256 }
          : {}),
        // Omitted entirely rather than sent as null when absent: the backend
        // reads "both absent" as "software controller, mint an identity", and
        // an explicit null would take the same branch but says something
        // different about intent.
        ...(payload.serialNumber ? { serial_number: payload.serialNumber } : {}),
        ...(payload.macAddress ? { mac_address: payload.macAddress } : {}),
        // Site and SSID, only when given -- the device wizard maps them later.
        ...(payload.externalSiteId?.trim()
          ? { external_site_id: payload.externalSiteId.trim() }
          : {}),
        ...(payload.externalSiteName?.trim()
          ? { external_site_name: payload.externalSiteName.trim() }
          : {}),
        ...(payload.guestSsidId?.trim() ? { guest_ssid_id: payload.guestSsidId.trim() } : {}),
        ...(payload.guestSsidName?.trim() ? { guest_ssid_name: payload.guestSsidName.trim() } : {}),
      },
      { timeout: 60_000 },
    );
    return {
      integrationId: data.integration.id,
      integrationName: data.integration.name,
      integrationStatus: data.integration.status,
      routerId: data.router_id,
      routerSerialNumber: data.router_serial_number,
      routerVendor: data.router_vendor,
      syntheticIdentity: data.synthetic_identity,
      // `integration` is the backend's full `NetworkIntegrationResponse`, so
      // the portal URL comes back with it -- same `?? null` pairing as
      // `toIntegration` in network-integration.service.ts, so an absent field
      // never renders as a copyable empty string.
      portalUrlScheme: data.integration.portal_url_scheme ?? null,
      portalUrlHostAndQuery: data.integration.portal_url_host_and_query ?? null,
      portalReadinessGaps: data.integration.portal_readiness_gaps ?? [],
    };
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

  /* REMOVED, DELIBERATELY, 2026-09-01: `createWireGuardPeer` (POST
   * `/routers/{id}/wireguard-peer`) and `rotateWireGuardPeer` (POST
   * `/routers/{id}/wireguard-peer/rotate`).
   *
   * Both called the backend's PLATFORM-GENERATES-THE-KEYPAIR path, which
   * `app/domains/wireguard/service.py` now refuses outright with
   * `HubCannotLearnPlatformKeyError` (409) -- `create_tunnel` at :1908,
   * `rotate_tunnel` at :2148. The refusal is correct and must not be worked
   * around: `ops/hub-agents/wg_agent.py` exposes only `POST /wg/peer` (which
   * mints its OWN keypair and returns it) and `GET /wg/peers`. There is no
   * verb that accepts a public key the caller already holds, so a keypair
   * generated on the platform side exists in exactly one place -- the
   * platform's database -- while the hub goes on expecting the previous key.
   * The tunnel it describes can never handshake, and nothing downstream
   * notices: the device pulls a private key that works, and the only symptom
   * is a tunnel that is silently, permanently down. Confirmed live on router
   * 21e13913 (see that exception's docstring).
   *
   * They are removed rather than left deprecated so no future caller can
   * fall back into them by autocomplete. The one correct way to give a
   * router a tunnel from this console is `allocateWireGuardPeerFromHub`
   * below -- the hub mints the keypair, so both sides know it by
   * construction. */

  /** THE ONLY WAY TO GIVE A ROUTER A WIREGUARD TUNNEL from this console.
   *
   * `POST /routers/{id}/wireguard-peer/allocate-external` -- the backend
   * calls the hub's agent bridge server-side (the bridge is a bare
   * `http.server.BaseHTTPRequestHandler` with no CORS/OPTIONS support, so a
   * browser `fetch()` at it always fails), registers what the hub minted,
   * and returns the same "everything needed to configure the device" bundle.
   * Same shape `RouterSetupScriptAdvanced` has been using since 2026-08-23.
   *
   * REUSE IS THE DEFAULT AND THAT IS LOAD-BEARING. `wg_agent.py` has no
   * delete and no update verb (a DELETE answers `501 Unsupported method`),
   * so every allocation that does not reuse leaks a peer on the hub
   * permanently: it keeps its `allowed_ips`, and `next_free_ip()` scans live
   * kernel state, so it consumes an address out of the /24 forever. Router
   * 01c9171e reached 10.20.0.5 while its device was still on .3.
   *
   * `rotate` asks for a fresh keypair instead of reuse. It is NOT sufficient
   * on its own: the backend independently refuses to allocate over a device
   * the hub reports handshaking right now (it adopts that live identity
   * instead and returns `reused: true`), because no server-side action can
   * make a device change the key it already imported. `force` overrides even
   * that and is destructive and unreclaimable -- this console deliberately
   * never sends it; see the WireGuard tab's own comment. */
  async allocateWireGuardPeerFromHub(
    routerId: string,
    options: { rotate?: boolean } = {},
  ): Promise<WireGuardTunnelAllocation> {
    const query = options.rotate ? "?rotate=true" : "";
    const { data } = await api.post<BackendWireGuardTunnelAllocation>(
      `/routers/${routerId}/wireguard-peer/allocate-external${query}`,
    );
    return toWireGuardAllocation(data);
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
  async getDeviceConnection(
    routerId: string,
  ): Promise<{ host: string | null; username: string | null; password: string | null }> {
    const { data } = await api.get<{
      host: string | null;
      username: string | null;
      password: string | null;
    }>(`/routers/${routerId}/device-connection`);
    return data;
  },

  // No `organizationId` argument: `attachOrganizationScope` (services/api.ts)
  // supplies X-Organization-Id for every organization-scoped session, and its
  // one caller (DhcpManagement's pool dialog) used to have to resolve that id
  // first -- which is what put it in a React Query key and refetched.
  async getDeviceInterfaces(routerId: string): Promise<DeviceInterface[]> {
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
    // real backend field is a plain free-text string, not an enum. See
    // MIKROTIK_MODEL_GROUPS above for the grouped/searchable version used by
    // RouterModelCombobox.
    return MIKROTIK_MODEL_GROUPS.flatMap((g) => g.models);
  },
};
