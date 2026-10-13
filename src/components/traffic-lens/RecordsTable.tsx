import { useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecordsColumn, RecordsRow } from "@/lib/records-table";

/**
 * The one records table of Traffic Lens. Both consoles draw it, each with
 * its own columns and rows; nothing here knows which console it is in, what
 * a row means, or where it came from.
 *
 * What it guarantees, for whoever passes the columns:
 *
 *  - A column marked `notRecorded` keeps its place. Its heading is greyed,
 *    is never a sort button, and gives the reason on hover (title) and on
 *    tap (a line above the table). Its cells are drawn greyed, as given.
 *  - A cell listed in a row's `missing` is drawn greyed too, with the row's
 *    own reason on hover, so a value that one row lacks does not read as a
 *    value.
 *  - Sorting is the caller's: a header click reports the sort key and draws
 *    the arrow the caller's state says. The table never reorders rows.
 *  - The optional last column is an action on the row (a download), never a
 *    piece of data.
 */
export function RecordsTable<Id extends string, Sort extends string>({
  columns,
  rows,
  sort,
  onSort,
  mono = [],
  rowAction,
}: {
  /** The columns to draw, in order. */
  columns: RecordsColumn<Id, Sort>[];
  rows: RecordsRow<Id>[];
  sort: { key: Sort; order: "asc" | "desc" };
  onSort: (key: Sort) => void;
  /** Columns set in the monospace face (addresses). */
  mono?: readonly Id[];
  rowAction?: {
    heading: string;
    title: string;
    label: (row: RecordsRow<Id>) => string;
    disabled?: boolean;
    onClick: (row: RecordsRow<Id>) => void;
  };
}) {
  /** The unavailable column whose reason is spelled out above the table. */
  const [explained, setExplained] = useState<Id | null>(null);
  const why = columns.find((c) => c.id === explained && c.notRecorded !== null);
  const sortState = (key: Sort): "ascending" | "descending" | "none" =>
    sort.key !== key ? "none" : sort.order === "asc" ? "ascending" : "descending";
  const HEAD = "whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider";

  return (
    <div className="space-y-3">
      {why && (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs"
        >
          <span className="font-semibold">{why.label}</span>: {why.notRecorded}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((c) => (
                <TableHead
                  key={c.id}
                  aria-sort={c.sort && c.notRecorded === null ? sortState(c.sort) : undefined}
                  className={`${HEAD} ${c.numeric ? "text-right" : ""}`}
                >
                  {c.notRecorded !== null ? (
                    <button
                      type="button"
                      title={c.notRecorded}
                      aria-label={`${c.label}. ${c.notRecorded}`}
                      onClick={() => setExplained(explained === c.id ? null : c.id)}
                      className="cursor-help uppercase tracking-wider text-muted-foreground/60 underline decoration-dotted underline-offset-4"
                    >
                      {c.label}
                    </button>
                  ) : c.sort ? (
                    <SortButton
                      label={c.label}
                      state={sortState(c.sort)}
                      onClick={() => onSort(c.sort as Sort)}
                    />
                  ) : (
                    c.label
                  )}
                </TableHead>
              ))}
              {rowAction && (
                <TableHead className={`${HEAD} text-right`}>{rowAction.heading}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                {columns.map((c) => {
                  const absent = c.notRecorded !== null || (row.missing ?? []).includes(c.id);
                  return (
                    <TableCell
                      key={c.id}
                      title={c.notRecorded ?? row.reasons?.[c.id]}
                      className={`whitespace-nowrap tabular-nums ${c.numeric ? "text-right" : ""} ${
                        mono.includes(c.id) ? "font-mono text-xs" : ""
                      } ${absent ? "text-muted-foreground/50" : ""}`}
                    >
                      {row.cells[c.id]}
                    </TableCell>
                  );
                })}
                {rowAction && (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={rowAction.disabled}
                      aria-label={rowAction.label(row)}
                      title={rowAction.title}
                      onClick={() => rowAction.onClick(row)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortButton({
  label,
  state,
  onClick,
}: {
  label: string;
  state: "ascending" | "descending" | "none";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={state === "none" ? `Sort by ${label}` : `Sorted ${state}; click to reverse`}
      className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${state === "none" ? "" : "text-foreground"}`}
    >
      {label}
      {state === "ascending" && <ArrowUp aria-hidden className="h-3 w-3" />}
      {state === "descending" && <ArrowDown aria-hidden className="h-3 w-3" />}
      <span className="sr-only">{state === "none" ? ", not sorted" : `, sorted ${state}`}</span>
    </button>
  );
}
