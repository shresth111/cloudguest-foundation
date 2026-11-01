/**
 * DASH-1 pure helpers: filters -> query params (plain `YYYY-MM-DD` dates, the
 * invoices P0 rule), the tile layout, and the donut segments. No React.
 */
import type {
  DashBucket,
  DashFilters,
  DashTile,
  SubscriberDashboard,
} from "@/services/isp-partner/dashboard-types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Query params for the API. Dates only for `custom`, and only as plain days. */
export function dashParams(f: DashFilters): Record<string, string> {
  const out: Record<string, string> = { period: f.period };
  if (f.period === "custom") {
    if (f.date_from && DAY.test(f.date_from)) out.date_from = f.date_from;
    if (f.date_to && DAY.test(f.date_to)) out.date_to = f.date_to;
  }
  if (f.isp_router_id) out.isp_router_id = f.isp_router_id;
  if (f.package_id) out.package_id = f.package_id;
  if (f.connection_type) out.connection_type = f.connection_type;
  return out;
}

/** A custom range the API will accept: both days, start <= end, <= 401 days. */
export function customRangeError(from?: string, to?: string): string | null {
  if (!from || !to || !DAY.test(from) || !DAY.test(to)) return "Pick a start and an end date.";
  if (from > to) return "The start date is after the end date.";
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days > 400) return "At most 401 days.";
  return null;
}

export const BUCKET_LABEL: Record<DashBucket, string> = {
  active: "Active",
  pending: "Pending",
  suspended: "Suspended",
  frozen: "Frozen",
  blocked: "Blocked",
  expired: "Expired",
  churned: "Churned",
  other: "Other",
};

export const TILE_LABEL: Record<DashTile, string> = {
  ...BUCKET_LABEL,
  total: "Total",
  online: "Online now",
  expiring_7d: "Expiring in 7 days",
  scheduled_renewals: "Renewing in 7 days",
  new_in_period: "New in period",
};

/** Tiles in the order they are shown: the partition first (it sums to the
 * total), then the cross-cutting counts. */
export const PARTITION_TILES: DashTile[] = [
  "active",
  "pending",
  "expired",
  "churned",
  "suspended",
  "frozen",
  "blocked",
  "other",
];
export const OVERLAY_TILES: DashTile[] = [
  "total",
  "expiring_7d",
  "scheduled_renewals",
  "new_in_period",
];

/** True when the partition tiles add up to the total (they always should). */
export function partitionAddsUp(d: Pick<SubscriberDashboard, "tiles" | "buckets">): boolean {
  return d.buckets.reduce((s, b) => s + (d.tiles[b] ?? 0), 0) === d.tiles.total;
}

export interface DonutSegment {
  key: "hotspot" | "pppoe";
  label: string;
  value: number;
  /** 0..1 start and end along the ring. */
  from: number;
  to: number;
}

/** Ring segments for online sessions. PPPoE is listed only when it is on. */
export function onlineSegments(o: SubscriberDashboard["online"]): DonutSegment[] {
  const parts: { key: "hotspot" | "pppoe"; label: string; value: number }[] = [
    { key: "hotspot", label: "Hotspot", value: o.hotspot_sessions },
  ];
  if (o.pppoe_enabled) parts.push({ key: "pppoe", label: "PPPoE", value: o.pppoe_sessions });
  const total = parts.reduce((s, p) => s + p.value, 0);
  let at = 0;
  return parts.map((p) => {
    const share = total > 0 ? p.value / total : 0;
    const seg = { ...p, from: at, to: at + share };
    at += share;
    return seg;
  });
}

/** SVG arc path for a ring segment (cx=cy=r+w, angles clockwise from 12 o'clock). */
export function arcPath(from: number, to: number, r: number, w: number): string {
  const c = r + w;
  const span = Math.min(to - from, 0.9999);
  if (span <= 0) return "";
  const a0 = 2 * Math.PI * from - Math.PI / 2;
  const a1 = 2 * Math.PI * (from + span) - Math.PI / 2;
  const p = (a: number) =>
    `${(c + r * Math.cos(a)).toFixed(3)} ${(c + r * Math.sin(a)).toFixed(3)}`;
  const large = span > 0.5 ? 1 : 0;
  return `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`;
}
