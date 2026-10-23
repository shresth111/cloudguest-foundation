/** Money for partner billing: the wire is integer paise, people type rupees. */

export function formatRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return "–";
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}₹${rupees.toLocaleString("en-IN")}.${rest}`;
}

/** "1,234.5" -> 123450. Integer arithmetic only (no float rounding), at most
 * two decimals; anything else is `null`. */
export function parseRupeesToPaise(input: string): number | null {
  const t = input.replace(/[,\s₹]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  return whole * 100 + frac;
}

/** Paise -> the plain "1234.50" a rupee input field holds. */
export function paiseToInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  online: "Online",
  prepaid_coupon: "Prepaid coupon",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  issued: "Unpaid",
  partially_paid: "Part paid",
  paid: "Paid",
  void: "Void",
};

export function invoiceTone(status: string, overdue?: boolean): string {
  if (status === "void") return "normal";
  if (status === "paid") return "active";
  return overdue ? "overdue" : "due";
}

/** Whether a payment mode needs a reference (UTR) -- §B.3 validation. */
export function modeNeedsReference(mode: string): boolean {
  return mode === "upi" || mode === "bank_transfer";
}
