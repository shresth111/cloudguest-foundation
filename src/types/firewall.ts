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
  /** The networks the router serves guests on, read off the router in the
   * same look (cloud-guest#317). Empty on an older backend or a router with
   * no hotspot/DHCP server. */
  guestNetworks: string[];
  /** What DHCP hands those guests as DNS; empty = the router itself. */
  guestDnsServers: string[];
}

/** POST /firewall-rules/routers/{id}/band (Master only). `created=false`
 * means a band was already there and was left alone. */
export interface FirewallBandPlacement {
  routerId: string;
  created: boolean;
}

/** The per-router "Limit connection floods" switch. `off` removes it. */
export type FloodLimitPreset = "off" | "relaxed" | "normal" | "strict";

/**
 * GET/PUT /firewall-rules/routers/{id}/flood-limit. Read off the router
 * every time -- the router's rows are the switch's only state, so a router
 * that was reset reads "off", truthfully.
 *
 * `preset` is `null` when the router holds a cap none of the presets
 * writes. `consistent` is false when a guest network is missing its row or
 * the rows disagree; turning the switch on again repairs it. `bandState`
 * must be `ready` for it to be turned on (off always works).
 */
export interface FloodLimitState {
  routerId: string;
  preset: FloodLimitPreset | null;
  limit: number | null;
  enabled: boolean;
  consistent: boolean;
  bandState: FirewallBandState;
  guestNetworks: string[];
  /** Connections one guest device may hold, per preset. */
  presets: Partial<Record<Exclude<FloodLimitPreset, "off">, number>>;
  checkedAt: string | null;
}

/** One port of the router's guest network, as the isolation read saw it. */
export interface GuestIsolationPort {
  interface: string;
  /** A link is up -- usually an access point (or a switch) is plugged in. */
  running: boolean;
  /** The router may put this port in the isolation group. */
  isolatable: boolean;
  isolated: boolean;
  /** Why it is left out: `wan`, `carries_vlan`, `has_address`, ... */
  excludedReason: string | null;
  isRadio: boolean;
}

/**
 * GET/PUT /firewall-rules/routers/{id}/guest-isolation -- "Guests can't see
 * each other", read off the router every time.
 *
 * `betweenPorts` is what the router enforces: guests on different ports
 * (different access points) cannot reach each other. Guests on the SAME
 * access point never pass through the router; `apIsolationNeeded` says the
 * owner must also turn on each access point's own "AP isolation".
 * `refusal` is the `ISOLATION_*` code turning it on would be refused with
 * here, or null.
 */
export interface GuestIsolationState {
  routerId: string;
  enabled: boolean;
  consistent: boolean;
  betweenPorts: boolean;
  routedGuard: boolean;
  /** The router's own Wi-Fi; null when it has none. */
  radiosIsolated: boolean | null;
  bandState: FirewallBandState;
  guestPorts: number;
  isolatedPorts: number;
  apPorts: number;
  apIsolationNeeded: boolean;
  ports: GuestIsolationPort[];
  refusal: string | null;
  summary: string;
  checkedAt: string | null;
}
