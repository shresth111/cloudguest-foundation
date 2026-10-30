import { cn } from "@/lib/utils";

/** The five console states. `offline` is neutral grey: "not applicable / unknown", never a fault. */
export type ConsoleStatus = "ok" | "warn" | "crit" | "info" | "offline";

const COLOR: Record<ConsoleStatus, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  info: "text-[var(--wy-info)]",
  offline: "text-[var(--wy-offline)]",
};

export interface StatusDotProps {
  /** Which state the dot shows. */
  status: ConsoleStatus;
  /** Accessible name, e.g. "Online" -- required, because colour alone carries nothing for a screen reader. */
  label: string;
  /** Animate a soft ring, for a value that is being watched live. Respects reduced motion. */
  pulse?: boolean;
  /** "sm" = 6px (inline in text), "md" = 8px (lists, switchers). */
  size?: "sm" | "md";
  className?: string;
}

/** A coloured state dot with an accessible label (role="img"). */
export function StatusDot({ status, label, pulse, size = "md", className }: StatusDotProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-block shrink-0 rounded-full bg-current",
        size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
        COLOR[status],
        pulse && "wy-pulse",
        className,
      )}
    />
  );
}
