/** Non-component exports split out of `isp-ui.tsx` so that file
 * only exports components (react-refresh/only-export-components). */
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { formatDateTime, formatRelative, formatTime } from "@/lib/format";
import { StatusDot, type ConsoleStatus } from "@/components/customer/console";

/** Fixed per-ISP colour, by position in the sorted list. */
export const ISP_SERIES = [
  "var(--wy-series-1)",
  "var(--wy-series-2)",
  "var(--wy-series-6)",
  "var(--wy-series-3)",
];

export const ispColor = (i: number) => ISP_SERIES[i % ISP_SERIES.length];

export function useIspT() {
  return useTranslation("isp", { i18n });
}

export const STATUS_WORD_KEY: Record<string, [string, string]> = {
  healthy: ["status.healthy", "Online"],
  degraded: ["status.degraded", "Degraded"],
  unhealthy: ["status.unhealthy", "Offline"],
  unknown: ["status.unknown", "Not checked"],
};

export function useStatusWord() {
  const { t } = useIspT();
  return (healthStatus: string | null | undefined) => {
    const [k, d] = STATUS_WORD_KEY[healthStatus ?? "unknown"] ?? STATUS_WORD_KEY.unknown;
    return t(k, d);
  };
}

export const STATUS_TEXT: Record<ConsoleStatus, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  info: "text-[var(--wy-info)]",
  offline: "text-[var(--wy-text-muted)]",
};

export const STATUS_BG: Record<ConsoleStatus, string> = {
  ok: "bg-[var(--wy-ok)]",
  warn: "bg-[var(--wy-warn)]",
  crit: "bg-[var(--wy-crit)]",
  info: "bg-[var(--wy-info)]",
  offline: "bg-[var(--wy-offline)]",
};

export const STATUS_SOFT: Record<ConsoleStatus, string> = {
  ok: "bg-[var(--wy-ok-soft)]",
  warn: "bg-[var(--wy-warn-soft)]",
  crit: "bg-[var(--wy-crit-soft)]",
  info: "bg-[var(--wy-info-soft)]",
  offline: "bg-[var(--wy-offline-soft)]",
};

export function fmtNum(v: number | null | undefined, digits = 0): string | null {
  return v == null || !Number.isFinite(v) ? null : v.toFixed(digits);
}

/** "3h 12m" / "4d 2h" / "45m" / "<1m". Units are read the same in en/hi. */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return "<1m";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/** Clock time; adds the date when it is not today. 12-hour, Indian locale
 * (see `@/lib/format`). */
export function fmtClock(iso: string, lang: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? formatTime(d, lang) : formatDateTime(d, lang);
}

export function fmtAgo(iso: string | null | undefined, lang: string): string | null {
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return null;
  return formatRelative(iso, lang, { style: "short" });
}
