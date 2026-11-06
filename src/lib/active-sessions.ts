import { api } from "@/services/api";
import { distinctGuestCount } from "@/lib/guest-counts";

/** The fields of a `/guest-sessions` row the "who is online" count reads. */
export interface ActiveSessionRow {
  id: string;
  status: string;
  /** Server-derived presence (session active AND device not seen as gone). */
  is_online?: boolean;
  guest_id?: string | null;
  router_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

/** 100 is the backend's own page_size ceiling (guest/router.py). */
const PAGE_SIZE = 100;
/** A venue with more than 1,000 open sessions at once is not one we serve
 * today; the cap only stops a runaway loop. `complete` says when it hit. */
export const MAX_ACTIVE_SESSION_PAGES = 10;

export interface ActiveSessions<T extends ActiveSessionRow = ActiveSessionRow> {
  rows: T[];
  /** `total_items` as the server reported it for `status=active`. */
  total: number;
  /** False when the page cap stopped the read before `total` rows. */
  complete: boolean;
}

/**
 * Every OPEN session at a location, whenever it started.
 *
 * "Currently online" used to be counted from the last 24h of session starts,
 * first 100 rows. A hotel or coworking guest whose session began yesterday was
 * not online by that measure, and at a venue with more than 100 logins a day
 * the older, still-open sessions fell off the page. `status=active` is a real
 * server-side filter on `/guest-sessions`, so this asks for exactly the open
 * sessions and pages through them. Errors propagate: a failed read must not
 * read as "nobody is online".
 */
export async function fetchActiveSessions<T extends ActiveSessionRow = ActiveSessionRow>(
  locationId: string,
  headers: Record<string, string>,
): Promise<ActiveSessions<T>> {
  const rows: T[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_ACTIVE_SESSION_PAGES; page++) {
    const { data } = await api.get<{ items: T[]; total_items?: number; has_next?: boolean }>(
      "/guest-sessions",
      {
        params: { location_id: locationId, status: "active", page, page_size: PAGE_SIZE },
        headers,
      },
    );
    const items = data?.items ?? [];
    rows.push(...items);
    total = data?.total_items ?? rows.length;
    const more = data?.has_next ?? rows.length < total;
    if (!more || items.length === 0) return { rows, total, complete: true };
  }
  return { rows, total, complete: rows.length >= total };
}

/**
 * Distinct guests online: open sessions the network still sees, not on a
 * router known to be offline. One guest on two devices is one person, the
 * rule the workspace dashboard already uses.
 */
export function countOnlineGuests(
  rows: ActiveSessionRow[],
  offlineRouterIds: ReadonlySet<string> = new Set(),
): number {
  const online = rows.filter(
    (s) =>
      (s.is_online ?? s.status === "active") &&
      (!s.router_id || !offlineRouterIds.has(s.router_id)),
  );
  return distinctGuestCount(online.map((s) => ({ guestId: s.guest_id ?? null })));
}
