export type DhcpDevicePushStatus = "pending" | "active" | "failed";

export interface DhcpPool {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  interface: string | null;
  addressRangeStart: string;
  addressRangeEnd: string;
  gatewayIpAddress: string | null;
  dnsPrimary: string | null;
  dnsSecondary: string | null;
  leaseTimeSeconds: number;
  isEnabled: boolean;
  /** Whether a real `/ip pool` + `/ip dhcp-server` + `/ip dhcp-server
   * network` triple for this pool exists on the router right now.
   * Deliberately separate from `isEnabled`, which is only intent: a pool
   * can be enabled and never have reached a device. */
  devicePushStatus: DhcpDevicePushStatus;
  /** Raw device error from the last failed push, shown verbatim. */
  devicePushError: string | null;
  devicePushedAt: string | null;
  createdAt: string;
}

export interface DhcpPoolListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface DhcpPoolListResult {
  rows: DhcpPool[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateDhcpPoolPayload {
  routerId: string;
  name: string;
  addressRangeStart: string;
  addressRangeEnd: string;
  interface?: string | null;
  gatewayIpAddress?: string | null;
  dnsPrimary?: string | null;
  dnsSecondary?: string | null;
  leaseTimeSeconds?: number;
  isEnabled?: boolean;
}

export interface UpdateDhcpPoolPayload {
  name?: string;
  addressRangeStart?: string;
  addressRangeEnd?: string;
  interface?: string | null;
  gatewayIpAddress?: string | null;
  dnsPrimary?: string | null;
  dnsSecondary?: string | null;
  leaseTimeSeconds?: number;
  isEnabled?: boolean;
}
