/**
 * Frontend view of one active guest session, as `GET /sessions/live`
 * (backend `app.domains.live_sessions`) returns it.
 *
 * Only the fields this fleet can honestly fill are surfaced. The backend
 * schema (`live_sessions/schemas.py`) deliberately exposes several fields
 * as `None`-by-absence, and its own docstring records which can never be
 * populated on this platform:
 *
 *   - `ssid` / `signal`  never, on the session path. They are observed per
 *                        *device* by the connected-devices sync, and only
 *                        for wireless devices; every router this company
 *                        owns is a wired MikroTik with no radio to ask.
 *                        Both are OMITTED from `LiveSession` below rather
 *                        than carried as always-null columns.
 *   - `nas`              the RADIUS wire identifier lives on
 *                        `RadiusNasClient`, keyed by router, not the
 *                        session; also Master-console/backend-only, never
 *                        customer-facing. Omitted.
 *   - `router` (name)    `router_id` is carried; resolving it to a display
 *                        name is a join owned by another branch, so only
 *                        the id is exposed here.
 *   - `username`         intentionally not the guest's phone/email (PII);
 *                        follow `guestId` to the guest record instead.
 */
export interface LiveSession {
  id: string;
  guestId: string | null;
  mac: string | null;
  ip: string | null;
  routerId: string | null;
  sessionTimeSeconds: number;
  downloadBytes: number;
  uploadBytes: number;
  status: string;
  locationId: string | null;
  startedAt: string | null;
}

export interface LiveSessionList {
  items: LiveSession[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LiveSessionQuery {
  locationId?: string;
  /** Backend default is "active"; pass "all" to include paused/idle rows. */
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
