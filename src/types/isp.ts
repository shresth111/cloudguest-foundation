export type IspLinkRole = "primary" | "backup";

/** How this link's own gateway/IP is actually obtained -- drives which
 * real health-check target-resolution strategy the backend uses.
 * Orthogonal to `linkType` (physical medium: fiber/DSL/cable/...): a
 * fiber connection can be static, DHCP, or PPPoE-authenticated all the
 * same. See backend `constants.IspConnectionMode`'s own docstring. */
export type IspConnectionMode = "static" | "dhcp" | "pppoe";

/** The only two values a manual status override accepts -- maps onto the
 * existing `healthy`/`unhealthy` vocabulary the rest of this domain
 * already uses (never a third, invented enum). See
 * `ispService.setManualStatus`. */
export type IspManualHealthStatus = "healthy" | "unhealthy";

export interface IspLink {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  providerName: string;
  linkType: string;
  connectionMode: IspConnectionMode;
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
  /** Whether the *current* healthStatus above came from a real RouterOS
   * ping ("automated" -- the sweep or a manual on-demand check) or an
   * admin's own override ("manual" -- see `ispService.setManualStatus`).
   * The next real ping always reclaims this back to "automated". */
  healthStatusSource: string;
  /** "Down since" -- non-null only while healthStatus is "unhealthy".
   * Computed server-side from real IspHealthCheck history, never
   * calculated client-side. */
  unhealthySince: string | null;
  latencyMs: number | null;
  packetLossPercentage: number | null;
  /** Live traffic load -- the most recently *computed* rate, distinct
   * from downloadBandwidthMbps/uploadBandwidthMbps above (the link's
   * provisioned plan capacity, never measured). Null until the second
   * successful sample ever (a rate needs two readings). */
  currentDownloadMbps: number | null;
  currentUploadMbps: number | null;
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
  connectionMode?: IspConnectionMode;
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
  connectionMode?: IspConnectionMode;
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

/** The result of one real RouterOS `/tool/ping` sweep against a link's own
 * `gatewayIpAddress` -- see backend `app.domains.isp.models.IspHealthCheck`.
 * `status` is one of `healthy` | `degraded` | `unhealthy` (classified from
 * latency/packet-loss thresholds server-side, never computed client-side). */
export interface IspHealthCheck {
  id: string;
  ispLinkId: string;
  checkedAt: string;
  status: string;
  /** "automated" for a real ping row, "manual" for an admin's own status
   * override -- see `IspLink.healthStatusSource`. */
  source: string;
  latencyMs: number | null;
  packetLossPercentage: number | null;
  errorMessage: string | null;
  /** Real traffic-load reading for this same tick -- null whenever a
   * rate genuinely couldn't be computed. This is what the "Traffic Load"
   * graph renders from -- the exact same rows the up/down "Status
   * Timeline" already uses. */
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export interface IspHealthCheckListQuery {
  page?: number;
  pageSize?: number;
}

export interface IspHealthCheckListResult {
  rows: IspHealthCheck[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  /** Null when there is no health-check history yet for this link (never
   * a fabricated 100%/0% placeholder) -- see backend
   * `IspService.compute_availability_percentage`. */
  availabilityPercentage: number | null;
}
