import type {
  Portal,
  PortalAd,
  PortalAnalyticsData,
  PortalBranding,
  PortalComponent,
  PortalKpis,
  PortalListQuery,
  PortalListResult,
  PortalLoginMethod,
  PortalStatus,
  PortalTheme,
  PortalVersion,
} from "@/types/portal";

// ------------- Seed data --------------
const ORGS: Array<[string, string]> = [
  ["ORG-01000", "Nimbus Hospitality"],
  ["ORG-01001", "Vertex Retail"],
  ["ORG-01002", "Halo Group"],
  ["ORG-01003", "Orbit Holdings"],
  ["ORG-01004", "Lumen Ventures"],
];
const LOCATIONS: Array<[string, string, string]> = [
  ["LOC-02000", "Nimbus San Francisco Downtown", "ORG-01000"],
  ["LOC-02001", "Vertex New York Central", "ORG-01001"],
  ["LOC-02002", "Halo London Airport", "ORG-01002"],
  ["LOC-02003", "Orbit Bengaluru Plaza", "ORG-01003"],
  ["LOC-02004", "Lumen Singapore Riverside", "ORG-01004"],
  ["LOC-02005", "Nimbus Paris Opera", "ORG-01000"],
  ["LOC-02006", "Vertex Chicago Riverwalk", "ORG-01001"],
  ["LOC-02007", "Halo Dubai Marina", "ORG-01002"],
];

const uid = () => Math.random().toString(36).slice(2, 10);
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// ------------- Themes --------------
const baseBranding = (over: Partial<PortalBranding> = {}): PortalBranding => ({
  primaryColor: "#0EA5E9",
  secondaryColor: "#0F172A",
  fontFamily: "Inter",
  borderRadius: 14,
  backgroundType: "gradient",
  gradientFrom: "#0F172A",
  gradientTo: "#1E293B",
  shadow: "md",
  buttonStyle: "solid",
  cardStyle: "elevated",
  animations: true,
  ...over,
});

const defaultComponents = (): PortalComponent[] => [
  { id: uid(), type: "logo", props: { align: "center", size: 96 } },
  { id: uid(), type: "heading", props: { text: "Welcome — connect to WiFi", size: 28 } },
  { id: uid(), type: "text", props: { text: "Sign in below to access complimentary internet.", size: 14 } },
  { id: uid(), type: "login_card", props: {} },
  { id: uid(), type: "footer", props: { text: "Powered by CloudGuest" } },
];

export const THEMES: PortalTheme[] = [
  {
    id: "theme-modern-hotel",
    name: "Modern Hotel",
    category: "hotel",
    description: "Warm neutrals with airy typography, ideal for boutique hotels.",
    preview: { from: "#1E293B", to: "#0EA5E9", accent: "#F59E0B" },
    branding: baseBranding({ primaryColor: "#F59E0B", gradientFrom: "#1E293B", gradientTo: "#0EA5E9" }),
    components: defaultComponents(),
  },
  {
    id: "theme-luxury-hotel",
    name: "Luxury Hotel",
    category: "luxury_hotel",
    description: "Deep obsidian palette with brass accents for premium properties.",
    preview: { from: "#111827", to: "#000000", accent: "#D4AF37" },
    branding: baseBranding({ primaryColor: "#D4AF37", gradientFrom: "#111827", gradientTo: "#000000", fontFamily: "Playfair Display", cardStyle: "glass" }),
    components: defaultComponents(),
  },
  {
    id: "theme-cafe",
    name: "Café",
    category: "cafe",
    description: "Cozy cream and espresso for cafés and bakeries.",
    preview: { from: "#F5E9D7", to: "#B08968", accent: "#7F4F24" },
    branding: baseBranding({ primaryColor: "#7F4F24", gradientFrom: "#F5E9D7", gradientTo: "#B08968" }),
    components: defaultComponents(),
  },
  {
    id: "theme-restaurant",
    name: "Restaurant",
    category: "restaurant",
    description: "Rich burgundy and gold for fine-dining establishments.",
    preview: { from: "#7F1D1D", to: "#450A0A", accent: "#EAB308" },
    branding: baseBranding({ primaryColor: "#EAB308", gradientFrom: "#7F1D1D", gradientTo: "#450A0A" }),
    components: defaultComponents(),
  },
  {
    id: "theme-hospital",
    name: "Hospital",
    category: "hospital",
    description: "Calm blues and crisp whites for clinical environments.",
    preview: { from: "#E0F2FE", to: "#0284C7", accent: "#0EA5E9" },
    branding: baseBranding({ primaryColor: "#0284C7", gradientFrom: "#E0F2FE", gradientTo: "#0284C7" }),
    components: defaultComponents(),
  },
  {
    id: "theme-university",
    name: "University",
    category: "university",
    description: "Academic navy with scholarly typography.",
    preview: { from: "#1E3A8A", to: "#312E81", accent: "#FBBF24" },
    branding: baseBranding({ primaryColor: "#FBBF24", gradientFrom: "#1E3A8A", gradientTo: "#312E81" }),
    components: defaultComponents(),
  },
  {
    id: "theme-corporate",
    name: "Corporate",
    category: "corporate",
    description: "Minimal, confident, brand-forward.",
    preview: { from: "#0F172A", to: "#1E293B", accent: "#0EA5E9" },
    branding: baseBranding(),
    components: defaultComponents(),
  },
  {
    id: "theme-airport",
    name: "Airport",
    category: "airport",
    description: "Fast, high-contrast design for high-throughput terminals.",
    preview: { from: "#0369A1", to: "#082F49", accent: "#38BDF8" },
    branding: baseBranding({ primaryColor: "#38BDF8", gradientFrom: "#0369A1", gradientTo: "#082F49" }),
    components: defaultComponents(),
  },
  {
    id: "theme-retail",
    name: "Retail Store",
    category: "retail",
    description: "Vibrant, promotion-friendly for retail and malls.",
    preview: { from: "#DB2777", to: "#7C3AED", accent: "#FDE047" },
    branding: baseBranding({ primaryColor: "#FDE047", gradientFrom: "#DB2777", gradientTo: "#7C3AED" }),
    components: defaultComponents(),
  },
];

// ------------- Portals --------------
const STATUSES: PortalStatus[] = ["published", "draft", "scheduled", "archived"];
const METHODS: PortalLoginMethod[] = ["mobile_otp", "email_otp", "voucher", "pms", "social", "click_through"];

function makePortal(i: number): Portal {
  const [locId, locName, orgId] = pick(LOCATIONS, i);
  const orgTuple = ORGS.find(([id]) => id === orgId) ?? ORGS[0];
  const theme = pick(THEMES, i);
  const status = pick(STATUSES, i);
  const methods = [pick(METHODS, i), pick(METHODS, i + 2)].filter((v, k, a) => a.indexOf(v) === k);
  const now = Date.now();
  const versions: PortalVersion[] = [
    { id: uid(), version: 1, label: "Initial", createdAt: new Date(now - 1000 * 60 * 60 * 24 * 12).toISOString(), createdBy: "system@cloudguest.io", status: "draft" },
    { id: uid(), version: 2, label: "Branding update", createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString(), createdBy: "ops@cloudguest.io", status: "draft", notes: "Updated hero copy and gradient" },
    { id: uid(), version: 3, label: "Published", createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(), createdBy: "admin@cloudguest.io", status: "published", notes: "Enabled OTP + click-through" },
  ];
  return {
    id: `PRT-${(4000 + i).toString().padStart(5, "0")}`,
    name: `${locName.split(" ")[0]} Guest Portal`,
    description: "Enterprise captive portal with OTP and social login.",
    organizationId: orgId,
    organizationName: orgTuple[1],
    locationId: locId,
    locationName: locName,
    status,
    themeId: theme.id,
    themeName: theme.name,
    loginMethods: methods,
    primaryLoginMethod: methods[0] ?? "mobile_otp",
    languages: ["en", "hi", "ar"],
    defaultLanguage: "en",
    branding: theme.branding,
    login: {
      sessionTimeoutMinutes: 60,
      idleTimeoutMinutes: 15,
      deviceLimit: 3,
      redirectUrl: "https://example.com/welcome",
      successPage: "https://example.com/success",
      failurePage: "https://example.com/failure",
      autoLogin: true,
      rememberDevice: true,
    },
    consent: {
      termsRequired: true,
      privacyRequired: true,
      marketingConsent: false,
      gdprConsent: true,
      termsUrl: "https://example.com/terms",
      privacyUrl: "https://example.com/privacy",
    },
    seo: {
      pageTitle: `${locName} — WiFi Login`,
      metaDescription: `Connect to complimentary guest WiFi at ${locName}.`,
      faviconUrl: "",
      socialImageUrl: "",
    },
    ads: [
      {
        id: uid(),
        name: "Summer Promo",
        type: "banner",
        mediaUrl: "https://picsum.photos/seed/ad1/800/200",
        clickUrl: "https://example.com/promo",
        startsAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
        endsAt: new Date(now + 1000 * 60 * 60 * 24 * 14).toISOString(),
        impressions: 12480 + i * 143,
        clicks: 342 + i * 11,
        active: true,
      },
    ],
    components: theme.components.map((c) => ({ ...c, id: uid() })),
    versions,
    currentVersion: versions.length,
    lastPublishedAt: status === "published" ? versions[versions.length - 1].createdAt : undefined,
    publishedBy: status === "published" ? "admin@cloudguest.io" : undefined,
    updatedAt: new Date(now - 1000 * 60 * 60 * (i + 1)).toISOString(),
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * (14 + i)).toISOString(),
    views: 4200 + i * 173,
    logins: 1800 + i * 87,
  };
}

const PORTALS: Portal[] = Array.from({ length: 24 }, (_, i) => makePortal(i));

// ------------- API --------------
export const portalService = {
  async kpis(): Promise<PortalKpis> {
    await delay(180);
    const total = PORTALS.length;
    const published = PORTALS.filter((p) => p.status === "published").length;
    const draft = PORTALS.filter((p) => p.status === "draft").length;
    const locations = new Set(PORTALS.map((p) => p.locationId)).size;
    const activeThemes = new Set(PORTALS.map((p) => p.themeId)).size;
    const todaysLogins = PORTALS.reduce((s, p) => s + Math.round(p.logins / 90), 0);
    const views = PORTALS.reduce((s, p) => s + p.views, 0);
    const logins = PORTALS.reduce((s, p) => s + p.logins, 0);
    return {
      totalPortals: total,
      publishedPortals: published,
      draftPortals: draft,
      activeLocations: locations,
      activeThemes,
      todaysLogins,
      conversionRate: views ? +(100 * (logins / views)).toFixed(1) : 0,
      portalViews: views,
    };
  },

  async list(query: PortalListQuery): Promise<PortalListResult> {
    await delay(200);
    let rows = [...PORTALS];
    if (query.search) {
      const s = query.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s) ||
          r.organizationName.toLowerCase().includes(s) ||
          r.locationName.toLowerCase().includes(s),
      );
    }
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    if (query.organizationId) rows = rows.filter((r) => r.organizationId === query.organizationId);
    if (query.loginMethod) rows = rows.filter((r) => r.loginMethods.includes(query.loginMethod!));
    rows.sort((a, b) => {
      const k = query.sort.key;
      const av = a[k] as unknown as string | number;
      const bv = b[k] as unknown as string | number;
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (query.sort.dir === "asc" ? 1 : -1);
    });
    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    return { items: rows.slice(start, start + query.pageSize), total };
  },

  async get(id: string): Promise<Portal> {
    await delay(180);
    const found = PORTALS.find((p) => p.id === id);
    if (!found) throw new Error("Portal not found");
    return structuredClone(found);
  },

  async create(input: Partial<Portal> & { name: string; organizationId: string; locationId: string }): Promise<Portal> {
    await delay(280);
    const orgName = ORGS.find(([id]) => id === input.organizationId)?.[1] ?? "Organization";
    const locName = LOCATIONS.find(([id]) => id === input.locationId)?.[1] ?? "Location";
    const p: Portal = {
      ...(makePortal(PORTALS.length) as Portal),
      ...input,
      id: `PRT-${(4000 + PORTALS.length).toString().padStart(5, "0")}`,
      organizationName: orgName,
      locationName: locName,
      status: "draft",
      loginMethods: input.loginMethods ?? ["mobile_otp"],
      primaryLoginMethod: input.primaryLoginMethod ?? "mobile_otp",
      versions: [
        {
          id: uid(),
          version: 1,
          label: "Initial",
          createdAt: new Date().toISOString(),
          createdBy: "you@cloudguest.io",
          status: "draft",
        },
      ],
      currentVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    PORTALS.unshift(p);
    return structuredClone(p);
  },

  async update(id: string, patch: Partial<Portal>): Promise<Portal> {
    await delay(200);
    const idx = PORTALS.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Portal not found");
    const merged: Portal = {
      ...PORTALS[idx],
      ...patch,
      branding: { ...PORTALS[idx].branding, ...(patch.branding ?? {}) },
      login: { ...PORTALS[idx].login, ...(patch.login ?? {}) },
      consent: { ...PORTALS[idx].consent, ...(patch.consent ?? {}) },
      seo: { ...PORTALS[idx].seo, ...(patch.seo ?? {}) },
      updatedAt: new Date().toISOString(),
    };
    PORTALS[idx] = merged;
    return structuredClone(merged);
  },

  async duplicate(id: string): Promise<Portal> {
    await delay(240);
    const src = PORTALS.find((p) => p.id === id);
    if (!src) throw new Error("Portal not found");
    const copy: Portal = {
      ...structuredClone(src),
      id: `PRT-${(4000 + PORTALS.length).toString().padStart(5, "0")}`,
      name: `${src.name} (Copy)`,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    PORTALS.unshift(copy);
    return copy;
  },

  async remove(id: string): Promise<void> {
    await delay(180);
    const idx = PORTALS.findIndex((p) => p.id === id);
    if (idx >= 0) PORTALS.splice(idx, 1);
  },

  async setStatus(id: string, status: PortalStatus): Promise<Portal> {
    await delay(180);
    const idx = PORTALS.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Portal not found");
    PORTALS[idx].status = status;
    if (status === "published") {
      PORTALS[idx].lastPublishedAt = new Date().toISOString();
      PORTALS[idx].publishedBy = "you@cloudguest.io";
      PORTALS[idx].currentVersion += 1;
      PORTALS[idx].versions.push({
        id: uid(),
        version: PORTALS[idx].currentVersion,
        label: `Published v${PORTALS[idx].currentVersion}`,
        createdAt: new Date().toISOString(),
        createdBy: "you@cloudguest.io",
        status: "published",
      });
    }
    PORTALS[idx].updatedAt = new Date().toISOString();
    return structuredClone(PORTALS[idx]);
  },

  async themes(): Promise<PortalTheme[]> {
    await delay(120);
    return structuredClone(THEMES);
  },

  async applyTheme(id: string, themeId: string): Promise<Portal> {
    await delay(200);
    const theme = THEMES.find((t) => t.id === themeId);
    const idx = PORTALS.findIndex((p) => p.id === id);
    if (!theme || idx < 0) throw new Error("Theme or portal not found");
    PORTALS[idx].branding = { ...theme.branding };
    PORTALS[idx].themeId = theme.id;
    PORTALS[idx].themeName = theme.name;
    PORTALS[idx].updatedAt = new Date().toISOString();
    return structuredClone(PORTALS[idx]);
  },

  async saveAsTheme(id: string, name: string): Promise<PortalTheme> {
    await delay(200);
    const p = PORTALS.find((x) => x.id === id);
    if (!p) throw new Error("Portal not found");
    const t: PortalTheme = {
      id: `theme-${uid()}`,
      name,
      category: "corporate",
      description: "Custom theme saved from portal",
      preview: { from: p.branding.gradientFrom, to: p.branding.gradientTo, accent: p.branding.primaryColor },
      branding: { ...p.branding },
      components: [...p.components],
    };
    THEMES.push(t);
    return t;
  },

  async restoreVersion(id: string, versionId: string): Promise<Portal> {
    await delay(200);
    const idx = PORTALS.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Portal not found");
    const v = PORTALS[idx].versions.find((x) => x.id === versionId);
    if (!v) throw new Error("Version not found");
    PORTALS[idx].currentVersion += 1;
    PORTALS[idx].versions.push({
      id: uid(),
      version: PORTALS[idx].currentVersion,
      label: `Restored v${v.version}`,
      createdAt: new Date().toISOString(),
      createdBy: "you@cloudguest.io",
      status: "draft",
      notes: `Restored from ${v.label}`,
    });
    PORTALS[idx].updatedAt = new Date().toISOString();
    return structuredClone(PORTALS[idx]);
  },

  async addAd(id: string, ad: Omit<PortalAd, "id" | "impressions" | "clicks">): Promise<Portal> {
    await delay(180);
    const idx = PORTALS.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Portal not found");
    PORTALS[idx].ads.unshift({ ...ad, id: uid(), impressions: 0, clicks: 0 });
    return structuredClone(PORTALS[idx]);
  },

  async removeAd(id: string, adId: string): Promise<Portal> {
    await delay(150);
    const idx = PORTALS.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Portal not found");
    PORTALS[idx].ads = PORTALS[idx].ads.filter((a) => a.id !== adId);
    return structuredClone(PORTALS[idx]);
  },

  async analytics(id: string): Promise<PortalAnalyticsData> {
    await delay(200);
    const p = PORTALS.find((x) => x.id === id);
    if (!p) throw new Error("Portal not found");
    const trend = Array.from({ length: 14 }, (_, i) => {
      const day = new Date(Date.now() - (13 - i) * 86400000);
      const base = 120 + Math.round(Math.sin(i / 2) * 40) + i * 8;
      return {
        date: day.toISOString().slice(5, 10),
        views: base,
        logins: Math.round(base * 0.65 - (i % 3) * 4),
        failed: 4 + (i % 5),
      };
    });
    return {
      trend,
      bounceRate: 22.4,
      avgTimeSeconds: 78,
      conversionRate: 64.3,
      methodBreakdown: [
        { method: "mobile_otp", value: 48 },
        { method: "email_otp", value: 21 },
        { method: "social", value: 14 },
        { method: "voucher", value: 9 },
        { method: "click_through", value: 6 },
        { method: "pms", value: 2 },
      ],
    };
  },

  organizations() {
    return ORGS.map(([id, name]) => ({ id, name }));
  },
  locations(orgId?: string) {
    return LOCATIONS.filter(([, , o]) => (orgId ? o === orgId : true)).map(([id, name, org]) => ({ id, name, orgId: org }));
  },
};
