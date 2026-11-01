import type { InputHTMLAttributes, ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolbarProps {
  /** Left side: a ToolbarSearch, filter selects, a SegmentedControl. */
  children?: ReactNode;
  /** Right side: actions that apply to the list ("Export", "Refresh"). The page's primary action lives in the PageHeader. */
  actions?: ReactNode;
  /** Draw a hairline under it, for a toolbar sitting at the top of a flush Panel above a table. */
  divided?: boolean;
  className?: string;
}

/**
 * The row above a list: search and filters left, list actions right, 36px
 * controls (40px below `sm`, for touch). Wraps rather than overflowing at
 * 390px.
 */
export function Toolbar({ children, actions, divided, className }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn(
        "flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center",
        divided && "border-b border-[var(--wy-border)]",
        // Every control in it shares one height: 40px for touch below sm, 36px above.
        "[&_button[role=combobox]]:h-10 [&_button[role=combobox]]:text-[13px] sm:[&_button[role=combobox]]:h-9",
        className,
      )}
    >
      {children != null && (
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {children}
        </div>
      )}
      {actions != null && (
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">{actions}</div>
      )}
    </div>
  );
}

export interface ToolbarSearchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> {
  /** Current query. */
  value: string;
  /** Called with the new query on every keystroke. */
  onValueChange: (value: string) => void;
  /** Shown in the box, and used as the accessible name unless `aria-label` is given. */
  placeholder: string;
}

/** The toolbar's search box: leading icon, token border, full width below `sm`. */
export function ToolbarSearch({
  value,
  onValueChange,
  placeholder,
  className,
  ...rest
}: ToolbarSearchProps) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--wy-text-faint)]"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        aria-label={rest["aria-label"] ?? placeholder}
        className="h-10 w-full rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] pl-8 pr-3 text-[13px] text-[var(--wy-text)] placeholder:text-[var(--wy-text-faint)] focus-visible:border-[var(--wy-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wy-accent)_35%,transparent)] sm:h-9"
        {...rest}
      />
    </div>
  );
}
