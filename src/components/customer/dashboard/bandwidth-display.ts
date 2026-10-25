/**
 * Display arithmetic for the Bandwidth Utilization card.
 *
 * Kept out of the component so `scripts/test-bandwidth-display.mjs` can run
 * it for real. The defect this exists to prevent (2026-10-25, Library Hall):
 * a venue measured 0.057 Mbps down / 0.225 Mbps up against a 300 Mbps plan,
 * and the card said "0 Mbps ↓ 0 Mbps ↑ 0% of plan" with a flat line, because
 * every number went through `toFixed(0)` / `Math.round` and the y-axis was
 * pinned to the plan speed. The owner read "0" as "not measuring". A real,
 * small reading must never render the same as no traffic.
 */
import { formatMbps } from "@/lib/device-health";

/** "0.06 Mbps", "2.4 Mbps", "180 Mbps". Never rounds a real reading to 0. */
export { formatMbps };

/**
 * Share of the advertised plan, as shown on the pill. `null` when it cannot
 * be computed (no plan speed, no reading). Any traffic above zero that rounds
 * below 1% reads "<1%", so "0%" means exactly zero traffic.
 */
export function utilizationLabel(
  downloadMbps: number | null | undefined,
  capacityMbps: number | null | undefined,
): { pct: number; label: string } | null {
  if (downloadMbps == null || !Number.isFinite(downloadMbps)) return null;
  if (capacityMbps == null || !(capacityMbps > 0)) return null;
  const raw = (downloadMbps / capacityMbps) * 100;
  const pct = Math.round(raw);
  if (pct === 0 && raw > 0) return { pct: 0, label: "<1%" };
  return { pct, label: `${pct}%` };
}

/**
 * Below this share of the plan, pinning the y-axis to the plan speed draws
 * the real traffic as a line on the floor, so the axis follows the data and
 * the plan line is left off-scale (the congestion summary still states the
 * plan).
 */
export const PLAN_AXIS_MIN_SHARE = 0.25;

/**
 * Whether the chart's y-axis should be anchored to the plan speed (and the
 * plan reference line drawn). Only when the traffic is large enough to be
 * legible on that scale.
 */
export function anchorAxisToPlan(
  dataMaxMbps: number | null | undefined,
  capacityMbps: number | null | undefined,
): boolean {
  if (capacityMbps == null || !(capacityMbps > 0)) return false;
  if (dataMaxMbps == null || !Number.isFinite(dataMaxMbps)) return false;
  return dataMaxMbps >= capacityMbps * PLAN_AXIS_MIN_SHARE;
}
