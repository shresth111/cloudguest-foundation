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
