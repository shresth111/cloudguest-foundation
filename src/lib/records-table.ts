/**
 * What any records table in Traffic Lens needs, whichever console draws it:
 * a column's description, an instant to the second, the result line, and the
 * quick filter over rows already loaded. Pure, no React, no wording about
 * where records come from: the customer dashboard imports this file too.
 *
 * Used by src/components/traffic-lens/RecordsTable.tsx, which is the one
 * table both consoles render with their own column sets.
 */
import { formatCount } from "@/lib/analytics-format";

const DASH = "—";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** One column of a records table. */
export interface RecordsColumn<Id extends string = string, Sort extends string = string> {
  id: Id;
  label: string;
  /** The server sort this header asks for; null = not sortable. */
  sort: Sort | null;
  /** Always shown: cannot be hidden in the column chooser. */
  fixed: boolean;
  numeric: boolean;
  /** Set when the column has no data: why, in one line. The header is then
   * greyed, is not sortable, and gives this reason on hover or tap. */
  notRecorded: string | null;
  /** Shown unless the person hides it. */
  initial: boolean;
}

/** One row, ready to draw: a stable key and a string per column id. */
export interface RecordsRow<Id extends string = string> {
  key: string;
  cells: Record<Id, string>;
  /** Column ids whose value this row does not have. Drawn greyed. */
  missing?: readonly Id[];
  /** Why, per missing cell: given on hover. */
  reasons?: Partial<Record<Id, string>>;
}

/** "2026-10-12 19:35:00": an instant to the second, in the venue's time
 * zone when it is known and usable, otherwise the browser's. */
export function recordTime(iso: string | null | undefined, timeZone?: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return DASH;
  const parts = (zone: string | undefined) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(t));
  let p: Intl.DateTimeFormatPart[];
  try {
    p = parts(timeZone || undefined);
  } catch {
    p = parts(undefined);
  }
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** "Retrieved 72 records in 0.04 second", from the count and the database
 * time the API returns. When the page is capped it says of how many. */
export function retrievedLine(r: {
  total: number;
  returned: number;
  query_ms: number;
  rows: unknown[];
}): string {
  const total = isNum(r.total) ? r.total : 0;
  const shown = isNum(r.returned) ? r.returned : r.rows.length;
  const took = isNum(r.query_ms) ? ` in ${(r.query_ms / 1000).toFixed(2)} second` : "";
  const noun = total === 1 ? "record" : "records";
  if (total === 0) return `Retrieved no records${took}`;
  if (shown < total)
    return `Retrieved ${formatCount(shown)} of ${formatCount(total)} ${noun}${took}`;
  return `Retrieved ${formatCount(total)} ${noun}${took}`;
}

/** The quick "Filter…" box: narrows the rows ALREADY LOADED, in the browser.
 * It asks the server for nothing, so it is not a search and is not audited.
 * Every word typed must appear somewhere in the row's shown cells. */
export function filterLoadedRecords<T extends Record<string, string>>(
  rows: readonly T[],
  visible: readonly string[],
  text: string,
): T[] {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => {
    const hay = visible
      .map((id) => row[id] ?? "")
      .join(" ")
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
