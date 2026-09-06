import {
  RUNTIME_LANGUAGE_LABEL,
  type GuestFontChoice,
  type PortalContentMode,
  type PortalSurvey,
  type RuntimeLanguage,
} from "@/types/portal-runtime";

export type PortalStatus = "draft" | "published" | "archived" | "scheduled";
export type PortalLoginMethod =
  | "mobile_otp"
  | "email_otp"
  | "whatsapp_otp"
  | "voucher"
  | "pms"
  | "social"
  | "click_through";
/** Aliased to `RuntimeLanguage` rather than restated. These were two
 * independent unions listing the identical five codes, and the admin model
 * (`Portal.languages`) feeds the guest runtime directly -- so a code that is
 * selectable here but unknown there is always a bug, and an alias makes that
 * impossible to introduce. */
export type PortalLanguage = RuntimeLanguage;

/** Re-exported, not re-declared -- see `RUNTIME_LANGUAGE_LABEL`'s own comment
 * for why the guest switcher and this admin picker now share one map. */
export const LANGUAGES: Record<PortalLanguage, string> = RUNTIME_LANGUAGE_LABEL;

export const LOGIN_METHOD_LABEL: Record<PortalLoginMethod, string> = {
  mobile_otp: "Mobile OTP",
  email_otp: "Email OTP",
  whatsapp_otp: "WhatsApp OTP",
  voucher: "Voucher",
  pms: "PMS",
  social: "Social",
  click_through: "Click-through",
};

export type PortalComponentType =
  | "logo"
  | "heading"
  | "text"
  | "image"
  | "video"
  | "button"
  | "divider"
  | "form"
  | "login_card"
  | "otp_input"
  | "voucher_input"
  | "pms_login"
  | "social_login"
  | "qr_code"
  | "ad_banner"
  | "footer"
  | "contact"
  | "map"
  | "html_block";

export interface PortalComponent {
  id: string;
  type: PortalComponentType;
  props: Record<string, string | number | boolean>;
}

export interface PortalBranding {
  logoUrl?: string;
  backgroundUrl?: string;
  backgroundType: "color" | "image" | "gradient" | "video";
  gradientFrom: string;
  gradientTo: string;
  primaryColor: string;
  secondaryColor: string;
  /** Free-text, cosmetic-only theme-catalog label (THEMES in
   * portal.service.ts) -- never round-tripped to any real backend field.
   * Not to be confused with `fontChoice` below, which is. */
  fontFamily: string;
  /** captive-portal-v6-design-spec.md §3 -- the real, backend-round-tripped
   * heading-only font choice (`RuntimePortalConfig.guestFontChoice`'s admin-
   * editable counterpart). Default `"system"`. See
   * `src/lib/portal-guest-fonts.ts` for the curated allowlist's real specs. */
  fontChoice: GuestFontChoice;
  /** captive-portal-v6-design-spec.md §4 -- the real, backend-round-tripped
   * background-overlay-strength admin control. 0-100, default 55. */
  backgroundOverlayStrength: number;
  borderRadius: number;
  shadow: "none" | "sm" | "md" | "lg";
  buttonStyle: "solid" | "outline" | "ghost";
  cardStyle: "flat" | "elevated" | "glass";
  animations: boolean;
}

export interface PortalLoginSettings {
  sessionTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  deviceLimit: number;
  redirectUrl: string;
  /** Venue-authored HTML for the post-login page (`post_login_html`), or ""
   * for none -- the editing-shape counterpart of
   * `RuntimePortalConfig.postLoginHtml`. Empty string rather than `null`,
   * matching every other free-text field in this group, so a controlled
   * `<textarea>` binds to it directly; `portal.service.ts` maps ""/whitespace
   * back to a real SQL `NULL` on write.
   *
   * Sits on `login` next to `redirectUrl` because these two are the same
   * decision -- what happens after a successful sign-in -- and a venue can
   * set either, both, or neither. */
  postLoginHtml: string;
  successPage: string;
  failurePage: string;
  autoLogin: boolean;
  rememberDevice: boolean;
}

export interface PortalConsent {
  termsRequired: boolean;
  privacyRequired: boolean;
  marketingConsent: boolean;
  gdprConsent: boolean;
  termsUrl: string;
  privacyUrl: string;
}

export interface PortalSeo {
  pageTitle: string;
  metaDescription: string;
  faviconUrl?: string;
  socialImageUrl?: string;
}

export interface PortalAd {
  id: string;
  name: string;
  type: "banner" | "video";
  mediaUrl: string;
  clickUrl: string;
  startsAt: string;
  endsAt: string;
  impressions: number;
  clicks: number;
  active: boolean;
}

export interface PortalVersion {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  createdBy: string;
  status: PortalStatus;
  notes?: string;
}

/** The captive portal's content mode + its per-mode source fields -- mirrors
 * the backend `content_*` columns (see `constants.PortalContentMode`). The
 * guest-facing runtime shape lives in `types/portal-runtime.ts`
 * (`RuntimePortalConfig`); this is the dashboard-facing editing shape. */
export interface PortalContent {
  mode: PortalContentMode;
  /** Heading shown above image/text/survey content (empty string = none). */
  heading: string;
  /** Body copy for `mode === "text"` (empty string = none). */
  body: string;
  /** Foreground content image for `mode === "image"` (empty string = none).
   * The redirect destination for `mode === "redirect"` reuses
   * `login.redirectUrl`, not a field here. */
  imageUrl: string;
  /** Survey definition for `mode === "survey"`, or null. */
  survey: PortalSurvey | null;
}

export interface Portal {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  organizationName: string;
  locationId: string;
  locationName: string;
  status: PortalStatus;
  themeId: string;
  themeName: string;
  loginMethods: PortalLoginMethod[];
  primaryLoginMethod: PortalLoginMethod;
  languages: PortalLanguage[];
  defaultLanguage: PortalLanguage;
  branding: PortalBranding;
  login: PortalLoginSettings;
  consent: PortalConsent;
  content: PortalContent;
  postConnect: PortalPostConnect;
  seo: PortalSeo;
  ads: PortalAd[];
  components: PortalComponent[];
  versions: PortalVersion[];
  currentVersion: number;
  lastPublishedAt?: string;
  publishedBy?: string;
  updatedAt: string;
  createdAt: string;
  views: number;
  logins: number;
}

/**
 * The "After they connect" settings -- everything a venue asks a guest for
 * on `/portal/session`, AFTER the RADIUS session is authorised.
 *
 * Deliberately its own section rather than more fields on `login`. `login`
 * is the sign-in screen; none of this can affect whether a guest gets
 * online, and keeping the boundary in the data model is what stops someone
 * quietly dragging the email field back onto the sign-in card. The section
 * boundary is a design guardrail, not tidiness.
 */
export interface PortalPostConnect {
  /** Both default OFF for every venue, existing ones included. The venue is
   * the Data Fiduciary under DPDP; a migration that switched on collection
   * of personal data on their behalf would make a decision that is not ours
   * to make. */
  collectGuestName: boolean;
  collectGuestEmail: boolean;
  /** The venue's own Google review link, pasted verbatim from Business
   * Profile → Read reviews → Get more reviews (backend `review_url`).
   * "" means the review card never renders. Never synthesised from a
   * place id. */
  reviewUrl: string;
  /** Whether the venue currently wants the card shown (backend
   * `review_card_enabled`). Separate from the link on purpose: pausing the
   * ask must not cost a venue the URL they would then have to go and find
   * again. The card needs both. */
  reviewCardEnabled: boolean;
  /** Private 1-5 star feedback, shown at least `feedbackDwellMinutes` into
   * a visit and never in a session where the Google card appeared. */
  guestFeedbackEnabled: boolean;
  feedbackDwellMinutes: number;
}

export interface PortalTheme {
  id: string;
  name: string;
  category:
    | "hotel"
    | "luxury_hotel"
    | "cafe"
    | "restaurant"
    | "hospital"
    | "university"
    | "corporate"
    | "airport"
    | "retail";
  description: string;
  preview: {
    from: string;
    to: string;
    accent: string;
  };
  branding: PortalBranding;
  components: PortalComponent[];
}

export interface PortalKpis {
  totalPortals: number;
  publishedPortals: number;
  draftPortals: number;
  activeLocations: number;
  activeThemes: number;
  todaysLogins: number;
  conversionRate: number;
  portalViews: number;
}

export interface PortalListQuery {
  search?: string;
  status?: PortalStatus;
  organizationId?: string;
  loginMethod?: PortalLoginMethod;
  page: number;
  pageSize: number;
  sort: { key: keyof Portal; dir: "asc" | "desc" };
}

export interface PortalListResult {
  items: Portal[];
  total: number;
}

export interface PortalAnalyticsPoint {
  date: string;
  views: number;
  logins: number;
  failed: number;
}

export interface PortalAnalyticsData {
  trend: PortalAnalyticsPoint[];
  bounceRate: number;
  avgTimeSeconds: number;
  conversionRate: number;
  methodBreakdown: Array<{ method: PortalLoginMethod; value: number }>;
}
