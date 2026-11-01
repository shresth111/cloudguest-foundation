import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps {
  /** Header title; omit (with `actions`) for a header-less panel. */
  title?: ReactNode;
  /** One quiet line under the title. */
  description?: ReactNode;
  /** Right-aligned header controls (buttons, a SegmentedControl, a link). */
  actions?: ReactNode;
  /** Remove body padding, for edge-to-edge tables and charts. */
  flush?: boolean;
  /** Heading level for `title` (default h2) so pages keep a sane outline. */
  as?: "h2" | "h3";
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

/** The Panel's surface classes, for the rare block that is a panel but not a
 * header + body (a status band, an error fallback). Prefer `<Panel>`. */
export const PANEL_SURFACE =
  "min-w-0 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text)] shadow-[var(--wy-shadow)]";

/** The console card: hairline border, small radius, optional header with title/actions. */
export function Panel({
  title,
  description,
  actions,
  flush,
  as: Heading = "h2",
  className,
  bodyClassName,
  children,
}: PanelProps) {
  const hasHeader = title != null || actions != null;
  return (
    <section className={cn(PANEL_SURFACE, className)}>
      {hasHeader && (
        <header className="flex min-h-11 items-center gap-3 border-b border-[var(--wy-border)] px-4 py-2">
          <div className="min-w-0 flex-1">
            {title != null && (
              <Heading className="truncate text-sm font-semibold tracking-normal">{title}</Heading>
            )}
            {description != null && (
              <p className="truncate text-xs text-[var(--wy-text-muted)]">{description}</p>
            )}
          </div>
          {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
