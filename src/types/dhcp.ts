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
  createdAt: string;
}

export interface DhcpPoolListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
  /** Threaded through as X-Organization-Id for callers that already have
   * it (the customer dashboard's location-scoped view) -- see
   * dhcp.service.ts's own comment for why this can't just always be
   * resolved internally. */
  organizationId?: string;
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
  organizationId?: string;
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
