import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ConsoleStatus } from "./StatusDot";

const TONE: Record<ConsoleStatus, string> = {
  ok: "bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]",
  warn: "bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]",
  crit: "bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]",
  info: "bg-[var(--wy-info-soft)] text-[var(--wy-info)]",
  offline: "bg-[var(--wy-offline-soft)] text-[var(--wy-offline)]",
};

export interface StatusBadgeProps {
  /** Which state. `offline` is the neutral grey (not applicable / unknown / off), never a fault. */
  status: ConsoleStatus;
  /** The word. Always present: the colour only repeats what the word says. */
  children: ReactNode;
  /** Leading dot (default true). Turn off for a dense column of badges that all share one tone. */
  dot?: boolean;
  /** Pulse the dot, for a state that is changing right now ("Applying…"). Respects reduced motion. */
  pulse?: boolean;
  className?: string;
}

/**
 * The one status pill: soft token fill, token text, optional dot. Use it for
 * a row's state ("Applied", "Couldn't apply", "Enabled"); never use the
 * accent colour as a status, and never a Tailwind palette class.
 */
export function StatusBadge({ status, children, dot = true, pulse, className }: StatusBadgeProps) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium leading-none",
        TONE[status],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "relative inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current",
            pulse && "wy-pulse",
          )}
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}
