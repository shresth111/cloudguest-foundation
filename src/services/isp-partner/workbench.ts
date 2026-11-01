/** SUB360-2 workbench + JAZE-5 helpdesk calls used by Subscriber 360. */
import api from "@/services/api";
import type { IspPage } from "@/services/isp-partner/types";
import type {
  DisconnectResult,
  TicketCreateBody,
  TicketType,
  TicketView,
  Workbench,
} from "@/services/isp-partner/workbench-types";

export const workbenchService = {
  async get(subscriberId: string): Promise<Workbench> {
    const { data } = await api.get<Workbench>(`/isp/subscribers/${subscriberId}/workbench`);
    return data;
  },
  async disconnect(
    subscriberId: string,
    body: { session_id?: string; mac?: string } = {},
  ): Promise<DisconnectResult> {
    const { data } = await api.post<DisconnectResult>(
      `/isp/subscribers/${subscriberId}/workbench/disconnect`,
      body,
    );
    return data;
  },
  /** Contact fields on the subscriber (PATCH semantics on the backend). */
  async patchContact(
    subscriberId: string,
    body: { phone?: string | null; email?: string | null },
  ): Promise<void> {
    await api.patch(`/isp/subscribers/${subscriberId}`, body);
  },
  async putAltEmail(subscriberId: string, alt_email: string | null): Promise<void> {
    await api.put(`/isp/subscribers/${subscriberId}/profile`, { alt_email });
  },
};

export const helpdeskService = {
  async types(): Promise<TicketType[]> {
    const { data } = await api.get<TicketType[] | { items: TicketType[] }>(
      "/isp/apps/ticket-types",
    );
    return Array.isArray(data) ? data : (data?.items ?? []);
  },
  async create(body: TicketCreateBody): Promise<TicketView> {
    const { data } = await api.post<TicketView>("/isp/apps/tickets", body);
    return data;
  },
  async comment(ticketId: string, body: string): Promise<void> {
    await api.post(`/isp/apps/tickets/${ticketId}/comments`, { body });
  },
  async forSubscriber(subscriberId: string): Promise<IspPage<TicketView>> {
    const { data } = await api.get<IspPage<TicketView>>("/isp/apps/tickets", {
      params: { subscriber_id: subscriberId, page_size: 20 },
    });
    return data;
  },
};

/** After a bound MAC is removed: end that device's live session now. With
 * the workbench off (404) fall back to JAZE-1's disconnect, which ends every
 * live session of the subscriber. Returns a one-line summary. */
export async function disconnectRemovedMac(subscriberId: string, mac: string): Promise<string> {
  const { ispErrorStatus } = await import("@/lib/isp-partner/errors");
  try {
    const r = await workbenchService.disconnect(subscriberId, { mac });
    if (r.ended.length === 0) return `${mac} has no live session.`;
    return r.unconfirmed.length
      ? `${r.ended.length} session(s) ended; ${r.unconfirmed.length} not confirmed by the router.`
      : `${r.ended.length} session(s) ended.`;
  } catch (err) {
    if (ispErrorStatus(err) !== 404) throw err;
    const { subscribers360Service } = await import("@/services/isp-partner/subscribers360");
    const r = await subscribers360Service.disconnect(subscriberId);
    return `${r.sessions_ended} session(s) ended.`;
  }
}
