/**
 * Batch B5 calls (ADDENDUM_04): venue alerts, the ISP alert feed, ISP -> Wyfy
 * support tickets and staff activity. Venue calls go to `/isp/venue/...` (the
 * shell's VenueScope pins the customer + location headers); the rest are the
 * ISP's own `/isp/...` routes.
 */
import { api } from "@/services/api";
import type { Page } from "@/services/isp-partner/venue-security";

export interface VenueAlert {
  id: string;
  status: "triggered" | "acknowledged" | "resolved" | string;
  severity: string;
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  location_id: string | null;
  router_id: string | null;
  router_name?: string | null;
}
export interface VenueAlertRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  target_component: string | null;
  severity: string;
  is_active: boolean;
}
export interface IspAlert {
  id: string;
  isp_customer_id: string;
  customer_name: string;
  isp_location_id: string | null;
  status: string;
  severity: string;
  message: string;
  triggered_at: string;
}
export interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string | null;
  priority: string;
  status: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  resolution_notes: string | null;
}
export interface TicketReply {
  id: string;
  author_name: string;
  is_staff_reply: boolean;
  message: string;
  created_at: string;
}
export interface StaffActivityItem {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  description: string | null;
  actor: { isp_user_id: string; name: string; is_isp_staff: boolean } | null;
  isp_customer_id: string | null;
  customer_name: string | null;
}

export const monitorSupportService = {
  async venueAlerts(): Promise<Page<VenueAlert>> {
    const { data } = await api.get<Page<VenueAlert>>("/isp/venue/alerts", {
      params: { page: 1, page_size: 100 },
    });
    return data;
  },
  async acknowledge(id: string): Promise<void> {
    await api.post(`/isp/venue/alerts/${id}/acknowledge`);
  },
  async resolve(id: string): Promise<void> {
    await api.post(`/isp/venue/alerts/${id}/resolve`);
  },
  async venueAlertRules(): Promise<Page<VenueAlertRule>> {
    const { data } = await api.get<Page<VenueAlertRule>>("/isp/venue/alert-rules");
    return data;
  },
  async ispAlerts(q: {
    customerId?: string;
    status?: string;
    page: number;
  }): Promise<Page<IspAlert>> {
    const { data } = await api.get<Page<IspAlert>>("/isp/alerts", {
      params: {
        isp_customer_id: q.customerId || undefined,
        alert_status: q.status || undefined,
        page: q.page,
        page_size: 25,
      },
    });
    return data;
  },
  async tickets(page: number): Promise<Page<Ticket>> {
    const { data } = await api.get<Page<Ticket>>("/isp/support-tickets", {
      params: { page, page_size: 25 },
    });
    return data;
  },
  async createTicket(body: {
    subject: string;
    description: string;
    priority: string;
    isp_customer_id?: string | null;
  }): Promise<Ticket> {
    const { data } = await api.post<Ticket>("/isp/support-tickets", body);
    return data;
  },
  async replies(ticketId: string): Promise<TicketReply[]> {
    const { data } = await api.get<{ items: TicketReply[] }>(
      `/isp/support-tickets/${ticketId}/replies`,
    );
    return data.items;
  },
  async reply(ticketId: string, message: string): Promise<void> {
    await api.post(`/isp/support-tickets/${ticketId}/replies`, { message });
  },
  async staffActivity(q: {
    customerId?: string | null;
    action?: string;
    page: number;
  }): Promise<Page<StaffActivityItem>> {
    const { data } = await api.get<Page<StaffActivityItem>>("/isp/staff-activity", {
      params: {
        isp_customer_id: q.customerId || undefined,
        action: q.action || undefined,
        page: q.page,
        page_size: 50,
      },
    });
    return data;
  },
};
