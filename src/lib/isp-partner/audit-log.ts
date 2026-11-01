/** AUDIT-LOG pure helpers. Dates are plain YYYY-MM-DD (never ISO times). */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function rangeError(since: string, until: string): string | null {
  if (since && !DAY.test(since)) return "Pick a start date.";
  if (until && !DAY.test(until)) return "Pick an end date.";
  if (since && until && since > until) return "The start date is after the end date.";
  return null;
}

export function ipText(ip: string | null, recorded: boolean): string {
  return recorded && ip ? ip : "not recorded";
}

export function detailText(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .map(
      ([k, v]) =>
        `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
    )
    .join(" · ");
}
