import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Optional gradient icon-badge next to the title -- omit for the
   * original plain header (every existing caller keeps rendering
   * identically); pass it to opt into the icon-badge treatment used
   * across the redesigned customer-facing pages this session. */
  icon?: ComponentType<{ className?: string }>;
  /** Optional decorative illustration rendered as a flex sibling to the
   * right of title/actions, before the actions slot -- omit for the
   * original layout (every existing caller keeps rendering identically). */
  illustration?: ReactNode;
}

/**
 * Consistent section header: eyebrow / title / description on the
 * left, right-aligned actions slot for filters, toggles or CTAs.
 */
export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  icon: Icon,
  illustration,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Icon className="h-4 w-4 text-white" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {(illustration || actions) && (
        <div className="flex shrink-0 items-center gap-3">
          {illustration}
          {actions}
        </div>
      )}
    </header>
  );
}
