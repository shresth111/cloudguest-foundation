import { api, requestErrorOf } from "@/services/api";
import { resolveOrgId } from "@/services/customer.service";
import type {
  WebCategory,
  WebCategoryCatalogue,
  WebFilterLocationPolicy,
  WebFilterPolicySource,
  WebFilterRouterState,
  WebFilterRouterStatus,
} from "@/types/dns-filtering";

/**
 * Cloudflare Gateway category filtering (cloud-guest#307). Every route pins
 * its own scope from the path id (location or router), so the tenant header
 * is only the usual organization one -- the same pattern as
 * `firewall.service.ts`.
 */

interface BackendCategory {
  id: number;
  name: string;
  description: string;
  category_class: string;
  beta: boolean;
  is_security: boolean;
  subcategories?: BackendCategory[];
}

interface BackendCategoryList {
  provider: string;
  items: BackendCategory[];
}

interface BackendLocationPolicy {
  location_id: string;
  organization_id: string;
  effective_category_ids: number[];
  source: string;
  location_category_ids: number[] | null;
  organization_category_ids: number[] | null;
}

interface BackendRouterStatus {
  router_id: string;
  enabled: boolean;
  state: string;
  device_push_status: string | null;
  device_push_error: string | null;
  device_pushed_at: string | null;
  effective_category_ids: number[];
  policy_source: string;
  bypass_hardening_enabled: boolean;
  bypass_hardening_status: string;
  bypass_hardening_error: string | null;
  routeros_version: string | null;
  limitations: string[];
}

const SOURCES: readonly WebFilterPolicySource[] = ["location", "organization", "none"];
const STATES: readonly WebFilterRouterState[] = ["pending", "active", "failed", "disabled"];
const PUSH: readonly ("pending" | "active" | "failed")[] = ["pending", "active", "failed"];
const BYPASS: readonly ("off" | "active" | "failed")[] = ["off", "active", "failed"];

function sourceOf(v: string): WebFilterPolicySource {
  return SOURCES.find((s) => s === v) ?? "none";
}

function toCategory(c: BackendCategory): WebCategory {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    categoryClass: c.category_class ?? "",
    beta: !!c.beta,
    isSecurity: !!c.is_security,
    subcategories: (c.subcategories ?? []).map(toCategory),
  };
}

function toLocationPolicy(p: BackendLocationPolicy): WebFilterLocationPolicy {
  return {
    locationId: p.location_id,
    organizationId: p.organization_id,
    effectiveCategoryIds: p.effective_category_ids ?? [],
    source: sourceOf(p.source),
    locationCategoryIds: p.location_category_ids ?? null,
    organizationCategoryIds: p.organization_category_ids ?? null,
  };
}

export function toRouterStatus(s: BackendRouterStatus): WebFilterRouterStatus {
  return {
    routerId: s.router_id,
    enabled: !!s.enabled,
    // An unknown state is read as "off": it is the state that offers no
    // Disable and claims nothing is filtered.
    state: STATES.find((x) => x === s.state) ?? "disabled",
    devicePushStatus: PUSH.find((x) => x === s.device_push_status) ?? null,
    devicePushError: s.device_push_error ?? null,
    devicePushedAt: s.device_pushed_at ?? null,
    effectiveCategoryIds: s.effective_category_ids ?? [],
    policySource: sourceOf(s.policy_source),
    bypassHardeningEnabled: !!s.bypass_hardening_enabled,
    bypassHardeningStatus: BYPASS.find((x) => x === s.bypass_hardening_status) ?? "off",
    bypassHardeningError: s.bypass_hardening_error ?? null,
    routerosVersion: s.routeros_version ?? null,
    limitations: s.limitations ?? [],
  };
}

async function orgHeaders(): Promise<{ headers: Record<string, string> } | undefined> {
  const orgId = await resolveOrgId();
  return orgId ? { headers: { "X-Organization-Id": orgId } } : undefined;
}

export const dnsFilteringService = {
  /**
   * The category catalogue. This is also the page's "is it set up?" check:
   * a 503 means no Cloudflare account is connected on this deployment, and a
   * 404 means this backend does not have #307. Both come back as
   * `not_configured` rather than as an error, because neither is something
   * the venue owner did or can retry. Anything else rejects.
   */
  async categories(locationId: string): Promise<WebCategoryCatalogue> {
    try {
      const { data } = await api.get<BackendCategoryList>("/dns-filtering/categories", {
        params: { location_id: locationId },
        ...(await orgHeaders()),
      });
      return { state: "ready", items: (data.items ?? []).map(toCategory) };
    } catch (err) {
      const status = requestErrorOf(err)?.status;
      if (status === 503 || status === 404) return { state: "not_configured" };
      throw err;
    }
  },

  async locationPolicy(locationId: string): Promise<WebFilterLocationPolicy> {
    const { data } = await api.get<BackendLocationPolicy>(
      `/dns-filtering/locations/${locationId}/policy`,
      await orgHeaders(),
    );
    return toLocationPolicy(data);
  },

  /** Saves this venue's own list. An empty list is a real choice ("block
   * nothing here"), not "go back to the account default" -- the backend has
   * no way to remove a venue's own list. */
  async setLocationPolicy(
    locationId: string,
    categoryIds: number[],
  ): Promise<WebFilterLocationPolicy> {
    const { data } = await api.put<BackendLocationPolicy>(
      `/dns-filtering/locations/${locationId}/policy`,
      { category_ids: categoryIds },
      await orgHeaders(),
    );
    return toLocationPolicy(data);
  },

  async routerStatus(routerId: string): Promise<WebFilterRouterStatus> {
    const { data } = await api.get<BackendRouterStatus>(
      `/dns-filtering/routers/${routerId}`,
      await orgHeaders(),
    );
    return toRouterStatus(data);
  },

  /** Switches the router's lookups to Cloudflare, checks them, and switches
   * back by itself if the check fails (the 502 then says `rolled_back`). */
  async enable(routerId: string): Promise<WebFilterRouterStatus> {
    const { data } = await api.post<BackendRouterStatus>(
      `/dns-filtering/routers/${routerId}/enable`,
      undefined,
      await orgHeaders(),
    );
    return toRouterStatus(data);
  },

  /** Puts the router's own lookup settings back first, then releases
   * Cloudflare. */
  async disable(routerId: string): Promise<WebFilterRouterStatus> {
    const { data } = await api.post<BackendRouterStatus>(
      `/dns-filtering/routers/${routerId}/disable`,
      undefined,
      await orgHeaders(),
    );
    return toRouterStatus(data);
  },

  async setBypassHardening(routerId: string, enabled: boolean): Promise<WebFilterRouterStatus> {
    const { data } = await api.put<BackendRouterStatus>(
      `/dns-filtering/routers/${routerId}/bypass-hardening`,
      { enabled },
      await orgHeaders(),
    );
    return toRouterStatus(data);
  },
};
