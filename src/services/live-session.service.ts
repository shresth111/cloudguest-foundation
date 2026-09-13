import { api } from "@/services/api";
import type { LiveSession, LiveSessionList, LiveSessionQuery } from "@/types/live-session";

/**
 * Reads the real "who is online right now" feed from `GET /sessions/live`
 * (backend `app.domains.live_sessions`), the endpoint the old
 * `LiveSessionExplorer` never called — it fabricated 45 rows in the browser
 * instead (see that component's docstring).
 *
 * Org scoping is handled by the shared request interceptor
 * (`attachOrganizationScope` in `api.ts`), which attaches the session's
 * `X-Organization-Id` to every call; `/sessions/live` reads it via
 * `CurrentOrganization`, so a customer only ever sees their own org's
 * sessions. `ssid`/`signal`/`nas`/router-name are intentionally dropped in
 * the mapping below — see `types/live-session.ts` for why none of them can
 * be filled on this fleet.
 */

interface BackendLiveSession {
  id: string;
  guest_id?: string | null;
  mac?: string | null;
  ip?: string | null;
  router_id?: string | null;
  session_time_seconds?: number;
  download_bytes?: number;
  upload_bytes?: number;
  status?: string;
  location_id?: string | null;
  started_at?: string | null;
}

interface BackendLiveSessionList {
  items: BackendLiveSession[];
  total: number;
  page: number;
  page_size: number;
}

function toLiveSession(s: BackendLiveSession): LiveSession {
  return {
    id: s.id,
    guestId: s.guest_id ?? null,
    mac: s.mac ?? null,
    ip: s.ip ?? null,
    routerId: s.router_id ?? null,
    sessionTimeSeconds: s.session_time_seconds ?? 0,
    downloadBytes: s.download_bytes ?? 0,
    uploadBytes: s.upload_bytes ?? 0,
    status: s.status ?? "active",
    locationId: s.location_id ?? null,
    startedAt: s.started_at ?? null,
  };
}

export const liveSessionService = {
  async list(query: LiveSessionQuery = {}): Promise<LiveSessionList> {
    const { data } = await api.get<BackendLiveSessionList>("/sessions/live", {
      params: {
        location_id: query.locationId,
        status: query.status ?? "active",
        search: query.search || undefined,
        page: query.page ?? 1,
        page_size: query.pageSize ?? 25,
      },
    });
    return {
      items: (data?.items ?? []).map(toLiveSession),
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      pageSize: data?.page_size ?? 25,
    };
  },
};
