import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/** What the customer shell hands a screen that draws its own PageHeader:
 * the tab's translated name and the active venue. */
export interface PageScope {
  title: string;
  venue?: string;
}

export interface PageHeaderProps {
  /** The screen's name: the same words as the tab or sidebar row that led here. */
  title: ReactNode;
  /** The venue this screen is scoped to, shown as a chip beside the title. Omit when it is not venue-scoped. */
  venue?: ReactNode;
  /** One or two plain sentences: what this screen does. No taglines. */
  description?: ReactNode;
  /** Right-aligned primary actions ("New rule"). Keep it to one or two buttons. */
  actions?: ReactNode;
  /** `h1` by default; a page has exactly one. */
  as?: "h1" | "h2";
  className?: string;
}

/**
 * The one page header of the console: h1 at 20/600, a venue chip, one
 * description line and the page's primary actions. It replaces the old
 * scope line plus the in-page hero (eyebrow, icon tile, second title,
 * illustration) that most screens stacked under it. One per page; the
 * section tabs sit above it.
 */
export function PageHeader({
  title,
  venue,
  description,
  actions,
  as: Heading = "h1",
  className,
}: PageHeaderProps) {
  return (
    <header
      data-page-header
      className={cn(
        "flex flex-col gap-3 border-b border-[var(--wy-border)] pb-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Heading className="min-w-0 truncate text-xl font-semibold tracking-tight text-[var(--wy-text)]">
            {title}
          </Heading>
          {venue != null && venue !== "" && (
            <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2 text-xs font-medium text-[var(--wy-text-muted)]">
              <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--wy-text-faint)]" />
              <span className="truncate">{venue}</span>
            </span>
          )}
        </div>
        {description != null && (
          <p className="max-w-3xl text-[13px] leading-relaxed text-[var(--wy-text-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions != null && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 [&_button]:max-sm:h-10">
          {actions}
        </div>
      )}
    </header>
  );
}
