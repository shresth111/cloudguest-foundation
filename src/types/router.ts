export type RouterStatus =
  | "pending_provisioning"
  | "provisioning"
  | "online"
  | "offline"
  | "suspended"
  | "decommissioned";

export type HealthStatus = "healthy" | "unhealthy" | null;

export interface RouterDevice {
  id: string;
  locationId: string;
  locationName: string;
  organizationId: string;
  organizationName: string;
  name: string;
  serialNumber: string;
  macAddress: string;
  model: string;
  vendor: string;
  routerOsVersion: string | null;
  managementIpAddress: string | null;
  publicIpAddress: string | null;
  status: RouterStatus;
  lastSeenAt: string | null;
  lastHealthCheckAt: string | null;
  healthStatus: HealthStatus;
  hasApiCredentials: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RouterListQuery {
  search?: string;
  status?: RouterStatus | "all";
  organizationId?: string | "all";
  locationId?: string | "all";
  page: number;
  pageSize: number;
}

export interface RouterListResult {
  /** How many locations could not be read while assembling this list.
   *
   * There is no endpoint that lists routers platform-wide, so the fleet is
   * assembled by fanning `GET /locations/{id}/routers` across every
   * location and concatenating. That fan-out uses `Promise.allSettled` so
   * one unreachable location does not take the whole page down -- correct,
   * but it silently *dropped* the rejected ones, and a router missing from
   * a fleet list is the single thing nobody notices. "Eight routers" and
   * "eight routers plus two locations we could not read" look identical.
   *
   * Zero for the location-scoped path, which reads one location directly
   * and has nothing to fan out. */
  unreachableLocationCount: number;
  rows: RouterDevice[];
  total: number;
}

export interface CreateRouterPayload {
  locationId: string;
  name: string;
  serialNumber: string;
  macAddress: string;
  model: string;
  vendor?: string;
  managementIpAddress?: string;
  publicIpAddress?: string;
  apiUsername?: string;
  apiSecret?: string;
  settings?: Record<string, unknown>;
}

/**
 * What the Master device-add wizard sends to register a TP-Link Omada
 * controller -- contract §11.6.
 *
 * A separate payload from {@link CreateRouterPayload} because it creates a
 * PAIR: the fleet device row *and* the network integration that actually
 * talks to the controller. The endpoint behind it
 * (`POST /network-integrations/platform/onboard`) writes both in one
 * transaction, which is the point -- `guest_sessions.router_id` is NOT NULL,
 * so an Omada venue with only one of the two rows still cannot log a guest in.
 *
 * `organizationId` is carried explicitly rather than taken from a header:
 * this is a GLOBAL-scoped platform route, and the operator calling it has no
 * organization of their own. The backend re-verifies that the location really
 * belongs to that organization before writing anything.
 *
 * `serialNumber`/`macAddress` are optional and travel together. A hardware
 * controller (OC200/OC300) has both on a sticker; a software controller has
 * neither and the backend mints a deterministic, visibly-synthetic identity
 * instead. Sending one without the other is refused.
 */
export interface OnboardControllerPayload {
  organizationId: string;
  locationId: string;
  name: string;
  controllerModel: string;
  baseUrl: string;
  authMode: "openapi" | "legacy";
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  serialNumber?: string;
  macAddress?: string;
  /** Omada ID -- required for a TP-Link cloud controller. */
  controllerId?: string;
  tlsMode?: "strict" | "pinned" | "insecure";
  tlsPinnedSha256?: string;
  /** The Omada site and guest SSID, when the caller already knows them. The
   * device wizard leaves them out (it maps them afterwards on Integrations);
   * the customer wizard collects them up front, because a hotspot operator
   * login cannot list sites and the value is typed in either way. Without a
   * site the backend reports `site_not_selected` and authorises nobody. */
  externalSiteId?: string;
  externalSiteName?: string;
  guestSsidId?: string;
  guestSsidName?: string;
}

/** What came back: the integration id to continue configuring, and the fleet
 * row it was linked to. */
export interface OnboardControllerResult {
  integrationId: string;
  integrationName: string;
  integrationStatus: string;
  routerId: string;
  routerSerialNumber: string;
  routerVendor: string;
  syntheticIdentity: boolean;
  /** The External Portal Server URL the operator pastes into Omada, split as
   * the controller's form splits it -- same fields, same meaning, as
   * `NetworkIntegration.portalUrlScheme`/`portalUrlHostAndQuery`. Both null
   * when the integration cannot serve a guest yet; `portalReadinessGaps`
   * then says why. */
  portalUrlScheme: string | null;
  portalUrlHostAndQuery: string | null;
  portalReadinessGaps: string[];
}

export const ROUTER_STATUS_LABEL: Record<RouterStatus, string> = {
  pending_provisioning: "Pending Provisioning",
  provisioning: "Provisioning",
  online: "Online",
  offline: "Offline",
  suspended: "Suspended",
  decommissioned: "Decommissioned",
};

export type PeerStatus = "pending" | "active" | "revoked";

export type PeerHealthStatus = "healthy" | "stale" | "unknown" | "revoked";

export const PEER_STATUS_LABEL: Record<PeerStatus, string> = {
  pending: "Pending device pull",
  active: "Active",
  revoked: "Revoked",
};

export interface WireGuardPeer {
  id: string;
  routerId: string;
  serverId: string;
  tunnelIpAddress: string;
  publicKey: string;
  status: PeerStatus;
  rotationCount: number;
  lastHandshakeAt: string | null;
  healthStatus: PeerHealthStatus;
  createdAt: string;
  updatedAt: string;
}

/** What `POST /routers/{id}/wireguard-peer/allocate-external` returns --
 * the backend's `WireGuardTunnelCreateResponse`, which is the peer row plus
 * "everything needed to configure the device's local WireGuard interface".
 *
 * NOT named `...Secrets` any more, and the rename is the point. This is the
 * response of the HUB-ALLOCATION path, where the keypair is minted on the
 * hub by `ops/hub-agents/wg_agent.py` and this platform only ever learns the
 * public half (the private half is stored as
 * `EXTERNALLY_MANAGED_KEY_SENTINEL`). So `peerPrivateKey` is genuinely
 * absent whenever an existing peer was reused rather than a new one
 * allocated -- there is no secret at all in that case, and a type that
 * promised one is what let the UI render a "shown once" key panel over a
 * response that had none.
 *
 * The platform-generates-the-keypair path that used to fill this
 * (`POST /routers/{id}/wireguard-peer` and `.../rotate`) is refused by the
 * backend on purpose -- see `HubCannotLearnPlatformKeyError` -- because the
 * hub agent has no verb to be told a public key it did not generate itself,
 * so the tunnel such a keypair describes could never establish. */
export interface WireGuardTunnelAllocation extends WireGuardPeer {
  /** NULL when `reused` is true: the peer's private key was generated ON THE
   * HUB and never held by this platform, so there is nothing to hand back --
   * and nothing that needs handing back, because the device already holds
   * the matching key. Callers rendering a setup script MUST NOT emit a
   * `private-key=` line in that case. */
  peerPrivateKey: string | null;
  /** True when this router already had a usable peer (or was found
   * handshaking on the hub right now) and it was returned as-is instead of a
   * new one being allocated. `wg_agent.py` exposes only `POST /wg/peer`
   * (always mints a NEW peer) and `GET /wg/peers` -- no delete, no update --
   * so every non-reused allocation leaks a peer on the hub permanently. */
  reused: boolean;
  hubPublicKey: string;
  hubEndpointHost: string;
  hubEndpointPort: number;
  tunnelNetworkCidr: string;
  /** The hub's own address *inside* the tunnel (e.g. "10.20.0.1"), distinct
   * from `hubEndpointHost`, which is the public address a router dials to
   * bring the tunnel up. This is the one a router's `/radius add address=`
   * should point at -- see `WireguardPeerInfo.hubTunnelIpAddress`. */
  hubTunnelIpAddress: string;
  persistentKeepaliveSeconds: number;
}

/** Only ever returned once, at the moment it's generated. */
export interface ProvisioningToken {
  routerId: string;
  token: string;
  expiresAt: string;
}

/** One real, currently-available interface read live off the device --
 * already excludes anything bound to a dhcp-server/dhcp-client or the
 * loopback, see the backend's device_adapters module docstring. */
export interface DeviceInterface {
  name: string;
  type: string | null;
  running: boolean;
  disabled: boolean;
  bridge: string | null;
  hasIpAddress: boolean;
}
