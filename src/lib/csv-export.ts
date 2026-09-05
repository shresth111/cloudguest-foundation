/**
 * Shared CSV export helpers.
 *
 * Extracted from `UserReports.tsx`, which had the only hardened
 * implementation in the codebase, so a second export surface (the Users
 * screen's guest list) could not quietly ship a less careful copy. CSV
 * escaping is exactly the kind of thing that gets reimplemented slightly
 * wrong the second time.
 */

/**
 * Leading characters Excel/Sheets treat as the start of a formula.
 *
 * This matters here more than in most products because guest-supplied
 * free text reaches these exports. A guest can register or redeem with an
 * identifier set to a formula payload -- the backend's own
 * `normalize_redeemed_identifier` only strips whitespace, by design -- so
 * a venue opening an export in Excel would execute it. Prefixing with an
 * apostrophe makes the cell inert while leaving the value readable.
 */
const CSV_FORMULA_TRIGGER_RE = /^[=+\-@]/;

/** Escape one CSV field: neutralise formula injection, then quote if the
 * value contains a comma, quote or newline (doubling embedded quotes, per
 * RFC 4180). */
export function csvField(val: string): string {
  const safe = CSV_FORMULA_TRIGGER_RE.test(val) ? `'${val}` : val;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Build a CSV document from a header row and body rows, escaping every
 * cell. Rows are arrays of already-stringified values. */
export function toCsv(header: string[], rows: string[][]): string {
  const head = header.map(csvField).join(",");
  const body = rows.map((r) => r.map(csvField).join(","));
  return [head, ...body].join("\n");
}

/** Trigger a browser download of `content` as `filename`.
 *
 * Revokes the object URL after the click -- without it every export leaks
 * a blob for the lifetime of the tab, which on a screen someone exports
 * from repeatedly is a real leak rather than a theoretical one. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** `YYYY-MM-DD` in the viewer's own timezone, for filenames. */
export function csvDateStamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
