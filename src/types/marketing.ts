/**
 * Guest Marketing (the paid "Marketing" add-on) -- wire types.
 *
 * These are the backend's shapes verbatim, snake_case included, from
 * wyfy-specs/guest-marketing-campaigns.md §5 (the contract the backend
 * builds against). They are deliberately NOT remapped to camelCase: every
 * field here is read straight off a response, and a hand-written mapping
 * layer is one more place for the two sides to drift apart silently. The
 * service returns exactly what the backend sent.
 */

export type MarketingChannel = "sms" | "whatsapp" | "email";
export const MARKETING_CHANNELS: readonly MarketingChannel[] = ["sms", "whatsapp", "email"];

export type ChannelMode = "live" | "logging" | "unconfigured";

export interface ChannelStatus {
  channel: MarketingChannel;
  /** True only for a real provider with complete credentials. A "logging"
   * provider is NOT configured (spec D8): it logs and returns success. */
  configured: boolean;
  provider: string | null;
  mode: ChannelMode;
  reason: string | null;
  requires_dlt_template_id?: boolean;
  custom_templates_supported?: boolean;
  // §12.4 (BYO providers), all optional: absent on a backend without BE-11.
  /** The §12.1 resolution right now. */
  provider_source?: ProviderSource;
  /** "Wyfy default" | "Your Ping4SMS (CAFEXY)". */
  provider_display_name?: string;
  /** The org's own row for this channel, if any (null = none). */
  own_provider_status?: ProviderStatus | null;
  byo_entitled?: boolean;
}

export interface PortalConsentState {
  enabled: boolean;
  text: string | null;
  text_version: string | null;
}

export interface MarketingStatus {
  channels: ChannelStatus[];
  portal_consent: PortalConsentState;
  consent_counts: Record<MarketingChannel, number>;
  quiet_hours: {
    start: string;
    end: string;
    timezone: string;
    applies_to: MarketingChannel[];
  };
  limits: { max_recipients_per_campaign: number; test_sends_per_day: number };
  /** Characters the SMS counter budgets for {{unsubscribe_link}}
   * (contract change 2026-09-25). */
  sms_unsubscribe_link_budget?: number;
}

export interface PortalConsentUpdate {
  location_id: string;
  enabled: boolean;
  text?: string | null;
}

export interface PortalConsentResult {
  location_id: string;
  enabled: boolean;
  text: string | null;
  text_version: string | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// ── Contacts / audience ────────────────────────────────────────────────

export type ConsentStatus = "opted_in" | "opted_out" | "none";

export interface MarketingContact {
  guest_id: string;
  display_name: string | null;
  /** Null when the guest has no address for the channel, or after the
   * 180-day retention prune (backend deviation #8). */
  masked_address: string | null;
  consent_status: ConsentStatus;
  consent_source: string | null;
  consent_changed_at: string | null;
  last_seen_at: string | null;
  total_visit_count: number;
}

export interface ContactListQuery {
  channel: MarketingChannel;
  consent_status?: ConsentStatus;
  location_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface OptOutResult {
  guest_id: string;
  channels: Partial<Record<MarketingChannel, ConsentStatus>>;
}

export interface AudienceFilter {
  channel: MarketingChannel;
  location_ids?: string[] | null;
  visited_from?: string | null;
  visited_to?: string | null;
  min_visits?: number | null;
  max_visits?: number | null;
  not_seen_for_days?: number | null;
  require_name?: boolean;
}

export interface AudienceSampleGuest {
  guest_id: string;
  display_name: string | null;
  /** Null when the guest has no address for the channel, or after the
   * 180-day retention prune (backend deviation #8). */
  masked_address: string | null;
  last_seen_at: string | null;
  total_visit_count: number;
}

export interface AudiencePreview {
  channel: MarketingChannel;
  matched_guests: number;
  reachable: number;
  excluded: {
    no_consent: number;
    opted_out: number;
    suppressed: number;
    no_address: number;
    invalid_address: number;
    blocked: number;
  };
  capped: boolean;
  sample: AudienceSampleGuest[];
}

// ── Templates ──────────────────────────────────────────────────────────

export const TEMPLATE_VARIABLES = [
  "guest_name",
  "venue_name",
  "location_name",
  "offer_code",
  "offer_expiry",
  "event_name",
  "event_date",
  "booking_link",
  "review_link",
  "unsubscribe_link",
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** The subset a campaign supplies values for (spec §5.0 "Variable
 * resolution"); the rest are resolved per guest / per venue by the server. */
export const CAMPAIGN_VARIABLES = [
  "offer_code",
  "offer_expiry",
  "event_name",
  "event_date",
  "booking_link",
] as const;
export type CampaignVariable = (typeof CAMPAIGN_VARIABLES)[number];

export const TEMPLATE_CATEGORIES = [
  "welcome",
  "offer",
  "feedback",
  "festival",
  "loyalty",
  "event",
  "winback",
  "announcement",
  "birthday",
  "custom",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export type SendableReason =
  | "channel_not_configured"
  | "channel_missing_in_template"
  | "dlt_template_id_missing"
  | "whatsapp_not_approved"
  | "unsubscribe_link_missing"
  | "review_link_missing";

export interface TemplateSms {
  body: string;
  dlt_template_id: string | null;
  length: number;
  encoding: "gsm7" | "ucs2";
  segments: number;
}

export interface TemplateWhatsapp {
  body: string;
  content_sid: string | null;
  variable_order: string[];
  approval_status: "not_submitted" | "pending" | "approved" | "rejected";
  /** §12.4: "own_waba" for templates synced from the venue's WABA. */
  source?: "wyfy" | "own_waba";
  provider_template_name?: string | null;
  provider_language?: string | null;
}

export interface TemplateEmail {
  subject: string;
  preheader: string | null;
  body_html: string;
}

export interface MarketingTemplate {
  id: string;
  is_system: boolean;
  system_key: string | null;
  name: string;
  category: TemplateCategory | string;
  description: string | null;
  sms: TemplateSms | null;
  whatsapp: TemplateWhatsapp | null;
  email: TemplateEmail | null;
  variables: string[];
  sendable: Record<MarketingChannel, { ok: boolean; reason: SendableReason | string | null }>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateListQuery {
  channel?: MarketingChannel;
  category?: string;
  include_system?: boolean;
  page?: number;
  page_size?: number;
}

export interface TemplateWritePayload {
  name: string;
  category: string;
  description?: string | null;
  sms?: { body: string; dlt_template_id?: string | null } | null;
  /** MVP: must be null for a custom template (whatsapp_custom_not_supported). */
  whatsapp?: null;
  email?: { subject: string; preheader?: string | null; body_html: string } | null;
}

export type TemplatePatchPayload = Partial<TemplateWritePayload> & { version: number };

export interface TemplatePreviewRequest {
  channel: MarketingChannel;
  template_id?: string | null;
  content?: {
    sms?: { body: string; dlt_template_id?: string | null };
    email?: { subject: string; preheader?: string | null; body_html: string };
  } | null;
  variables?: Partial<Record<CampaignVariable, string>>;
  location_id?: string | null;
}

export interface TemplatePreview {
  channel: MarketingChannel;
  rendered: { body: string; subject: string | null };
  sms: { length: number; encoding: "gsm7" | "ucs2"; segments: number } | null;
  missing_variables: string[];
}

// ── Campaigns ──────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
export const CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

export interface CampaignStats {
  recipients: number;
  pending: number;
  submitted: number;
  delivered: number;
  failed: number;
  skipped: number;
  /** False = the provider gives no delivery receipts; never show a Delivered %. */
  delivered_is_tracked: boolean;
  /** Who the dispatcher left out, frozen when the campaign started; null
   * until dispatched (contract change 2026-09-25, additive). Optional so a
   * backend that predates the change still type-checks as "not reported". */
  excluded_at_dispatch?: AudiencePreview["excluded"] | null;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: MarketingChannel;
  location_id: string | null;
  template: { id: string; name: string; is_system: boolean };
  variables: Partial<Record<CampaignVariable, string>>;
  audience_filter: AudienceFilter;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  paused_until: string | null;
  stats: CampaignStats;
  created_by: { id: string; name: string } | null;
  version: number;
  created_at: string;
  updated_at: string;
  /** Detail endpoint only. */
  last_error?: string | null;
  /** §12.4: set from the schedule-time snapshot; null for drafts. */
  provider?: CampaignProvider | null;
}

export interface CampaignListQuery {
  status?: CampaignStatus[];
  /** Contract change 2026-09-25 (venue filter): matches a campaign whose
   * `location_id` is this venue OR whose audience `location_ids` contains
   * it. All-venues campaigns are not matched. */
  location_id?: string;
  channel?: MarketingChannel;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface CampaignCreatePayload {
  name: string;
  channel: MarketingChannel;
  template_id: string;
  location_id: string | null;
  variables: Partial<Record<CampaignVariable, string>>;
  audience_filter: AudienceFilter;
}

export type CampaignPatchPayload = Partial<CampaignCreatePayload> & { version: number };

export interface TestSendResult {
  results: {
    to_masked: string;
    status: "submitted" | "failed";
    provider_message_id: string | null;
    error_code: string | null;
  }[];
}

// ── Delivery logs ──────────────────────────────────────────────────────

export type RecipientStatus =
  | "pending"
  | "sending"
  | "submitted"
  | "delivered"
  | "failed"
  | "skipped";
export const RECIPIENT_STATUSES: readonly RecipientStatus[] = [
  "pending",
  "sending",
  "submitted",
  "delivered",
  "failed",
  "skipped",
];

export interface CampaignRecipient {
  id: string;
  /** §12.4: which pipe carried it. */
  provider_source?: ProviderSource | null;
  guest_id: string | null;
  display_name: string | null;
  /** Null when the guest has no address for the channel, or after the
   * 180-day retention prune (backend deviation #8). */
  masked_address: string | null;
  status: RecipientStatus;
  skip_reason: string | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  submitted_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  /** Attributed venue (contract change 2026-09-25): the venue of the
   * guest's most recent visit among the audience venues, fixed at dispatch.
   * Optional so an older backend still type-checks. */
  location_id?: string | null;
  location_name?: string | null;
}

export interface DeliveryLogEntry extends CampaignRecipient {
  campaign: { id: string; name: string };
  channel: MarketingChannel;
}

export interface RecipientListQuery {
  status?: RecipientStatus[];
  page?: number;
  page_size?: number;
}

export interface DeliveryListQuery {
  /** Contract change 2026-09-25: the row's attributed venue. */
  location_id?: string;
  channel?: MarketingChannel;
  status?: RecipientStatus[];
  campaign_id?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

// ── Entitlements (GET /me/entitlements) ────────────────────────────────

export const GUEST_MARKETING_FEATURE_KEY = "guest_marketing";

// ── Master add-on control (§5.9) ───────────────────────────────────────

export interface OrganizationAddon {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  source: "plan" | "override";
  plan_value: boolean;
  override: {
    is_enabled: boolean;
    reason: string | null;
    /** `name` can be null (a deleted or nameless user). */
    set_by: { id: string; name: string | null } | null;
    set_at: string;
  } | null;
  active_campaign_count: number;
  /** §12.3: BYO is only effective with Guest Marketing; set when it is the
   * reason this add-on reads disabled. */
  blocked_by?: string | null;
}

export interface OrganizationAddons {
  organization_id: string;
  addons: OrganizationAddon[];
}

export interface AddonWriteResult {
  addon: OrganizationAddon;
  cancelled_campaign_count: number;
}

// ── §12 Channel providers (bring-your-own) ─────────────────────────────

export type ProviderSource = "wyfy" | "own";
export type ProviderStatus = "unverified" | "verified" | "failed";
export type ProviderType = "ping4sms" | "exotel" | "smtp" | "ses" | "meta_cloud";

export const GUEST_MARKETING_BYO_FEATURE_KEY = "guest_marketing_byo";

export interface CampaignProvider {
  source: ProviderSource;
  type: ProviderType | string | null;
  display_name: string;
}

/** A secret field as the server shows it: whether it is set, and the last 4
 * characters ("…" for short secrets). The value itself is never returned. */
export interface SecretHint {
  set: boolean;
  hint: string | null;
}

export interface ProviderView {
  channel: MarketingChannel;
  provider_type: ProviderType | string;
  enabled: boolean;
  status: ProviderStatus;
  last_verified_at: string | null;
  last_error: string | null;
  /** True iff this row is what §12.1 resolves to right now. */
  effective: boolean;
  /** Non-secret fields verbatim, secret fields as {set, hint}. */
  display: Record<string, string | number | boolean | null | SecretHint>;
  updated_at: string;
  updated_by: { id: string; name: string | null } | null;
}

export interface ChannelProviders {
  channel: MarketingChannel;
  effective_source: ProviderSource;
  own: ProviderView | null;
}

export interface ProvidersResponse {
  channels: ChannelProviders[];
}

export interface ProviderPutPayload {
  provider_type: ProviderType;
  /** Partial on update: an omitted secret keeps the stored one. */
  config: Record<string, string | number | boolean>;
  enabled?: boolean | null;
}

export interface ProviderVerifyPayload {
  test_to: string | null;
  template_id: string | null;
}

export interface ProviderVerifyResult {
  provider: ProviderView;
  checks: { name: string; ok: boolean; detail: string }[];
}

export interface ProviderDeleteResult {
  channel: MarketingChannel;
  effective_source: ProviderSource;
  affected_campaign_count: number;
}

/** Master's read-only view (§12.4): no hints, no secrets. */
export interface PlatformProviders {
  channels: {
    channel: MarketingChannel;
    effective_source: ProviderSource;
    own: {
      provider_type: string;
      enabled: boolean;
      status: ProviderStatus;
      last_verified_at: string | null;
      last_error: string | null;
      sender_label: string | null;
    } | null;
  }[];
}
