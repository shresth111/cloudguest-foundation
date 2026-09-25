/**
 * Pure helpers for the Marketing template editor: the variable grammar and
 * the SMS length / encoding / segment counter.
 *
 * These MIRROR the server's rules (wyfy-specs/guest-marketing-campaigns.md
 * §5.4 "Validation rules") for live feedback while typing. They decide
 * nothing: the server re-validates every save, and its answer -- including
 * the `sms` block it computes on the saved template -- is what the screen
 * shows once it has one. Kept free of React and of the api client so
 * `scripts/test-marketing-template.mjs` can run them directly.
 */

import { TEMPLATE_VARIABLES } from "@/types/marketing";

const VARIABLE_SET = new Set<string>(TEMPLATE_VARIABLES);

/** `{{name}}`, allowing inner whitespace the way the server's parser does
 * not -- so `{{ name }}` is reported as unknown rather than silently
 * accepted. */
const VARIABLE_RE = /\{\{([^{}]*)\}\}/g;

export interface VariableScan {
  /** Known variables in order of first use, de-duplicated. */
  used: string[];
  /** Anything inside `{{ }}` that is not in the closed set. */
  unknown: string[];
  /** A lone `{{` or `}}` with no partner -- the server's
   * `unknown_variable` covers malformed braces too. */
  malformed: boolean;
}

export function scanVariables(text: string): VariableScan {
  const used: string[] = [];
  const unknown: string[] = [];
  for (const m of text.matchAll(VARIABLE_RE)) {
    const name = m[1];
    if (VARIABLE_SET.has(name)) {
      if (!used.includes(name)) used.push(name);
    } else if (!unknown.includes(name)) {
      unknown.push(name);
    }
  }
  const stripped = text.replace(VARIABLE_RE, "");
  const malformed = stripped.includes("{{") || stripped.includes("}}");
  return { used, unknown, malformed };
}

// ── SMS encoding ───────────────────────────────────────────────────────

// GSM 03.38 basic character set.
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// Extension table: each costs two septets (escape + char).
const GSM7_EXTENDED = "^{}\\[~]|€\f";

const BASIC = new Set(Array.from(GSM7_BASIC));
const EXTENDED = new Set(Array.from(GSM7_EXTENDED));

export interface SmsMeasure {
  /** Characters as the recipient sees them (code points). */
  length: number;
  encoding: "gsm7" | "ucs2";
  /** Billable units in the chosen encoding (septets for GSM-7, UTF-16
   * code units for UCS-2). */
  units: number;
  segments: number;
  /** Units left before the next segment starts. */
  remainingInSegment: number;
}

/**
 * GSM-7: 160 in one segment, 153 per segment beyond that. UCS-2 (any
 * character outside GSM-7 -- Hindi, ₹, emoji): 70, then 67. Exactly the
 * numbers in spec §5.4.
 */
export function measureSms(text: string): SmsMeasure {
  const chars = Array.from(text);
  const gsm = chars.every((c) => BASIC.has(c) || EXTENDED.has(c));
  const units = gsm ? chars.reduce((n, c) => n + (EXTENDED.has(c) ? 2 : 1), 0) : text.length; // UTF-16 code units: a surrogate pair costs two
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  const capacity = segments <= 1 ? single : segments * multi;
  return {
    length: chars.length,
    encoding: gsm ? "gsm7" : "ucs2",
    units,
    segments,
    remainingInSegment: Math.max(0, capacity - units),
  };
}

/**
 * Worst-case rendered length, the way the server checks `sms_too_long`:
 * every variable replaced by a placeholder of its maximum length
 * (`guest_name` 20, `venue_name`/`location_name` 30, the unsubscribe link
 * 30, campaign values 30, `review_link` 30, `booking_link` 200 -- the
 * server's numbers, including backend deviation #13). Placeholder text is plain
 * ASCII so it never changes the encoding the body itself implies.
 */
const WORST_CASE_LENGTH: Record<string, number> = {
  guest_name: 20,
  venue_name: 30,
  location_name: 30,
  unsubscribe_link: 30,
  offer_code: 30,
  offer_expiry: 30,
  event_name: 30,
  event_date: 30,
  booking_link: 200,
  // 30, not 200: the server measures review_link at 30 (backend deviation #13).
  review_link: 30,
};

export function worstCaseSms(text: string): SmsMeasure {
  const rendered = text.replace(VARIABLE_RE, (_all, name: string) =>
    "x".repeat(WORST_CASE_LENGTH[name] ?? 0),
  );
  return measureSms(rendered);
}

export const SMS_MAX_RAW_LENGTH = 1000;
export const SMS_MAX_WORST_CASE_SEGMENTS = 3;

/** The client-side mirror of the server's SMS body checks, as issue codes
 * the editor can translate. Empty = nothing the client can see wrong. */
export function smsBodyIssues(body: string): string[] {
  const issues: string[] = [];
  const scan = scanVariables(body);
  if (scan.unknown.length > 0 || scan.malformed) issues.push("unknown_variable");
  if (!scan.used.includes("unsubscribe_link")) issues.push("unsubscribe_link_missing");
  if (body.length > SMS_MAX_RAW_LENGTH) issues.push("sms_raw_too_long");
  if (worstCaseSms(body).segments > SMS_MAX_WORST_CASE_SEGMENTS) issues.push("sms_too_long");
  return issues;
}

export function emailBodyIssues(subject: string, bodyHtml: string): string[] {
  const issues: string[] = [];
  const scan = scanVariables(`${subject}\n${bodyHtml}`);
  if (scan.unknown.length > 0 || scan.malformed) issues.push("unknown_variable");
  if (!scanVariables(bodyHtml).used.includes("unsubscribe_link"))
    issues.push("unsubscribe_link_missing");
  if (!subject.trim()) issues.push("subject_required");
  return issues;
}

/** DLT content template ids are digits, 12..30 long (spec §5.4). */
export function isValidDltTemplateId(value: string): boolean {
  return /^\d{12,30}$/.test(value);
}

/**
 * The variables a campaign has to supply values for, given the template's
 * own variable list. Everything else (guest_name, venue_name, ...) is filled
 * per guest by the server.
 */
export function campaignVariablesIn(templateVariables: readonly string[]): string[] {
  const campaign = ["offer_code", "offer_expiry", "event_name", "event_date", "booking_link"];
  return campaign.filter((v) => templateVariables.includes(v));
}

/** Max length the server accepts for a campaign-level value (§5.0). */
export function campaignVariableMaxLength(name: string): number {
  return name === "booking_link" ? 200 : 30;
}
