import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  CreatePortForwardingPayload,
  PortForwardingListQuery,
  PortForwardingListResult,
  PortForwardingRule,
  UpdatePortForwardingPayload,
} from "@/types/port-forwarding";

interface BackendPortForwardingRule {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  protocol: string;
  source_address: string | null;
  destination_address: string | null;
  destination_port: number;
  internal_address: string;
  internal_port: number;
  description: string | null;
  is_enabled: boolean;
  device_push_status: "pending" | "active" | "failed";
  device_push_error: string | null;
  device_pushed_at: string | null;
  created_at: string;
}

interface BackendPortForwardingListResponse {
  items: BackendPortForwardingRule[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toRule(r: BackendPortForwardingRule): PortForwardingRule {
  return {
    id: r.id,
    routerId: r.router_id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    name: r.name,
    protocol: r.protocol,
    sourceAddress: r.source_address,
    destinationAddress: r.destination_address,
    destinationPort: r.destination_port,
    internalAddress: r.internal_address,
    internalPort: r.internal_port,
    description: r.description,
    isEnabled: r.is_enabled,
    devicePushStatus: r.device_push_status,
    devicePushError: r.device_push_error,
    devicePushedAt: r.device_pushed_at,
    createdAt: r.created_at,
  };
}

// `create_port_forwarding_rule`/`list_port_forwarding_rules`/etc. all resolve
// their tenant scope from CurrentOrganization (X-Organization-Id) -- absent
// it, RequirePermission falls back to checking for a GLOBAL-scope grant,
// which an ordinary customer/org-owner session never holds, so every call
// here 403'd for a real customer ("'firewall.read' is required at global
// scope").
//
// Nothing here sets that header any more, and no method takes an
// `organizationId`: `attachOrganizationHeader` (services/api.ts) puts it on
// every request from an organization-scoped session, and deliberately puts
// nothing on a GLOBAL-scope one -- so the master console's platform-wide
// /network view still spans every org, exactly as when this module threaded
// the id by hand. Do not re-add it: the caller then has to *resolve* the id
// before it can read, that resolution lands in the React Query key, and the
// key changing once it settles fired every read on this page twice.
export const portForwardingService = {
  async list(q: PortForwardingListQuery): Promise<PortForwardingListResult> {
    // The demo account's token isn't a real backend session -- every call
    // here 401'd on a plain page load (spamming the console the moment
    // Port Forwarding is opened in the demo). No curated demo fixture
    // exists for this domain, so this honestly reports zero rather than
    // inventing fake rules, same convention as dhcp.service.ts/
    // vlan.service.ts's own demo guards.
    if (isDemo()) {
      return { rows: [], total: 0, totalPages: 1, hasNext: false, hasPrevious: false };
    }
    const { data } = await api.get<BackendPortForwardingListResponse>("/port-forwarding/rules", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
    });
    return {
      rows: data.items.map(toRule),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  // There is deliberately no getKpis() here any more. It re-issued this
  // module's own list() URL verbatim (same path, same page_size=100) for a
  // second time on every page load, and then reported `total_items` --
  // the true server total -- alongside enabled/disabled counted over at most
  // the 100 rows it happened to receive, so past 100 rules the three tiles
  // stopped summing. The page already holds the list; PortForwardingManagement
  // derives its tiles from that one response and says, on the tile itself,
  // when the rows it counted do not cover the total. There is no
  // `is_enabled` filter on GET /port-forwarding/rules (see
  // app/domains/port_forwarding/router.py) to get an exact count from,
  // and page_size is capped at 100.

  async create(payload: CreatePortForwardingPayload): Promise<PortForwardingRule> {
    const { data } = await api.post<BackendPortForwardingRule>("/port-forwarding/rules", {
      router_id: payload.routerId,
      name: payload.name,
      protocol: payload.protocol ?? "both",
      source_address: payload.sourceAddress ?? null,
      destination_address: payload.destinationAddress ?? null,
      destination_port: payload.destinationPort,
      internal_address: payload.internalAddress,
      internal_port: payload.internalPort,
      description: payload.description ?? null,
      is_enabled: payload.isEnabled ?? true,
    });
    return toRule(data);
  },

  async update(id: string, payload: UpdatePortForwardingPayload): Promise<PortForwardingRule> {
    const { data } = await api.put<BackendPortForwardingRule>(`/port-forwarding/rules/${id}`, {
      name: payload.name,
      protocol: payload.protocol,
      source_address: payload.sourceAddress,
      destination_address: payload.destinationAddress,
      destination_port: payload.destinationPort,
      internal_address: payload.internalAddress,
      internal_port: payload.internalPort,
      description: payload.description,
      is_enabled: payload.isEnabled,
    });
    return toRule(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/port-forwarding/rules/${id}`);
  },

  /**
   * Realizes the rule on its router, over the RouterOS API.
   *
   * Creating a rule writes a database row and nothing else -- that is
   * deliberate, so that renaming one cannot fail with a device connection
   * error. This is the separate step that actually reaches the hardware,
   * and until it exists in the UI a "created" rule is only ever a row: no
   * `/ip firewall nat` DSTNAT entry exists, and the public port the
   * dashboard says is forwarded answers nothing.
   *
   * Note the path: the push hangs off `/port-forwarding/rules/{id}/push`,
   * under the same `/rules` segment as the rest of this domain's CRUD --
   * not `/port-forwarding/{id}/push`.
   *
   * Gated by `firewall.execute` on the backend, not `firewall.update` --
   * editing a row and reaching into a live router are different
   * privileges, and both an Organization Owner (FULL) and an Organization
   * Admin (OPERATE) hold it.
   *
   * Failures arrive as real non-2xx responses carrying the device's own
   * error text, so the caller's `catch` gets something worth showing. The
   * backend deliberately never returns `200 {success: false}` here: the
   * response interceptor discards `success`, so such a response would
   * reach this method as a success.
   */
  async push(id: string): Promise<PortForwardingRule> {
    const { data } = await api.post<BackendPortForwardingRule>(`/port-forwarding/rules/${id}/push`);
    return toRule(data);
  },
};
