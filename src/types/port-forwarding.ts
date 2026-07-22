export interface PortForwardingRule {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  protocol: string; // "tcp" | "udp" | "both"
  sourceAddress: string | null;
  destinationAddress: string | null;
  destinationPort: number;
  internalAddress: string;
  internalPort: number;
  description: string | null;
  isEnabled: boolean;
  createdAt: string;
}

export interface PortForwardingListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface PortForwardingListResult {
  rows: PortForwardingRule[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreatePortForwardingPayload {
  routerId: string;
  name: string;
  protocol?: string;
  sourceAddress?: string | null;
  destinationAddress?: string | null;
  destinationPort: number;
  internalAddress: string;
  internalPort: number;
  description?: string | null;
  isEnabled?: boolean;
}

export interface UpdatePortForwardingPayload {
  name?: string;
  protocol?: string;
  sourceAddress?: string | null;
  destinationAddress?: string | null;
  destinationPort?: number;
  internalAddress?: string;
  internalPort?: number;
  description?: string | null;
  isEnabled?: boolean;
}

export interface PortForwardingKpis {
  total: number;
  enabled: number;
  disabled: number;
}
