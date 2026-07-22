export interface Vlan {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  vlanId: number; // 802.1Q tag, 1-4094
  name: string;
  gatewayIpAddress: string | null;
  cidr: string | null;
  interface: string | null;
  description: string | null;
  isEnabled: boolean;
  createdAt: string;
}

export interface VlanListQuery {
  routerId?: string;
  locationId?: string;
  page: number;
  pageSize: number;
}

export interface VlanListResult {
  rows: Vlan[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateVlanPayload {
  routerId: string;
  vlanId: number;
  name: string;
  gatewayIpAddress?: string | null;
  cidr?: string | null;
  interface?: string | null;
  description?: string | null;
  isEnabled?: boolean;
}

export interface UpdateVlanPayload {
  vlanId?: number;
  name?: string;
  gatewayIpAddress?: string | null;
  cidr?: string | null;
  interface?: string | null;
  description?: string | null;
  isEnabled?: boolean;
}

export interface VlanKpis {
  total: number;
  enabled: number;
  disabled: number;
}
