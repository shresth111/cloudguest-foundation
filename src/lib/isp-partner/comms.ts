/** COMMS-2 pure helpers: status labels/tones, filter validation, and the
 * client-side mirror of the template variable rules. */
import type { CommsLogQuery, CommsStatus } from "@/services/isp-partner/comms";

export const STATUS_LABEL: Record<CommsStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  skipped: "Not sent",
};

export const STATUS_TONE: Record<CommsStatus, string> = {
  queued: "pending",
  sent: "normal",
  delivered: "online",
  read: "online",
  failed: "offline",
  skipped: "normal",
};

export const EVENT_LABEL: Record<string, string> = {
  pre_expiry: "Before the due date",
  unpaid: "Unpaid invoice",
  receipt: "Payment receipt",
  renewal: "Renewal",
  invoice_email: "Invoice email",
  device_alert: "Device alert",
  test: "Test",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Plain dates only (the invoices P0 rule); start <= end. */
export function filterErrors(q: CommsLogQuery): string | null {
  if (q.date_from && !DAY.test(q.date_from)) return "Start date is not a date.";
  if (q.date_to && !DAY.test(q.date_to)) return "End date is not a date.";
  if (q.date_from && q.date_to && q.date_from > q.date_to)
    return "The start date is after the end date.";
  if (q.phone && !/^[+\d\s-]{6,20}$/.test(q.phone)) return "Phone: digits only.";
  return null;
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function unknownVariables(text: string, allowed: string[]): string[] {
  const set = new Set(allowed);
  const out = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) if (!set.has(m[1])) out.add(m[1]);
  return [...out].sort();
}

/** Meta template names: lowercase letters, digits, underscore. */
export function validWaName(name: string): boolean {
  return /^[a-z0-9_]{1,512}$/.test(name);
}
