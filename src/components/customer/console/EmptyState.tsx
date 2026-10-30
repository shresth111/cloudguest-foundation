import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** A lucide icon component, shown in a soft tile. */
  icon?: ComponentType<{ className?: string }>;
  /** One short sentence saying what is (not) here. */
  title: ReactNode;
  /** Why, and what would make something appear. */
  description?: ReactNode;
  /** A button or link that resolves the emptiness. */
  action?: ReactNode;
  /** Tighter padding for use inside a Panel. */
  compact?: boolean;
  className?: string;
}

/** The honest "nothing here yet" block: icon, one line, why, and the next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      {Icon && (
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] text-[var(--wy-text-faint)]">
          <Icon aria-hidden className="h-4 w-4" />
        </div>
      )}
      <p className="text-[13px] font-semibold text-[var(--wy-text)]">{title}</p>
      {description != null && (
        <p className="max-w-sm text-xs leading-relaxed text-[var(--wy-text-muted)]">
          {description}
        </p>
      )}
      {action != null && <div className="mt-1">{action}</div>}
    </div>
  );
}
