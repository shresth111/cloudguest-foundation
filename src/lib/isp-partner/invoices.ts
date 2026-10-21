/** Pure helpers for the invoices screens (ADDENDUM_03). */
import { formatRupees } from "@/lib/isp-partner/money";
import type { InvoiceRow } from "@/services/isp-partner/invoices-types";

/** Indian financial year (1 April – 31 March) containing `d`, as the
 * `{ start, end }` dates and the `YY-YY` label used in invoice numbers. */
export function indianFy(d: Date): { start: Date; end: Date; label: string } {
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31),
    label: `${yy(startYear)}-${yy(startYear + 1)}`,
  };
}

export type RangePreset = "this_month" | "last_month" | "this_fy" | "custom";

/** `[from, to]` as `YYYY-MM-DD` (inclusive) for a preset, in local time. */
export function presetRange(
  p: Exclude<RangePreset, "custom">,
  now: Date = new Date(),
): [string, string] {
  const day = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (p === "this_month") return [day(new Date(now.getFullYear(), now.getMonth(), 1)), day(now)];
  if (p === "last_month")
    return [
      day(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      day(new Date(now.getFullYear(), now.getMonth(), 0)),
    ];
  return [day(indianFy(now).start), day(now)];
}

export const INVOICE_STATUS_LABEL_X: Record<string, string> = {
  issued: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  cancelled: "Cancelled",
  void: "Void",
};

export function invoiceStatusTone(status: string): string {
  if (status === "paid") return "active";
  if (status === "cancelled" || status === "void") return "normal";
  if (status === "partially_paid") return "pending";
  return "due";
}

export const INVOICE_KIND_LABEL: Record<string, string> = {
  recharge: "Recharge",
  renewal: "Renewal",
  cycle: "Postpaid cycle",
  manual: "Manual",
  coupon: "Coupon",
};

/** Digits for wa.me: a bare 10-digit Indian mobile gets the 91 prefix;
 * anything unusable gives "" (wa.me then lets staff pick the contact). */
export function waNumber(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return "";
}

/** "Share on WhatsApp" (§9): a wa.me link the staff member opens themselves.
 * No API and no automated send. */
export function whatsappShareUrl(args: {
  phone: string | null | undefined;
  name: string | null | undefined;
  invoiceNumber: string;
  totalPaise: number;
  balancePaise: number;
  ispName: string;
  supportPhone?: string | null;
}): string {
  const lines = [
    `Hello${args.name ? ` ${args.name}` : ""},`,
    args.balancePaise > 0
      ? `Your invoice ${args.invoiceNumber} for ${formatRupees(args.totalPaise)} has ${formatRupees(args.balancePaise)} due.`
      : `Your invoice ${args.invoiceNumber} for ${formatRupees(args.totalPaise)} is paid. Thank you.`,
    args.supportPhone ? `For help call ${args.supportPhone}.` : "",
    `- ${args.ispName}`,
  ].filter(Boolean);
  const text = encodeURIComponent(lines.join("\n"));
  const n = waNumber(args.phone);
  return n ? `https://wa.me/${n}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Same rule BE applies (§12): back-dated at most 7 days, never into a closed FY. */
export function invoiceDateProblem(dateIso: string, now: Date = new Date()): string | null {
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return "Pick a date.";
  const date = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date.getTime() > today.getTime()) return "The invoice date cannot be in the future.";
  if (today.getTime() - date.getTime() > 7 * 86_400_000) return "At most 7 days in the past.";
  if (date.getTime() < indianFy(now).start.getTime())
    return "That date is in the previous financial year, which is closed.";
  return null;
}

/** The billed person or business, for lists and the WhatsApp greeting. */
export function billToName(i: Pick<InvoiceRow, "subscriber" | "customer">): string {
  if (i.subscriber)
    return [i.subscriber.first_name, i.subscriber.last_name].filter(Boolean).join(" ") || "–";
  return i.customer?.name ?? "–";
}
