export type VlanStatus = "active" | "draft" | "disabled";
export type IspBinding = "primary" | "secondary" | "failover" | "none";

export interface Vlan {
  id: string;
  vlanId: number;                 // 802.1Q tag, 1-4094
  name: string;
  description?: string;
  subnet: string;                 // CIDR
  gateway: string;
  dnsPrimary: string;
  dnsSecondary?: string;
  dhcpEnabled: boolean;
  dhcpRangeStart?: string;
  dhcpRangeEnd?: string;
  leaseMinutes: number;
  isolation: boolean;             // client isolation
  isp: IspBinding;
  locationIds: string[];
  routerIds: string[];
  ssids: string[];
  status: VlanStatus;
  createdAt: number;
  updatedAt: number;
  clients: number;
  throughputMbps: number;
}

export interface VlanKpis {
  total: number;
  active: number;
  disabled: number;
  clients: number;
  totalThroughputMbps: number;
}
