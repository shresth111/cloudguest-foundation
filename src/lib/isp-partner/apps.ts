/** Pure helpers for the Apps screens (APPS-FE over JAZE-5). No React, no
 * API: `scripts/test-isp-partner-apps.mjs` runs them. Rules mirror the
 * backend (apps_common / apps_helpdesk / apps_tasks / apps_inventory); the
 * API stays the authority, these only decide which buttons to show and
 * catch obvious mistakes before a round trip.
 *
 * Built so the APPS-2 backend gaps (SLA escalation, task pipeline states,
 * inventory approvals, lead SLA) slot in: every status list is data, an
 * unknown status from the API gets a readable fallback label and no
 * transitions instead of breaking the page. */
import { parseRupeesToPaise } from "@/lib/isp-partner/money";
import type {
  AnnouncementBody,
  DiscountBody,
  LeadBody,
  TaskQuery,
  TicketPatch,
  TicketTypeFull,
} from "@/services/isp-partner/apps-types";

export const humanize = (v: string | null | undefined): string =>
  v ? v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "–";

export const TICKET_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  on_hold: "On hold",
  resolved: "Resolved",
  closed: "Closed",
};
export const RFO_LABEL: Record<string, string> = {
  fiber_cut: "Fiber cut",
  power_olt: "Power / OLT",
  cpe_fault: "Customer equipment",
  upstream: "Upstream provider",
  other: "Other",
};
export const TASK_STATUS_LABEL: Record<string, string> = {
  unclaimed: "Unclaimed",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
export const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  feasibility_pending: "Feasibility check",
  feasible: "Feasible",
  not_feasible: "Not feasible",
  install_scheduled: "Install scheduled",
  converted: "Converted",
  dropped: "Dropped",
};
export const UNIT_STATE_LABEL: Record<string, string> = {
  in_stock: "In stock",
  assigned: "With a customer",
  returned: "Returned",
  faulty: "Faulty",
  retired: "Retired",
};

export function label(map: Record<string, string>, v: string | null | undefined): string {
  return v ? (map[v] ?? humanize(v)) : "–";
}

/** MTag tone per status (unknown statuses read as neutral). */
export function tone(v: string | null | undefined): string {
  switch (v) {
    case "open":
    case "unclaimed":
    case "new":
    case "in_stock":
      return "pending";
    case "in_progress":
    case "assigned":
    case "contacted":
    case "feasibility_pending":
    case "install_scheduled":
      return "active";
    case "resolved":
    case "closed":
    case "completed":
    case "converted":
    case "feasible":
      return "paid";
    case "breached":
    case "rejected":
    case "faulty":
    case "not_feasible":
    case "dropped":
      return "failed";
    default:
      return "normal";
  }
}

// ---------------------------------------------------------------- permissions

export interface AppsCan {
  read: boolean;
  create: boolean;
  update: boolean;
  manage: boolean;
  export: boolean;
}

export function appsCan(can: (p: string) => boolean): AppsCan {
  return {
    read: can("isp_apps.read"),
    create: can("isp_apps.create"),
    update: can("isp_apps.update"),
    manage: can("isp_apps.manage"),
    export: can("isp_apps.export"),
  };
}

// ---------------------------------------------------------------- helpdesk

/** Same rule as `apps_helpdesk.needs_rfo`: only a type that says so. */
export function needsRfo(type: Pick<TicketTypeFull, "requires_rfo"> | null | undefined): boolean {
  return !!type && type.requires_rfo === true;
}

export const DONE_TICKET = new Set(["resolved", "closed"]);

/** Status change body, or why it cannot be sent. */
export function ticketStatusBody(
  target: string,
  current: { status: string; rfo_reason: string | null },
  type: Pick<TicketTypeFull, "requires_rfo"> | null | undefined,
  rfo: string,
  note: string,
): { body: TicketPatch } | { error: string } {
  if (target === current.status) return { error: "The ticket already has that status." };
  const body: TicketPatch = { status: target as TicketPatch["status"] };
  if (DONE_TICKET.has(target)) {
    const reason = rfo || current.rfo_reason || "";
    if (needsRfo(type) && !reason) return { error: "Pick a reason for outage before resolving." };
    if (rfo) body.rfo_reason = rfo as TicketPatch["rfo_reason"];
    if (note.trim()) body.resolution_note = note.trim();
  }
  return { body };
}

/** "Due in 3 h", "Breached 2 h ago", "No SLA". */
export function slaText(
  t: { sla_state: string; due_at: string | null; status: string; tat_minutes: number | null },
  now: number = Date.now(),
): string {
  if (t.sla_state === "no_sla" || !t.due_at) return "No SLA";
  if (DONE_TICKET.has(t.status))
    return t.sla_state === "breached" ? "Resolved late" : "Resolved in time";
  const diff = Date.parse(t.due_at) - now;
  const fmt = (ms: number) => {
    const m = Math.round(Math.abs(ms) / 60_000);
    return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  };
  return diff >= 0 ? `Due in ${fmt(diff)}` : `Breached ${fmt(diff)} ago`;
}

export function minutesText(m: number | null | undefined): string {
  if (m === null || m === undefined) return "–";
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 2880) return `${(m / 60).toFixed(1)} h`;
  return `${(m / 1440).toFixed(1)} d`;
}

/** SLA hours text -> minutes (BE: 5 min to 60 days). */
export function slaMinutes(hours: string): number | null | "bad" {
  const t = hours.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return "bad";
  const m = Math.round(n * 60);
  return m >= 5 && m <= 60 * 24 * 60 ? m : "bad";
}

// ---------------------------------------------------------------- tasks

/** `apps_tasks.TASK_TRANSITIONS`. Unknown status -> no moves. */
export const TASK_NEXT: Record<string, string[]> = {
  unclaimed: ["assigned", "cancelled"],
  assigned: ["in_progress", "completed", "rejected", "unclaimed", "cancelled"],
  in_progress: ["completed", "rejected", "assigned", "cancelled"],
  rejected: ["unclaimed", "assigned", "cancelled"],
  completed: [],
  cancelled: [],
};

export function taskNext(status: string): string[] {
  return TASK_NEXT[status] ?? [];
}

export type TaskView = "unclaimed" | "mine" | "all";

export function taskQuery(view: TaskView, extra: Partial<TaskQuery> = {}): TaskQuery {
  if (view === "unclaimed") return { ...extra, status: "unclaimed", mine: undefined };
  if (view === "mine") return { ...extra, mine: true };
  return { ...extra, mine: undefined };
}

export function taskStatusBody(
  target: string,
  note: string,
  reason: string,
):
  | { body: { status: string; completion_note?: string; rejected_reason?: string } }
  | { error: string } {
  if (target === "rejected" && !reason.trim()) return { error: "Say why the task is rejected." };
  const body: { status: string; completion_note?: string; rejected_reason?: string } = {
    status: target,
  };
  if (target === "completed" && note.trim()) body.completion_note = note.trim();
  if (target === "rejected") body.rejected_reason = reason.trim().slice(0, 255);
  return { body };
}

// ---------------------------------------------------------------- inventory

/** `apps_inventory.UNIT_TRANSITIONS`. */
export const UNIT_NEXT: Record<string, string[]> = {
  in_stock: ["assigned", "faulty", "retired"],
  assigned: ["returned", "faulty"],
  returned: ["in_stock", "faulty", "retired"],
  faulty: ["in_stock", "retired"],
  retired: [],
};

export function unitNext(state: string): string[] {
  return UNIT_NEXT[state] ?? [];
}

export const UNIT_CSV_TEMPLATE = "serial,sku,mac,note\n";
export const MAX_IMPORT_BYTES = 512 * 1024;

export function importProblem(file: { size: number; name: string }): string | null {
  if (!/\.csv$/i.test(file.name)) return "Pick a .csv file.";
  if (file.size > MAX_IMPORT_BYTES) return "The CSV must be 512 KB or smaller.";
  return null;
}

// ---------------------------------------------------------------- discounts

export interface DiscountDraft {
  code: string;
  kind: "percent" | "flat";
  value: string;
  description: string;
  max_discount: string;
  min_amount: string;
  max_uses: string;
  valid_from: string;
  valid_until: string;
  active: boolean;
}

export function emptyDiscount(): DiscountDraft {
  return {
    code: "",
    kind: "percent",
    value: "",
    description: "",
    max_discount: "",
    min_amount: "",
    max_uses: "",
    valid_from: "",
    valid_until: "",
    active: true,
  };
}

/** `YYYY-MM-DD` (local day) -> ISO instant at the start / end of that day. */
export function dayStartIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return new Date(`${day}T00:00:00`).toISOString();
}
export function dayEndIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return new Date(`${day}T23:59:59`).toISOString();
}

/** Create body (code/kind/value only on create; the PATCH model has no
 * code/kind/value). */
export function discountBody(
  d: DiscountDraft,
  create: boolean,
): { body: DiscountBody } | { error: string } {
  const body: DiscountBody = {};
  if (create) {
    const code = d.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { error: "Code: 3-32 letters, digits, - or _." };
    body.code = code;
    body.kind = d.kind;
    if (d.kind === "percent") {
      const v = Number(d.value);
      if (!Number.isInteger(v) || v < 1 || v > 100)
        return { error: "Percent off: a whole number 1-100." };
      body.value = v;
    } else {
      const v = parseRupeesToPaise(d.value);
      if (v === null || v <= 0) return { error: "Amount off: a rupee amount, e.g. 100." };
      body.value = v;
    }
  }
  body.description = d.description.trim() || null;
  const cap = d.max_discount.trim() ? parseRupeesToPaise(d.max_discount) : null;
  if (d.max_discount.trim() && (cap === null || cap <= 0))
    return { error: "Maximum discount: a rupee amount." };
  body.max_discount_paise = cap;
  const min = d.min_amount.trim() ? parseRupeesToPaise(d.min_amount) : null;
  if (d.min_amount.trim() && min === null) return { error: "Minimum bill: a rupee amount." };
  body.min_amount_paise = min;
  const uses = d.max_uses.trim() ? Number(d.max_uses) : null;
  if (uses !== null && (!Number.isInteger(uses) || uses < 1))
    return { error: "Uses: a whole number, 1 or more." };
  body.max_uses = uses;
  body.valid_from = d.valid_from ? dayStartIso(d.valid_from) : null;
  body.valid_until = d.valid_until ? dayEndIso(d.valid_until) : null;
  if (d.valid_from && d.valid_until && d.valid_until < d.valid_from)
    return { error: "The end date is before the start date." };
  body.active = d.active;
  return { body };
}

// ---------------------------------------------------------------- announcements

export function announcementBody(d: {
  title: string;
  body: string;
  audience: "all" | "selected";
  customer_ids: string[];
  send_email: boolean;
}): { body: AnnouncementBody } | { error: string } {
  const title = d.title.trim();
  const text = d.body.trim();
  if (!title) return { error: "Give it a title." };
  if (title.length > 150) return { error: "Title: at most 150 characters." };
  if (!text) return { error: "Write the message." };
  if (text.length > 5000) return { error: "Message: at most 5000 characters." };
  if (d.audience === "selected" && d.customer_ids.length === 0)
    return { error: "Pick at least one customer, or send to all." };
  return {
    body: {
      title,
      body: text,
      audience: d.audience,
      customer_ids: d.audience === "selected" ? d.customer_ids : [],
      send_email: d.send_email,
    },
  };
}

// ---------------------------------------------------------------- leads

export function leadBody(d: {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  source: string;
  isp_customer_id: string;
  interested_package_id: string;
  notes: string;
}): { body: LeadBody } | { error: string } {
  const name = d.name.trim();
  if (!name) return { error: "Name is required." };
  const email = d.email.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "The email looks wrong." };
  const nz = (v: string) => v.trim() || null;
  return {
    body: {
      name,
      phone: nz(d.phone),
      email: email || null,
      address: nz(d.address),
      city: nz(d.city),
      source: d.source as LeadBody["source"],
      isp_customer_id: d.isp_customer_id || null,
      interested_package_id: d.interested_package_id || null,
      notes: nz(d.notes),
    },
  };
}

/** Statuses a plain PATCH may set (`converted` only via convert). */
export function leadPatchStatuses(current: string): string[] {
  if (current === "converted") return [];
  return [
    "new",
    "contacted",
    "feasibility_pending",
    "feasible",
    "not_feasible",
    "install_scheduled",
    "dropped",
  ].filter((s) => s !== current);
}

/** Where to convert a lead: the CAF workbench when it is on (the CAF fields
 * then follow the lead), otherwise JAZE-5's own convert. */
export function convertRoute(cafOn: boolean): "caf" | "apps" {
  return cafOn ? "caf" : "apps";
}

/** Lead status PATCH body (`check_lead_status`: dropping needs a reason). */
export function leadStatusBody(
  target: string,
  reason: string,
): { body: LeadBody } | { error: string } {
  if (target === "converted") return { error: "Use Convert to turn a lead into a subscriber." };
  if (target === "dropped") {
    const r = reason.trim();
    if (!r) return { error: "Say why the lead is dropped." };
    return { body: { status: "dropped", dropped_reason: r.slice(0, 255) } };
  }
  return { body: { status: target as LeadBody["status"] } };
}
