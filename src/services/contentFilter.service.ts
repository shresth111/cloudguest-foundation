import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import { listAllPages } from "@/services/list-all-pages";
import type {
  ContentFilterApp,
  ContentFilterAppList,
  ContentFilterCategory,
  ContentFilterListQuery,
  ContentFilterListResult,
  ContentFilterRule,
  ContentFilterValueType,
  CreateContentFilterRulePayload,
  UpdateContentFilterRulePayload,
} from "@/types/contentFilter";

interface BackendContentFilterRule {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  category: string | null;
  value_type: string;
  value: string;
  comment: string | null;
  /** Absent on a backend without the Apps toggle. */
  app_key?: string | null;
  is_enabled: boolean;
  device_push_status: "pending" | "active" | "failed";
  device_push_error: string | null;
  device_pushed_at: string | null;
  created_at: string;
}

interface BackendContentFilterListResponse {
  items: BackendContentFilterRule[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendContentFilterApp {
  key: string;
  name: string;
  category: string;
  note: string | null;
  state: ContentFilterApp["state"];
  push_status: ContentFilterApp["pushStatus"];
  targets: {
    value_type: string;
    value: string;
    rule_id: string | null;
    owned: boolean;
    is_enabled: boolean;
    device_push_status: ContentFilterApp["pushStatus"];
    device_push_error: string | null;
  }[];
}

interface BackendContentFilterAppList {
  router_id: string;
  items: BackendContentFilterApp[];
  limitations: string[];
}

export function toApp(a: BackendContentFilterApp): ContentFilterApp {
  return {
    key: a.key,
    name: a.name,
    category: a.category,
    note: a.note,
    state: a.state,
    pushStatus: a.push_status,
    targets: a.targets.map((t) => ({
      valueType: t.value_type as ContentFilterValueType,
      value: t.value,
      ruleId: t.rule_id,
      owned: t.owned,
      isEnabled: t.is_enabled,
      devicePushStatus: t.device_push_status,
      devicePushError: t.device_push_error,
    })),
  };
}

function toRule(r: BackendContentFilterRule): ContentFilterRule {
  return {
    id: r.id,
    routerId: r.router_id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    name: r.name,
    category: (r.category as ContentFilterCategory | null) ?? null,
    valueType: r.value_type as ContentFilterValueType,
    value: r.value,
    comment: r.comment,
    appKey: r.app_key ?? null,
    isEnabled: r.is_enabled,
    devicePushStatus: r.device_push_status,
    devicePushError: r.device_push_error,
    devicePushedAt: r.device_pushed_at,
    createdAt: r.created_at,
  };
}

// Tenant scope rides on `X-Organization-Id`, which the api client attaches to
// every request from an organization-scoped session (see
// `attachOrganizationScope` in services/api.ts). A master-console view still
// spans every organization -- it now says so with `X-Organization-Scope: all`
// rather than by omitting the org header, which is the implicit default that
// gave a GLOBAL-scoped founder a fourteen-tenant report about his own venue.
// Nothing here sets that header by hand any more and no method takes an
// `organizationId`. Do not re-add one: the caller then has to *resolve* the id
// before it can read, that resolution ends up in the React Query key, and the
// key changing once it settles fired every read on these pages twice.

// Same tenant-scope convention as qos.service.ts/
// dhcp.service.ts/port-forwarding.service.ts's own -- every
// content-filter-rules endpoint resolves its org from CurrentOrganization
// (X-Organization-Id), absent which RequirePermission 403s an ordinary
// customer session (it only falls back to a GLOBAL-scope grant no real
// org-owner session holds).
export const contentFilterService = {
  async list(q: ContentFilterListQuery): Promise<ContentFilterListResult> {
    // No curated demo fixture exists for this domain yet -- honestly
    // reports zero rather than inventing fake blocked sites, same
    // convention as qos.service.ts's own demo guard.
    if (isDemo()) {
      return { rows: [], total: 0, totalPages: 1, hasNext: false, hasPrevious: false };
    }
    const { data } = await api.get<BackendContentFilterListResponse>("/content-filter-rules", {
      params: {
        router_id: q.routerId,
        page: q.page,
        page_size: q.pageSize,
        // Only sent when asked for, so an older backend sees the same request.
        ...(q.excludeAppRules ? { exclude_app_rules: true } : {}),
      },
    });
    return {
      rows: data.items.map(toRule),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  /**
   * Every rule on `routerId`, in pages of at most 100 -- the route caps
   * `page_size` at 100, and Fix a Problem's one request for 200 422'd every
   * time. Rejects if any page fails, so "no rule blocks this site" is never
   * concluded from a list we could not read.
   */
  async listAll(routerId: string): Promise<ContentFilterRule[]> {
    return listAllPages((page, pageSize) =>
      contentFilterService.list({ routerId, page, pageSize }),
    );
  },

  async create(payload: CreateContentFilterRulePayload): Promise<ContentFilterRule> {
    const { data } = await api.post<BackendContentFilterRule>("/content-filter-rules", {
      router_id: payload.routerId,
      name: payload.name,
      value_type: payload.valueType,
      value: payload.value,
      category: payload.category ?? null,
      comment: payload.comment ?? null,
      is_enabled: payload.isEnabled ?? true,
    });
    return toRule(data);
  },

  async update(id: string, payload: UpdateContentFilterRulePayload): Promise<ContentFilterRule> {
    const { data } = await api.put<BackendContentFilterRule>(`/content-filter-rules/${id}`, {
      name: payload.name,
      value_type: payload.valueType,
      value: payload.value,
      category: payload.category,
      comment: payload.comment,
      is_enabled: payload.isEnabled,
    });
    return toRule(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/content-filter-rules/${id}`);
  },

  /**
   * Realizes the block on its router, over the RouterOS API.
   *
   * Creating a rule writes a database row and nothing else -- that is
   * deliberate, so that renaming one cannot fail with a device connection
   * error. This is the separate step that actually reaches the hardware,
   * and until it exists in the UI "blocked" means "a database row exists"
   * and nothing more, on a screen that presents it as an enforced
   * restriction -- the customer blocks a site and reaches it from the
   * guest network unchanged.
   *
   * The backend refuses to push a disabled rule (a disabled rule is the
   * customer saying this site should *not* be blocked), so that arrives
   * here as a 4xx naming the problem rather than a false success.
   *
   * Failures arrive as real non-2xx responses carrying the device's own
   * error text, so the caller's `catch` gets something worth showing. The
   * backend deliberately never returns `200 {success: false}` here: the
   * response interceptor discards `success`, so such a response would
   * reach this method as a success.
   */
  async push(id: string): Promise<ContentFilterRule> {
    const { data } = await api.post<BackendContentFilterRule>(`/content-filter-rules/${id}/push`);
    return toRule(data);
  },

  /** Every catalogue app and how much of it is blocked on this router. */
  async listApps(routerId: string): Promise<ContentFilterAppList> {
    const { data } = await api.get<BackendContentFilterAppList>(
      `/content-filter-rules/routers/${routerId}/apps`,
    );
    return {
      routerId: data.router_id,
      items: data.items.map(toApp),
      limitations: data.limitations,
    };
  },

  /**
   * Switch an app off: the backend creates a block for each of its website
   * names and sends each one to the router. A partial result is a real 502
   * (`CONTENT_FILTER_APP_INCOMPLETE`), so a `catch` here means some names did
   * not reach the router; re-reading the list shows which.
   */
  async blockApp(routerId: string, appKey: string): Promise<ContentFilterApp> {
    const { data } = await api.put<BackendContentFilterApp>(
      `/content-filter-rules/routers/${routerId}/apps/${appKey}`,
    );
    return toApp(data);
  },

  /** Switch an app back on: removes only the blocks its toggle created. */
  async unblockApp(routerId: string, appKey: string): Promise<ContentFilterApp> {
    const { data } = await api.delete<BackendContentFilterApp>(
      `/content-filter-rules/routers/${routerId}/apps/${appKey}`,
    );
    return toApp(data);
  },
};
