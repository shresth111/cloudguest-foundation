import api from "@/services/api";
import type { GuestSessionDeviceEvents } from "@/types/guestDeviceEvents";

/** The request for one session's device events. Only the session id goes in
 * the URL; the organization goes in the scope header the backend checks the
 * session against -- the same shape as every other Guest Connection Records
 * read (`/guest-sessions` in UserReports.tsx). */
export function guestDeviceEventsRequest(
  sessionId: string,
  orgId: string,
): { url: string; headers: Record<string, string> } {
  return {
    url: `/guest-sessions/${encodeURIComponent(sessionId)}/device-events`,
    headers: { "X-Organization-Id": orgId },
  };
}

export const guestDeviceEventsService = {
  async forSession(sessionId: string, orgId: string): Promise<GuestSessionDeviceEvents> {
    const { url, headers } = guestDeviceEventsRequest(sessionId, orgId);
    const { data } = await api.get<GuestSessionDeviceEvents>(url, { headers });
    return data;
  },
};
