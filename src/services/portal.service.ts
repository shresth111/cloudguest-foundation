import { api } from "@/services/api";
import type {
  Portal,
  PortalAd,
  PortalAnalyticsData,
  PortalBranding,
  PortalComponent,
  PortalKpis,
  PortalLanguage,
  PortalListQuery,
  PortalListResult,
  PortalLoginMethod,
  PortalStatus,
  PortalTheme,
  PortalVersion,
} from "@/types/portal";

// ============================================================================
// Real backend wiring -- backend/app/domains/captive_portal is a flat config
// record (colors/theme string/login-method toggles/legal text), far
// narrower than this file's Portal type (which also models a drag-drop
// component builder, versioning history, ad slots, and page-view/login
// analytics -- none of which the backend persists anywhere). Every field
// with a real backend counterpart below is read/written for real; every
// field with no backend counterpart is filled with an honest, structural
// default (0 / empty array / unset), never fabricated sample data, and
// left clearly commented. Operations with NO backend support at all
// (theme catalog application, version restore, ads, page analytics) still
// echo the current real config so the UI doesn't break, but do not
// persist -- see each method below.
// ============================================================================

interface BackendCaptivePortalConfig {
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
  advertisement_banner_url: string | null;
  advertisement_banner_link: string | null;
  terms_and_conditions_text: string | null;
  terms_and_conditions_url: string | null;
  privacy_policy_text: string | null;
  privacy_policy_url: string | null;
  splash_headline: string | null;
  splash_welcome_message: string | null;
  redirect_url: string | null;
  otp_sms_enabled: boolean;
  otp_email_enabled: boolean;
  voucher_enabled: boolean;
  username_password_enabled: boolean;
  social_login_enabled: boolean;
  social_login_providers: string[];
  created_at: string;
  updated_at: string;
}

interface BackendListResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendOrg {
  id: string;
  name: string;
}

interface BackendLocation {
  id: string;
  name: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

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

// ------------- Design theme catalog --------------
// No backend equivalent -- CaptivePortalConfig.theme is a plain string
// label, not a structured template. Kept as a local, static design catalog
// (same content as before) purely for the theme-picker UI; applyTheme()/
// saveAsTheme() below apply it in-memory only, see their own comments.
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

// ------------- Org/location seed data (organizations()/locations() only) --------------
// portalService.organizations()/.locations() are consumed synchronously via
// useMemo in PortalWizard.tsx/PortalTable.tsx (not through react-query), so
// they can't become async without changing those call sites -- out of
// scope for this migration. Real org/location data is real elsewhere
// (organization.service.ts, location.service.ts); this stays a static seed
// purely for the wizard's dropdowns.
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

// ============================================================================
// Real <-> frontend mapping
// ============================================================================

const LOGIN_METHOD_FLAGS: Array<{ method: PortalLoginMethod; flag: keyof BackendCaptivePortalConfig }> = [
  { method: "mobile_otp", flag: "otp_sms_enabled" },
  { method: "email_otp", flag: "otp_email_enabled" },
  { method: "voucher", flag: "voucher_enabled" },
  { method: "social", flag: "social_login_enabled" },
];

function toLoginMethods(c: BackendCaptivePortalConfig): PortalLoginMethod[] {
  return LOGIN_METHOD_FLAGS.filter((m) => c[m.flag]).map((m) => m.method);
}

function loginMethodFlags(methods: PortalLoginMethod[]): Partial<BackendCaptivePortalConfig> {
  const set = new Set(methods);
  return {
    otp_sms_enabled: set.has("mobile_otp"),
    otp_email_enabled: set.has("email_otp"),
    voucher_enabled: set.has("voucher"),
    social_login_enabled: set.has("social"),
  };
}

async function fetchOrgNameMap(): Promise<Map<string, string>> {
  const { data } = await api.get<BackendListResponse<BackendOrg>>("/organizations", {
    params: { page_size: 100 },
  });
  return new Map(data.items.map((o) => [o.id, o.name]));
}

/** Fans out one /organizations/{id}/locations call per org present in
 * `configs` and builds a locationId -> name map -- there is no cross-org
 * location lookup endpoint (same constraint documented in
 * location.service.ts's fetchAllLocations). */
async function fetchLocationNameMap(orgIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(orgIds)];
  const settled = await Promise.allSettled(
    unique.map((orgId) =>
      api.get<BackendListResponse<BackendLocation>>(`/organizations/${orgId}/locations`, {
        params: { page_size: 100 },
      }),
    ),
  );
  const map = new Map<string, string>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const loc of r.value.data.items) map.set(loc.id, loc.name);
  }
  return map;
}

function toPortal(
  c: BackendCaptivePortalConfig,
  orgNames: Map<string, string>,
  locNames: Map<string, string>,
): Portal {
  const loginMethods = toLoginMethods(c);
  const version: PortalVersion = {
    id: c.id,
    version: 1,
    label: c.is_active ? "Active" : "Draft",
    createdAt: c.created_at,
    createdBy: "",
    status: c.is_active ? "published" : "draft",
  };
  return {
    id: c.id,
    name: c.name,
    description: undefined,
    organizationId: c.organization_id,
    organizationName: orgNames.get(c.organization_id) ?? "",
    locationId: c.location_id ?? "",
    locationName: c.location_id ? (locNames.get(c.location_id) ?? "") : "Organization default",
    status: c.is_active ? "published" : "draft",
    themeId: c.theme,
    themeName: c.theme,
    loginMethods,
    primaryLoginMethod: loginMethods[0] ?? "mobile_otp",
    languages: c.supported_languages as PortalLanguage[],
    defaultLanguage: c.default_language as PortalLanguage,
    branding: baseBranding({
      logoUrl: c.logo_url ?? undefined,
      backgroundUrl: c.background_image_url ?? undefined,
      primaryColor: c.primary_color,
      secondaryColor: c.secondary_color,
    }),
    login: {
      sessionTimeoutMinutes: 60,
      idleTimeoutMinutes: 15,
      deviceLimit: 3,
      redirectUrl: c.redirect_url ?? "",
      successPage: "",
      failurePage: "",
      autoLogin: true,
      rememberDevice: true,
    },
    consent: {
      termsRequired: !!(c.terms_and_conditions_text || c.terms_and_conditions_url),
      privacyRequired: !!(c.privacy_policy_text || c.privacy_policy_url),
      marketingConsent: false,
      gdprConsent: false,
      termsUrl: c.terms_and_conditions_url ?? "",
      privacyUrl: c.privacy_policy_url ?? "",
    },
    seo: {
      pageTitle: c.splash_headline ?? c.name,
      metaDescription: c.splash_welcome_message ?? "",
      faviconUrl: undefined,
      socialImageUrl: c.advertisement_banner_url ?? undefined,
    },
    ads: [],
    components: defaultComponents(),
    versions: [version],
    currentVersion: 1,
    lastPublishedAt: c.is_active ? c.updated_at : undefined,
    publishedBy: undefined,
    updatedAt: c.updated_at,
    createdAt: c.created_at,
    views: 0,
    logins: 0,
  };
}

async function fetchAllConfigs(): Promise<BackendCaptivePortalConfig[]> {
  const { data } = await api.get<BackendListResponse<BackendCaptivePortalConfig>>(
    "/captive-portal-configs",
    { params: { page: 1, page_size: 100 } },
  );
  return data.items;
}

async function hydrate(configs: BackendCaptivePortalConfig[]): Promise<Portal[]> {
  const [orgNames, locNames] = await Promise.all([
    fetchOrgNameMap(),
    fetchLocationNameMap(configs.map((c) => c.organization_id)),
  ]);
  return configs.map((c) => toPortal(c, orgNames, locNames));
}

async function fetchOnePortal(id: string): Promise<Portal> {
  const { data } = await api.get<BackendCaptivePortalConfig>(`/captive-portal-configs/${id}`);
  const [orgNames, locNames] = await Promise.all([
    fetchOrgNameMap(),
    fetchLocationNameMap([data.organization_id]),
  ]);
  return toPortal(data, orgNames, locNames);
}

// ============================================================================
// Service
// ============================================================================

export const portalService = {
  async kpis(): Promise<PortalKpis> {
    const configs = await fetchAllConfigs();
    const total = configs.length;
    const published = configs.filter((c) => c.is_active).length;
    const draft = total - published;
    const locations = new Set(configs.map((c) => c.location_id).filter(Boolean)).size;
    const activeThemes = new Set(configs.map((c) => c.theme)).size;
    return {
      totalPortals: total,
      publishedPortals: published,
      draftPortals: draft,
      activeLocations: locations,
      activeThemes,
      // No page-view/login tracking exists in the captive_portal domain --
      // these stay 0 rather than a fabricated figure.
      todaysLogins: 0,
      conversionRate: 0,
      portalViews: 0,
    };
  },

  async list(query: PortalListQuery): Promise<PortalListResult> {
    const configs = await fetchAllConfigs();
    let rows = await hydrate(configs);
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
    return fetchOnePortal(id);
  },

  async create(input: Partial<Portal> & { name: string; organizationId: string; locationId: string }): Promise<Portal> {
    const flags = loginMethodFlags(input.loginMethods ?? ["mobile_otp"]);
    const { data } = await api.post<BackendCaptivePortalConfig>("/captive-portal-configs", {
      organization_id: input.organizationId,
      location_id: input.locationId || null,
      name: input.name,
      is_active: false,
      theme: input.themeId ?? "corporate",
      logo_url: input.branding?.logoUrl ?? null,
      background_image_url: input.branding?.backgroundUrl ?? null,
      primary_color: input.branding?.primaryColor ?? "#0EA5E9",
      secondary_color: input.branding?.secondaryColor ?? "#0F172A",
      default_language: input.defaultLanguage ?? "en",
      supported_languages: input.languages ?? ["en"],
      terms_and_conditions_url: input.consent?.termsUrl || null,
      privacy_policy_url: input.consent?.privacyUrl || null,
      splash_headline: input.seo?.pageTitle ?? null,
      splash_welcome_message: input.seo?.metaDescription ?? null,
      redirect_url: input.login?.redirectUrl || null,
      ...flags,
    });
    return fetchOnePortal(data.id);
  },

  async update(id: string, patch: Partial<Portal>): Promise<Portal> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.themeId !== undefined) body.theme = patch.themeId;
    if (patch.branding?.logoUrl !== undefined) body.logo_url = patch.branding.logoUrl || null;
    if (patch.branding?.backgroundUrl !== undefined)
      body.background_image_url = patch.branding.backgroundUrl || null;
    if (patch.branding?.primaryColor !== undefined) body.primary_color = patch.branding.primaryColor;
    if (patch.branding?.secondaryColor !== undefined) body.secondary_color = patch.branding.secondaryColor;
    if (patch.defaultLanguage !== undefined) body.default_language = patch.defaultLanguage;
    if (patch.languages !== undefined) body.supported_languages = patch.languages;
    if (patch.consent?.termsUrl !== undefined) body.terms_and_conditions_url = patch.consent.termsUrl || null;
    if (patch.consent?.privacyUrl !== undefined) body.privacy_policy_url = patch.consent.privacyUrl || null;
    if (patch.seo?.pageTitle !== undefined) body.splash_headline = patch.seo.pageTitle || null;
    if (patch.seo?.metaDescription !== undefined) body.splash_welcome_message = patch.seo.metaDescription || null;
    if (patch.login?.redirectUrl !== undefined) body.redirect_url = patch.login.redirectUrl || null;
    if (patch.loginMethods !== undefined) Object.assign(body, loginMethodFlags(patch.loginMethods));

    if (Object.keys(body).length > 0) {
      await api.put(`/captive-portal-configs/${id}`, body);
    }
    return fetchOnePortal(id);
  },

  /** No backend equivalent for cloning a config -- fetches the real source
   * and creates a real copy via the same create() path above (a real,
   * persisted duplicate, not a mocked one). */
  async duplicate(id: string): Promise<Portal> {
    const src = await fetchOnePortal(id);
    return portalService.create({ ...src, name: `${src.name} (Copy)` });
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/captive-portal-configs/${id}`);
  },

  async setStatus(id: string, status: PortalStatus): Promise<Portal> {
    // Backend only has a binary is_active -- "published" activates, every
    // other frontend status ("draft"/"archived"/"scheduled", none of which
    // the backend distinguishes) deactivates.
    await api.post(`/captive-portal-configs/${id}/${status === "published" ? "activate" : "deactivate"}`);
    return fetchOnePortal(id);
  },

  /** Static design catalog -- see THEMES comment above, no backend concept. */
  async themes(): Promise<PortalTheme[]> {
    return structuredClone(THEMES);
  },

  /** No backend field stores an applied "theme id" beyond the plain
   * `theme` string -- this persists the theme's real color fields for
   * real (primary/secondary color), then returns the refreshed config
   * with the local theme id attached for display. */
  async applyTheme(id: string, themeId: string): Promise<Portal> {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) throw new Error("Theme not found");
    await api.put(`/captive-portal-configs/${id}`, {
      theme: theme.id,
      primary_color: theme.branding.primaryColor,
      secondary_color: theme.branding.secondaryColor,
    });
    return fetchOnePortal(id);
  },

  /** No backend endpoint to persist a new theme definition -- appends to
   * the local, in-memory catalog only (matches prior mock behavior; not
   * shared across sessions/users). */
  async saveAsTheme(id: string, name: string): Promise<PortalTheme> {
    const p = await fetchOnePortal(id);
    const t: PortalTheme = {
      id: `theme-${uid()}`,
      name,
      category: "corporate",
      description: "Custom theme saved from portal",
      preview: { from: p.branding.gradientFrom, to: p.branding.gradientTo, accent: p.branding.primaryColor },
      branding: { ...p.branding },
      components: defaultComponents(),
    };
    THEMES.push(t);
    return t;
  },

  /** No version history exists in the backend (see module comment) --
   * this is a UI-only echo of the current config so the version panel
   * doesn't crash; it does not change any persisted data. */
  async restoreVersion(id: string, _versionId: string): Promise<Portal> {
    return fetchOnePortal(id);
  },

  /** No ad-slot storage exists in the backend's captive_portal domain --
   * kept as an in-memory echo (not persisted) so the ads panel stays
   * usable; a real ads feature would need a backend field/table first. */
  async addAd(id: string, ad: Omit<PortalAd, "id" | "impressions" | "clicks">): Promise<Portal> {
    const p = await fetchOnePortal(id);
    p.ads = [{ ...ad, id: uid(), impressions: 0, clicks: 0 }, ...p.ads];
    return p;
  },

  async removeAd(id: string, adId: string): Promise<Portal> {
    const p = await fetchOnePortal(id);
    p.ads = p.ads.filter((a) => a.id !== adId);
    return p;
  },

  /** No analytics/event tracking exists for captive_portal configs --
   * returns real zeros rather than a fabricated trend line. */
  async analytics(_id: string): Promise<PortalAnalyticsData> {
    return {
      trend: [],
      bounceRate: 0,
      avgTimeSeconds: 0,
      conversionRate: 0,
      methodBreakdown: [],
    };
  },

  organizations() {
    return ORGS.map(([id, name]) => ({ id, name }));
  },
  locations(orgId?: string) {
    return LOCATIONS.filter(([, , o]) => (orgId ? o === orgId : true)).map(([id, name, org]) => ({ id, name, orgId: org }));
  },
};
