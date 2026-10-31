import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SubTabOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional count shown after the label (tabular, neutral). */
  count?: number;
}

export interface SubTabsProps<T extends string> {
  /** The views, in display order. Use SegmentedControl instead for 4 or fewer short choices. */
  options: ReadonlyArray<SubTabOption<T>>;
  /** The selected view. */
  value: T;
  /** Called with the newly selected view. */
  onChange: (value: T) => void;
  /** Names the tab list for screen readers, e.g. "Report type". */
  ariaLabel: string;
  /** Prefix for tab/panel ids; the panel should carry `id={`${idPrefix}-panel`}` and `aria-labelledby` the active tab. */
  idPrefix?: string;
  className?: string;
}

/**
 * Small underline tabs for switching between more than four views inside one
 * screen (tablist semantics, roving tabindex, arrow/Home/End keys). It sits
 * under the PageHeader; the section tabs above the header are a different,
 * larger control.
 */
export function SubTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix = "subtabs",
  className,
}: SubTabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    if (i < 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "flex min-w-0 items-end gap-1 overflow-x-auto border-b border-[var(--wy-border)] [scrollbar-width:none]",
        className,
      )}
    >
      {options.map((o, idx) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            id={`${idPrefix}-tab-${o.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wy-accent)] motion-reduce:transition-none",
              selected
                ? "border-[var(--wy-accent)] text-[var(--wy-text)]"
                : "border-transparent text-[var(--wy-text-muted)] hover:text-[var(--wy-text)]",
            )}
          >
            {o.label}
            {o.count != null && (
              <span className="rounded-full bg-[var(--wy-surface-2)] px-1.5 text-[11px] tabular-nums text-[var(--wy-text-muted)]">
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
