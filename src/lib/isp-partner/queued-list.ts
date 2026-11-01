/** P3-SWEEP: the ISP-wide queued renewals page (`/partner/queued-renewals`).
 * Pure helpers: the URL search <-> filters, and the request params. */
import type { QueuedListQuery } from "@/services/isp-partner/queued-renewal";

export const QUEUED_LIST_STATUSES = ["pending", "active", "cancelled", "all"] as const;
export type QueuedListStatus = (typeof QUEUED_LIST_STATUSES)[number];

export const QUEUED_LIST_STATUS_LABEL: Record<QueuedListStatus, string> = {
  pending: "Waiting to start",
  active: "Started",
  cancelled: "Cancelled",
  all: "All",
};

/** "Starts within" choices, in days. */
export const STARTS_WITHIN = [1, 7, 30] as const;

export interface QueuedSearch {
  status?: QueuedListStatus;
  q?: string;
  package?: string;
  within?: number;
  page?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** TanStack `validateSearch`: anything unknown or malformed is dropped, so a
 * hand-edited URL never reaches the API as a 422. */
export function parseQueuedSearch(raw: Record<string, unknown>): QueuedSearch {
  const out: QueuedSearch = {};
  const st = raw.status;
  if (typeof st === "string" && (QUEUED_LIST_STATUSES as readonly string[]).includes(st))
    out.status = st as QueuedListStatus;
  if (typeof raw.q === "string" && raw.q.trim()) out.q = raw.q.trim().slice(0, 100);
  if (typeof raw.package === "string" && UUID.test(raw.package)) out.package = raw.package;
  const within = Number(raw.within);
  if ((STARTS_WITHIN as readonly number[]).includes(within)) out.within = within;
  const page = Number(raw.page);
  if (Number.isInteger(page) && page > 1) out.page = page;
  return out;
}

export const PAGE_SIZE = 50;

export function queuedListQuery(s: QueuedSearch): QueuedListQuery {
  return {
    status: s.status ?? "pending",
    q: s.q || undefined,
    package_id: s.package || undefined,
    starts_within_days: s.within,
    page: s.page ?? 1,
    page_size: PAGE_SIZE,
  };
}

export const pagesOf = (total: number, pageSize: number = PAGE_SIZE): number =>
  Math.max(1, Math.ceil(total / pageSize));

/** True when any filter beyond the default "waiting" view is applied. */
export const hasFilters = (s: QueuedSearch): boolean =>
  !!(s.q || s.package || s.within || (s.status && s.status !== "pending"));
