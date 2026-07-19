import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  /** Optional sticky header rendered above content with hairline separator. */
  header?: ReactNode;
  /** Adds subtle mesh gradient backdrop for hero-level pages. */
  mesh?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * Consistent page container providing max-width, vertical rhythm and
 * an optional sticky header. Use for every top-level route to keep
 * spacing, padding and background treatments uniform.
 */
export function PageShell({
  children,
  header,
  mesh = false,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div className={cn("relative flex min-h-full flex-col", mesh && "mesh-bg", className)}>
      {header && (
        <div className="sticky top-16 z-10 -mx-4 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {header}
        </div>
      )}
      <div className={cn("flex-1 space-y-6 py-2", contentClassName)}>{children}</div>
    </div>
  );
}
