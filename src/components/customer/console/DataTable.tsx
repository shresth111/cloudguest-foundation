import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Monospace cell text: IPs, MACs, ports, ids. */
export const MONO_CELL = "font-[family-name:var(--wy-font-mono)] text-xs";

/**
 * Hover-revealed row controls (edit/delete) that still show for keyboard
 * users (focus-within) and always show on touch (below `sm`, where the table
 * is a card list and there is no hover). Put it on the controls' wrapper.
 */
export const ROW_REVEAL =
  "transition-opacity duration-150 motion-reduce:transition-none sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100";

export interface DataTableColumn<T> {
  /** Stable key for the column. */
  id: string;
  /** Header text (also the label in the mobile card). */
  header: ReactNode;
  /** Renders the cell. */
  cell: (row: T) => ReactNode;
  /** Monospace, for addresses and ports. */
  mono?: boolean;
  align?: "left" | "right";
  /** Extra classes on the `<td>` (e.g. `whitespace-normal` for a wrapping name). */
  className?: string;
  /** Mobile card role: `title` heads the card, `hidden` is left out; default is a label/value row. */
  mobile?: "title" | "hidden";
  /** Table layout only: hide the column below this breakpoint, so a wide
   * table sheds its least-needed columns instead of scrolling sideways.
   * The mobile card list ignores it (use `mobile` there). */
  visibleFrom?: "md" | "lg" | "xl" | "2xl";
}

const VISIBLE_FROM = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
} as const;

export interface DataTableProps<T> {
  /** Column definitions, in display order. */
  columns: ReadonlyArray<DataTableColumn<T>>;
  /** The rows on screen (already filtered/paginated). */
  rows: readonly T[];
  /** Stable React key per row. */
  rowKey: (row: T) => string;
  /** Names the table for screen readers, e.g. "Address ranges". */
  ariaLabel: string;
  /** While true, shows `loadingLabel` in place of rows. */
  loading?: boolean;
  /** Shown while loading (default "Loading…" is the caller's job to translate). */
  loadingLabel?: ReactNode;
  /** Shown when not loading and there are no rows: a sentence, or an EmptyState. */
  empty?: ReactNode;
  /** Per-row controls, rendered in a trailing right-aligned column (and at the foot of each mobile card). */
  rowActions?: (row: T) => ReactNode;
  /** Accessible header for the actions column (visually hidden). */
  actionsLabel?: string;
  /** Makes rows focusable and clickable (Enter/Space too). Leave unset when rows only hold buttons. */
  onRowClick?: (row: T) => void;
  /** Accessible name for a clickable row, e.g. "Edit Guest pool". */
  rowLabel?: (row: T) => string;
  /** Row height: compact 40px (default), comfortable 48px. */
  density?: "compact" | "comfortable";
  /** Cap the table's height and scroll inside it, so the sticky header stays in view. */
  maxHeight?: string;
  /** Under the table: pagination, a "showing N of M" line. */
  footer?: ReactNode;
  className?: string;
}

/**
 * The console table shell: 13px rows, a sticky header on `--wy-surface-2`,
 * nowrap cells with an optional mono style, a visible focus marker on the
 * row that holds keyboard focus (3px accent bar, >= 3:1 on every surface),
 * and a card list below `sm` instead of a sideways-scrolling grid.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  loading,
  loadingLabel = "…",
  empty,
  rowActions,
  actionsLabel,
  onRowClick,
  rowLabel,
  density = "compact",
  maxHeight,
  footer,
  className,
}: DataTableProps<T>) {
  const colSpan = columns.length + (rowActions ? 1 : 0);
  const state = loading ? "loading" : rows.length === 0 ? "empty" : "rows";
  const stateBody =
    state === "loading" ? (
      <div role="status" className="px-4 py-10 text-center text-[13px] text-[var(--wy-text-muted)]">
        {loadingLabel}
      </div>
    ) : state === "empty" ? (
      typeof empty === "string" || typeof empty === "number" ? (
        <div className="px-4 py-10 text-center text-[13px] text-[var(--wy-text-muted)]">
          {empty}
        </div>
      ) : (
        empty
      )
    ) : null;

  const rowKeyDown = (row: T) => (e: KeyboardEvent<HTMLElement>) => {
    if (!onRowClick || e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick(row);
    }
  };

  // The focus marker: a 3px accent bar on the row's first cell plus a soft
  // tint, whenever the row itself or anything inside it has keyboard focus.
  const focusMarker =
    "[&:is(:focus-visible,:has(:focus-visible))]:bg-[var(--wy-accent-soft)] [&:is(:focus-visible,:has(:focus-visible))>td:first-child]:shadow-[inset_3px_0_0_var(--wy-accent)] focus-visible:outline-none";

  return (
    <div className={cn("min-w-0", className)} data-density={density}>
      {/* sm and up: the table. */}
      <div
        className={cn("hidden overflow-x-auto sm:block", maxHeight && "overflow-y-auto")}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table
          aria-label={ariaLabel}
          className="w-full border-collapse text-[13px] text-[var(--wy-text)]"
        >
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-[1] h-9 whitespace-nowrap border-b border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-3 text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]",
                    c.align === "right" ? "text-right" : "text-left",
                    c.visibleFrom && VISIBLE_FROM[c.visibleFrom],
                  )}
                >
                  {c.header}
                </th>
              ))}
              {rowActions && (
                <th
                  scope="col"
                  className="sticky top-0 z-[1] h-9 border-b border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-3"
                >
                  {actionsLabel && <span className="sr-only">{actionsLabel}</span>}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {state !== "rows" ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  {stateBody}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? rowKeyDown(row) : undefined}
                  className={cn(
                    "group/row border-b border-[var(--wy-border)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--wy-surface-2)] motion-reduce:transition-none",
                    density === "compact" ? "h-10" : "h-12",
                    onRowClick && "cursor-pointer",
                    focusMarker,
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        "whitespace-nowrap px-3 align-middle",
                        density === "compact" ? "py-1.5" : "py-2.5",
                        c.mono && MONO_CELL,
                        c.align === "right" && "text-right",
                        c.visibleFrom && VISIBLE_FROM[c.visibleFrom],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="whitespace-nowrap px-2 py-1 text-right align-middle">
                      <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Below sm: one card per row. */}
      <div className="sm:hidden">
        {state !== "rows" ? (
          stateBody
        ) : (
          <ul aria-label={ariaLabel} className="divide-y divide-[var(--wy-border)]">
            {rows.map((row) => {
              const title = columns.filter((c) => c.mobile === "title");
              const body = columns.filter((c) => c.mobile !== "title" && c.mobile !== "hidden");
              return (
                <li
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? rowKeyDown(row) : undefined}
                  className={cn(
                    "group/row space-y-2 px-4 py-3 text-[13px] text-[var(--wy-text)] [&:is(:focus-visible,:has(:focus-visible))]:bg-[var(--wy-accent-soft)] [&:is(:focus-visible,:has(:focus-visible))]:shadow-[inset_3px_0_0_var(--wy-accent)] focus-visible:outline-none",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {title.length > 0 && (
                    <div className="min-w-0 space-y-0.5 font-medium">
                      {title.map((c) => (
                        <div key={c.id} className={cn("min-w-0", c.mono && MONO_CELL)}>
                          {c.cell(row)}
                        </div>
                      ))}
                    </div>
                  )}
                  {body.length > 0 && (
                    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                      {body.map((c) => (
                        <div key={c.id} className="contents">
                          <dt className="text-xs text-[var(--wy-text-faint)]">{c.header}</dt>
                          <dd className={cn("min-w-0 break-words", c.mono && MONO_CELL)}>
                            {c.cell(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {rowActions && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 [&_button]:min-h-10 [&_button]:min-w-10">
                      {rowActions(row)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {footer != null && <div className="border-t border-[var(--wy-border)]">{footer}</div>}
    </div>
  );
}

export interface TablePagerProps {
  /** "Page 2 of 5 · 112 rules": already formatted by the caller. */
  summary: ReactNode;
  previousLabel: ReactNode;
  nextLabel: ReactNode;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** The pagination row a DataTable footer usually holds. */
export function TablePager({
  summary,
  previousLabel,
  nextLabel,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: TablePagerProps) {
  const btn =
    "inline-flex h-10 items-center rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] px-3 text-xs font-medium text-[var(--wy-text)] transition-colors hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] disabled:pointer-events-none disabled:opacity-50 sm:h-8";
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-[var(--wy-text-muted)]">
      <span className="tabular-nums">{summary}</span>
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={!hasPrevious} onClick={onPrevious}>
          {previousLabel}
        </button>
        <button type="button" className={btn} disabled={!hasNext} onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
