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

/** Only ever returned once, at the moment a tunnel is created or rotated. */
export interface WireGuardTunnelSecrets extends WireGuardPeer {
  peerPrivateKey: string;
  hubPublicKey: string;
  hubEndpointHost: string;
  hubEndpointPort: number;
  tunnelNetworkCidr: string;
  persistentKeepaliveSeconds: number;
}

/** Only ever returned once, at the moment it's generated. */
export interface ProvisioningToken {
  routerId: string;
  token: string;
  expiresAt: string;
}
