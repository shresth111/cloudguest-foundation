/** DASH-1 shapes. Contract: LANE_NOTES [DASH-1] (BE `feat/isp-dashboard`). */

export type DashBucket =
  | "active"
  | "pending"
  | "suspended"
  | "frozen"
  | "blocked"
  | "expired"
  | "churned"
  | "other";
export type DashOverlay = "online" | "expiring_7d" | "scheduled_renewals" | "new_in_period";
export type DashTile = DashBucket | DashOverlay | "total";
export type DashPeriod = "today" | "7d" | "30d" | "custom";

export interface DashFilters {
  period: DashPeriod;
  /** Plain `YYYY-MM-DD`, only for `custom`. */
  date_from?: string;
  date_to?: string;
  isp_router_id?: string;
  package_id?: string;
  connection_type?: string;
}

export interface SubscriberDashboard {
  tiles: Record<DashTile, number>;
  buckets: DashBucket[];
  overlays: DashOverlay[];
  /** null while JAZE-5 apps are off. Not part of `total`. */
  pending_leads: number | null;
  online: {
    hotspot_sessions: number;
    pppoe_sessions: number;
    total_sessions: number;
    subscribers: number;
    pppoe_enabled: boolean;
  };
  period: { period: DashPeriod; date_from: string; date_to: string };
  definitions: Record<string, string>;
  as_of: string;
}

export interface DashListItem {
  id: string;
  identifier: string | null;
  display_name: string | null;
  circuit_id: number | null;
  customer_id: string;
  customer_name: string | null;
  package_name: string | null;
  display_state: string;
  bucket: DashBucket;
  overlays: DashOverlay[];
  valid_until: string | null;
  created_at: string | null;
}

export interface DashList {
  tile: DashTile;
  items: DashListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  period: SubscriberDashboard["period"];
}
