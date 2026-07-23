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
