import { toCsv } from "@/lib/csv-export";
import type { SessionTimeline } from "@/services/sessionTimeline.service";

/** Pure helpers for the guest-session AAA timeline drawer -- kept out of the
 * component so `scripts/test-aaa-and-security-logs.mjs` can exercise them. */

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1000;
  let u = 0;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u += 1;
  }
  return `${v.toFixed(1)} ${units[u]}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m} min`;
  return `${Math.max(0, Math.round(seconds))}s`;
}

/** The timeline as CSV -- one row per step, raw values flattened into one
 * column. Built with the shared formula-safe `toCsv`. */
export function timelineCsv(t: SessionTimeline): string {
  return toCsv(
    ["Time", "Phase", "Step", "Detail", "Times", "Raw values"],
    t.entries.map((e) => [
      e.at,
      e.phase,
      e.title,
      e.detail ?? "",
      String(e.repeatCount),
      Object.entries(e.raw)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    ]),
  );
}
