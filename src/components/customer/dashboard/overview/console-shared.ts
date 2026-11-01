/** Non-component exports split out of `console-ui.tsx` so that file
 * only exports components (react-refresh/only-export-components). */
import {
  CONSOLE_STATUS_WORD,
  PANEL_SURFACE,
  Panel,
  StatusDot as SharedStatusDot,
  type ConsoleStatus as SharedStatus,
} from "@/components/customer/console";

export type OverviewStatus = SharedStatus | "unknown";

export function toSharedStatus(s: OverviewStatus): SharedStatus {
  return s === "unknown" ? "offline" : s;
}

/** Text colour per status, as a Tailwind arbitrary value. */
export const STATUS_TEXT: Record<OverviewStatus, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  info: "text-[var(--wy-info)]",
  offline: "text-[var(--wy-offline)]",
  unknown: "text-[var(--wy-text-faint)]",
};

export const STATUS_BG: Record<OverviewStatus, string> = {
  ok: "bg-[var(--wy-ok)]",
  warn: "bg-[var(--wy-warn)]",
  crit: "bg-[var(--wy-crit)]",
  info: "bg-[var(--wy-info)]",
  offline: "bg-[var(--wy-offline)]",
  unknown: "bg-[var(--wy-text-faint)]",
};

export const STATUS_SOFT_BG: Record<OverviewStatus, string> = {
  ok: "bg-[var(--wy-ok-soft)]",
  warn: "bg-[var(--wy-warn-soft)]",
  crit: "bg-[var(--wy-crit-soft)]",
  info: "bg-[var(--wy-info-soft)]",
  offline: "bg-[var(--wy-offline-soft)]",
  unknown: "bg-[var(--wy-offline-soft)]",
};

/** CSS colour value (for SVG fill/stroke). */
export const STATUS_VAR: Record<OverviewStatus, string> = {
  ok: "var(--wy-ok)",
  warn: "var(--wy-warn)",
  crit: "var(--wy-crit)",
  info: "var(--wy-info)",
  offline: "var(--wy-offline)",
  unknown: "var(--wy-text-faint)",
};

/** Recharts `contentStyle` for every chart tooltip on the page. */
export const CONSOLE_TOOLTIP_STYLE = {
  borderRadius: "var(--wy-radius)",
  border: "1px solid var(--wy-border-strong)",
  background: "var(--wy-surface)",
  color: "var(--wy-text)",
  fontSize: 12,
  padding: "6px 10px",
  boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
};
