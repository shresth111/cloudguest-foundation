/**
 * Local console primitives for the Overview page.
 *
 * STAND-INS. The shell branch (`dashboard-revamp-shell`) ships the shared
 * versions in `src/components/customer/console/` (`StatusDot`, `StatTile`,
 * `Panel`, `SegmentedControl`, `EmptyState`). These exist only so this page
 * can be built before that lands; at merge, swap each import for the shared
 * one and delete the matching export here. `SectionBoundary` has no shared
 * counterpart and stays.
 *
 * Every colour is a `--wy-*` token, never a literal, so the swap is a no-op
 * visually once both sides read the same names.
 */
import { Component, useRef, type ErrorInfo, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ConsoleStatus = "ok" | "warn" | "crit" | "info" | "offline" | "unknown";

/** Text colour per status, as a Tailwind arbitrary value. */
export const STATUS_TEXT: Record<ConsoleStatus, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  info: "text-[var(--wy-info)]",
  offline: "text-[var(--wy-offline)]",
  unknown: "text-[var(--wy-text-faint)]",
};

export const STATUS_BG: Record<ConsoleStatus, string> = {
  ok: "bg-[var(--wy-ok)]",
  warn: "bg-[var(--wy-warn)]",
  crit: "bg-[var(--wy-crit)]",
  info: "bg-[var(--wy-info)]",
  offline: "bg-[var(--wy-offline)]",
  unknown: "bg-[var(--wy-text-faint)]",
};

export const STATUS_SOFT_BG: Record<ConsoleStatus, string> = {
  ok: "bg-[var(--wy-ok-soft)]",
  warn: "bg-[var(--wy-warn-soft)]",
  crit: "bg-[var(--wy-crit-soft)]",
  info: "bg-[var(--wy-info-soft)]",
  offline: "bg-[var(--wy-offline-soft)]",
  unknown: "bg-[var(--wy-offline-soft)]",
};

/** CSS colour value (for SVG fill/stroke). */
export const STATUS_VAR: Record<ConsoleStatus, string> = {
  ok: "var(--wy-ok)",
  warn: "var(--wy-warn)",
  crit: "var(--wy-crit)",
  info: "var(--wy-info)",
  offline: "var(--wy-offline)",
  unknown: "var(--wy-text-faint)",
};

/** Swap for `console/StatusDot` at merge. `live` adds a slow ping ring,
 * motion-safe only, and only ever for a status that is actually ok. */
export function StatusDot({
  status,
  live = false,
  className,
  label,
}: {
  status: ConsoleStatus;
  live?: boolean;
  className?: string;
  /** When given, the dot is announced; otherwise it is decorative. */
  label?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex h-2 w-2 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {live && status === "ok" && (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping motion-reduce:hidden",
            STATUS_BG[status],
          )}
          style={{ animationDuration: "2.4s" }}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", STATUS_BG[status])} />
    </span>
  );
}

/** Recharts `contentStyle` for every chart tooltip on the page. */
export const CONSOLE_TOOLTIP_STYLE = {
  borderRadius: "var(--wy-radius)",
  border: "1px solid var(--wy-border-strong)",
  background: "var(--wy-surface)",
  color: "var(--wy-text)",
  fontSize: 12,
  padding: "6px 10px",
  boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
};

export const PANEL =
  "rounded-[var(--wy-radius-lg)] border border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text)] shadow-[var(--wy-shadow)]";

/** Swap for `console/Panel` at merge. */
export function Panel({
  className,
  children,
  testId,
  as: Tag = "section",
  labelledBy,
}: {
  className?: string;
  children: ReactNode;
  testId?: string;
  as?: "section" | "div";
  labelledBy?: string;
}) {
  return (
    <Tag className={cn(PANEL, className)} data-testid={testId} aria-labelledby={labelledBy}>
      {children}
    </Tag>
  );
}

/** The one panel header used across the page: small caps title, optional
 * meta line, actions on the right. Dense on purpose. */
export function PanelHead({
  id,
  title,
  meta,
  icon,
  right,
  className,
}: {
  id?: string;
  title: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--wy-border)] px-4 py-2.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-[var(--wy-text-faint)]">{icon}</span>}
        <h2 id={id} className="truncate text-[13px] font-semibold tracking-[-0.005em]">
          {title}
        </h2>
        {meta && (
          <span className="hidden truncate text-xs text-[var(--wy-text-faint)] sm:inline">
            {meta}
          </span>
        )}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** Text-button link used in panel headers ("View all"). */
export function PanelLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-1 text-xs font-medium text-[var(--wy-accent)] transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
    >
      {children}
    </button>
  );
}

/** Swap for `console/SegmentedControl` at merge. A radiogroup with roving
 * focus: arrow keys move and select, as WAI-ARIA describes for radios. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const onKey = (e: KeyboardEvent) => {
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (idx - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKey}
      className="inline-flex items-center rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-0.5"
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[calc(var(--wy-radius)-2px)] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              on
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

/** Swap for `console/EmptyState` at merge. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center",
        className,
      )}
      data-state="empty"
    >
      <p className="text-sm font-medium text-[var(--wy-text)]">{title}</p>
      {body && <p className="max-w-sm text-xs text-[var(--wy-text-muted)]">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Swap for `console/StatTile` at merge. */
export function StatTile({
  label,
  value,
  footer,
  loading,
  status,
}: {
  label: string;
  value: string | null;
  footer?: ReactNode;
  loading?: boolean;
  status?: ConsoleStatus;
}) {
  return (
    <div className={cn(PANEL, "px-4 py-3")}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--wy-text-muted)]">
        {status && <StatusDot status={status} />}
        {label}
      </div>
      <div className="mt-1.5 h-8">
        {loading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-[var(--wy-surface-2)]" />
        ) : (
          <span
            className={cn(
              "text-2xl font-semibold tabular-nums tracking-[-0.02em]",
              value == null && "text-[var(--wy-text-faint)]",
            )}
          >
            {value ?? "—"}
          </span>
        )}
      </div>
      <div className="mt-1 min-h-4 truncate text-xs text-[var(--wy-text-muted)]">
        {!loading && footer}
      </div>
    </div>
  );
}

/** A section that crashes renders its own fallback instead of taking the
 * page down -- the insight cards once did exactly that on a wrong-shaped
 * body. No shared counterpart; keep. */
export class SectionBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[dashboard] section "${this.props.name}" failed to render`, error, info);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The fallback a SectionBoundary shows. */
export function SectionFailed({ title, body }: { title: string; body: string }) {
  return (
    <div className={cn(PANEL, "px-4 py-6 text-center")} role="alert" data-state="error">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[var(--wy-text-muted)]">{body}</p>
    </div>
  );
}
