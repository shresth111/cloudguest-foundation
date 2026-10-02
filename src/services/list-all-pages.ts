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
 */

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
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const pageSize = Math.min(opts.pageSize ?? BACKEND_MAX_PAGE_SIZE, BACKEND_MAX_PAGE_SIZE);
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
