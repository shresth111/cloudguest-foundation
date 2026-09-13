/**
 * Small, dependency-free formatters shared by the customer Analytics pages
 * (analytics.guest/network/device/isp/executive) and the Live Session
 * explorer. Kept here rather than inline so the same byte/rate/percent
 * rendering is used across every panel and can be unit-tested on its own
 * (scripts/test-analytics-format.mjs).
 *
 * Everything here treats `null`/`undefined` as "no reading" and returns an
 * em dash, never a fabricated `0`. The backend domain-analytics endpoints
 * are deliberate about the difference (an unavailable metric is `null` with
 * an `available: false` flag, never a zero standing in for a real value),
 * so the display layer has to preserve it too.
 */

const DASH = "—";

/** Human-readable byte count (1000-based, matching the rest of the
 * dashboard's `fmtBytes` convention). `null`/`undefined` → em dash. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return DASH;
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

/** Bytes-per-second → a human bit-rate. The backend's
 * `average_speed_bytes_per_second` is bytes/s; multiply by 8 for bits.
 * `null` → em dash (there is genuinely no rate to show). */
export function formatBitrate(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond == null || !Number.isFinite(bytesPerSecond)) return DASH;
  const bitsPerSecond = bytesPerSecond * 8;
  if (bitsPerSecond < 1000) return `${Math.round(bitsPerSecond)} bps`;
  const units = ["Kbps", "Mbps", "Gbps"];
  let value = bitsPerSecond / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

/** A percentage rendered to one decimal, `null` → em dash. Pass the value
 * already in percent (e.g. 98.4), not a 0..1 fraction. */
export function formatPercent(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) return DASH;
  return `${percent.toFixed(1)}%`;
}

/** Plain integer with thousands separators; `null` → em dash. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return Math.round(value).toLocaleString();
}
