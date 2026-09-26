/**
 * Marketing credits arithmetic for display (wyfy-specs/guest-marketing-
 * campaigns.md §13.1). Amounts travel as integers in MINOR units (100 minor
 * = 1 credit = ₹1.00 before GST). Formatting is done on the integer -- no
 * float ever touches an amount -- so "1,250.40" is exact.
 *
 * Dependency-free so scripts/test-marketing-ui.mjs can execute it.
 */

/** 125040 -> "1,250.40" (Indian digit grouping). */
export function formatCredits(minor: number | null | undefined): string {
  if (typeof minor !== "number" || !Number.isFinite(minor)) return "—";
  const m = Math.trunc(minor);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole.toLocaleString("en-IN")}.${frac}`;
}

/** "1,250.40 credits" / "1.00 credit". */
export function creditsLabel(minor: number | null | undefined): string {
  const s = formatCredits(minor);
  return `${s} ${minor === 100 ? "credit" : "credits"}`;
}

/** Signed, for ledger deltas: "+500.00" / "-0.60" / "0.00". */
export function formatSignedCredits(minor: number): string {
  if (minor > 0) return `+${formatCredits(minor)}`;
  return formatCredits(minor);
}

export type CreditTone = "ok" | "low" | "empty";

/** Red at 0, amber when the server says it is low (§13.5, §13.10). */
export function creditTone(available: number, isLow: boolean): CreditTone {
  if (available <= 0) return "empty";
  return isLow ? "low" : "ok";
}

/**
 * "credits" typed by an operator -> minor units, exactly. Accepts up to two
 * decimals; anything else is null (refused, never rounded).
 */
export function parseCreditsInput(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const whole = Number(m[2]);
  const frac = Number((m[3] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(whole)) return null;
  const minor = whole * 100 + frac;
  return m[1] ? -minor : minor;
}

/** The composer's cost sentence (§13.10). */
export function estimateSentence(e: {
  provider_source: string;
  reachable: number;
  unit: string;
  unit_price_minor: number;
  units_per_recipient_max: number;
  estimated_max_minor: number;
}): string {
  if (e.provider_source === "own") return "Sent via your own provider: no Wyfy credits used.";
  const units =
    e.unit === "segment"
      ? ` × ${e.units_per_recipient_max} segment${e.units_per_recipient_max === 1 ? "" : "s"}`
      : "";
  return (
    `Estimated cost: up to ${formatCredits(e.estimated_max_minor)} credits ` +
    `(${e.reachable.toLocaleString("en-IN")} guest${e.reachable === 1 ? "" : "s"}${units} × ${formatCredits(e.unit_price_minor)}). ` +
    "Unused credits are returned after sending."
  );
}
