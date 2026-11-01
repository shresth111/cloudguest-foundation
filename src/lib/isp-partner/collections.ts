/** COLLECTIONS-1 pure helpers: labels, tones and form checks. The risk
 * score and the forecast are computed by the backend; nothing here
 * re-derives a number. */
import type {
  HandoverStatus,
  PartyRef,
  NoteOutcome,
  PromiseStatus,
  RiskBand,
} from "@/services/isp-partner/collections-types";

export const BAND_LABEL: Record<RiskBand, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};

/** MTag tone keys that exist in the kit. */
export function bandTone(band: RiskBand): string {
  return band === "high" ? "overdue" : band === "medium" ? "warning" : "normal";
}

export const PROMISE_LABEL: Record<PromiseStatus, string> = {
  open: "Promised",
  kept: "Kept",
  broken: "Missed",
  cancelled: "Cancelled",
  superseded: "Replaced",
};

export function promiseTone(status: PromiseStatus): string {
  if (status === "kept") return "paid";
  if (status === "broken") return "overdue";
  if (status === "open") return "pending";
  return "offline";
}

export const OUTCOMES: NoteOutcome[] = [
  "called",
  "no_answer",
  "visited",
  "promised",
  "disputed",
  "other",
];

export const OUTCOME_LABEL: Record<NoteOutcome, string> = {
  called: "Called",
  no_answer: "No answer",
  visited: "Visited",
  promised: "Promised to pay",
  disputed: "Disputes the bill",
  other: "Other",
};

export const HANDOVER_LABEL: Record<HandoverStatus, string> = {
  submitted: "Waiting for approval",
  approved: "Approved",
  rejected: "Sent back",
};

export function handoverTone(status: HandoverStatus): string {
  return status === "approved" ? "paid" : status === "rejected" ? "overdue" : "pending";
}

export const EVENT_LABEL: Record<string, string> = {
  note: "Note",
  promise_made: "Promise made",
  promise_kept: "Promise kept",
  promise_broken: "Promise missed",
  promise_cancelled: "Promise cancelled",
  cash_collected: "Cash collected",
  invoice: "Bill issued",
  credit_note: "Credit note",
  payment: "Payment",
  reminder: "Reminder sent",
};

export function eventLabel(kind: string): string {
  return EVENT_LABEL[kind] ?? kind.replace(/_/g, " ");
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** A promise date is today .. today + 60 (the backend's rule). `today` is
 * the ISP's local day as a plain YYYY-MM-DD. */
export function promiseDateError(day: string, today: string): string | null {
  if (!DAY.test(day)) return "Pick the date they will pay by.";
  if (day < today) return "The date cannot be in the past.";
  if (day > addDays(today, 60)) return "At most 60 days ahead.";
  return null;
}

/** A handover covers today or one of the last 31 days. */
export function handoverDateError(day: string, today: string): string | null {
  if (!DAY.test(day)) return "Pick the day the cash was collected.";
  if (day > today) return "The day cannot be in the future.";
  if (day < addDays(today, -31)) return "At most 31 days back.";
  return null;
}

/** "₹100 short", "₹50 over", "matches". `diff` = declared/received - expected. */
export function differenceText(diffPaise: number, rupees: (p: number) => string): string {
  if (diffPaise === 0) return "matches";
  return diffPaise < 0 ? `${rupees(-diffPaise)} short` : `${rupees(diffPaise)} over`;
}

/** One key per cash dialog, so a double tap or a retry records once. */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return `coll-${c.randomUUID()}`;
  return `coll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** WhatsApp / phone links for a call-out. Only digits reach the URL. */
export function telHref(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `tel:+${d.length === 10 ? `91${d}` : d}` : null;
}

export function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function partyOf(i: { subscriber_id: string | null; isp_customer_id: string }): PartyRef {
  return i.subscriber_id
    ? { subscriber_id: i.subscriber_id }
    : { isp_customer_id: i.isp_customer_id };
}

export const COLLECTIONS_TABS = ["overdue", "promises", "cash"] as const;
export type CollectionsTab = (typeof COLLECTIONS_TABS)[number];
