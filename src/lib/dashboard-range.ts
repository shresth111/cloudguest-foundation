/**
 * The customer dashboard's date-range selector, as the query it becomes.
 * Pure so `scripts/test-dashboard-range.mjs` can exercise it directly.
 *
 * 24h is a rolling window bucketed by hour. 7d / 30d are whole local days
 * ending today, bucketed by day -- "last 7 days" on a Tuesday afternoon
 * should include all of last Wednesday, not start at 3pm on it.
 */
export type DashboardRange = "24h" | "7d" | "30d";

export const DASHBOARD_RANGES: { value: DashboardRange; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export interface DashboardRangeWindow {
  start: Date;
  end: Date;
  bucket: "hour" | "day";
  /** Minutes east of UTC, as the backend's `tz_offset_minutes` expects
   * (IST = 330). `Date#getTimezoneOffset` has the opposite sign. */
  tzOffsetMinutes: number;
}

export function dashboardRangeWindow(
  range: DashboardRange,
  now: Date = new Date(),
): DashboardRangeWindow {
  const tzOffsetMinutes = -now.getTimezoneOffset();
  if (range === "24h") {
    return {
      start: new Date(now.getTime() - 24 * 3_600_000),
      end: now,
      bucket: "hour",
      tzOffsetMinutes,
    };
  }
  const days = range === "7d" ? 7 : 30;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return { start, end: now, bucket: "day", tzOffsetMinutes };
}

/** Axis/tooltip label for one bucket of the series. */
export function bucketLabel(bucketStartIso: string, bucket: "hour" | "day"): string {
  const d = new Date(bucketStartIso);
  if (Number.isNaN(d.getTime())) return "";
  if (bucket === "hour") return `${String(d.getHours()).padStart(2, "0")}:00`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
