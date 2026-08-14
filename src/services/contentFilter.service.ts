import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
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
  is_enabled: boolean;
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
    isEnabled: r.is_enabled,
    createdAt: r.created_at,
  };
}

function orgHeaders(organizationId?: string) {
  return organizationId ? { headers: { "X-Organization-Id": organizationId } } : {};
}

// Same orgHeaders/tenant-scope convention as qos.service.ts/
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
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
      ...orgHeaders(q.organizationId),
    });
    return {
      rows: data.items.map(toRule),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async create(payload: CreateContentFilterRulePayload): Promise<ContentFilterRule> {
    const { data } = await api.post<BackendContentFilterRule>(
      "/content-filter-rules",
      {
        router_id: payload.routerId,
        name: payload.name,
        value_type: payload.valueType,
        value: payload.value,
        category: payload.category ?? null,
        comment: payload.comment ?? null,
        is_enabled: payload.isEnabled ?? true,
      },
      orgHeaders(payload.organizationId),
    );
    return toRule(data);
  },

  async update(
    id: string,
    payload: UpdateContentFilterRulePayload,
    organizationId?: string,
  ): Promise<ContentFilterRule> {
    const { data } = await api.put<BackendContentFilterRule>(
      `/content-filter-rules/${id}`,
      {
        name: payload.name,
        value_type: payload.valueType,
        value: payload.value,
        category: payload.category,
        comment: payload.comment,
        is_enabled: payload.isEnabled,
      },
      orgHeaders(organizationId),
    );
    return toRule(data);
  },

  async remove(id: string, organizationId?: string): Promise<void> {
    await api.delete(`/content-filter-rules/${id}`, orgHeaders(organizationId));
  },
};
