export type RuntimeAuthMethod =
  | "mobile_otp"
  | "email_otp"
  | "voucher"
  | "pms"
  | "social"
  | "qr"
  | "click_through";

export type RuntimeLanguage = "en" | "hi" | "ar" | "fr" | "es";

export interface RuntimeBrand {
  brandId: string;
  companyName: string;
  venueName: string;
  wifiSsid: string;
  logoText: string;
  welcomeTitle: string;
  welcomeMessage: string;
  termsSummary: string;
  primaryColor: string;
  accentColor: string;
  backgroundFrom: string;
  backgroundTo: string;
  fontFamily: string;
  radius: number;
  heroImage: string;
  supportEmail: string;
  supportPhone: string;
}

export interface RuntimePortalConfig {
  brand: RuntimeBrand;
  enabledMethods: RuntimeAuthMethod[];
  defaultLanguage: RuntimeLanguage;
  languages: RuntimeLanguage[];
  sessionMinutes: number;
  dataLimitMb: number;
  adEnabled: boolean;
  adSkipSeconds: number;
  redirectUrl: string;
  redirectDelaySeconds: number;
  requireTerms: boolean;
  socialProviders: Array<"google" | "facebook" | "apple" | "microsoft">;
}

export interface RuntimeSession {
  sessionId: string;
  startedAt: number;
  expiresAt: number;
  device: string;
  ipAddress: string;
  macAddress: string;
  bytesUsed: number;
  bytesLimit: number;
}

export interface RuntimeAdSlot {
  id: string;
  title: string;
  description: string;
  cta: string;
  ctaUrl: string;
  imageColor: string;
}
