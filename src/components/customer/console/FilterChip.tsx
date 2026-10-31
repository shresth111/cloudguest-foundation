import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A filter chip: a toggle button (aria-pressed) for list filters, e.g. "Down (2)". */
export function FilterChip({
  pressed,
  onClick,
  children,
  className,
  ...rest
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] motion-reduce:transition-none",
        pressed
          ? "border-[var(--wy-accent)] bg-[var(--wy-accent-soft)] text-[var(--wy-accent)]"
          : "border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text-muted)] hover:border-[var(--wy-border-strong)] hover:text-[var(--wy-text)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
