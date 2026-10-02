/**
 * Read EVERY page of a backend list endpoint, in pages the backend accepts.
 *
 * ## Why this exists
 *
 * Every paginated list route in the backend declares
 * `page_size: int = Query(default=25, ge=1, le=100)`. A request above that cap
 * is not clamped -- FastAPI rejects it with a 422 and the caller gets nothing
 * at all. Two Master-console callers asked for `page_size=200` because they
 * wanted "all of them" (the organization scope picker, and the Router Fleet's
 * controller -> integration join), so both 422'd on every Master page load:
 * the picker listed no organizations and the fleet join silently did nothing.
 *
 * Lowering the number to 100 would have made both requests succeed and both
 * screens quietly wrong at the 101st tenant. A caller that needs the whole
 * list has to walk `has_next`, and this is the one place that does it.
 *
 * ## Failure is loud
 *
 * A failed page rejects the whole read. Returning the pages that did load
 * would hand back a short list indistinguishable from a complete one -- the
 * exact silent truncation this replaces. `MAX_PAGES` is a circuit breaker
 * against a backend whose `has_next` never turns false, not a truncation
 * point, and hitting it throws for the same reason.
 *
 * ## `getAllItems`
 *
 * The raw-endpoint form of the same walk, for the services that call
 * `api.get(path, { params: { page_size: 100 } })` and then read `data.items`
 * as if it were the whole list. That shape was the second half of the bug
 * class: it never 422s, it just stops at row 100 and says nothing.
 */

import { api } from "@/services/api";

/** The backend's `le=100` on every list route's `page_size`. */
export const BACKEND_MAX_PAGE_SIZE = 100;

/** 500 x 100 = 50k rows. No legitimate directory read gets near it. */
const MAX_PAGES = 500;

export interface PageOf<T> {
  rows: T[];
  hasNext: boolean;
}

export async function listAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PageOf<T>>,
  opts: {
    pageSize?: number;
    maxPages?: number;
    /** The endpoint's own `le=` when it is not the usual 100. Only
     * `/monitored-hardware` has one today (`le=200`); every exception is
     * listed with its endpoint in `scripts/test-list-page-size.mjs`. */
    maxPageSize?: number;
  } = {},
): Promise<T[]> {
  const cap = opts.maxPageSize ?? BACKEND_MAX_PAGE_SIZE;
  const pageSize = Math.min(opts.pageSize ?? cap, cap);
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { rows, hasNext } = await fetchPage(page, pageSize);
    all.push(...rows);
    if (!hasNext) return all;
  }
  throw new Error(
    `listAllPages: still has_next after ${maxPages} pages of ${pageSize}; refusing to return a truncated list`,
  );
}

/** The pagination fields every backend list payload carries next to `items`. */
export interface BackendPage<T> {
  items: T[];
  has_next?: boolean | null;
  total_pages?: number | null;
}

/** `has_next` when the payload says it, `total_pages` when that is all it
 * says, and otherwise "a full page means there may be more" -- the only
 * fallback that cannot stop early on a list that has more rows. */
export function backendHasNext(
  data: BackendPage<unknown>,
  page: number,
  pageSize: number,
): boolean {
  if (typeof data.has_next === "boolean") return data.has_next;
  if (typeof data.total_pages === "number") return page < data.total_pages;
  return data.items.length >= pageSize;
}

export interface GetAllItemsConfig {
  /** Query params sent on EVERY page. `page` / `page_size` are owned here. */
  params?: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
  /** See `listAllPages`' `maxPageSize`. */
  maxPageSize?: number;
}

/**
 * Every row of `GET path`, walking pages of at most 100. Rejects if any page
 * fails -- see the header: a partial list must never look like a whole one.
 */
export async function getAllItems<T>(path: string, config: GetAllItemsConfig = {}): Promise<T[]> {
  const { maxPageSize, params, headers } = config;
  return listAllPages<T>(
    async (page, pageSize) => {
      const { data } = await api.get<BackendPage<T>>(path, {
        headers,
        params: { ...params, page, page_size: pageSize },
      });
      return { rows: data.items, hasNext: backendHasNext(data, page, pageSize) };
    },
    { maxPageSize },
  );
}
