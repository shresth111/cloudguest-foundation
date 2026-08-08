import { api } from "@/services/api";
import type {
  MasterShortLink,
  MasterShortLinkListQuery,
  MasterShortLinkListResult,
} from "@/types/short-link";

// Master-only cross-org short link visibility/moderation -- distinct
// endpoints from short-link.service.ts's org-scoped ones (GET/PATCH
// /master/short-links, not /short-links + a header swap), per the fixed
// contract this was built against:
//   GET   /master/short-links       cross-org list/search (filter by org,
//                                    source, is_active) -- master-only
//   PATCH /master/short-links/{id}  moderation (deactivate any org's link)
//
// Deliberately its own file, never imported by anything under
// src/components/customer/ or src/components/features/ -- the cross-tenant
// fields it returns (organizationId/organizationName, source) are
// master-only detail that must never leak into the customer-facing bundle,
// same separation this codebase already keeps between customer/ and
// master/ components (see MasterShortLinkScreen's own doc comment).
//
// No live backend to confirm the exact envelope against yet -- shaped like
// every other paginated list in this codebase (see short-link.service.ts's
// own doc comment for the identical caveat). Revisit `BackendMasterShortLink*`
// first if the real backend disagrees once it's live.

interface BackendMasterShortLink {
  id: string;
  code: string;
  short_url: string;
  target_url: string;
  click_count: number;
  last_clicked_at: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  organization_id: string;
  organization_name: string;
  source: string | null;
}

interface BackendMasterShortLinkListResponse {
  items: BackendMasterShortLink[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toMasterShortLink(l: BackendMasterShortLink): MasterShortLink {
  return {
    id: l.id,
    code: l.code,
    shortUrl: l.short_url,
    targetUrl: l.target_url,
    clickCount: l.click_count,
    lastClickedAt: l.last_clicked_at,
    isActive: l.is_active,
    expiresAt: l.expires_at,
    createdAt: l.created_at,
    organizationId: l.organization_id,
    organizationName: l.organization_name,
    source: l.source,
  };
}

export const masterShortLinkService = {
  async list(query: MasterShortLinkListQuery): Promise<MasterShortLinkListResult> {
    const { data } = await api.get<BackendMasterShortLinkListResponse>("/master/short-links", {
      params: {
        page: query.page,
        page_size: query.pageSize,
        search: query.search || undefined,
        organization_id: query.organizationId || undefined,
        source: query.source || undefined,
        is_active: query.isActive,
      },
    });
    return {
      rows: data.items.map(toMasterShortLink),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  /** Force-deactivate an abusive/reported link regardless of which org owns
   * it. `PATCH /master/short-links/{id}` also technically accepts
   * `is_active: true` (reinstate) -- exposed here too since the moderation
   * UI needs to undo an accidental deactivation, not just apply one. */
  async setActive(id: string, isActive: boolean): Promise<MasterShortLink> {
    const { data } = await api.patch<BackendMasterShortLink>(`/master/short-links/${id}`, {
      is_active: isActive,
    });
    return toMasterShortLink(data);
  },
};
