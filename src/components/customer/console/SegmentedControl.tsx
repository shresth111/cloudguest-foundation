import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when `label` is an icon. */
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string> {
  /** The choices, in display order. */
  options: ReadonlyArray<SegmentedOption<T>>;
  /** The selected value. */
  value: T;
  /** Called with the newly selected value. */
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Time range". */
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}

/** A compact single-choice toggle (radiogroup semantics, arrow-key navigation), e.g. 24h / 7d / 30d. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "sm",
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step || i < 0) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-0.5",
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
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-[calc(var(--wy-radius)-2px)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
              size === "sm" ? "h-6 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              selected
                ? "bg-[var(--wy-surface)] text-[var(--wy-text)] shadow-[var(--wy-shadow)]"
                : "text-[var(--wy-text-muted)] hover:text-[var(--wy-text)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
