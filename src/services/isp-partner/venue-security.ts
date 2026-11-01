/**
 * Batch B4 venue twin calls (ADDENDUM_04: Security, Fix a Problem, Devices).
 *
 * Same rule as `venue.ts`: the partner console's own calls go straight to
 * `/isp/venue/...`, which the shim passes through, and the twin resolves the
 * customer and location from the X-Isp-* headers `VenueScope` pins. Response
 * bodies are the customer domains' own wire shapes (snake_case), typed here.
 *
 * Not here on purpose: the Wyfy firewall band. It is Master-only and has no
 * twin; a call to it from this console would be a 404 by design.
 */
import { api } from "@/services/api";

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// -- Security Score ----------------------------------------------------------
export interface SecurityCounter {
  key: string;
  label: string;
  count: number | null;
  available: boolean;
  unavailable_reason?: string | null;
}
export interface SecurityScoreFactor {
  key: string;
  label: string;
  penalty: number;
  max_penalty: number;
  affected: number;
  available: boolean;
  detail: string;
}
export interface SecurityOverview {
  score: {
    score: number | null;
    band: string | null;
    max_score: number;
    available: boolean;
    unavailable_reason?: string | null;
    factors: SecurityScoreFactor[];
  };
  counters: SecurityCounter[];
  fleet: {
    routers_total: number;
    routers_reporting: number;
    routers_stale: number;
    routers_unhealthy: number;
    no_managed_gateway: boolean;
  };
  generated_at: string;
}
export interface SecurityCapability {
  key: string;
  label: string;
  availability: string;
  enforcement?: string | null;
  detail?: string | null;
}

// -- Block Websites ----------------------------------------------------------
export interface ContentFilterRule {
  id: string;
  router_id: string;
  name: string;
  category: string | null;
  value_type: "domain" | "ip_cidr" | string;
  value: string;
  comment: string | null;
  app_key: string | null;
  is_enabled: boolean;
  device_push_status: string;
  device_push_error: string | null;
  created_at: string;
}
export interface ContentFilterRuleCreate {
  router_id: string;
  name: string;
  value_type: "domain" | "ip_cidr";
  value: string;
  category?: string | null;
  comment?: string | null;
  is_enabled?: boolean;
}
export interface DnsCategory {
  id: number;
  name: string;
  description: string;
  category_class: string;
  is_security: boolean;
  subcategories: DnsCategory[];
}
export interface LocationDnsPolicy {
  location_id: string;
  effective_category_ids: number[];
  source: string;
  location_category_ids: number[] | null;
  organization_category_ids: number[] | null;
}
export interface RouterDnsStatus {
  router_id: string;
  enabled: boolean;
  state: string;
  device_push_status: string | null;
  device_push_error: string | null;
  policy_source: string;
  limitations: string[];
}

// -- Firewall ----------------------------------------------------------------
export interface FirewallRule {
  id: string;
  router_id: string;
  name: string;
  chain: string;
  action: string;
  protocol: string;
  source_address: string | null;
  destination_address: string | null;
  source_port: number | null;
  destination_port: number | null;
  in_interface: string | null;
  priority: number;
  comment: string | null;
  is_enabled: boolean;
  device_push_status: string;
  device_push_error: string | null;
}
export interface FirewallRuleCreate {
  router_id: string;
  name: string;
  chain: "input" | "forward" | "output";
  action: "accept" | "drop" | "reject";
  protocol: "tcp" | "udp" | "icmp" | "all";
  source_address?: string | null;
  destination_address?: string | null;
  source_port?: number | null;
  destination_port?: number | null;
  priority: number;
  comment?: string | null;
  is_enabled: boolean;
}
export interface FirewallPushResult {
  router_id: string;
  added: number;
  removed: number;
  unchanged: number;
}
export interface FloodLimit {
  router_id: string;
  preset: "off" | "relaxed" | "normal" | "strict" | null;
  limit: number | null;
  enabled: boolean;
  consistent: boolean;
  band_state: "ready" | "missing" | "invalid";
  presets: Record<string, number>;
}
export interface GuestIsolation {
  router_id: string;
  enabled: boolean;
  consistent: boolean;
  band_state: "ready" | "missing" | "invalid";
  guest_ports: number;
  isolated_ports: number;
  refusal: string | null;
  summary: string;
}

// -- Fix a Problem -----------------------------------------------------------
export interface DiagnosticRun {
  id: string;
  router_id: string;
  diagnostic_type: string;
  target: string;
  status: string;
  result: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
}

// -- Devices -----------------------------------------------------------------
export interface ConnectedDevice {
  id: string;
  router_id: string;
  mac_address: string | null;
  ip_address: string | null;
  hostname: string | null;
  vendor: string | null;
  connection_type: string;
  interface: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  comment: string | null;
}
export interface MonitoredHardware {
  id: string;
  router_id: string | null;
  name: string;
  mac_address: string;
  device_type: string;
  floor: string | null;
  status: string;
  status_reason: string;
  last_seen_at: string | null;
}
export interface MonitoredHardwareCreate {
  router_id?: string | null;
  name: string;
  mac_address: string;
  device_type: string;
  floor?: string | null;
}

const V = "/isp/venue";

export const venueSecurityService = {
  // Security Score
  async overview(): Promise<SecurityOverview> {
    const { data } = await api.get<SecurityOverview>(`${V}/security/overview`);
    return data;
  },
  async capabilities(): Promise<SecurityCapability[]> {
    const { data } = await api.get<{ features: SecurityCapability[] }>(
      `${V}/security/capabilities`,
    );
    return data.features;
  },

  // Block Websites: rules on one router
  async listContentRules(routerId: string): Promise<Page<ContentFilterRule>> {
    const { data } = await api.get<Page<ContentFilterRule>>(`${V}/content-filter-rules`, {
      params: { isp_router_id: routerId, exclude_app_rules: true, page: 1, page_size: 100 },
    });
    return data;
  },
  async createContentRule(body: ContentFilterRuleCreate): Promise<ContentFilterRule> {
    const { data } = await api.post<ContentFilterRule>(`${V}/content-filter-rules`, body);
    return data;
  },
  async deleteContentRule(id: string): Promise<void> {
    await api.delete(`${V}/content-filter-rules/${id}`);
  },
  async pushContentRule(id: string): Promise<ContentFilterRule> {
    const { data } = await api.post<ContentFilterRule>(`${V}/content-filter-rules/${id}/push`);
    return data;
  },
  // Block Websites: DNS categories
  async dnsCategories(): Promise<DnsCategory[]> {
    const { data } = await api.get<{ items: DnsCategory[] }>(`${V}/dns-filtering/categories`);
    return data.items;
  },
  async locationDnsPolicy(): Promise<LocationDnsPolicy> {
    const { data } = await api.get<LocationDnsPolicy>(`${V}/dns-filtering/location-policy`);
    return data;
  },
  async setLocationDnsPolicy(categoryIds: number[]): Promise<LocationDnsPolicy> {
    const { data } = await api.put<LocationDnsPolicy>(`${V}/dns-filtering/location-policy`, {
      category_ids: categoryIds,
    });
    return data;
  },
  async routerDnsStatus(routerId: string): Promise<RouterDnsStatus> {
    const { data } = await api.get<RouterDnsStatus>(`${V}/dns-filtering/routers/${routerId}`);
    return data;
  },
  async setRouterDns(routerId: string, enabled: boolean): Promise<RouterDnsStatus> {
    const { data } = await api.post<RouterDnsStatus>(
      `${V}/dns-filtering/routers/${routerId}/${enabled ? "enable" : "disable"}`,
    );
    return data;
  },

  // Firewall (the customer's own rules)
  async listFirewallRules(routerId: string): Promise<Page<FirewallRule>> {
    const { data } = await api.get<Page<FirewallRule>>(`${V}/firewall-rules`, {
      params: { isp_router_id: routerId, page: 1, page_size: 100 },
    });
    return data;
  },
  async createFirewallRule(body: FirewallRuleCreate): Promise<FirewallRule> {
    const { data } = await api.post<FirewallRule>(`${V}/firewall-rules`, body);
    return data;
  },
  async deleteFirewallRule(id: string): Promise<void> {
    await api.delete(`${V}/firewall-rules/${id}`);
  },
  async pushFirewall(routerId: string): Promise<FirewallPushResult> {
    const { data } = await api.post<FirewallPushResult>(
      `${V}/firewall-rules/routers/${routerId}/push`,
    );
    return data;
  },
  async floodLimit(routerId: string): Promise<FloodLimit> {
    const { data } = await api.get<FloodLimit>(
      `${V}/firewall-rules/routers/${routerId}/flood-limit`,
    );
    return data;
  },
  async setFloodLimit(routerId: string, preset: string): Promise<FloodLimit> {
    const { data } = await api.put<FloodLimit>(
      `${V}/firewall-rules/routers/${routerId}/flood-limit`,
      { preset },
    );
    return data;
  },
  async guestIsolation(routerId: string): Promise<GuestIsolation> {
    const { data } = await api.get<GuestIsolation>(
      `${V}/firewall-rules/routers/${routerId}/guest-isolation`,
    );
    return data;
  },
  async setGuestIsolation(routerId: string, enabled: boolean): Promise<GuestIsolation> {
    const { data } = await api.put<GuestIsolation>(
      `${V}/firewall-rules/routers/${routerId}/guest-isolation`,
      { enabled },
    );
    return data;
  },

  // Fix a Problem
  async runDiagnostic(
    routerId: string,
    kind: "ping" | "traceroute",
    target: string,
  ): Promise<DiagnosticRun> {
    const body =
      kind === "ping"
        ? { target, count: 4, timeout_seconds: 10 }
        : { target, max_hops: 20, timeout_seconds: 30 };
    const { data } = await api.post<DiagnosticRun>(
      `${V}/network-diagnostics/routers/${routerId}/${kind}`,
      body,
    );
    return data;
  },
  async listRuns(routerId: string): Promise<Page<DiagnosticRun>> {
    const { data } = await api.get<Page<DiagnosticRun>>(`${V}/network-diagnostics/runs`, {
      params: { isp_router_id: routerId, page: 1, page_size: 20 },
    });
    return data;
  },

  // Devices
  async listClients(routerId: string | null): Promise<Page<ConnectedDevice>> {
    const { data } = await api.get<Page<ConnectedDevice>>(`${V}/connected-devices`, {
      params: { isp_router_id: routerId ?? undefined, page: 1, page_size: 100 },
    });
    return data;
  },
  async syncClients(routerId: string): Promise<void> {
    await api.post(`${V}/connected-devices/sync/${routerId}`);
  },
  async disconnectClient(id: string): Promise<void> {
    await api.post(`${V}/connected-devices/${id}/disconnect`);
  },
  async listHardware(): Promise<Page<MonitoredHardware>> {
    const { data } = await api.get<Page<MonitoredHardware>>(`${V}/monitored-hardware`, {
      params: { page: 1, page_size: 100 },
    });
    return data;
  },
  async registerHardware(locationId: string, body: MonitoredHardwareCreate): Promise<void> {
    // location_id is forced to the pinned location by the twin anyway.
    await api.post(`${V}/monitored-hardware`, { location_id: locationId, ...body });
  },
  async deleteHardware(id: string): Promise<void> {
    await api.delete(`${V}/monitored-hardware/${id}`);
  },
};
