import type {
  ApiKeyRow,
  FeatureCard,
  FeaturePolicy,
  IntegrationRow,
  ModuleLimits,
  NasDevice,
  NasGroup,
  NotificationChannel,
  PolicyAssignment,
  SecurityConfig,
  TenantAuditEntry,
  UsageSnapshot,
  WebhookRow,
} from "@/types/tenant";
import { ROUTER_OPS } from "@/types/tenant";

const FEATURE_CATALOG: Omit<FeatureCard, "status">[] = [
  { key: "guestWifi", name: "Guest WiFi", description: "Public Wi-Fi with session and quota tracking.", category: "Networking" },
  { key: "captivePortal", name: "Captive Portal", description: "Branded splash and auth landing.", category: "Networking" },
  { key: "freeradius", name: "FreeRADIUS", description: "RADIUS auth backend for enterprise Wi-Fi.", category: "Networking" },
  { key: "wireguard", name: "WireGuard", description: "Site-to-site VPN mesh.", category: "Networking" },
  { key: "analytics", name: "Analytics", description: "Traffic, dwell time, and behavioural charts.", category: "Insights" },
  { key: "monitoring", name: "Monitoring", description: "Router uptime, CPU, RAM, latency.", category: "Insights" },
  { key: "reports", name: "Reports", description: "Scheduled PDF / Excel / CSV delivery.", category: "Insights" },
  { key: "voucherLogin", name: "Voucher Login", description: "Prepaid access codes for guests.", category: "Authentication" },
  { key: "qrLogin", name: "QR Login", description: "Scan-to-connect onboarding.", category: "Authentication" },
  { key: "otpLogin", name: "OTP Login", description: "Mobile & email one-time passcodes.", category: "Authentication" },
  { key: "socialLogin", name: "Social Login", description: "Google, Facebook, Apple sign-in.", category: "Authentication" },
  { key: "sms", name: "SMS", description: "Outbound SMS engine and templates.", category: "Messaging" },
  { key: "email", name: "Email", description: "Transactional email pipeline.", category: "Messaging" },
  { key: "whiteLabel", name: "White Label", description: "Custom branding, domain and themes.", category: "Branding" },
  { key: "pms", name: "PMS", description: "Property management system integrations.", category: "Integrations" },
  { key: "billing", name: "Billing", description: "Plans, invoices, and payment gateways.", category: "Commerce" },
  { key: "api", name: "API", description: "Public REST + webhook surface.", category: "Developer" },
  { key: "aiAssistant", name: "AI Assistant", description: "In-app copilot for analytics & support.", category: "Insights" },
  { key: "notificationCenter", name: "Notification Center", description: "Priority alerts, in-app drawer.", category: "Messaging" },
  { key: "auditLogs", name: "Audit Logs", description: "Timeline of every tenant change.", category: "Governance" },
];

interface CustomerState {
  features: Record<string, "enabled" | "disabled" | "upgrade_required">;
  limits: ModuleLimits;
  groups: NasGroup[];
  nas: NasDevice[];
  policies: FeaturePolicy[];
  integrations: IntegrationRow[];
  apiKeys: ApiKeyRow[];
  webhooks: WebhookRow[];
  security: SecurityConfig;
  notifications: NotificationChannel[];
  audit: TenantAuditEntry[];
  usage: UsageSnapshot;
}

const STATE: Record<string, CustomerState> = {};

function delay<T>(v: T, ms = 250): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

function seed(id: string): CustomerState {
  if (STATE[id]) return STATE[id];
  const features: CustomerState["features"] = {};
  FEATURE_CATALOG.forEach((f, i) => {
    features[f.key] = i % 7 === 5 ? "upgrade_required" : i % 5 === 0 ? "disabled" : "enabled";
  });
  const groups: NasGroup[] = [
    { id: "GRP-HTL", name: "Hotel Group", description: "All hospitality properties.", nasCount: 3 },
    { id: "GRP-CAF", name: "Cafe Group", description: "F&B outlets.", nasCount: 1 },
    { id: "GRP-HSP", name: "Hospital Group", description: "Clinical sites.", nasCount: 1 },
    { id: "GRP-WHR", name: "Warehouse Group", description: "Logistics and back-office.", nasCount: 1 },
    { id: "GRP-BRN", name: "Branch Office", description: "Corporate branches.", nasCount: 0 },
  ];
  const nas: NasDevice[] = [
    {
      id: "NAS-DEL-001",
      nasIdentifier: "cg-del-001",
      routerIdentity: "MT-DEL-01",
      name: "Hotel Delhi Core",
      serialNumber: "SN-DEL-1001",
      model: "MikroTik CCR2004",
      routerOsVersion: "7.14.2",
      publicIp: "203.0.113.10",
      privateIp: "10.10.1.1",
      locationId: "LOC-90001",
      locationName: "Hotel Delhi",
      groupId: "GRP-HTL",
      status: "online",
    },
    {
      id: "NAS-DEL-002",
      nasIdentifier: "cg-del-002",
      routerIdentity: "MT-DEL-02",
      name: "Hotel Delhi Guest",
      serialNumber: "SN-DEL-1002",
      model: "MikroTik hAP ax3",
      routerOsVersion: "7.14.1",
      publicIp: "203.0.113.11",
      privateIp: "10.10.2.1",
      locationId: "LOC-90001",
      locationName: "Hotel Delhi",
      groupId: "GRP-HTL",
      status: "online",
    },
    {
      id: "NAS-MUM-001",
      nasIdentifier: "cg-mum-001",
      routerIdentity: "MT-MUM-01",
      name: "Hotel Mumbai",
      serialNumber: "SN-MUM-2001",
      model: "MikroTik RB5009",
      routerOsVersion: "7.13.5",
      publicIp: "203.0.113.20",
      privateIp: "10.20.1.1",
      locationId: "LOC-90002",
      locationName: "Hotel Mumbai",
      groupId: "GRP-HTL",
      status: "degraded",
    },
    {
      id: "NAS-JAI-001",
      nasIdentifier: "cg-jai-001",
      routerIdentity: "MT-JAI-01",
      name: "Cafe Jaipur",
      serialNumber: "SN-JAI-3001",
      model: "MikroTik hEX S",
      routerOsVersion: "7.13.0",
      publicIp: "203.0.113.30",
      privateIp: "10.30.1.1",
      locationId: "LOC-90003",
      locationName: "Cafe Jaipur",
      groupId: "GRP-CAF",
      status: "online",
    },
    {
      id: "NAS-HSP-001",
      nasIdentifier: "cg-hsp-001",
      routerIdentity: "MT-HSP-01",
      name: "Hospital Noida",
      serialNumber: "SN-HSP-4001",
      model: "MikroTik CCR1036",
      routerOsVersion: "7.14.0",
      publicIp: "203.0.113.40",
      privateIp: "10.40.1.1",
      locationId: "LOC-90004",
      locationName: "Hospital Noida",
      groupId: "GRP-HSP",
      status: "offline",
    },
    {
      id: "NAS-PUN-001",
      nasIdentifier: "cg-pun-001",
      routerIdentity: "MT-PUN-01",
      name: "Warehouse Pune",
      serialNumber: "SN-PUN-5001",
      model: "MikroTik hAP ac2",
      routerOsVersion: "7.12.1",
      publicIp: "203.0.113.50",
      privateIp: "10.50.1.1",
      locationId: "LOC-90005",
      locationName: "Warehouse Pune",
      groupId: "GRP-WHR",
      status: "online",
    },
  ];
  const routerOps = Object.fromEntries(ROUTER_OPS.map((k) => [k, k !== "factory_reset" && k !== "delete"])) as Record<
    string,
    boolean
  >;
  const featureBool = Object.fromEntries(
    FEATURE_CATALOG.map((f) => [f.key, features[f.key] === "enabled"]),
  );
  const policies: FeaturePolicy[] = [
    {
      id: "POL-HOTEL-PREM",
      name: "Hotel Premium",
      description: "Full guest experience for hotel properties.",
      features: { ...featureBool, whiteLabel: true, socialLogin: true, aiAssistant: true },
      routerOps,
      assignments: [
        { scope: "location", targetId: "LOC-90001", targetLabel: "Hotel Delhi" },
        { scope: "nas_group", targetId: "GRP-HTL", targetLabel: "Hotel Group" },
      ],
      updatedAt: new Date().toISOString(),
    },
    {
      id: "POL-CAFE-LITE",
      name: "Cafe Lite",
      description: "Lightweight portal + voucher access.",
      features: { ...featureBool, whiteLabel: false, socialLogin: false, aiAssistant: false, freeradius: false },
      routerOps: { ...routerOps, upgrade_os: false, terminal: false },
      assignments: [{ scope: "nas_group", targetId: "GRP-CAF", targetLabel: "Cafe Group" }],
      updatedAt: new Date().toISOString(),
    },
  ];
  const integrations: IntegrationRow[] = [
    { key: "smtp", name: "SMTP", category: "Messaging", enabled: true, configured: true },
    { key: "sms", name: "SMS Gateway", category: "Messaging", enabled: true, configured: true },
    { key: "freeradius", name: "FreeRADIUS", category: "Networking", enabled: true, configured: true },
    { key: "wireguard", name: "WireGuard", category: "Networking", enabled: false, configured: false },
    { key: "google", name: "Google OAuth", category: "Auth", enabled: true, configured: true },
    { key: "facebook", name: "Facebook Login", category: "Auth", enabled: false, configured: false },
    { key: "apple", name: "Apple Login", category: "Auth", enabled: false, configured: false },
    { key: "stripe", name: "Stripe", category: "Commerce", enabled: true, configured: true },
    { key: "razorpay", name: "Razorpay", category: "Commerce", enabled: false, configured: false },
    { key: "webhook", name: "Webhooks", category: "Developer", enabled: true, configured: true },
    { key: "rest", name: "REST API", category: "Developer", enabled: true, configured: true },
  ];
  const apiKeys: ApiKeyRow[] = [
    {
      id: "AK-001",
      label: "Production backend",
      prefix: "cg_live_9f2a",
      scopes: ["read:*", "write:guests"],
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      lastUsed: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
      id: "AK-002",
      label: "Analytics ETL",
      prefix: "cg_live_31bd",
      scopes: ["read:analytics"],
      createdAt: new Date(Date.now() - 21 * 86400000).toISOString(),
      lastUsed: new Date(Date.now() - 45 * 60000).toISOString(),
    },
  ];
  const webhooks: WebhookRow[] = [
    { id: "WH-1", url: "https://ops.example.com/hooks/cloudguest", events: ["guest.connected", "router.down"], enabled: true },
  ];
  const security: SecurityConfig = {
    mfaRequired: true,
    passwordMinLength: 12,
    passwordRotationDays: 90,
    sessionTimeoutMinutes: 30,
    ipAllowlist: [],
    allowedDomains: ["cloudguest.io"],
  };
  const notifications: NotificationChannel[] = [
    { key: "email", enabled: true, events: ["billing.invoice", "router.down", "guest.blocked"] },
    { key: "sms", enabled: true, events: ["router.down"] },
    { key: "push", enabled: false, events: [] },
    { key: "webhook", enabled: true, events: ["guest.connected", "policy.updated"] },
  ];
  const audit: TenantAuditEntry[] = [
    { id: "AUD-1", at: new Date(Date.now() - 3600000).toISOString(), actor: "priya@cloudguest.io", action: "Module Enabled", target: "Analytics", meta: "trial → enabled" },
    { id: "AUD-2", at: new Date(Date.now() - 7200000).toISOString(), actor: "priya@cloudguest.io", action: "Router Added", target: "NAS-DEL-002" },
    { id: "AUD-3", at: new Date(Date.now() - 3 * 3600000).toISOString(), actor: "system", action: "Policy Updated", target: "Hotel Premium" },
    { id: "AUD-4", at: new Date(Date.now() - 5 * 3600000).toISOString(), actor: "ravi@cloudguest.io", action: "User Invited", target: "manager@hoteldelhi.com" },
    { id: "AUD-5", at: new Date(Date.now() - 26 * 3600000).toISOString(), actor: "priya@cloudguest.io", action: "Brand Changed", target: "Primary color #2563eb → #0f766e" },
  ];
  const state: CustomerState = {
    features,
    limits: { locations: 25, routers: 100, nas: 100, guests: 25000, concurrentSessions: 5000, staff: 50, apiKeys: 10, storageGb: 250, smsCredits: 5000, emailCredits: 50000 },
    groups,
    nas,
    policies,
    integrations,
    apiKeys,
    webhooks,
    security,
    notifications,
    audit,
    usage: { locations: 6, routers: 12, nas: nas.length, guests: 4218, bandwidthGb: 812, storageGb: 96, emails: 12480, sms: 1043, apiCalls: 84210 },
  };
  STATE[id] = state;
  return state;
}

function pushAudit(id: string, entry: Omit<TenantAuditEntry, "id" | "at">) {
  const s = seed(id);
  s.audit.unshift({ id: `AUD-${Date.now()}`, at: new Date().toISOString(), ...entry });
}

export const tenantService = {
  featureCatalog: FEATURE_CATALOG,

  async getConfig(customerId: string) {
    const s = seed(customerId);
    const features: FeatureCard[] = FEATURE_CATALOG.map((c) => ({ ...c, status: s.features[c.key] ?? "disabled" }));
    return delay({ features, limits: s.limits });
  },
  async setFeatureStatus(customerId: string, key: string, status: "enabled" | "disabled" | "upgrade_required") {
    const s = seed(customerId);
    s.features[key] = status;
    pushAudit(customerId, { actor: "admin", action: "Feature Enabled", target: key, meta: `→ ${status}` });
    return delay(true);
  },
  async setLimits(customerId: string, limits: ModuleLimits) {
    seed(customerId).limits = limits;
    pushAudit(customerId, { actor: "admin", action: "Limits Updated", target: "module limits" });
    return delay(true);
  },

  async listGroups(id: string) {
    return delay(seed(id).groups);
  },
  async saveGroup(id: string, group: Omit<NasGroup, "nasCount">) {
    const s = seed(id);
    const idx = s.groups.findIndex((g) => g.id === group.id);
    if (idx >= 0) s.groups[idx] = { ...s.groups[idx], ...group };
    else s.groups.push({ ...group, nasCount: 0 });
    pushAudit(id, { actor: "admin", action: "NAS Group Saved", target: group.name });
    return delay(true);
  },
  async deleteGroup(id: string, groupId: string) {
    const s = seed(id);
    s.groups = s.groups.filter((g) => g.id !== groupId);
    s.nas.forEach((n) => { if (n.groupId === groupId) n.groupId = undefined; });
    return delay(true);
  },

  async listNas(id: string) {
    return delay(seed(id).nas);
  },
  async saveNas(id: string, nas: NasDevice) {
    const s = seed(id);
    const idx = s.nas.findIndex((n) => n.id === nas.id);
    if (idx >= 0) s.nas[idx] = nas;
    else s.nas.push(nas);
    s.groups.forEach((g) => { g.nasCount = s.nas.filter((n) => n.groupId === g.id).length; });
    pushAudit(id, { actor: "admin", action: "Router Added", target: nas.id });
    return delay(true);
  },
  async deleteNas(id: string, nasId: string) {
    const s = seed(id);
    s.nas = s.nas.filter((n) => n.id !== nasId);
    return delay(true);
  },

  async listPolicies(id: string) {
    return delay(seed(id).policies);
  },
  async savePolicy(id: string, policy: FeaturePolicy) {
    const s = seed(id);
    const idx = s.policies.findIndex((p) => p.id === policy.id);
    const stamped = { ...policy, updatedAt: new Date().toISOString() };
    if (idx >= 0) s.policies[idx] = stamped;
    else s.policies.push(stamped);
    pushAudit(id, { actor: "admin", action: "Policy Updated", target: policy.name });
    return delay(true);
  },
  async deletePolicy(id: string, policyId: string) {
    const s = seed(id);
    s.policies = s.policies.filter((p) => p.id !== policyId);
    return delay(true);
  },
  async assignPolicy(id: string, policyId: string, assignment: PolicyAssignment) {
    const s = seed(id);
    const p = s.policies.find((x) => x.id === policyId);
    if (p) {
      const dup = p.assignments.find(
        (a) => a.scope === assignment.scope && a.targetId === assignment.targetId,
      );
      if (!dup) p.assignments.push(assignment);
      pushAudit(id, { actor: "admin", action: "Policy Assigned", target: `${p.name} → ${assignment.targetLabel}` });
    }
    return delay(true);
  },
  async unassignPolicy(id: string, policyId: string, idxOrTarget: string) {
    const s = seed(id);
    const p = s.policies.find((x) => x.id === policyId);
    if (p) p.assignments = p.assignments.filter((a) => `${a.scope}:${a.targetId}` !== idxOrTarget);
    return delay(true);
  },

  async listIntegrations(id: string) {
    return delay(seed(id).integrations);
  },
  async toggleIntegration(id: string, key: string, enabled: boolean) {
    const row = seed(id).integrations.find((i) => i.key === key);
    if (row) row.enabled = enabled;
    return delay(true);
  },

  async listApiKeys(id: string) {
    return delay(seed(id).apiKeys);
  },
  async createApiKey(id: string, label: string, scopes: string[]) {
    const s = seed(id);
    const secret = `cg_live_${Math.random().toString(36).slice(2, 10)}`;
    const row: ApiKeyRow = {
      id: `AK-${Date.now()}`,
      label,
      prefix: secret,
      scopes,
      createdAt: new Date().toISOString(),
    };
    s.apiKeys.push(row);
    pushAudit(id, { actor: "admin", action: "API Key Created", target: label });
    return delay({ row, secret: `${secret}_${Math.random().toString(36).slice(2, 18)}` });
  },
  async rotateApiKey(id: string, keyId: string) {
    const s = seed(id);
    const row = s.apiKeys.find((k) => k.id === keyId);
    if (row) row.prefix = `cg_live_${Math.random().toString(36).slice(2, 10)}`;
    return delay(true);
  },
  async deleteApiKey(id: string, keyId: string) {
    const s = seed(id);
    s.apiKeys = s.apiKeys.filter((k) => k.id !== keyId);
    return delay(true);
  },
  async listWebhooks(id: string) {
    return delay(seed(id).webhooks);
  },
  async saveWebhook(id: string, wh: WebhookRow) {
    const s = seed(id);
    const idx = s.webhooks.findIndex((w) => w.id === wh.id);
    if (idx >= 0) s.webhooks[idx] = wh;
    else s.webhooks.push(wh);
    return delay(true);
  },
  async deleteWebhook(id: string, whId: string) {
    const s = seed(id);
    s.webhooks = s.webhooks.filter((w) => w.id !== whId);
    return delay(true);
  },

  async getSecurity(id: string) {
    return delay(seed(id).security);
  },
  async setSecurity(id: string, cfg: SecurityConfig) {
    seed(id).security = cfg;
    pushAudit(id, { actor: "admin", action: "Security Updated", target: "policy" });
    return delay(true);
  },

  async getNotifications(id: string) {
    return delay(seed(id).notifications);
  },
  async setNotifications(id: string, channels: NotificationChannel[]) {
    seed(id).notifications = channels;
    return delay(true);
  },

  async getUsage(id: string) {
    return delay(seed(id).usage);
  },
  async listAudit(id: string) {
    return delay(seed(id).audit);
  },
};
