export type BrandStatus = "draft" | "published" | "archived";
export type DomainStatus = "pending" | "verifying" | "active" | "failed";
export type Language = "en" | "hi" | "ar" | "fr" | "es";
export type TemplateCategory = "hotel" | "cafe" | "restaurant" | "hospital" | "university" | "corporate" | "airport" | "retail";

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  sidebar: string;
  navbar: string;
  buttonBg: string;
  buttonText: string;
  cardBg: string;
  cardBorder: string;
}

export interface Typography {
  fontFamily: string;
  fontSize: number;
  headingWeight: number;
  buttonWeight: number;
  borderRadius: number;
  cardRadius: number;
  shadow: "none" | "sm" | "md" | "lg" | "xl";
}

export interface BrandLogos {
  company: string;
  favicon: string;
  login: string;
  dashboard: string;
  mobile: string;
  footer: string;
  watermark: string;
}

export interface LoginBranding {
  background: string;
  banner: string;
  illustration: string;
  heading: string;
  description: string;
  footer: string;
}

export interface EmailBranding {
  header: string;
  footer: string;
  companyLogo: string;
  companyAddress: string;
  socials: { twitter?: string; linkedin?: string; facebook?: string; instagram?: string };
}

export interface EmailTemplate {
  id: string;
  key: "welcome" | "otp" | "password_reset" | "invoice" | "subscription_expiry";
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
}

export interface SmsBranding {
  senderName: string;
  footer: string;
}

export interface SmsTemplate {
  id: string;
  key: "otp" | "welcome" | "promotional";
  name: string;
  body: string;
}

export interface PortalBranding {
  logo: string;
  background: string;
  primary: string;
  accent: string;
  font: string;
  welcomeMessage: string;
  footer: string;
  terms: string;
  privacy: string;
}

export interface CustomDomain {
  id: string;
  brandId: string;
  domain: string;
  ssl: "issued" | "pending" | "failed";
  dns: "verified" | "pending" | "failed";
  verification: DomainStatus;
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  companyName: string;
  status: BrandStatus;
  language: Language;
  colors: BrandColors;
  typography: Typography;
  logos: BrandLogos;
  login: LoginBranding;
  email: EmailBranding;
  emailTemplates: EmailTemplate[];
  sms: SmsBranding;
  smsTemplates: SmsTemplate[];
  portal: PortalBranding;
  domainId?: string;
  updatedAt: string;
}

export interface BrandingTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  preview: string;
  colors: BrandColors;
  typography: Typography;
}

export interface WhiteLabelKpis {
  totalClients: number;
  activeBrands: number;
  customDomains: number;
  activeThemes: number;
  emailTemplates: number;
  smsTemplates: number;
  activeLogos: number;
  publishedBranding: number;
}

export interface WhiteLabelSnapshot {
  kpis: WhiteLabelKpis;
  brands: Brand[];
  domains: CustomDomain[];
  templates: BrandingTemplate[];
}
