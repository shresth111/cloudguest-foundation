/** NETMON-2 pure helpers: sparkline geometry, filter validation, labels. */
import type { CompletedQuery, TrafficPoint } from "@/services/isp-partner/netmon";

export const REASON_LABEL: Record<string, string> = {
  not_set_up: "Not set up",
  offline: "Can't read this router",
  monitoring_off: "Monitoring off",
  poll_failed: "Last reading failed",
  no_data_yet: "No readings yet",
  controller_managed: "Vendor controller",
};

/** Words the partner UI must never show (QA-023). */
export const FORBIDDEN_WORDS = ["tunnel", "wireguard", "vpn"];

/** SVG polyline points for one series in a w x h box, shared y-scale. */
export function sparkPaths(
  points: TrafficPoint[],
  w: number,
  h: number,
): { inPath: string; outPath: string; max: number } {
  if (points.length === 0) return { inPath: "", outPath: "", max: 0 };
  const max = Math.max(...points.map((p) => Math.max(p.in_mbps, p.out_mbps)), 0.001);
  const t0 = Date.parse(points[0].at);
  const t1 = Date.parse(points[points.length - 1].at);
  const span = Math.max(t1 - t0, 1);
  const xy = (p: TrafficPoint, v: number) =>
    `${(((Date.parse(p.at) - t0) / span) * w).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`;
  return {
    inPath: points.map((p) => xy(p, p.in_mbps)).join(" "),
    outPath: points.map((p) => xy(p, p.out_mbps)).join(" "),
    max,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAC = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

export function completedError(q: CompletedQuery): string | null {
  if (q.date_from && !DAY.test(q.date_from)) return "Start date is not a date.";
  if (q.date_to && !DAY.test(q.date_to)) return "End date is not a date.";
  if (q.date_from && q.date_to) {
    if (q.date_from > q.date_to) return "The start date is after the end date.";
    const days =
      (Date.parse(`${q.date_to}T00:00:00Z`) - Date.parse(`${q.date_from}T00:00:00Z`)) / 86_400_000;
    if (days > 92) return "At most 93 days at a time.";
  }
  if (q.mac && !MAC.test(q.mac)) return "MAC looks like AA:BB:CC:DD:EE:FF.";
  if (q.ip && !IPV4.test(q.ip) && !q.ip.includes(":")) return "Not an IP address.";
  return null;
}
