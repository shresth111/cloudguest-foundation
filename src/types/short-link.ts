/** Org-scoped short link, shape matching the fixed backend contract this
 * was built against (see short-link.service.ts's own doc comment for the
 * exact endpoints) -- `POST/GET/PATCH/DELETE /short-links`, each item
 * `{id, code, short_url, target_url, click_count, last_clicked_at,
 * is_active, expires_at, created_at}`. */
export interface ShortLink {
  id: string;
  code: string;
  shortUrl: string;
  targetUrl: string;
  clickCount: number;
  lastClickedAt: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface ShortLinkListResult {
  rows: ShortLink[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateShortLinkPayload {
  targetUrl: string;
  expiresAt?: string | null;
}

export interface UpdateShortLinkPayload {
  targetUrl?: string;
  isActive?: boolean;
  expiresAt?: string | null;
}

/** One recorded click, for the detail endpoint's "click analytics". Exact
 * field set is unverified against a live backend (no `GET /short-links/{id}`
 * response has been seen yet) -- shaped defensively (every field but
 * `occurredAt` is nullable) so an unrecognized/absent field degrades to
 * "unknown" in the UI instead of breaking the page. */
export interface ShortLinkClickEvent {
  occurredAt: string;
  referrer: string | null;
  userAgent: string | null;
  country: string | null;
}

export interface ShortLinkDailyClicks {
  date: string;
  count: number;
}

export interface ShortLinkDetail extends ShortLink {
  recentClicks: ShortLinkClickEvent[];
  clicksByDay: ShortLinkDailyClicks[];
}

/* ── Master (platform-operator) cross-org view ──────────────────────────
 * Never imported by anything under src/components/customer/ or
 * src/components/features/ -- cross-tenant fields (organizationId/Name,
 * source) are master-only detail, kept out of the customer bundle path the
 * same way MasterShell.tsx's own doc comments describe for other domains. */

export interface MasterShortLink extends ShortLink {
  organizationId: string;
  organizationName: string;
  /** Which surface created the link (e.g. "customer", "campaign",
   * "system") -- filterable per the task contract ("filter by org, source,
   * is_active"). Exact enum values unverified against a live backend. */
  source: string | null;
}

export interface MasterShortLinkListQuery {
  page: number;
  pageSize: number;
  search?: string;
  organizationId?: string;
  source?: string;
  isActive?: boolean;
}

export interface MasterShortLinkListResult {
  rows: MasterShortLink[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
