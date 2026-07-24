import { api, TOKEN_STORAGE_KEY } from "@/services/api";
import type {
  CreateTicketPayload,
  SupportTicket,
  TicketPriority,
  TicketReply,
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

interface BackendTicketReply {
  id: string;
  ticket_id: string;
  author_user_id: string;
  author_name: string;
  author_email: string;
  is_staff_reply: boolean;
  message: string;
  created_at: string;
}

function toReply(r: BackendTicketReply): TicketReply {
  return {
    id: r.id,
    ticketId: r.ticket_id,
    authorUserId: r.author_user_id,
    authorName: r.author_name,
    authorEmail: r.author_email,
    isStaffReply: r.is_staff_reply,
    message: r.message,
    createdAt: r.created_at,
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
export async function resolveOrgId(): Promise<string> {
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

  /** The reply thread for one ticket, oldest first. ``asCustomer: true``
   * sends ``X-Organization-Id`` (the customer dashboard's own ticket --
   * mirrors ``list()``'s identical header); omitted/false makes the
   * no-header Master-console call (mirrors ``update()``'s identical
   * "no header -> platform-level caller" call shape). */
  async listReplies(ticketId: string, opts?: { asCustomer?: boolean }): Promise<TicketReply[]> {
    const headers = opts?.asCustomer ? { "X-Organization-Id": await resolveOrgId() } : undefined;
    const { data } = await api.get<{ items: BackendTicketReply[] }>(
      `/support-tickets/${ticketId}/replies`,
      { headers },
    );
    return data.items.map(toReply);
  },

  async addReply(
    ticketId: string,
    message: string,
    opts?: { asCustomer?: boolean },
  ): Promise<TicketReply> {
    const headers = opts?.asCustomer ? { "X-Organization-Id": await resolveOrgId() } : undefined;
    const { data } = await api.post<BackendTicketReply>(
      `/support-tickets/${ticketId}/replies`,
      { message },
      { headers },
    );
    return toReply(data);
  },
};

/** Builds the ``WS /support-tickets/ws`` URL -- the browser-native
 * ``WebSocket`` API has no way to set an ``Authorization`` header, so the
 * access token travels as a ``?token=`` query param instead (read from the
 * same ``localStorage`` key ``api.ts``'s request interceptor already
 * reads it from), exactly mirroring how every REST call already
 * authenticates. ``organizationId`` -- when supplied -- is the WebSocket
 * equivalent of the ``X-Organization-Id`` header (a real header can't be
 * set on a WebSocket handshake either): pass the customer's own
 * organization id for the customer dashboard's tenant-scoped connection,
 * or omit it entirely for the Master console's cross-tenant connection
 * (see ``app.domains.support_tickets.router``'s own module docstring for
 * the backend half of this). */
export function buildTicketsWebSocketUrl(organizationId?: string): string {
  const httpBase = api.defaults.baseURL || "/api/v1";
  const resolvedBase = httpBase.startsWith("/")
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${httpBase}`
    : httpBase;
  const wsBase = resolvedBase.replace(/^http/, "ws");
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (organizationId) params.set("organization_id", organizationId);
  return `${wsBase}/support-tickets/ws?${params.toString()}`;
}
