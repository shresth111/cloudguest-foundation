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
  /** See `FirewallDevicePushStatus`. */
  devicePushStatus: FirewallDevicePushStatus | null;
  /** The router's or the refusal's own words from the last failed push. */
  devicePushError: string | null;
  devicePushedAt: string | null;
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

/**
 * Whether a rule is on its router right now, as the router's last push left
 * it (cloud-guest#304, `FirewallDevicePushStatus`):
 *
 *  - `pending` -- saved here, not on the router: never applied, edited since,
 *    or switched off (a switched-off rule leaves the router at the next push).
 *  - `active`  -- the last push put exactly this rule on the router and read
 *    it back there.
 *  - `failed`  -- the last push for this router failed; `devicePushError`
 *    carries the reason.
 *
 * `null` when the backend did not send the field at all (a backend without
 * #304). That is "we don't know", and is rendered as nothing rather than as a
 * guess.
 */
export type FirewallDevicePushStatus = "pending" | "active" | "failed";

/** POST /firewall-rules/routers/{id}/push, 200. Counts come from the writes
 * the push issued; an unchanged re-push reports everything as unchanged. */
export interface FirewallPushResult {
  routerId: string;
  added: number;
  removed: number;
  unchanged: number;
  rules: FirewallRule[];
}

/** GET /firewall-rules/routers/{id}/band. `null` from the service means the
 * endpoint is not there (404) or not readable -- "status unknown". */
export type FirewallBandState = "ready" | "missing" | "invalid";

export interface FirewallBandStatus {
  state: FirewallBandState;
  reason: string | null;
  checkedAt: string | null;
}

/** POST /firewall-rules/routers/{id}/band (Master only). `created=false`
 * means a band was already there and was left alone. */
export interface FirewallBandPlacement {
  routerId: string;
  created: boolean;
}
