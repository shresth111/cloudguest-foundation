import i18n from "@/lib/i18n";
import type { LocationComparisonItem } from "./insights.types";

/** Pure formatting helpers for the insight widgets (kept out of the
 * component files so fast refresh stays component-only). */

export function rangeLabel(days: number): string {
  return i18n.t("insights:rangeDays", { count: days, defaultValue: `Last ${days} days` });
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12 am";
  if (h < 12) return `${h} am`;
  if (h === 12) return "12 pm";
  return `${h - 12} pm`;
}

export function hourRangeLabel(hour: number): string {
  return `${hourLabel(hour)}–${hourLabel(hour + 1)}`;
}

/** Number of shades in the heatmap's sequential scale. */
export const HEATMAP_STEPS = 5;

/** 0 for an empty cell, else 1..HEATMAP_STEPS relative to the busiest cell. */
export function stepFor(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(HEATMAP_STEPS, Math.ceil((value / max) * HEATMAP_STEPS));
}

export function sharePercent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part * 1000) / whole) / 10;
}

const METHOD_DEFAULTS: Record<string, string> = {
  otp_sms: "SMS OTP",
  otp_whatsapp: "WhatsApp OTP",
  otp_email: "Email OTP",
  voucher: "Voucher",
  username_password: "Password",
  pin: "PIN",
  mac_whitelist: "Trusted device",
};

export function methodLabel(method: string): string {
  return i18n.t(`insights:method.${method}`, {
    defaultValue: METHOD_DEFAULTS[method] ?? method.replace(/_/g, " "),
  });
}

export type Liveness = "online" | "partial" | "offline" | "none";

export function livenessOf(row: LocationComparisonItem): Liveness {
  if (row.routers_total === 0) return "none";
  if (row.routers_online === row.routers_total) return "online";
  if (row.routers_online === 0) return "offline";
  return "partial";
}
