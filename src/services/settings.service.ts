import type {
  ApiKey,
  BackupEntry,
  IntegrationCard,
  PlatformSettings,
} from "@/types/settings";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const now = () => new Date().toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

const defaultIntegrations: IntegrationCard[] = [
  { id: "mikrotik", name: "MikroTik", category: "network", description: "RouterOS management & API bridge", status: "connected", configured: true },
  { id: "freeradius", name: "FreeRADIUS", category: "network", description: "AAA server for guest authentication", status: "connected", configured: true },
  { id: "wireguard", name: "WireGuard", category: "network", description: "Modern VPN tunneling for edge routers", status: "connected", configured: true },
  { id: "opera_pms", name: "Opera PMS", category: "pms", description: "Oracle Opera property management system", status: "disconnected", configured: false },
  { id: "hotelogix", name: "Hotelogix", category: "pms", description: "Cloud hotel PMS integration", status: "disconnected", configured: false },
  { id: "cloudbeds", name: "Cloudbeds", category: "pms", description: "Cloudbeds reservations sync", status: "connected", configured: true },
  { id: "stayflexi", name: "Stayflexi", category: "pms", description: "Unified hotel operations", status: "disconnected", configured: false },
  { id: "mews", name: "Mews", category: "pms", description: "Mews open-API PMS", status: "error", configured: true },
  { id: "stripe", name: "Stripe", category: "payment", description: "Global card processing", status: "connected", configured: true },
  { id: "razorpay", name: "Razorpay", category: "payment", description: "India payments & UPI", status: "connected", configured: true },
  { id: "openai", name: "OpenAI", category: "ai", description: "GPT-powered assistant and copilots", status: "connected", configured: true },
];

const seedKeys: ApiKey[] = [
  { id: "k_1", name: "Production", key: "sk_live_" + rand(24), createdAt: daysFromNow(-120), lastUsedAt: daysFromNow(-1), scopes: ["read", "write"] },
  { id: "k_2", name: "Staging",    key: "sk_test_" + rand(24), createdAt: daysFromNow(-45),  lastUsedAt: daysFromNow(-3), scopes: ["read"] },
];

const seedBackups: BackupEntry[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `bk_${i}`,
  createdAt: daysFromNow(-i - 1),
  sizeMb: 240 + Math.round(Math.random() * 120),
  type: i % 3 === 0 ? "manual" : "scheduled",
  status: i === 5 ? "failed" : "success",
}));

function rand(len: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

let state: PlatformSettings = {
  general: {
    platformName: "CloudGuest",
    companyName: "CloudGuest Networks Inc.",
    supportEmail: "support@cloudguest.io",
    supportPhone: "+1 (415) 555-0132",
    website: "https://cloudguest.io",
    defaultLanguage: "en",
    timezone: "UTC",
    currency: "USD",
    dateFormat: "DD MMM YYYY",
    timeFormat: "24h",
  },
  auth: {
    emailLogin: true, mobileOtp: true, emailOtp: true, voucherLogin: true,
    pmsLogin: false, socialLogin: true, qrLogin: true,
    sessionTimeoutMinutes: 60, rememberLogin: true,
    passwordExpiryDays: 90, maxLoginAttempts: 5,
  },
  security: {
    forceHttps: true, twoFactor: true,
    ipWhitelist: ["10.0.0.0/8", "192.168.1.0/24"],
    ipBlacklist: ["45.155.204.10"],
    deviceTrust: true, passwordComplexity: "high",
    captcha: true, auditLogging: true,
  },
  notifications: {
    email: true, sms: true, push: true, browser: true,
    slack: true, webhooks: true,
    slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX",
    webhookEndpoint: "https://api.cloudguest.io/webhooks/events",
  },
  email: {
    provider: "aws_ses", host: "email-smtp.us-east-1.amazonaws.com",
    port: 587, username: "AKIAIOSFODNN7EXAMPLE",
    password: rand(24), fromAddress: "noreply@cloudguest.io",
    connectionStatus: "connected", lastTestedAt: daysFromNow(-1),
  },
  sms: {
    provider: "twilio", apiKey: rand(32), senderId: "CGUEST",
    templateId: "TMP_00123", connectionStatus: "connected",
    lastTestedAt: daysFromNow(-2),
  },
  storage: {
    provider: "aws_s3", bucket: "cloudguest-prod", region: "us-east-1",
    accessKey: rand(20), secretKey: rand(40),
    usageGb: 148.3, quotaGb: 500, connectionStatus: "connected",
  },
  integrations: defaultIntegrations,
  payment: {
    provider: "stripe", publishableKey: "pk_live_" + rand(24),
    secretKey: "sk_live_" + rand(24), webhookSecret: "whsec_" + rand(28),
    currency: "USD", taxPercent: 8.5, autoInvoice: true,
  },
  api: {
    keys: seedKeys, webhookUrl: "https://api.cloudguest.io/v1/webhook",
    rateLimitPerMinute: 600, callsToday: 18240, callsMonth: 512340, errorsToday: 34,
  },
  system: {
    maintenanceMode: false, debugMode: false, autoRefresh: true,
    logRetentionDays: 30, ntpServer: "pool.ntp.org",
    lastCacheClearAt: daysFromNow(-4),
  },
  backup: {
    schedule: "daily", lastBackupAt: daysFromNow(-1),
    nextBackupAt: daysFromNow(0), history: seedBackups,
  },
  featureFlags: {
    whiteLabel: true, aiAssistant: true, analytics: true, billing: true,
    pms: false, qrLogin: true, voucherLogin: true, socialLogin: true,
    monitoring: true, auditLogs: true,
  },
  license: {
    plan: "enterprise", licenseKey: "CGST-ENT-" + rand(4).toUpperCase() + "-" + rand(4).toUpperCase() + "-" + rand(4).toUpperCase(),
    activatedFeatures: ["White Label", "AI Assistant", "Analytics", "Billing", "Monitoring", "Audit Logs", "Multi-Org", "SSO"],
    organizationLimit: 500, routerLimit: 10_000, guestLimit: 1_000_000,
    expiryDate: daysFromNow(365),
  },
  about: {
    platformVersion: "2.14.0", buildNumber: "build.20260719.1",
    environment: "production", reactVersion: "19.0.0",
    apiVersion: "v1.14", databaseVersion: "PostgreSQL 16.2",
    redisVersion: "Redis 7.2.4",
    licenseNotice: "© 2026 CloudGuest Networks Inc. Enterprise License.",
  },
  updatedAt: now(),
};

function touch<T extends object>(patch: Partial<PlatformSettings>): PlatformSettings {
  state = { ...state, ...patch, updatedAt: now() } as PlatformSettings;
  return state;
}

export const settingsService = {
  async getAll(): Promise<PlatformSettings> {
    await delay();
    return structuredClone(state);
  },
  async updateSection<K extends keyof PlatformSettings>(section: K, value: PlatformSettings[K]): Promise<PlatformSettings> {
    await delay(250);
    touch({ [section]: value } as Partial<PlatformSettings>);
    return structuredClone(state);
  },
  async resetAll(): Promise<PlatformSettings> {
    await delay(400);
    state = { ...state, updatedAt: now() };
    return structuredClone(state);
  },
  async testEmail(): Promise<{ ok: boolean; message: string }> {
    await delay(600);
    const ok = Math.random() > 0.15;
    state.email = { ...state.email, connectionStatus: ok ? "connected" : "disconnected", lastTestedAt: now() };
    return { ok, message: ok ? "Test email delivered" : "Provider rejected credentials" };
  },
  async testSms(): Promise<{ ok: boolean; message: string }> {
    await delay(600);
    const ok = Math.random() > 0.15;
    state.sms = { ...state.sms, connectionStatus: ok ? "connected" : "disconnected", lastTestedAt: now() };
    return { ok, message: ok ? "Test SMS delivered" : "Gateway timed out" };
  },
  async testStorage(): Promise<{ ok: boolean; message: string }> {
    await delay(600);
    const ok = Math.random() > 0.1;
    state.storage = { ...state.storage, connectionStatus: ok ? "connected" : "disconnected" };
    return { ok, message: ok ? "Bucket reachable" : "Access denied" };
  },
  async testIntegration(id: string): Promise<{ ok: boolean }> {
    await delay(500);
    const ok = Math.random() > 0.2;
    state.integrations = state.integrations.map((i) =>
      i.id === id ? { ...i, status: ok ? "connected" : "error" } : i,
    );
    return { ok };
  },
  async toggleIntegration(id: string): Promise<PlatformSettings> {
    await delay(200);
    state.integrations = state.integrations.map((i) =>
      i.id === id
        ? { ...i, status: i.status === "connected" ? "disconnected" : "connected", configured: true }
        : i,
    );
    return structuredClone(state);
  },
  async clearCache(): Promise<void> {
    await delay(400);
    state.system.lastCacheClearAt = now();
  },
  async restartServices(): Promise<void> {
    await delay(800);
  },
  async createApiKey(name: string): Promise<ApiKey> {
    await delay(300);
    const key: ApiKey = {
      id: "k_" + Math.random().toString(36).slice(2, 8),
      name, key: "sk_live_" + rand(24),
      createdAt: now(), scopes: ["read", "write"],
    };
    state.api.keys = [key, ...state.api.keys];
    return key;
  },
  async revokeApiKey(id: string): Promise<void> {
    await delay(200);
    state.api.keys = state.api.keys.filter((k) => k.id !== id);
  },
  async backupNow(): Promise<BackupEntry> {
    await delay(700);
    const entry: BackupEntry = {
      id: "bk_" + Math.random().toString(36).slice(2, 8),
      createdAt: now(), sizeMb: 260 + Math.round(Math.random() * 80),
      type: "manual", status: "success",
    };
    state.backup.history = [entry, ...state.backup.history].slice(0, 20);
    state.backup.lastBackupAt = entry.createdAt;
    return entry;
  },
  async restoreBackup(id: string): Promise<void> {
    await delay(700);
    void id;
  },
  async exportConfig(): Promise<string> {
    await delay(200);
    return JSON.stringify(state, null, 2);
  },
  async importConfig(payload: string): Promise<PlatformSettings> {
    await delay(300);
    try {
      const parsed = JSON.parse(payload) as PlatformSettings;
      state = { ...state, ...parsed, updatedAt: now() };
    } catch { /* ignore */ }
    return structuredClone(state);
  },
  async testAllConnections(): Promise<{ email: boolean; sms: boolean; storage: boolean }> {
    await delay(700);
    const email = Math.random() > 0.1;
    const sms = Math.random() > 0.1;
    const storage = Math.random() > 0.1;
    state.email.connectionStatus = email ? "connected" : "disconnected";
    state.sms.connectionStatus = sms ? "connected" : "disconnected";
    state.storage.connectionStatus = storage ? "connected" : "disconnected";
    return { email, sms, storage };
  },
};
