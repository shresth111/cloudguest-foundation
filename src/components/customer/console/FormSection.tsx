import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  /** Section heading, e.g. "Where it applies". */
  title?: ReactNode;
  /** One quiet line under the heading. */
  description?: ReactNode;
  /** FormField / FormSwitchRow children; laid out in a 1-column grid, 2 columns from `sm`. */
  children: ReactNode;
  /** Footer actions (Cancel / Save), right-aligned under a hairline. */
  footer?: ReactNode;
  /** `panel` (default) = its own bordered Panel on the page; `plain` = no chrome, for inside a dialog. */
  variant?: "panel" | "plain";
  /** Columns from `sm` up (default 2). */
  columns?: 1 | 2;
  className?: string;
}

/**
 * A group of form fields with an optional heading and footer actions. As a
 * `panel` it is the console card; as `plain` it is a fieldset for a dialog
 * body. Either way the fields sit in one label-over-field grid.
 */
export function FormSection({
  title,
  description,
  children,
  footer,
  variant = "panel",
  columns = 2,
  className,
}: FormSectionProps) {
  const headingId = useId();
  const panel = variant === "panel";
  return (
    <section
      aria-labelledby={title != null ? headingId : undefined}
      className={cn(
        "min-w-0 text-[var(--wy-text)]",
        panel &&
          "rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] shadow-[var(--wy-shadow)]",
        className,
      )}
    >
      {(title != null || description != null) && (
        <header className={cn(panel ? "border-b border-[var(--wy-border)] px-4 py-3" : "mb-3")}>
          {title != null && (
            <h3 id={headingId} className="text-sm font-semibold">
              {title}
            </h3>
          )}
          {description != null && (
            <p className="mt-0.5 text-xs text-[var(--wy-text-muted)]">{description}</p>
          )}
        </header>
      )}
      <div
        className={cn("grid gap-x-3 gap-y-3.5", columns === 2 && "sm:grid-cols-2", panel && "p-4")}
      >
        {children}
      </div>
      {footer != null && (
        <footer
          className={cn(
            "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
            panel ? "border-t border-[var(--wy-border)] px-4 py-3" : "mt-4",
          )}
        >
          {footer}
        </footer>
      )}
    </section>
  );
}

export interface FormFieldProps {
  /** The visible label. */
  label: ReactNode;
  /** Id of the control, so the label is clickable and named. Pass it to the input too. */
  htmlFor?: string;
  /** Validation message; replaces the hint while present and is announced. */
  error?: ReactNode;
  /** Quiet help under the control. */
  hint?: ReactNode;
  /** Hint tone: `warn` for a "typed by hand" style caution. */
  hintTone?: "muted" | "warn" | "crit";
  /** Something right-aligned on the label row, e.g. a "Type manually" link. */
  labelAction?: ReactNode;
  /** Take the full row in a 2-column FormSection. */
  wide?: boolean;
  /** The control. */
  children: ReactNode;
  className?: string;
}

const HINT_TONE = {
  muted: "text-[var(--wy-text-muted)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
} as const;

/** One label / control / hint-or-error stack. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  hintTone = "muted",
  labelAction,
  wide,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("min-w-0 space-y-1.5", wide && "sm:col-span-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--wy-text)]">
          {label}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-[var(--wy-crit)]">
          {error}
        </p>
      ) : hint ? (
        <p className={cn("text-xs leading-relaxed", HINT_TONE[hintTone])}>{hint}</p>
      ) : null}
    </div>
  );
}

export interface FormSwitchRowProps {
  /** What the switch turns on. */
  label: ReactNode;
  /** What that means, in one line. */
  description?: ReactNode;
  /** The Switch (or checkbox) itself. */
  control: ReactNode;
  /** Take the full row in a 2-column FormSection. */
  wide?: boolean;
  className?: string;
}

/** A labelled on/off row: text left, switch right, inset surface. The row
 * is a `<label>`, so the text names the switch and clicking it toggles. */
export function FormSwitchRow({
  label,
  description,
  control,
  wide,
  className,
}: FormSwitchRowProps) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-3 py-2",
        wide && "sm:col-span-2",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--wy-text)]">{label}</div>
        {description != null && (
          <div className="text-xs text-[var(--wy-text-muted)]">{description}</div>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </label>
  );
}
