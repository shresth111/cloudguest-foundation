import { api } from "@/services/api";
import type {
  CreateTicketPayload,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  UpdateTicketPayload,
} from "@/types/support-ticket";

interface BackendTicket {
  id: string;
  organization_id: string;
  location_id: string | null;
  created_by_user_id: string;
  created_by_name: string;
  created_by_email: string;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  subject: string;
  description: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendTicketListResponse {
  items: BackendTicket[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toTicket(t: BackendTicket): SupportTicket {
  return {
    id: t.id,
    organizationId: t.organization_id,
    locationId: t.location_id,
    createdByUserId: t.created_by_user_id,
    createdByName: t.created_by_name,
    createdByEmail: t.created_by_email,
    assignedToUserId: t.assigned_to_user_id,
    assignedToName: t.assigned_to_name,
    subject: t.subject,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    resolutionNotes: t.resolution_notes,
    resolvedAt: t.resolved_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

interface MyOrganizationMembership {
  organization_id: string;
  status: "invited" | "active" | "suspended" | "removed";
}

let cachedOrgId: string | null = null;
/** Resolves the *current user's own* organization id via `/me/organizations`
 * -- the membership-scoped endpoint (no `organizations.read` permission
 * required, returns only organizations this user actually belongs to).
 *
 * Previously this called the platform-wide `GET /organizations` (admin-only
 * cross-tenant listing, ordered newest-first) and took `items[0]` -- on any
 * database with more than one organization that silently tags the ticket
 * with a *different* organization than the one the customer actually
 * belongs to (whichever org was created most recently platform-wide), which
 * then fails `TicketService._assert_location_in_organization` on the
 * backend the moment a real location is selected (the location belongs to
 * the customer's real org, not the wrongly-resolved one) -- see
 * app.domains.support_tickets.service.TicketService._assert_location_in_organization.
 */
async function resolveOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const { data } = await api.get<MyOrganizationMembership[]>("/me/organizations");
  const membership = data.find((m) => m.status === "active") ?? data[0];
  if (!membership) throw new Error("No organization found for the current session");
  cachedOrgId = membership.organization_id;
  return cachedOrgId;
}

export const ticketService = {
  /** Org-scoped -- the customer dashboard's own tickets. */
  async list(params?: { status?: TicketStatus; priority?: TicketPriority; search?: string }): Promise<SupportTicket[]> {
    const orgId = await resolveOrgId();
    const { data } = await api.get<BackendTicketListResponse>("/support-tickets", {
      params: { page_size: 100, ...params },
      headers: { "X-Organization-Id": orgId },
    });
    return data.items.map(toTicket);
  },

  /** No X-Organization-Id header -- the backend resolves this to "every
   * organization the caller's permissions allow," which is exactly the
   * Master (super-admin) dashboard's cross-tenant view. */
  async listAllOrgs(params?: { status?: TicketStatus; priority?: TicketPriority; search?: string }): Promise<SupportTicket[]> {
    const { data } = await api.get<BackendTicketListResponse>("/support-tickets", {
      params: { page_size: 100, ...params },
    });
    return data.items.map(toTicket);
  },

  async create(payload: CreateTicketPayload): Promise<SupportTicket> {
    const orgId = await resolveOrgId();
    const { data } = await api.post<BackendTicket>(
      "/support-tickets",
      {
        location_id: payload.locationId,
        subject: payload.subject,
        description: payload.description,
        category: payload.category,
        priority: payload.priority ?? "medium",
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toTicket(data);
  },

  async update(ticketId: string, payload: UpdateTicketPayload): Promise<SupportTicket> {
    const { data } = await api.patch<BackendTicket>(`/support-tickets/${ticketId}`, {
      status: payload.status,
      priority: payload.priority,
      assigned_to_user_id: payload.assignedToUserId,
      resolution_notes: payload.resolutionNotes,
    });
    return toTicket(data);
  },
};
