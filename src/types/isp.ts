export type IspLinkRole = "primary" | "backup";

export interface IspLink {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  providerName: string;
  linkType: string;
  role: IspLinkRole;
  isActiveUplink: boolean;
  autoFailback: boolean;
  isEnabled: boolean;
  priority: number;
  interface: string | null;
  gatewayIpAddress: string | null;
  dnsPrimary: string | null;
  dnsSecondary: string | null;
  downloadBandwidthMbps: number | null;
  uploadBandwidthMbps: number | null;
  healthStatus: string;
  latencyMs: number | null;
  packetLossPercentage: number | null;
  lastCheckedAt: string | null;
  consecutiveUnhealthyCount: number;
  createdAt: string;
}

export interface IspLinkListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface IspLinkListResult {
  rows: IspLink[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateIspLinkPayload {
  routerId: string;
  providerName: string;
  linkType?: string;
  role: IspLinkRole;
  priority?: number;
  interface?: string | null;
  gatewayIpAddress?: string | null;
  dnsPrimary?: string | null;
  dnsSecondary?: string | null;
  downloadBandwidthMbps?: number | null;
  uploadBandwidthMbps?: number | null;
  autoFailback?: boolean;
}

export interface UpdateIspLinkPayload {
  providerName?: string;
  linkType?: string;
  role?: IspLinkRole;
  priority?: number;
  interface?: string | null;
  gatewayIpAddress?: string | null;
  dnsPrimary?: string | null;
  dnsSecondary?: string | null;
  downloadBandwidthMbps?: number | null;
  uploadBandwidthMbps?: number | null;
  autoFailback?: boolean;
  isEnabled?: boolean;
}

export type IspRoutingRuleType = "vlan" | "user" | "ip" | "source" | "interface" | "policy";

export interface IspRoutingRule {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  ispLinkId: string;
  ruleType: IspRoutingRuleType;
  name: string;
  description: string | null;
  priority: number;
  isEnabled: boolean;
  vlanId: number | null;
  sourceMacAddress: string | null;
  ipAddress: string | null;
  sourceCidr: string | null;
  interfaceName: string | null;
  policyId: string | null;
  createdAt: string;
}

export interface IspRoutingRuleListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface IspRoutingRuleListResult {
  rows: IspRoutingRule[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateIspRoutingRulePayload {
  routerId: string;
  ispLinkId: string;
  ruleType: IspRoutingRuleType;
  name: string;
  description?: string | null;
  priority?: number;
  isEnabled?: boolean;
  vlanId?: number | null;
  sourceMacAddress?: string | null;
  ipAddress?: string | null;
  sourceCidr?: string | null;
  interfaceName?: string | null;
  policyId?: string | null;
}

export interface UpdateIspRoutingRulePayload {
  ispLinkId?: string;
  ruleType?: IspRoutingRuleType;
  name?: string;
  description?: string | null;
  priority?: number;
  isEnabled?: boolean;
  vlanId?: number | null;
  sourceMacAddress?: string | null;
  ipAddress?: string | null;
  sourceCidr?: string | null;
  interfaceName?: string | null;
  policyId?: string | null;
}
