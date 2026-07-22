export type FirewallChain = "input" | "forward" | "output";
export type FirewallAction = "accept" | "drop" | "reject";
export type FirewallProtocol = "tcp" | "udp" | "icmp" | "all";

export interface FirewallRule {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  chain: FirewallChain;
  action: FirewallAction;
  protocol: FirewallProtocol;
  sourceAddress: string | null;
  destinationAddress: string | null;
  sourcePort: number | null;
  destinationPort: number | null;
  inInterface: string | null;
  priority: number;
  comment: string | null;
  isEnabled: boolean;
  createdAt: string;
}

export interface FirewallRuleListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface FirewallRuleListResult {
  rows: FirewallRule[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateFirewallRulePayload {
  routerId: string;
  name: string;
  chain?: FirewallChain;
  action?: FirewallAction;
  protocol?: FirewallProtocol;
  sourceAddress?: string | null;
  destinationAddress?: string | null;
  sourcePort?: number | null;
  destinationPort?: number | null;
  inInterface?: string | null;
  priority?: number;
  comment?: string | null;
  isEnabled?: boolean;
}

export interface UpdateFirewallRulePayload {
  name?: string;
  chain?: FirewallChain;
  action?: FirewallAction;
  protocol?: FirewallProtocol;
  sourceAddress?: string | null;
  destinationAddress?: string | null;
  sourcePort?: number | null;
  destinationPort?: number | null;
  inInterface?: string | null;
  priority?: number;
  comment?: string | null;
  isEnabled?: boolean;
}
