import type { CouponLayout } from "@/services/isp-partner/plans-types";

/** Pure helpers for the plans screens (ADDENDUM_02). */

/** 15360 -> "15 Mbps", 512 -> "512 Kbps", 0 -> "Unlimited". */
export function formatKbps(kbps: number | null | undefined): string {
  if (kbps === null || kbps === undefined) return "–";
  if (kbps === 0) return "Unlimited";
  if (kbps >= 1024 && kbps % 1024 === 0) return `${kbps / 1024} Mbps`;
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} Mbps`;
  return `${kbps} Kbps`;
}

export function mbpsToKbps(mbps: number): number {
  return Math.round(mbps * 1024);
}

/** Live preview of the backend's suggested name (§8 "<group> · <Prepaid|Postpaid> · <N> days").
 * The backend's own suggestion wins when it answers; this is only the preview. */
export function previewPackageName(groupName: string, type: string, validityDays: number): string {
  const t = type === "postpaid" ? "Postpaid" : "Prepaid";
  return `${groupName} · ${t} · ${validityDays} day${validityDays === 1 ? "" : "s"}`;
}

/** "in 12 days" / "expires today" / "expired 3 days ago". */
export function relativeValidity(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "–";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "–";
  const days = Math.round((t - now) / 86_400_000);
  if (days === 0) return t >= now ? "expires today" : "expired today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `expired ${-days} day${days === -1 ? "" : "s"} ago`;
}

/** The ladder the addendum proposes (§9). */
export const DEFAULT_LADDER_SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50];
export const DEFAULT_LADDER_VALIDITIES = [30, 90];

/** The default validity for new packages (founder decision, Q12): 30 days. */
export const DEFAULT_VALIDITY_DAYS = 30;

export const COUPON_STATUS_LABEL: Record<string, string> = {
  unused: "Unused",
  active: "In use",
  used_up: "Used up",
  expired: "Expired",
  revoked: "Revoked",
};

export function couponTone(status: string): string {
  if (status === "unused") return "normal";
  if (status === "active") return "active";
  if (status === "revoked" || status === "expired") return "suspended";
  return "info";
}

/** Print sheet layouts (§8 print.pdf). */
export const LAYOUT_LABEL: Record<CouponLayout, string> = {
  "a4-24": "A4, 24 per sheet",
  "a4-40": "A4, 40 per sheet",
  "thermal-58mm": "58 mm thermal roll",
};

/** The new valid-until the backend will set (§7), for the preview only. */
export function rechargePreview(
  validUntil: string | null,
  validityDays: number,
  now = Date.now(),
): Date {
  const base = Math.max(now, validUntil ? new Date(validUntil).getTime() : 0);
  return new Date(base + validityDays * 86_400_000);
}
