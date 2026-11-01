/** ADDENDUM_05 JAZE-1 (J1/J2/J11/J19): Subscriber 360, onboarding profile,
 * directory, plan sync. Mirrors `isp_partner/subscriber360_router.py`. */
import type {
  SubscriberCreate,
  SubscriberDetail,
  Subscriber,
} from "@/services/isp-partner/plans-types";
import type { InvoiceRow } from "@/services/isp-partner/invoices-types";

export const DISPLAY_STATES = [
  "active",
  "grace",
  "expired",
  "blocked",
  "permanently_blocked",
  "frozen",
  "suspended",
  "scheduled",
  "disabled",
] as const;
export type DisplayState = (typeof DISPLAY_STATES)[number];

export type UserType = "home" | "commercial" | "sme";
export type ConnectionType = "fiber" | "wireless" | "ethernet" | "other";
export type AfterDueAction = "suspend" | "keep_active" | "disconnect_once";

export interface SubscriberProfile {
  alt_email?: string | null;
  gender?: "male" | "female" | "other" | "undisclosed" | null;
  billing_city?: string | null;
  billing_pincode?: string | null;
  install_same_as_billing?: boolean;
  install_address?: string | null;
  install_area?: string | null;
  install_building?: string | null;
  install_city?: string | null;
  install_pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  installed_at?: string | null;
  user_type?: UserType;
  connection_type?: ConnectionType | null;
  ont_serial?: string | null;
  stb_serial?: string | null;
  override_price_paise?: number | null;
  billing_anchor_day?: number | null;
  after_due_action?: AfterDueAction;
  exclude_reminders?: boolean;
  activation_at?: string | null;
  comments?: string | null;
  /** Read only. */
  maps_url?: string | null;
}

export interface LiveSession {
  id: string;
  started_at: string | null;
  uptime_seconds: number | null;
  last_activity_at: string | null;
  ip_address: string | null;
  mac_address: string | null;
  router_name: string | null;
  location_name: string | null;
  bytes_uploaded: number;
  bytes_downloaded: number;
}

export interface TimelineEvent {
  id: string;
  kind: string;
  summary: string | null;
  detail: Record<string, unknown>;
  at: string;
  actor_name: string | null;
}

export interface Subscriber360 extends SubscriberDetail {
  display_state: DisplayState | string;
  profile: SubscriberProfile;
  hold: {
    block_kind: "temporary" | "permanent" | null;
    blocked_reason: string | null;
    blocked_at: string | null;
    frozen_at: string | null;
    frozen_remaining_seconds: number | null;
    grace_until: string | null;
  };
  online: boolean;
  live_sessions: LiveSession[];
  auth: { hotspot: boolean; pppoe: boolean; mac_bound: boolean | null; static_ip: string | null };
  billing: { due_paise: number; overdue_paise: number; status: "paid" | "unpaid" };
  can_revert: boolean;
  timeline: TimelineEvent[];
  welcome?: { whatsapp_share_url: string; text: string } | null;
}

export interface DirectoryRow extends Subscriber {
  display_state: DisplayState | string;
  user_type: UserType;
  override_price_paise: number | null;
}

export interface DirectoryPage {
  items: DirectoryRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  state_counts: Record<DisplayState, number>;
  package_counts: { package_id: string; name: string; total: number; active: number }[];
}

export interface DirectoryQuery {
  state?: DisplayState;
  search?: string;
  isp_customer_id?: string;
  package_id?: string;
  zone_id?: string;
  page?: number;
  page_size?: number;
}

export interface TypeaheadHit {
  id: string;
  circuit_id: number;
  identifier: string;
  name: string | null;
  phone: string | null;
  customer_name: string | null;
  status: string;
}

export interface SubscriberLedger {
  subscriber_id: string;
  billed_paise: number;
  paid_paise: number;
  due_paise: number;
  overdue_paise: number;
  status: "paid" | "unpaid";
  invoices: InvoiceRow[];
  payments: {
    id: string;
    receipt_number: string;
    amount_paise: number;
    mode: string;
    received_at: string;
    status?: string;
  }[];
}

export interface OnboardBody extends SubscriberCreate {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  state_code?: string | null;
  zone_id?: string | null;
  profile?: SubscriberProfile;
  welcome_whatsapp?: boolean;
}

export interface RenewBody {
  package_id?: string;
  paid_now?: boolean;
  payment?: { mode: string; reference?: string | null; received_at?: string | null } | null;
  idempotency_key?: string;
}

export interface PlanSyncBody {
  dry_run?: boolean;
  live_push?: boolean;
  kick_online?: boolean;
}

export interface PlanSyncResult {
  dry_run: boolean;
  subscribers: number;
  speed_group_changes: number;
  online_sessions: number;
  locations_with_online: number;
  live_pushed_sessions?: number;
  live_push_failed_locations?: number;
  sessions_kicked?: number;
}

export type NoteBody = {
  body: string;
  subject?: string | null;
  ticket_type?:
    | "slow_speed"
    | "no_connection"
    | "frequent_disconnection"
    | "billing"
    | "other"
    | null;
  source?: "phone" | "whatsapp" | "walk_in" | "email" | "field" | "other" | null;
  close_after_raising?: boolean;
};
