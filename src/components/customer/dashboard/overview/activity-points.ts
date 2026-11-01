/** Non-component exports split out of `ActivityChart.tsx` so that file
 * only exports components (react-refresh/only-export-components). */
import { bucketLabel } from "@/lib/dashboard-range";
import type { DashboardSeries } from "@/services/customer.service";
import type { ActivityPoint } from "./ActivityChart";

/** Pure: buckets -> chart rows. Drops nothing, invents nothing. */
export function toActivityPoints(s: DashboardSeries | undefined): ActivityPoint[] {
  if (!s || !Array.isArray(s.series)) return [];
  return s.series.map((b, i) => ({
    i,
    label: bucketLabel(b.bucketStart, s.bucket ?? "hour"),
    bucketStart: b.bucketStart,
    online: Number.isFinite(b.online) ? b.online : 0,
    arrivals: Number.isFinite(b.arrivals) ? b.arrivals : 0,
  }));
}
