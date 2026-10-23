/**
 * Wire types for ADDENDUM_02 §8: speed groups, packages, coupon batches,
 * coupons and subscribers. Founder decisions: coupons are code-only (no PIN);
 * default validity 30 days.
 */

export interface SpeedBurst {
  download_kbps: number | null;
  upload_kbps: number | null;
  threshold_kbps: number | null;
  time_seconds: number | null;
}

export interface SpeedGroup {
  id: string;
  name: string;
  download_kbps: number;
  upload_kbps: number;
  burst: SpeedBurst | null;
  priority: number;
  status: "active" | "disabled" | string;
  notes?: string | null;
  packages: { id: string; name: string; validity_days: number; status: string }[];
  active_users: number;
  total_users: number;
  can_delete: boolean;
  created_at: string;
}

export interface SpeedGroupBody {
  name: string;
  download_kbps: number;
  upload_kbps: number;
  burst?: SpeedBurst | null;
  priority?: number;
  notes?: string | null;
}

export type PackageType = "prepaid" | "postpaid";

export interface IspPackage {
  id: string;
  name: string;
  speed_group: { id: string; name: string; download_kbps: number; upload_kbps: number };
  type: PackageType | string;
  validity_days: number;
  price_paise: number;
  price_includes_gst: boolean;
  data_cap_mb: number | null;
  max_devices: number;
  status: "active" | "disabled" | string;
  needs_price?: boolean;
  coupons: { unused: number; active: number; used_up: number; expired: number };
  subscribers: number;
  can_delete: boolean;
}

export interface PackageBody {
  speed_group_id: string;
  type: PackageType;
  validity_days: number;
  price_paise: number;
  price_includes_gst?: boolean;
  data_cap_mb?: number | null;
  max_devices?: number;
  name?: string | null;
}

export type PackagePatch = Partial<PackageBody>;

export interface LadderBody {
  speeds_mbps: number[];
  validities_days: number[];
  type: PackageType;
  upload_equals_download: boolean;
  /** Keys `"<mbps>:<days>"`. Missing prices are created disabled. */
  prices_paise: Record<string, number>;
}

export interface LadderResult {
  created_groups: number;
  created_packages: number;
  skipped: unknown[];
}

export interface PlanSettings {
  default_validity_days: number;
}

export type CouponLayout = "a4-24" | "a4-40" | "thermal-58mm";

export interface CouponBatchBody {
  package_id: string;
  isp_customer_id: string;
  isp_location_id?: string | null;
  quantity: number;
  code_length?: number;
  code_prefix?: string | null;
  shelf_life_days?: number;
}

export interface CouponBatch {
  id: string;
  package: { id: string; name: string } | null;
  package_id?: string;
  isp_customer_id: string;
  customer_name?: string | null;
  isp_location_id: string | null;
  location_name?: string | null;
  quantity: number;
  serial_prefix: string | null;
  shelf_life_until: string | null;
  status: "active" | "revoked" | "expired" | string;
  counts?: { unused: number; active: number; used_up: number; expired: number; revoked: number };
  created_at: string;
  /** 201 only: locations whose portal has coupon (voucher) login switched off. */
  coupon_login_disabled_at_locations?: { isp_location_id: string; name?: string }[] | string[];
}

export interface Coupon {
  id: string;
  serial: string;
  code: string;
  status: "unused" | "active" | "used_up" | "expired" | "revoked" | string;
  redeemed_by: string | null;
  activated_at: string | null;
  expires_at: string | null;
}

export interface Subscriber {
  id: string;
  isp_customer_id: string;
  customer_name?: string | null;
  identifier: string;
  display_name: string | null;
  package: { id: string; name: string } | null;
  speed_group: { id: string; name: string; download_kbps?: number; upload_kbps?: number } | null;
  valid_until: string | null;
  status: "active" | "expired" | "disabled" | string;
  source: "coupon" | "manual" | string;
  last_seen_at?: string | null;
  /** ADDENDUM_03 §5: immutable, unique per ISP. */
  circuit_id?: number | null;
  zone?: { id: string; name: string } | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface SubscriberDetail extends Subscriber {
  coupon_history?: {
    serial: string;
    package_name?: string;
    activated_at: string | null;
    expires_at: string | null;
  }[];
  recent_sessions?: {
    id: string;
    started_at: string;
    ended_at: string | null;
    location_name?: string | null;
    bytes_uploaded?: number;
    bytes_downloaded?: number;
  }[];
}

export interface SubscriberCreate {
  isp_customer_id: string;
  identifier: string;
  display_name?: string | null;
  package_id: string;
  valid_from?: string;
}

export interface SubscriberPatch {
  /** ADDENDUM_03 §12. */
  zone_id?: string | null;
  package_id?: string;
  valid_until?: string;
  display_name?: string | null;
}
