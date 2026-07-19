export type RouterStatus =
  | "online"
  | "offline"
  | "maintenance"
  | "provisioning"
  | "suspended"
  | "error";

export type TunnelStatus = "up" | "down" | "connecting";
export type ServiceStatus = "running" | "stopped" | "error";

export interface RouterDevice {
  id: string;
  name: string;
  mikrotikIdentity: string;
  nasId: string;
  organizationId: string;
  organizationName: string;
  locationId: string;
  locationName: string;
  model: string;
  serialNumber: string;
  routerOsVersion: string;
  latestOsVersion: string;
  publicIp: string;
  privateIp: string;
  wireguardStatus: TunnelStatus;
  radiusStatus: ServiceStatus;
  internetStatus: "online" | "offline" | "degraded";
  uptimeHours: number;
  cpuPct: number;
  ramPct: number;
  storagePct: number;
  temperatureC: number;
  latencyMs: number;
  packetLossPct: number;
  activeGuests: number;
  activeSessions: number;
  status: RouterStatus;
  lastSeen: string;
  createdAt: string;
  // Config
  wanIp: string;
  lanIp: string;
  dns: string;
  gateway: string;
  timezone: string;
  sharedSecret: string;
  apiPort: number;
  apiUsername: string;
  services: {
    freeradius: boolean;
    wireguard: boolean;
    captivePortal: boolean;
    guestWifi: boolean;
    monitoring: boolean;
    analytics: boolean;
  };
}

export interface RouterListQuery {
  search?: string;
  status?: RouterStatus | "all";
  organizationId?: string | "all";
  locationId?: string | "all";
  model?: string | "all";
  page: number;
  pageSize: number;
  sortBy?: keyof RouterDevice;
  sortDir?: "asc" | "desc";
}

export interface RouterListResult {
  rows: RouterDevice[];
  total: number;
}

export interface CreateRouterPayload {
  basic: {
    name: string;
    organizationId: string;
    locationId: string;
    model: string;
    serialNumber: string;
    mikrotikIdentity: string;
  };
  network: {
    wanIp: string;
    lanIp: string;
    dns: string;
    gateway: string;
    timezone: string;
  };
  auth: {
    nasId: string;
    sharedSecret: string;
    apiPort: number;
    apiUsername: string;
    apiPassword: string;
  };
  services: {
    freeradius: boolean;
    wireguard: boolean;
    captivePortal: boolean;
    guestWifi: boolean;
    monitoring: boolean;
    analytics: boolean;
  };
}

export const ROUTER_STATUS_LABEL: Record<RouterStatus, string> = {
  online: "Online",
  offline: "Offline",
  maintenance: "Maintenance",
  provisioning: "Provisioning",
  suspended: "Suspended",
  error: "Error",
};

export interface ConnectedDevice {
  id: string;
  name: string;
  mac: string;
  ip: string;
  guestName: string;
  connectedSince: string;
  downloadMb: number;
  uploadMb: number;
  rssi: number;
}

export interface WireGuardPeer {
  id: string;
  name: string;
  publicKey: string;
  endpoint: string;
  allowedIps: string;
  lastHandshake: string;
  status: TunnelStatus;
}

export interface RouterAlert {
  id: string;
  type: "cpu" | "memory" | "offline" | "wireguard" | "radius" | "wan";
  title: string;
  severity: "info" | "warning" | "critical";
  raisedAt: string;
}
