/** JAZE-5 Apps (`/isp/apps/*`, BE `isp_partner/apps_router.py`, flag
 * `ISP_APPS_ENABLED`, default OFF -> 404). Ticket shapes are SUB360-2's
 * (`workbench-types.ts`) and are re-exported here, not redefined. */
import type {
  RfoReason,
  TicketPriority,
  TicketSource,
  TicketStatus,
  TicketType,
  TicketView,
} from "@/services/isp-partner/workbench-types";

export type { RfoReason, TicketPriority, TicketSource, TicketStatus, TicketType, TicketView };

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "on_hold", "resolved", "closed"];
export const TICKET_SOURCES: TicketSource[] = [
  "phone",
  "whatsapp",
  "walk_in",
  "email",
  "portal",
  "field",
  "other",
];
export const TICKET_PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];
export const RFO_REASONS: RfoReason[] = ["fiber_cut", "power_olt", "cpe_fault", "upstream", "other"];
export type SlaState = "within" | "breached" | "no_sla";

/** `type_view` (adds sort_order to SUB360-2's TicketType). */
export interface TicketTypeFull extends TicketType {
  sort_order: number;
}

export interface TicketEvent {
  kind: string;
  body: string | null;
  detail: Record<string, unknown> | null;
  actor_name: string | null;
  at: string;
}

export interface TicketDetail extends TicketView {
  events: TicketEvent[];
}

export interface TicketQuery {
  isp_customer_id?: string;
  subscriber_id?: string;
  status?: TicketStatus;
  assignee_user_id?: string;
  type_id?: string;
  rfo_reason?: RfoReason;
  sla_state?: SlaState;
  /** Plain `YYYY-MM-DD` (BE `date`). */
  since?: string;
  until?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface TicketPatch {
  status?: TicketStatus;
  priority?: TicketPriority;
  type_id?: string | null;
  assignee_user_id?: string | null;
  rfo_reason?: RfoReason | null;
  resolution_note?: string | null;
}

export interface TicketStats {
  by_rfo: Record<string, number>;
  by_type: {
    type_id: string | null;
    type_name: string | null;
    count: number;
    resolved: number;
    avg_tat_minutes: number | null;
    breached: number;
  }[];
  overall: { count: number; resolved: number; avg_tat_minutes: number | null; breached: number };
}

export interface TicketTypeBody {
  name?: string;
  sla_minutes?: number | null;
  requires_rfo?: boolean;
  active?: boolean;
  sort_order?: number;
}

// ---------------------------------------------------------------- tasks

export type TaskKind = "install" | "repair" | "survey" | "removal" | "other";
export type TaskStatus =
  | "unclaimed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled";
export const TASK_KINDS: TaskKind[] = ["install", "repair", "survey", "removal", "other"];
export const TASK_STATUSES: TaskStatus[] = [
  "unclaimed",
  "assigned",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
];

export interface TaskView {
  id: string;
  isp_customer_id: string | null;
  customer_name: string | null;
  subscriber_id: string | null;
  ticket_id: string | null;
  lead_id: string | null;
  kind: TaskKind | string;
  title: string;
  notes: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduled_at: string | null;
  status: TaskStatus | string;
  assignee_user_id: string | null;
  assignee_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_note: string | null;
  rejected_reason: string | null;
  created_at: string;
}

export interface TaskQuery {
  isp_customer_id?: string;
  status?: TaskStatus;
  kind?: TaskKind;
  assignee_user_id?: string;
  mine?: boolean;
  since?: string;
  until?: string;
  page?: number;
  page_size?: number;
}

export interface TaskBody {
  isp_customer_id?: string | null;
  subscriber_id?: string | null;
  ticket_id?: string | null;
  kind?: TaskKind;
  title?: string;
  notes?: string | null;
  address?: string | null;
  scheduled_at?: string | null;
  assignee_user_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: TaskStatus;
  completion_note?: string | null;
  rejected_reason?: string | null;
}

// ---------------------------------------------------------------- announcements

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "selected";
  customer_ids: string[];
  send_email: boolean;
  status: "draft" | "sent" | string;
  sent_at: string | null;
  created_at: string;
}

export interface AnnouncementBody {
  title?: string;
  body?: string;
  audience?: "all" | "selected";
  customer_ids?: string[];
  send_email?: boolean;
}

// ---------------------------------------------------------------- discounts

export interface Discount {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "flat";
  /** percent: whole percent; flat: paise. */
  value: number;
  max_discount_paise: number | null;
  min_amount_paise: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  package_ids: string[];
  active: boolean;
  label: string;
}

export interface DiscountBody {
  code?: string;
  kind?: "percent" | "flat";
  value?: number;
  description?: string | null;
  max_discount_paise?: number | null;
  min_amount_paise?: number | null;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  package_ids?: string[] | null;
  active?: boolean;
}

export interface DiscountPreview {
  discount_id: string;
  code: string;
  label: string;
  gross_paise: number;
  discount_paise: number;
  taxable_paise: number;
}

export interface Redemption {
  isp_customer_id: string;
  subscriber_id: string | null;
  invoice_id: string;
  amount_paise: number;
  at: string;
}

// ---------------------------------------------------------------- inventory

export type ItemCategory = "ont" | "router" | "cpe" | "ap" | "switch" | "other";
export type UnitState = "in_stock" | "assigned" | "returned" | "faulty" | "retired";
export const ITEM_CATEGORIES: ItemCategory[] = ["ont", "router", "cpe", "ap", "switch", "other"];
export const UNIT_STATES: UnitState[] = ["in_stock", "assigned", "returned", "faulty", "retired"];

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: ItemCategory | string;
  notes: string | null;
  counts: Record<UnitState, number>;
}

export interface InventoryUnit {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  serial: string;
  mac: string | null;
  state: UnitState | string;
  isp_customer_id: string | null;
  customer_name: string | null;
  subscriber_id: string | null;
  state_changed_at: string | null;
  note: string | null;
}

export interface InventoryUnitDetail extends InventoryUnit {
  history: {
    from_state: string | null;
    to_state: string;
    isp_customer_id: string | null;
    note: string | null;
    at: string;
  }[];
}

export interface UnitQuery {
  item_id?: string;
  state?: UnitState;
  isp_customer_id?: string;
  subscriber_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { line: number; serial?: string; error: string }[];
}

// ---------------------------------------------------------------- leads

export type LeadStatus =
  | "new"
  | "contacted"
  | "feasibility_pending"
  | "feasible"
  | "not_feasible"
  | "install_scheduled"
  | "converted"
  | "dropped";
export type LeadSource = "walk_in" | "phone" | "website" | "referral" | "campaign" | "other";
export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "feasibility_pending",
  "feasible",
  "not_feasible",
  "install_scheduled",
  "converted",
  "dropped",
];
export const LEAD_SOURCES: LeadSource[] = [
  "walk_in",
  "phone",
  "website",
  "referral",
  "campaign",
  "other",
];

export interface Lead {
  id: string;
  number: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  source: LeadSource | string;
  status: LeadStatus | string;
  isp_customer_id: string | null;
  customer_name: string | null;
  interested_package_id: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  feasibility_note: string | null;
  dropped_reason: string | null;
  notes: string | null;
  converted_subscriber_id: string | null;
  converted_at: string | null;
  created_at: string;
}

export interface LeadDetail extends Lead {
  tasks: TaskView[];
}

export interface LeadQuery {
  status?: LeadStatus;
  isp_customer_id?: string;
  assignee_user_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface LeadBody {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  isp_customer_id?: string | null;
  interested_package_id?: string | null;
  assignee_user_id?: string | null;
  feasibility_note?: string | null;
  dropped_reason?: string | null;
  notes?: string | null;
}
