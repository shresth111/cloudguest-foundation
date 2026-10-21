/**
 * Wire types for the ISP partner API, typed straight from
 * `~/wyfy-ops/isp-network/API_CONTRACT.md` (§4 ISP endpoints, §5 TR-069).
 * Field names are the backend's own (snake_case): these are the response
 * bodies after `api.ts` has unwrapped the `{ success, data }` envelope.
 *
 * Owned by the FE lane. The Master page keeps its own `platform.ts`.
 */

/** Every non-keyset list (API_CONTRACT preamble). */
export interface IspPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type IspRoleSlug =
  | "isp-owner"
  | "isp-admin"
  | "isp-noc"
  | "isp-technician"
  | "isp-viewer"
  | "isp-billing";

export const ISP_ROLE_SLUGS: readonly IspRoleSlug[] = [
  "isp-owner",
  "isp-admin",
  "isp-noc",
  "isp-technician",
  "isp-viewer",
  "isp-billing",
];

// ---------------------------------------------------------------------------
// §4.1 Me
// ---------------------------------------------------------------------------

export interface IspMe {
  isp: {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | string;
    support_phone: string | null;
    timezone: string;
  };
  user: { id: string; name: string; email: string; role: IspRoleSlug | string };
  permissions: string[];
  /** null = every customer. */
  confined_customer_ids: string[] | null;
}

// ---------------------------------------------------------------------------
// §4.2 Overview
// ---------------------------------------------------------------------------

export type IspAttentionKind =
  | "router_offline"
  | "router_pending"
  | "cpe_silent"
  | "customer_suspend_pending";

export interface IspAttentionItem {
  kind: IspAttentionKind | string;
  isp_customer_id: string;
  customer_name: string;
  isp_location_id: string | null;
  isp_router_id: string | null;
  cpe_id: string | null;
  label: string;
  since: string;
}

export interface IspOverviewCustomerRow {
  isp_customer_id: string;
  name: string;
  status: string;
  locations: number;
  routers_online: number;
  routers_total: number;
  guests_today: number;
  bytes_today: number;
}

export interface IspOverview {
  customers: { total: number; active: number; suspended: number };
  locations: { total: number; active: number };
  routers: { total: number; online: number; offline: number; pending: number };
  guests: { today_unique: number; active_sessions: number };
  cpes: { total: number; online: number; offline: number; unassigned: number };
  attention: IspAttentionItem[];
  per_customer: IspOverviewCustomerRow[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// §4.3 Customers
// ---------------------------------------------------------------------------

export interface IspCustomer {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | string;
  legal_name: string | null;
  gstin: string | null;
  external_ref: string | null;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  address_line1: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  timezone: string;
  notes: string | null;
  counts: { locations: number; routers_total: number; routers_online: number; cpes: number };
  tr069_enabled: boolean;
  /** ADDENDUM_03 §4. */
  zone?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

/** POST body. `slug` optional; there is deliberately no login/admin field. */
export interface IspCustomerCreate {
  name: string;
  slug?: string | null;
  legal_name?: string | null;
  gstin?: string | null;
  external_ref?: string | null;
  contact_name?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  notes?: string | null;
}

/** PATCH body: everything optional, and `slug` is immutable. */
export type IspCustomerUpdate = Partial<Omit<IspCustomerCreate, "slug">> & {
  /** ADDENDUM_03 §4: edit only. */
  zone_id?: string | null;
};

export interface IspCustomerListQuery {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// §4.4 Locations
// ---------------------------------------------------------------------------

export interface IspLocation {
  id: string;
  isp_customer_id: string;
  customer_name: string;
  name: string;
  slug: string;
  location_code: string | null;
  status: "active" | "suspended" | string;
  property_type: string | null;
  address_line1: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  routers: { total: number; online: number };
  tr069_enabled: boolean;
  created_at: string;
}

export interface IspLocationCreate {
  name: string;
  slug?: string | null;
  property_type?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

export type IspLocationUpdate = Partial<IspLocationCreate>;

export interface IspLocationListQuery {
  isp_customer_id?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ---------------------------------------------------------------------------
// §4.5 Routers
// ---------------------------------------------------------------------------

export type IspRouterStatus =
  | "pending_provisioning"
  | "provisioning"
  | "online"
  | "offline"
  | "suspended"
  | "decommissioned";

export interface IspRouter {
  id: string;
  isp_customer_id: string;
  customer_name: string;
  isp_location_id: string;
  location_name: string;
  name: string;
  model: string;
  serial_number: string;
  mac_address: string;
  vendor: string;
  routeros_version: string | null;
  status: IspRouterStatus | string;
  cloud_link: "up" | "down" | "unknown" | string;
  last_seen_at: string | null;
  tr069: { enabled: boolean; cpe_id: string | null };
}

export interface IspRouterCreate {
  name: string;
  serial_number: string;
  mac_address: string;
  model: string;
  /** P1 accepts `mikrotik` only. */
  vendor: "mikrotik";
}

export interface IspRouterUpdate {
  name?: string;
  model?: string;
}

export interface IspRouterListQuery {
  isp_customer_id?: string;
  isp_location_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

/** `GET /isp/routers/{id}/as-router-device`: the existing `GET /routers/{id}`
 * response (`RouterResponse`) with the two names filled in. */
export interface IspRouterAsDevice {
  id: string;
  location_id: string;
  organization_id: string;
  organization_name?: string | null;
  location_name?: string | null;
  name: string;
  serial_number: string;
  mac_address: string;
  model: string;
  vendor: string;
  routeros_version: string | null;
  management_ip_address: string | null;
  public_ip_address: string | null;
  status: string;
  last_seen_at: string | null;
  last_health_check_at: string | null;
  health_status: "healthy" | "unhealthy" | null;
  has_api_credentials: boolean;
  controller_state?: string | null;
  controller_state_reason?: string | null;
  controller_last_contacted_at?: string | null;
  vendor_claim_is_contradicted?: boolean | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// §4.7 Captive portal: the existing CaptivePortalConfig schemas
// ---------------------------------------------------------------------------

export interface CaptivePortalConfig {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  is_active: boolean;
  is_default: boolean;
  theme: string;
  logo_url: string | null;
  background_image_url: string | null;
  primary_color: string;
  secondary_color: string;
  default_language: string;
  supported_languages: string[];
  terms_and_conditions_text: string | null;
  terms_and_conditions_url: string | null;
  privacy_policy_text: string | null;
  privacy_policy_url: string | null;
  splash_headline: string | null;
  splash_welcome_message: string | null;
  redirect_url: string | null;
  collect_guest_name: boolean;
  collect_guest_email: boolean;
  require_guest_name: boolean;
  otp_sms_enabled: boolean;
  otp_email_enabled: boolean;
  otp_whatsapp_enabled: boolean;
  voucher_enabled: boolean;
  username_password_enabled: boolean;
  pin_login_enabled: boolean;
  social_login_enabled: boolean;
  powered_by_enabled: boolean;
  created_at: string;
  updated_at: string;
  /** The response carries ~30 more fields this editor never writes. */
  [key: string]: unknown;
}

/** `CaptivePortalConfigListResponse` (its own pagination shape). */
export interface CaptivePortalConfigList {
  items: CaptivePortalConfig[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

/** The subset of `CaptivePortalConfigUpdateRequest` this editor sends. */
export interface CaptivePortalConfigUpdate {
  theme?: string;
  logo_url?: string | null;
  background_image_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  splash_headline?: string | null;
  splash_welcome_message?: string | null;
  terms_and_conditions_text?: string | null;
  terms_and_conditions_url?: string | null;
  privacy_policy_url?: string | null;
  redirect_url?: string | null;
  collect_guest_name?: boolean;
  collect_guest_email?: boolean;
  otp_sms_enabled?: boolean;
  otp_email_enabled?: boolean;
  otp_whatsapp_enabled?: boolean;
  voucher_enabled?: boolean;
  username_password_enabled?: boolean;
  pin_login_enabled?: boolean;
}

// ---------------------------------------------------------------------------
// §4.8 Guests and sessions
// ---------------------------------------------------------------------------

export interface IspGuest {
  id: string;
  display_name: string | null;
  phone_masked: string | null;
  email_masked: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  session_count: number;
  isp_location_id: string | null;
}

export interface IspSession {
  id: string;
  guest_display_name: string | null;
  isp_location_id: string | null;
  location_name: string | null;
  auth_method: string | null;
  status: "active" | "ended" | string;
  started_at: string;
  ended_at: string | null;
  ip_address: string | null;
  bytes_uploaded: number;
  bytes_downloaded: number;
}

export interface IspGuestQuery {
  isp_location_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface IspSessionQuery {
  isp_location_id?: string;
  status?: "active" | "ended";
  since?: string;
  until?: string;
  page?: number;
  page_size?: number;
}

// ---------------------------------------------------------------------------
// §4.9 Logs
// ---------------------------------------------------------------------------

/** Shared filters on every log endpoint. */
export interface IspLogScope {
  isp_customer_id?: string;
  isp_location_id?: string;
  isp_router_id?: string;
  since?: string;
  until?: string;
}

export interface IspNetLogEvent {
  id: number;
  received_at: string;
  device_time: string | null;
  location_id: string | null;
  location_name: string | null;
  router_id: string | null;
  router_name: string | null;
  hostname: string | null;
  source: string;
  category: string;
  protocol: string | null;
  src_ip: string | null;
  dst_ip: string | null;
  status: string | null;
  device_mac: string | null;
  severity: number | null;
  severity_name: string | null;
  summary: string | null;
  message: string;
  isp_customer_id: string;
  customer_name: string;
}

export interface IspNetLogPage {
  feature_enabled: boolean;
  items: IspNetLogEvent[];
  next_cursor: string | null;
  since: string;
  until: string;
}

export interface IspNetLogSummary {
  feature_enabled: boolean;
  since: string;
  until: string;
  timezone: string;
  totals: { events: number; errors: number; warnings: number };
  by_day: { day: string; total: number; errors: number; warnings: number }[];
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_customer: {
    isp_customer_id: string;
    customer_name: string;
    total: number;
    errors: number;
    warnings: number;
  }[];
}

/** One IPDR row: the existing `/ipdr/connections` item (masked on screen). */
export interface IspIpdrItem {
  time_stamp_ist: string;
  name: string;
  contact_no: string;
  alternate_contact_no: string;
  email: string;
  user_id: string;
  source_ip: string;
  source_port: string;
  translated_ip: string;
  translated_port: string;
  allocation: string;
  destination_ip: string;
  destination_port: string;
  protocol: string;
  allocation_start_ist: string;
  allocation_end_ist: string;
  total_online_time: string;
  mac: string;
  ts: string;
  location_id: string | null;
  router_id: string | null;
  [key: string]: unknown;
}

export interface IspIpdrPage {
  since: string;
  until: string;
  items: IspIpdrItem[];
  next_cursor: string | null;
  coverage: { day: string; status: string; live: number; archived: number }[];
}

/** `GuestLoginHistoryLogListResponse` item plus the two customer fields. */
export interface IspAuthLog {
  id: string;
  guest_id: string | null;
  organization_id: string | null;
  location_id: string | null;
  /** Masked by the backend. */
  identifier: string | null;
  auth_method: string;
  success: boolean;
  failure_reason: string | null;
  attempted_at: string;
  ip_address: string | null;
  isp_customer_id: string;
  customer_name: string;
}

export interface IspAuthLogPage {
  items: IspAuthLog[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// ---------------------------------------------------------------------------
// §4.10 Reports
// ---------------------------------------------------------------------------

export interface IspReportSummary {
  since: string;
  until: string;
  timezone: string;
  portfolio: {
    customers: { active: number; suspended: number };
    locations: { active: number; suspended: number };
    routers: { online: number; offline: number; pending: number };
    router_availability: {
      isp_router_id: string;
      name: string;
      customer_name: string;
      /** null = not measured. Never render as 0 %. */
      availability_percentage: number | null;
    }[];
  };
  guest_activity: {
    logins: number;
    unique_guests: number;
    avg_session_minutes: number | null;
    by_day: { day: string; logins: number; unique_guests: number; bytes: number }[];
  };
  usage_by_customer: {
    isp_customer_id: string;
    name: string;
    logins: number;
    unique_guests: number;
    bytes_up: number;
    bytes_down: number;
    bytes_total: number;
  }[];
  top_customers: { isp_customer_id: string; name: string; bytes_total: number }[];
  tr069: {
    total: number;
    online: number;
    offline: number;
    unassigned: number;
    by_model: {
      manufacturer: string | null;
      model: string | null;
      software_version: string | null;
      count: number;
      online: number;
    }[];
  };
}

export type IspReportSection =
  | "portfolio"
  | "guest_activity"
  | "usage_by_customer"
  | "tr069"
  | "all";

export interface IspReportQuery {
  since: string;
  until: string;
  isp_customer_id?: string;
}

// ---------------------------------------------------------------------------
// §4.11 ISP staff users
// ---------------------------------------------------------------------------

export interface IspUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  username: string;
  role: IspRoleSlug | string;
  status: "active" | "disabled" | string;
  customer_scope: { isp_customer_id: string; name: string }[] | null;
  last_login_at: string | null;
  created_at: string;
}

export interface IspUserCreate {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: IspRoleSlug;
  customer_ids: string[] | null;
  send_welcome_email: boolean;
}

export interface IspUserUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role?: IspRoleSlug;
}

export interface IspUserCreated {
  user: IspUser;
  temporary_password: string;
}

export interface IspRole {
  slug: IspRoleSlug | string;
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface IspUserListQuery {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// §5 TR-069
// ---------------------------------------------------------------------------

export interface Tr069AcsCredential {
  acs_url: string;
  username: string;
  /** null when disabled, or when the caller lacks tr069.manage. */
  password: string | null;
  enabled: boolean;
  periodic_inform_interval_s_recommended: number;
  notes: string | null;
}

export interface Tr069CustomerState extends Tr069AcsCredential {
  isp_customer_id: string;
}

export interface Tr069LocationSettings {
  enabled: boolean;
  periodic_inform_interval_s: number;
}

export interface Tr069Device {
  id: string;
  genieacs_device_id: string;
  label: string | null;
  isp_customer_id: string | null;
  customer_name: string | null;
  isp_location_id: string | null;
  location_name: string | null;
  isp_router_id: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  software_version: string | null;
  data_model: "tr098" | "tr181" | string | null;
  wan_ip: string | null;
  online: boolean;
  last_inform_at: string | null;
  first_seen_at: string;
  management_enabled: boolean;
}

export interface Tr069DeviceDetail extends Tr069Device {
  params: {
    uptime_s: number | null;
    wan_ip: string | null;
    wan_connection_type: "dhcp" | "pppoe" | "static" | string | null;
    pppoe_username: string | null;
    wifi: {
      index: number;
      ssid: string | null;
      band: string | null;
      enabled: boolean | null;
      clients: number | null;
    }[];
    lan_hosts: number | null;
    hardware_version: string | null;
    software_version: string | null;
  };
  params_refreshed_at: string | null;
  last_task: { kind: string; status: string; created_at: string } | null;
}

export interface Tr069DeviceQuery {
  isp_customer_id?: string;
  assigned?: boolean;
  online?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface Tr069DeviceUpdate {
  isp_customer_id?: string | null;
  isp_location_id?: string | null;
  label?: string | null;
}

export interface Tr069TaskQueued {
  task_id: string;
  kind: "refresh_params" | "reboot" | string;
  status: "queued" | "done" | string;
  message: string;
}

export interface Tr069Task {
  id: string;
  kind: string;
  status: "queued" | "done" | "fault" | "expired" | string;
  created_at: string;
  completed_at: string | null;
  fault?: unknown;
  requested_by?: string | null;
}
