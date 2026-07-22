/**
 * System-level mock services powering FE-022:
 * - Feature Marketplace
 * - Subscription Center + Usage
 * - System Health + Monitoring
 * - API Keys + Webhooks
 * - Integrations catalog
 * - Notification Center
 * - Help Center
 * - Export Center
 */

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();
const rand = (n = 8) =>
  Array.from({ length: n })
    .map(() => Math.random().toString(36).slice(2, 3))
    .join("");

// ---------- Feature Marketplace ----------
export type MarketplaceStatus = "installed" | "available" | "upgrade";
export interface MarketplaceFeature {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  status: MarketplaceStatus;
  plan: "starter" | "professional" | "enterprise";
  users: number;
  rating: number;
}

const FEATURES: MarketplaceFeature[] = [
  { id: "guest-wifi", name: "Guest WiFi", category: "Networking", description: "Onboard guests with captive portals and OTP login.", icon: "Wifi", status: "installed", plan: "starter", users: 128_540, rating: 4.9 },
  { id: "captive-portal", name: "Captive Portal Builder", category: "Networking", description: "Drag-and-drop portal design with live preview.", icon: "LayoutTemplate", status: "installed", plan: "professional", users: 63_210, rating: 4.8 },
  { id: "freeradius", name: "FreeRADIUS", category: "Auth", description: "Enterprise AAA for MikroTik & vendor gear.", icon: "ShieldCheck", status: "installed", plan: "professional", users: 21_450, rating: 4.7 },
  { id: "wireguard", name: "WireGuard Tunnels", category: "Networking", description: "Zero-config VPN for remote routers.", icon: "Network", status: "installed", plan: "professional", users: 18_770, rating: 4.9 },
  { id: "analytics", name: "Advanced Analytics", category: "Analytics", description: "Cohorts, funnels, and revenue attribution.", icon: "BarChart3", status: "upgrade", plan: "enterprise", users: 9_320, rating: 4.6 },
  { id: "monitoring", name: "Live Monitoring", category: "Analytics", description: "CPU/RAM/latency streams for every router.", icon: "Activity", status: "installed", plan: "professional", users: 42_800, rating: 4.8 },
  { id: "ai-assistant", name: "AI Assistant", category: "Automation", description: "Copilot for support & network diagnostics.", icon: "Sparkles", status: "available", plan: "enterprise", users: 3_120, rating: 4.5 },
  { id: "voucher", name: "Voucher Login", category: "Auth", description: "Generate & sell prepaid guest vouchers.", icon: "Ticket", status: "installed", plan: "starter", users: 87_100, rating: 4.7 },
  { id: "qr", name: "QR Login", category: "Auth", description: "One-scan guest onboarding.", icon: "QrCode", status: "installed", plan: "starter", users: 96_300, rating: 4.9 },
  { id: "social", name: "Social Login", category: "Auth", description: "Google, Apple, Facebook & Microsoft.", icon: "Users", status: "available", plan: "professional", users: 14_090, rating: 4.4 },
  { id: "white-label", name: "White Label", category: "Branding", description: "Full custom branding & domains.", icon: "Palette", status: "upgrade", plan: "enterprise", users: 5_800, rating: 4.8 },
  { id: "pms", name: "PMS Integration", category: "Integrations", description: "Opera, Cloudbeds, Mews & Hotelogix.", icon: "Building2", status: "available", plan: "enterprise", users: 2_450, rating: 4.6 },
  { id: "api", name: "API Access", category: "Developer", description: "REST + Webhooks for automation.", icon: "Code2", status: "installed", plan: "professional", users: 11_240, rating: 4.7 },
  { id: "notifications", name: "Notifications", category: "Automation", description: "Multi-channel alerts and digest emails.", icon: "Bell", status: "installed", plan: "starter", users: 132_400, rating: 4.6 },
  { id: "reports", name: "Reports", category: "Analytics", description: "Scheduled PDF / Excel exports.", icon: "FileBarChart", status: "installed", plan: "professional", users: 27_600, rating: 4.5 },
  { id: "billing", name: "Billing", category: "Commerce", description: "Stripe & Razorpay revenue engine.", icon: "Receipt", status: "installed", plan: "professional", users: 8_400, rating: 4.7 },
];

// ---------- Subscription Center ----------
export interface UsageMetric {
  key: string;
  label: string;
  used: number;
  limit: number;
  unit: string;
}
export interface CurrentPlan {
  tier: "Starter" | "Professional" | "Enterprise" | "Custom";
  price: number;
  currency: string;
  cycle: "monthly" | "yearly";
  renewsOn: string;
  seats: number;
  features: string[];
  usage: UsageMetric[];
}
export interface InvoiceRow {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "failed";
  issuedAt: string;
  dueAt: string;
}

const PLAN: CurrentPlan = {
  tier: "Professional",
  price: 499,
  currency: "USD",
  cycle: "monthly",
  renewsOn: iso(21),
  seats: 25,
  features: ["Unlimited locations", "50 routers", "Advanced analytics", "24/7 chat support"],
  usage: [
    { key: "storage", label: "Storage", used: 128, limit: 500, unit: "GB" },
    { key: "api", label: "API calls", used: 812_400, limit: 2_000_000, unit: "req" },
    { key: "sms", label: "SMS credits", used: 3_240, limit: 10_000, unit: "msg" },
    { key: "email", label: "Email credits", used: 24_100, limit: 100_000, unit: "msg" },
    { key: "locations", label: "Locations", used: 42, limit: 100, unit: "" },
    { key: "routers", label: "Routers", used: 128, limit: 500, unit: "" },
    { key: "guests", label: "Guest sessions", used: 84_200, limit: 250_000, unit: "" },
  ],
};

const INVOICES: InvoiceRow[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `inv_${i}`,
  number: `INV-2026-${String(9000 - i).padStart(5, "0")}`,
  amount: 499,
  currency: "USD",
  status: i === 0 ? "open" : i === 6 ? "failed" : "paid",
  issuedAt: iso(-i * 30),
  dueAt: iso(-i * 30 + 15),
}));

// ---------- API Keys / Webhooks ----------
export interface ApiKeyRow {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt: string;
  scopes: string[];
  expiresAt?: string;
}
export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  status: "active" | "paused" | "failed";
  createdAt: string;
}

let API_KEYS: ApiKeyRow[] = [
  { id: "k1", name: "Production Server", key: "sk_live_" + rand(28), createdAt: iso(-120), lastUsedAt: iso(-0.2), scopes: ["read", "write", "admin"] },
  { id: "k2", name: "Analytics ETL", key: "sk_live_" + rand(28), createdAt: iso(-64), lastUsedAt: iso(-1), scopes: ["read"] },
  { id: "k3", name: "Zapier Bridge", key: "sk_live_" + rand(28), createdAt: iso(-14), lastUsedAt: iso(-0.05), scopes: ["read", "write"], expiresAt: iso(180) },
];
let WEBHOOKS: WebhookRow[] = [
  { id: "w1", url: "https://hooks.acme.io/cloudguest", events: ["guest.connected", "router.offline"], status: "active", createdAt: iso(-60) },
  { id: "w2", url: "https://ops.acme.io/alerts", events: ["security.alert"], status: "failed", createdAt: iso(-30) },
];

// ---------- Integrations ----------
export interface IntegrationDef {
  id: string;
  name: string;
  category: "network" | "auth" | "payments" | "messaging" | "pms" | "developer";
  description: string;
  icon: string;
  status: "connected" | "available" | "error";
}
const INTEGRATIONS: IntegrationDef[] = [
  { id: "mikrotik", name: "MikroTik", category: "network", description: "RouterOS API bridge", icon: "Router", status: "connected" },
  { id: "freeradius", name: "FreeRADIUS", category: "auth", description: "AAA for guest login", icon: "ShieldCheck", status: "connected" },
  { id: "wireguard", name: "WireGuard", category: "network", description: "Modern VPN mesh", icon: "Network", status: "connected" },
  { id: "smtp", name: "SMTP", category: "messaging", description: "Transactional email", icon: "Mail", status: "connected" },
  { id: "sms", name: "SMS Gateway", category: "messaging", description: "Twilio / Vonage", icon: "MessageSquare", status: "connected" },
  { id: "google", name: "Google OAuth", category: "auth", description: "Sign in with Google", icon: "Chrome", status: "connected" },
  { id: "facebook", name: "Facebook Login", category: "auth", description: "Meta OAuth", icon: "Facebook", status: "available" },
  { id: "apple", name: "Apple Sign In", category: "auth", description: "Sign in with Apple", icon: "Apple", status: "available" },
  { id: "microsoft", name: "Microsoft Login", category: "auth", description: "Entra ID", icon: "Building2", status: "available" },
  { id: "stripe", name: "Stripe", category: "payments", description: "Global cards & subs", icon: "CreditCard", status: "connected" },
  { id: "razorpay", name: "Razorpay", category: "payments", description: "India payments & UPI", icon: "CreditCard", status: "connected" },
  { id: "slack", name: "Slack", category: "messaging", description: "Alerts in Slack", icon: "Slack", status: "available" },
  { id: "teams", name: "Microsoft Teams", category: "messaging", description: "Alerts in Teams", icon: "Users", status: "available" },
  { id: "webhook", name: "Webhooks", category: "developer", description: "Outbound events", icon: "Webhook", status: "connected" },
  { id: "rest", name: "REST API", category: "developer", description: "Public API access", icon: "Code2", status: "connected" },
];

// ---------- Notification Center ----------
export type NotifCategory =
  | "system"
  | "router"
  | "guest"
  | "billing"
  | "subscription"
  | "security"
  | "maintenance"
  | "portal"
  | "wifi"
  | "wireguard"
  | "alert";
export type NotifPriority = "low" | "medium" | "high" | "critical";
export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  category: NotifCategory;
  priority: NotifPriority;
  location?: string;
  createdAt: string;
  unread: boolean;
  action?: { label: string; href: string };
}

const CATS: NotifCategory[] = ["system", "router", "guest", "billing", "subscription", "security", "maintenance", "portal", "wifi", "wireguard", "alert"];
const PRIS: NotifPriority[] = ["low", "medium", "high", "critical"];
const NOTES = [
  { title: "Router offline", description: "MK-047 lost connection 3 min ago.", category: "router" as NotifCategory, priority: "high" as NotifPriority },
  { title: "High CPU", description: "Router MK-012 CPU sustained at 92%.", category: "router" as NotifCategory, priority: "medium" as NotifPriority },
  { title: "Bandwidth limit reached", description: "Guest quota exceeded on Suite 214.", category: "guest" as NotifCategory, priority: "medium" as NotifPriority },
  { title: "Subscription renewing", description: "Renews in 21 days for $499.", category: "subscription" as NotifCategory, priority: "low" as NotifPriority },
  { title: "Failed login attempts", description: "5 failed attempts for admin@acme.io.", category: "security" as NotifCategory, priority: "high" as NotifPriority },
  { title: "WireGuard tunnel down", description: "Tunnel wg-eu-04 failed handshake.", category: "wireguard" as NotifCategory, priority: "critical" as NotifPriority },
  { title: "Voucher batch expired", description: "Batch VB-2098 expired today.", category: "wifi" as NotifCategory, priority: "low" as NotifPriority },
  { title: "Maintenance window", description: "Scheduled Sun 02:00 UTC.", category: "maintenance" as NotifCategory, priority: "low" as NotifPriority },
  { title: "Portal published", description: "Lobby portal v12 is live.", category: "portal" as NotifCategory, priority: "low" as NotifPriority },
  { title: "Payment received", description: "$499 from Acme Hotels.", category: "billing" as NotifCategory, priority: "low" as NotifPriority },
];

const NOTIFS: NotificationItem[] = Array.from({ length: 42 }).map((_, i) => {
  const src = NOTES[i % NOTES.length];
  return {
    id: `n_${i}`,
    title: src.title,
    description: src.description,
    category: src.category,
    priority: src.priority,
    location: ["HQ", "Suite 214", "Conference Hall", "Cafe 3rd Ave"][i % 4],
    createdAt: iso(-(i * 0.15)),
    unread: i < 12,
    action: { label: "Open", href: "/dashboard" },
  };
});

// ---------- Help Center ----------
export interface HelpArticle {
  id: string;
  title: string;
  category: "docs" | "video" | "kb" | "faq" | "release" | "api";
  summary: string;
  updatedAt: string;
}
const HELP: HelpArticle[] = [
  { id: "h1", title: "Getting started with CloudGuest", category: "docs", summary: "Set up your first property in 10 minutes.", updatedAt: iso(-3) },
  { id: "h2", title: "Provisioning routers", category: "video", summary: "Watch the router registration wizard end-to-end.", updatedAt: iso(-6) },
  { id: "h3", title: "Voucher billing FAQ", category: "faq", summary: "Common questions from front-desk teams.", updatedAt: iso(-9) },
  { id: "h4", title: "REST API reference", category: "api", summary: "Endpoints, auth, and rate limits.", updatedAt: iso(-1) },
  { id: "h5", title: "Release notes 4.12", category: "release", summary: "Ships new marketplace + system monitoring.", updatedAt: iso(-2) },
  { id: "h6", title: "Portal branding playbook", category: "kb", summary: "Best practices for enterprise brands.", updatedAt: iso(-11) },
];

// ---------- Public service ----------
export const systemService = {
  // marketplace
  async listMarketplace() { await delay(); return FEATURES; },
  async toggleFeature(id: string, enable: boolean) {
    await delay(200);
    const f = FEATURES.find((x) => x.id === id);
    if (f) f.status = enable ? "installed" : "available";
    return f;
  },

  // subscription
  async getPlan() { await delay(); return PLAN; },
  async listInvoices() { await delay(); return INVOICES; },

  // system health
  async systemMetrics() {
    await delay();
    return Array.from({ length: 24 }).map((_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      cpu: 30 + Math.round(Math.random() * 40),
      ram: 40 + Math.round(Math.random() * 30),
      disk: 55 + Math.round(Math.random() * 15),
      requests: 1200 + Math.round(Math.random() * 900),
      queue: Math.round(Math.random() * 20),
      emails: 100 + Math.round(Math.random() * 400),
      sms: 20 + Math.round(Math.random() * 150),
      errors: Math.round(Math.random() * 8),
    }));
  },

  // api keys
  async listApiKeys() { await delay(); return API_KEYS; },
  async createApiKey(name: string, scopes: string[]) {
    await delay(200);
    const row: ApiKeyRow = { id: `k_${Date.now()}`, name, key: "sk_live_" + rand(28), createdAt: iso(0), lastUsedAt: iso(0), scopes };
    API_KEYS = [row, ...API_KEYS];
    return row;
  },
  async revokeApiKey(id: string) { await delay(150); API_KEYS = API_KEYS.filter((k) => k.id !== id); return true; },
  async rotateApiKey(id: string) {
    await delay(200);
    const k = API_KEYS.find((x) => x.id === id);
    if (k) k.key = "sk_live_" + rand(28);
    return k;
  },
  async listWebhooks() { await delay(); return WEBHOOKS; },
  async createWebhook(url: string, events: string[]) {
    await delay(200);
    const row: WebhookRow = { id: `w_${Date.now()}`, url, events, status: "active", createdAt: iso(0) };
    WEBHOOKS = [row, ...WEBHOOKS];
    return row;
  },
  async deleteWebhook(id: string) { await delay(150); WEBHOOKS = WEBHOOKS.filter((w) => w.id !== id); return true; },

  // integrations
  async listIntegrations() { await delay(); return INTEGRATIONS; },

  // notification center
  async listNotifications(filters?: { category?: NotifCategory; priority?: NotifPriority; unreadOnly?: boolean }) {
    await delay();
    return NOTIFS.filter((n) => {
      if (filters?.category && n.category !== filters.category) return false;
      if (filters?.priority && n.priority !== filters.priority) return false;
      if (filters?.unreadOnly && !n.unread) return false;
      return true;
    });
  },
  async markAllRead() { await delay(120); NOTIFS.forEach((n) => (n.unread = false)); return true; },
  async markRead(id: string) {
    await delay(80);
    const n = NOTIFS.find((x) => x.id === id);
    if (n) n.unread = false;
    return n;
  },

  // help
  async listHelp() { await delay(); return HELP; },

  // exports
  async requestExport(entity: string, format: "pdf" | "excel" | "csv") {
    await delay(400);
    return { id: `exp_${Date.now()}`, entity, format, status: "queued" as const, requestedAt: iso(0) };
  },

  categories: CATS,
  priorities: PRIS,
};
