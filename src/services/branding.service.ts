import type {
  Brand,
  BrandColors,
  BrandingTemplate,
  CustomDomain,
  EmailTemplate,
  SmsTemplate,
  TemplateCategory,
  Typography,
  WhiteLabelSnapshot,
} from "@/types/branding";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const ORGS = [
  "Nova Hospitality",
  "Beacon Retail",
  "Skyline Airports",
  "Marina Resorts",
  "Vantage Coworks",
  "Harbor Cafes",
  "Aurora Malls",
  "Summit Hotels",
  "Northwind Health",
  "Cascade Universities",
];

const CATEGORIES: TemplateCategory[] = [
  "hotel",
  "cafe",
  "restaurant",
  "hospital",
  "university",
  "corporate",
  "airport",
  "retail",
];

const PALETTES: Record<TemplateCategory, BrandColors> = {
  hotel: { primary: "#8B5CF6", secondary: "#EC4899", accent: "#F59E0B", success: "#10B981", warning: "#F59E0B", error: "#EF4444", sidebar: "#0F172A", navbar: "#111827", buttonBg: "#8B5CF6", buttonText: "#FFFFFF", cardBg: "#FFFFFF", cardBorder: "#E5E7EB" },
  cafe: { primary: "#B45309", secondary: "#78350F", accent: "#F59E0B", success: "#10B981", warning: "#F59E0B", error: "#EF4444", sidebar: "#292524", navbar: "#1C1917", buttonBg: "#B45309", buttonText: "#FFFFFF", cardBg: "#FFFAF0", cardBorder: "#FDE68A" },
  restaurant: { primary: "#DC2626", secondary: "#7F1D1D", accent: "#F59E0B", success: "#059669", warning: "#F59E0B", error: "#B91C1C", sidebar: "#1F2937", navbar: "#111827", buttonBg: "#DC2626", buttonText: "#FFFFFF", cardBg: "#FFFFFF", cardBorder: "#FEE2E2" },
  hospital: { primary: "#0EA5E9", secondary: "#0369A1", accent: "#22D3EE", success: "#10B981", warning: "#F59E0B", error: "#EF4444", sidebar: "#0F172A", navbar: "#0C4A6E", buttonBg: "#0EA5E9", buttonText: "#FFFFFF", cardBg: "#F0F9FF", cardBorder: "#BAE6FD" },
  university: { primary: "#1D4ED8", secondary: "#1E3A8A", accent: "#F59E0B", success: "#10B981", warning: "#F59E0B", error: "#EF4444", sidebar: "#1E1B4B", navbar: "#1E3A8A", buttonBg: "#1D4ED8", buttonText: "#FFFFFF", cardBg: "#EFF6FF", cardBorder: "#DBEAFE" },
  corporate: { primary: "#0F172A", secondary: "#334155", accent: "#3B82F6", success: "#10B981", warning: "#F59E0B", error: "#EF4444", sidebar: "#0F172A", navbar: "#1E293B", buttonBg: "#0F172A", buttonText: "#FFFFFF", cardBg: "#FFFFFF", cardBorder: "#E5E7EB" },
  airport: { primary: "#0369A1", secondary: "#075985", accent: "#22D3EE", success: "#10B981", warning: "#F59E0B", error: "#EF4444", sidebar: "#0C4A6E", navbar: "#082F49", buttonBg: "#0369A1", buttonText: "#FFFFFF", cardBg: "#F0F9FF", cardBorder: "#BAE6FD" },
  retail: { primary: "#DB2777", secondary: "#9D174D", accent: "#F59E0B", success: "#10B981", warning: "#F59E0B", error: "#EF4444", sidebar: "#1F2937", navbar: "#111827", buttonBg: "#DB2777", buttonText: "#FFFFFF", cardBg: "#FDF2F8", cardBorder: "#FBCFE8" },
};

const DEFAULT_TYPO: Typography = {
  fontFamily: "Inter",
  fontSize: 14,
  headingWeight: 600,
  buttonWeight: 500,
  borderRadius: 10,
  cardRadius: 14,
  shadow: "md",
};

const LOGO_PLACEHOLDER = "https://api.dicebear.com/9.x/shapes/svg?seed=";

function makeTemplates(): BrandingTemplate[] {
  return CATEGORIES.map((cat, i) => ({
    id: `tpl_${cat}`,
    name: `${cat[0].toUpperCase()}${cat.slice(1)} experience`,
    category: cat,
    preview: `${LOGO_PLACEHOLDER}${cat}-${i}`,
    colors: PALETTES[cat],
    typography: { ...DEFAULT_TYPO, fontFamily: cat === "cafe" ? "Merriweather" : cat === "university" ? "Playfair Display" : "Inter" },
  }));
}

function defaultEmailTemplates(brand: string): EmailTemplate[] {
  const keys: EmailTemplate["key"][] = ["welcome", "otp", "password_reset", "invoice", "subscription_expiry"];
  const names: Record<EmailTemplate["key"], string> = {
    welcome: "Welcome",
    otp: "OTP verification",
    password_reset: "Password reset",
    invoice: "Invoice",
    subscription_expiry: "Subscription expiry",
  };
  return keys.map((k) => ({
    id: `et_${brand}_${k}`,
    key: k,
    name: names[k],
    subject: `${names[k]} · ${brand}`,
    body: `Hi {{name}},\n\nThis is a ${names[k].toLowerCase()} message from ${brand}.\n\nRegards,\nThe ${brand} team`,
    updatedAt: new Date().toISOString(),
  }));
}

function defaultSmsTemplates(brand: string): SmsTemplate[] {
  return [
    { id: `sm_${brand}_otp`, key: "otp", name: "OTP", body: `${brand}: Your OTP is {{code}}. Valid for 5 minutes.` },
    { id: `sm_${brand}_welcome`, key: "welcome", name: "Welcome", body: `Welcome to ${brand} WiFi. Enjoy your stay!` },
    { id: `sm_${brand}_promo`, key: "promotional", name: "Promotional", body: `${brand}: Members get 20% off — visit {{url}}` },
  ];
}

function makeBrand(idx: number): Brand {
  const org = ORGS[idx % ORGS.length];
  const cat = CATEGORIES[idx % CATEGORIES.length];
  const name = `${org.split(" ")[0]} Guest WiFi`;
  const status = idx % 5 === 0 ? "draft" : idx % 7 === 0 ? "archived" : "published";
  return {
    id: `brand_${1000 + idx}`,
    name,
    organizationId: `org_${1000 + idx}`,
    organizationName: org,
    companyName: org,
    status,
    language: (["en", "hi", "ar", "fr", "es"] as const)[idx % 5],
    colors: PALETTES[cat],
    typography: DEFAULT_TYPO,
    logos: {
      company: `${LOGO_PLACEHOLDER}${name}`,
      favicon: `${LOGO_PLACEHOLDER}fav-${name}`,
      login: `${LOGO_PLACEHOLDER}login-${name}`,
      dashboard: `${LOGO_PLACEHOLDER}dash-${name}`,
      mobile: `${LOGO_PLACEHOLDER}mob-${name}`,
      footer: `${LOGO_PLACEHOLDER}foot-${name}`,
      watermark: `${LOGO_PLACEHOLDER}wm-${name}`,
    },
    login: {
      background: `https://images.unsplash.com/photo-1519750783826-e2420f4d687f?w=1400&auto=format`,
      banner: "",
      illustration: "",
      heading: `Welcome to ${org}`,
      description: "Sign in to manage your guest WiFi experience.",
      footer: `© ${new Date().getFullYear()} ${org}. All rights reserved.`,
    },
    email: {
      header: `${org} — Guest experience`,
      footer: `You are receiving this because you signed up with ${org}.`,
      companyLogo: `${LOGO_PLACEHOLDER}${name}`,
      companyAddress: "221 Market St, Suite 500, San Francisco, CA",
      socials: { twitter: "https://twitter.com", linkedin: "https://linkedin.com" },
    },
    emailTemplates: defaultEmailTemplates(name),
    sms: { senderName: org.split(" ")[0].slice(0, 11).toUpperCase(), footer: `Msg&data rates may apply. Reply STOP to unsubscribe.` },
    smsTemplates: defaultSmsTemplates(name),
    portal: {
      logo: `${LOGO_PLACEHOLDER}portal-${name}`,
      background: `https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&auto=format`,
      primary: PALETTES[cat].primary,
      accent: PALETTES[cat].accent,
      font: DEFAULT_TYPO.fontFamily,
      welcomeMessage: `Welcome to ${org} Guest WiFi`,
      footer: `Powered by CloudGuest`,
      terms: "By connecting you agree to our terms of use.",
      privacy: "We respect your privacy. Read our privacy policy.",
    },
    domainId: idx % 3 === 0 ? `dom_${1000 + idx}` : undefined,
    updatedAt: new Date(Date.now() - idx * 86400000).toISOString(),
  };
}

let brandsStore: Brand[] = Array.from({ length: 14 }).map((_, i) => makeBrand(i));

let domainsStore: CustomDomain[] = brandsStore
  .filter((b) => b.domainId)
  .map((b, i) => ({
    id: b.domainId!,
    brandId: b.id,
    domain: `${b.name.toLowerCase().replace(/[^a-z]+/g, "-")}.io`,
    ssl: i % 3 === 0 ? "pending" : "issued",
    dns: i % 4 === 0 ? "pending" : "verified",
    verification: i % 5 === 0 ? "failed" : i % 3 === 0 ? "verifying" : "active",
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));

const templatesStore: BrandingTemplate[] = makeTemplates();

function computeKpis() {
  return {
    totalClients: brandsStore.length,
    activeBrands: brandsStore.filter((b) => b.status === "published").length,
    customDomains: domainsStore.length,
    activeThemes: brandsStore.length,
    emailTemplates: brandsStore.reduce((s, b) => s + b.emailTemplates.length, 0),
    smsTemplates: brandsStore.reduce((s, b) => s + b.smsTemplates.length, 0),
    activeLogos: brandsStore.filter((b) => b.logos.company).length,
    publishedBranding: brandsStore.filter((b) => b.status === "published").length,
  };
}

export const brandingService = {
  async getSnapshot(): Promise<WhiteLabelSnapshot> {
    await delay();
    return { kpis: computeKpis(), brands: brandsStore, domains: domainsStore, templates: templatesStore };
  },
  async getBrand(id: string) {
    await delay(150);
    return brandsStore.find((b) => b.id === id) ?? null;
  },
  async saveBrand(brand: Brand) {
    await delay(400);
    brandsStore = brandsStore.map((b) => (b.id === brand.id ? { ...brand, updatedAt: new Date().toISOString() } : b));
    return brandsStore.find((b) => b.id === brand.id)!;
  },
  async publishBrand(id: string) {
    await delay(300);
    brandsStore = brandsStore.map((b) => (b.id === id ? { ...b, status: "published", updatedAt: new Date().toISOString() } : b));
    return true;
  },
  async duplicateBrand(id: string) {
    await delay(300);
    const src = brandsStore.find((b) => b.id === id);
    if (!src) return null;
    const clone: Brand = { ...src, id: `brand_${Date.now()}`, name: `${src.name} (copy)`, status: "draft", updatedAt: new Date().toISOString() };
    brandsStore = [clone, ...brandsStore];
    return clone;
  },
  async deleteBrand(id: string) {
    await delay(200);
    brandsStore = brandsStore.filter((b) => b.id !== id);
    return true;
  },
  async resetBrand(id: string) {
    await delay(200);
    const base = makeBrand(0);
    brandsStore = brandsStore.map((b) => (b.id === id ? { ...b, colors: base.colors, typography: base.typography } : b));
    return brandsStore.find((b) => b.id === id)!;
  },
  async applyTemplate(brandId: string, templateId: string) {
    await delay(250);
    const t = templatesStore.find((x) => x.id === templateId);
    if (!t) return null;
    brandsStore = brandsStore.map((b) => (b.id === brandId ? { ...b, colors: t.colors, typography: t.typography } : b));
    return brandsStore.find((b) => b.id === brandId)!;
  },
  async addDomain(brandId: string, domain: string) {
    await delay(300);
    const d: CustomDomain = {
      id: `dom_${Date.now()}`,
      brandId,
      domain,
      ssl: "pending",
      dns: "pending",
      verification: "pending",
      createdAt: new Date().toISOString(),
    };
    domainsStore = [d, ...domainsStore];
    brandsStore = brandsStore.map((b) => (b.id === brandId ? { ...b, domainId: d.id } : b));
    return d;
  },
  async verifyDomain(id: string) {
    await delay(600);
    domainsStore = domainsStore.map((d) => (d.id === id ? { ...d, ssl: "issued", dns: "verified", verification: "active" } : d));
    return true;
  },
  async removeDomain(id: string) {
    await delay(200);
    const dom = domainsStore.find((d) => d.id === id);
    domainsStore = domainsStore.filter((d) => d.id !== id);
    if (dom) brandsStore = brandsStore.map((b) => (b.id === dom.brandId ? { ...b, domainId: undefined } : b));
    return true;
  },
  async saveEmailTemplate(brandId: string, tpl: EmailTemplate) {
    await delay(200);
    brandsStore = brandsStore.map((b) =>
      b.id === brandId ? { ...b, emailTemplates: b.emailTemplates.map((e) => (e.id === tpl.id ? { ...tpl, updatedAt: new Date().toISOString() } : e)) } : b,
    );
    return tpl;
  },
  async saveSmsTemplate(brandId: string, tpl: SmsTemplate) {
    await delay(200);
    brandsStore = brandsStore.map((b) =>
      b.id === brandId ? { ...b, smsTemplates: b.smsTemplates.map((e) => (e.id === tpl.id ? tpl : e)) } : b,
    );
    return tpl;
  },
  async exportTheme(id: string) {
    await delay(150);
    const b = brandsStore.find((x) => x.id === id);
    return b ? { fileName: `${b.name}-theme.json`, payload: JSON.stringify({ colors: b.colors, typography: b.typography }, null, 2) } : null;
  },
  async importTheme(id: string, payload: string) {
    await delay(200);
    try {
      const parsed = JSON.parse(payload) as { colors: BrandColors; typography: Typography };
      brandsStore = brandsStore.map((b) => (b.id === id ? { ...b, colors: parsed.colors, typography: parsed.typography } : b));
      return true;
    } catch {
      return false;
    }
  },
};

export type BrandingService = typeof brandingService;
