import { api } from "@/services/api";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import type {
  CreateShortLinkPayload,
  ShortLink,
  ShortLinkDetail,
  ShortLinkListResult,
  UpdateShortLinkPayload,
} from "@/types/short-link";

// Real backend integration against the fixed contract this was built to
// (backend built concurrently by another agent, not live at the time this
// was written):
//   POST   /short-links        {target_url, expires_at?} -> org-scoped create
//   GET    /short-links        paginated list, caller's org only
//   GET    /short-links/{id}   detail + click analytics
//   PATCH  /short-links/{id}   update target_url/is_active/expires_at
//   DELETE /short-links/{id}   revoke
// Org context is threaded via X-Organization-Id, the same convention every
// sibling org-scoped service in this file's neighborhood uses (see
// voucher.service.ts, routing-policy.service.ts's own doc comments) --
// resolved via resolveOrgId() (GET /me/organizations, not the platform-wide
// GET /organizations an ordinary customer session 403s on -- see that
// function's own doc comment in customer.service.ts).
//
// List/detail envelope shapes below are unverified against a live backend
// (it wasn't up yet) -- shaped to match this codebase's own established
// paginated-list convention (voucher.service.ts's BackendVoucherBatchListResponse:
// items/page/page_size/total_items/total_pages/has_next/has_previous).
// Revisit `BackendShortLink{,ListResponse,Detail}` first if the real
// backend's response disagrees once it's live.

interface BackendShortLink {
  id: string;
  code: string;
  short_url: string;
  target_url: string;
  click_count: number;
  last_clicked_at: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface BackendShortLinkListResponse {
  items: BackendShortLink[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendShortLinkClickEvent {
  occurred_at: string;
  referrer: string | null;
  user_agent: string | null;
  country: string | null;
}

interface BackendShortLinkDetail extends BackendShortLink {
  recent_clicks?: BackendShortLinkClickEvent[];
  clicks_by_day?: { date: string; count: number }[];
}

function toShortLink(l: BackendShortLink): ShortLink {
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
  };
}

function toShortLinkDetail(d: BackendShortLinkDetail): ShortLinkDetail {
  return {
    ...toShortLink(d),
    recentClicks: (d.recent_clicks ?? []).map((c) => ({
      occurredAt: c.occurred_at,
      referrer: c.referrer,
      userAgent: c.user_agent,
      country: c.country,
    })),
    clicksByDay: d.clicks_by_day ?? [],
  };
}

// Demo-session seed -- same convention as router.service.ts's DEMO_ROUTERS /
// voucher pages' DEMO_SEED: the Master Console's demo sign-in issues a
// token the real backend never accepts, so every real call below 401s
// under a demo session.
const DEMO_LINKS: ShortLink[] = [
  {
    id: "sl-demo-1",
    code: "wifi24",
    shortUrl: "https://wyfy.link/wifi24",
    targetUrl: "https://wyfyguest.com/portal/loc-demo-001",
    clickCount: 128,
    lastClickedAt: new Date(Date.now() - 3600_000).toISOString(),
    isActive: true,
    expiresAt: null,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "sl-demo-2",
    code: "promo-aug",
    shortUrl: "https://wyfy.link/promo-aug",
    targetUrl: "https://wyfyguest.com/campaigns/summer",
    clickCount: 42,
    lastClickedAt: null,
    isActive: true,
    expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "sl-demo-3",
    code: "old-menu",
    shortUrl: "https://wyfy.link/old-menu",
    targetUrl: "https://wyfyguest.com/portal/loc-demo-002",
    clickCount: 7,
    lastClickedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    isActive: false,
    expiresAt: null,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
];

export const shortLinkService = {
  async list(page = 1, pageSize = 25): Promise<ShortLinkListResult> {
    if (isDemo()) {
      return {
        rows: DEMO_LINKS,
        total: DEMO_LINKS.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      };
    }
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendShortLinkListResponse>("/short-links", {
      params: { page, page_size: pageSize },
      headers: { "X-Organization-Id": orgId },
    });
    return {
      rows: data.items.map(toShortLink),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async get(id: string): Promise<ShortLinkDetail> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendShortLinkDetail>(`/short-links/${id}`, {
      headers: { "X-Organization-Id": orgId },
    });
    return toShortLinkDetail(data);
  },

  async create(payload: CreateShortLinkPayload): Promise<ShortLink> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendShortLink>(
      "/short-links",
      { target_url: payload.targetUrl, expires_at: payload.expiresAt ?? null },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toShortLink(data);
  },

  async update(id: string, payload: UpdateShortLinkPayload): Promise<ShortLink> {
    const orgId = await resolveOrgId();
    const body: Record<string, unknown> = {};
    if (payload.targetUrl !== undefined) body.target_url = payload.targetUrl;
    if (payload.isActive !== undefined) body.is_active = payload.isActive;
    if (payload.expiresAt !== undefined) body.expires_at = payload.expiresAt;
    const { data } = await api.patch<BackendShortLink>(`/short-links/${id}`, body, {
      headers: { "X-Organization-Id": orgId },
    });
    return toShortLink(data);
  },

  async remove(id: string): Promise<void> {
    const orgId = await resolveOrgId();
    await api.delete(`/short-links/${id}`, { headers: { "X-Organization-Id": orgId } });
  },
};
