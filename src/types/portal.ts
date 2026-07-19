export type PortalStatus = "draft" | "published" | "archived" | "scheduled";
export type PortalLoginMethod =
  | "mobile_otp"
  | "email_otp"
  | "voucher"
  | "pms"
  | "social"
  | "click_through";
export type PortalLanguage = "en" | "hi" | "ar" | "fr" | "es";

export const LANGUAGES: Record<PortalLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  ar: "العربية",
  fr: "Français",
  es: "Español",
};

export const LOGIN_METHOD_LABEL: Record<PortalLoginMethod, string> = {
  mobile_otp: "Mobile OTP",
  email_otp: "Email OTP",
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
  fontFamily: string;
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
