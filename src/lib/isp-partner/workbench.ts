/**
 * SUB360-2 pure helpers: ticket text (plain / markdown-lite, sanitised and
 * stored as text), the raise-ticket form rules (JAZE-5's RFO rule), and
 * small display helpers. No React, no requests.
 */
import type {
  RfoReason,
  TicketCreateBody,
  TicketPriority,
  TicketSource,
  TicketType,
} from "@/services/isp-partner/workbench-types";

/** Text we store: no HTML tags, no control characters (tab and newline
 * kept), normalised newlines, at most 3 blank lines in a row, trimmed,
 * capped at `max`. Never HTML: the UI renders it as text. */
/** Control characters (except tab/newline), zero-width and bidi overrides,
 * BOM. Built from code points so the source stays ASCII. */
const INVISIBLE = new RegExp(
  "[" +
    [
      [0x00, 0x08],
      [0x0b, 0x0c],
      [0x0e, 0x1f],
      [0x7f, 0x7f],
      [0x200b, 0x200f],
      [0x2028, 0x202e],
      [0x2060, 0x206f],
      [0xfeff, 0xfeff],
    ]
      .map(
        ([a, b]) => `\\u${a.toString(16).padStart(4, "0")}-\\u${b.toString(16).padStart(4, "0")}`,
      )
      .join("") +
    "]",
  "g",
);

export function sanitizeTicketText(input: string, max = 20000): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(INVISIBLE, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

export type LiteInline =
  | { t: "text"; v: string }
  | { t: "bold"; v: string }
  | { t: "code"; v: string };
export type LiteBlock = { t: "p"; parts: LiteInline[] } | { t: "li"; parts: LiteInline[] };

/** Markdown-lite: `**bold**`, `` `code` ``, "- " bullets, line breaks.
 * Returns tokens the UI renders as React text nodes (never innerHTML). */
export function liteBlocks(text: string): LiteBlock[] {
  const inline = (s: string): LiteInline[] => {
    const out: LiteInline[] = [];
    const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
      out.push(m[1] !== undefined ? { t: "bold", v: m[1] } : { t: "code", v: m[2] });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ t: "text", v: s.slice(last) });
    return out;
  };
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) =>
      /^\s*[-*]\s+/.test(l)
        ? { t: "li" as const, parts: inline(l.replace(/^\s*[-*]\s+/, "")) }
        : { t: "p" as const, parts: inline(l) },
    );
}

export const SOURCE_OPTIONS: { value: TicketSource; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "walk_in", label: "Walk-in" },
  { value: "portal", label: "Portal" },
  { value: "field", label: "Field visit" },
  { value: "other", label: "Other" },
];

export const RFO_OPTIONS: { value: RfoReason; label: string }[] = [
  { value: "fiber_cut", label: "Fibre cut" },
  { value: "power_olt", label: "Power / OLT" },
  { value: "cpe_fault", label: "CPE fault" },
  { value: "upstream", label: "Upstream" },
  { value: "other", label: "Other" },
];

export interface TicketForm {
  type_id: string;
  subject: string;
  description: string;
  source: TicketSource;
  priority: TicketPriority;
  /** "" = auto (no assignee; the helpdesk queue picks it up). */
  assignee_user_id: string;
  close_after_raising: boolean;
  rfo_reason: RfoReason | "";
  resolution_note: string;
}

export const EMPTY_TICKET: TicketForm = {
  type_id: "",
  subject: "",
  description: "",
  source: "phone",
  priority: "normal",
  assignee_user_id: "",
  close_after_raising: false,
  rfo_reason: "",
  resolution_note: "",
};

/** Closing at once needs an RFO when the type requires it (JAZE-5 default:
 * every type requires one; no type = no RFO rule). */
export function rfoRequired(form: TicketForm, types: TicketType[]): boolean {
  if (!form.close_after_raising) return false;
  const t = types.find((x) => x.id === form.type_id);
  return t ? t.requires_rfo : false;
}

export type TicketResult =
  | { ok: true; body: TicketCreateBody }
  | { ok: false; errors: Partial<Record<keyof TicketForm, string>> };

export function buildTicketBody(
  form: TicketForm,
  types: TicketType[],
  ids: { isp_customer_id: string; subscriber_id: string },
): TicketResult {
  const errors: Partial<Record<keyof TicketForm, string>> = {};
  const subject = sanitizeTicketText(form.subject, 200).replace(/\n+/g, " ");
  const description = sanitizeTicketText(form.description);
  const note = sanitizeTicketText(form.resolution_note, 5000);
  if (!subject) errors.subject = "A subject is required.";
  if (rfoRequired(form, types) && !form.rfo_reason)
    errors.rfo_reason = "Closing now needs a reason for outage (this ticket type requires one).";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    body: {
      isp_customer_id: ids.isp_customer_id,
      subscriber_id: ids.subscriber_id,
      type_id: form.type_id || null,
      subject,
      description: description || null,
      source: form.source,
      priority: form.priority,
      assignee_user_id: form.assignee_user_id || null,
      close_after_raising: form.close_after_raising,
      rfo_reason: form.close_after_raising && form.rfo_reason ? form.rfo_reason : null,
      resolution_note: form.close_after_raising && note ? note : null,
    },
  };
}

export const OPEN_TICKET_STATUSES = new Set(["open", "in_progress", "on_hold"]);

/** "12 d 4 h left" / "Ended 3 d ago" / "No end date". */
export function validityLeft(seconds: number | null): string {
  if (seconds === null) return "No end date";
  const abs = Math.abs(seconds);
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const span = d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
  return seconds >= 0 ? `${span} left` : `Ended ${span} ago`;
}
