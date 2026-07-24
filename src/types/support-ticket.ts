export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  organizationId: string;
  locationId: string | null;
  createdByUserId: string;
  createdByName: string;
  createdByEmail: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  subject: string;
  description: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketPayload {
  locationId?: string;
  subject: string;
  description: string;
  category?: string;
  priority?: TicketPriority;
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToUserId?: string | null;
  resolutionNotes?: string;
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export interface TicketReply {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName: string;
  authorEmail: string;
  isStaffReply: boolean;
  message: string;
  createdAt: string;
}

/** Real-time WebSocket payload shapes -- mirror the backend's
 * ``app.domains.support_tickets.constants.TicketRealtimeMessageType``
 * values and the ``_reply_live_payload``/``_ticket_live_payload``
 * dicts published alongside a reply-create/ticket-update write. Every
 * field is a plain string (UUIDs/dates included) -- relayed verbatim off
 * a JSON-serialized Redis message, never re-typed on the wire. */
export interface TicketReplyLivePayload {
  id: string;
  ticket_id: string;
  organization_id: string;
  author_user_id: string;
  author_name: string;
  author_email: string;
  is_staff_reply: boolean;
  message: string;
  created_at: string;
}

export interface TicketUpdatedLivePayload {
  id: string;
  ticket_id: string;
  organization_id: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to_user_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  updated_at: string;
}

export type TicketRealtimeMessage =
  | { type: "reply_created"; payload: TicketReplyLivePayload; occurred_at: string }
  | { type: "ticket_updated"; payload: TicketUpdatedLivePayload; occurred_at: string };
