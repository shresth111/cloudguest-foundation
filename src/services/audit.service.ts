import type {
  AuditAction,
  AuditAnalytics,
  AuditCategory,
  AuditFilters,
  AuditKpis,
  AuditLog,
  AuditSeverity,
  AuditStatus,
  PaginatedLogs,
  RetentionSettings,
  UserActivityRecord,
} from "@/types/audit";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const ORGS = [
  { id: "org_1", name: "Marriott Bonvoy" },
  { id: "org_2", name: "Taj Hotels" },
  { id: "org_3", name: "OYO Networks" },
  { id: "org_4", name: "Starbucks India" },
  { id: "org_5", name: "IndiGo Lounges" },
];

const LOCATIONS = [
  { id: "loc_1", name: "Mumbai — BKC" },
  { id: "loc_2", name: "Bengaluru — Whitefield" },
  { id: "loc_3", name: "Delhi — Aerocity" },
  { id: "loc_4", name: "Chennai — OMR" },
  { id: "loc_5", name: "Goa — Candolim" },
];

const USERS = [
  { id: "u_1", name: "Ananya Rao",   email: "ananya@cloudguest.io", role: "Super Admin" },
  { id: "u_2", name: "Rohan Kapoor", email: "rohan@marriott.com",   role: "Org Admin" },
  { id: "u_3", name: "Meera Iyer",   email: "meera@taj.com",         role: "Location Manager" },
  { id: "u_4", name: "Vikram Shah",  email: "vikram@cloudguest.io",  role: "Support Engineer" },
  { id: "u_5", name: "Priya Nair",   email: "priya@oyo.com",         role: "Read Only" },
  { id: "u_6", name: "System",       email: "system@cloudguest.io",  role: "System" },
];

const DEVICES = ["MacBook Pro 14\"", "Dell XPS 13", "iPhone 15 Pro", "Pixel 8", "iPad Air", "Windows Desktop"];
const BROWSERS = ["Chrome 128", "Safari 17", "Firefox 129", "Edge 128", "Arc 1.6"];
const OSES = ["macOS 14.6", "Windows 11", "iOS 17.5", "Android 14", "Ubuntu 24.04"];
const CITIES = ["Mumbai, IN", "Bengaluru, IN", "Delhi, IN", "Singapore", "Dubai, AE", "London, UK"];
const MODULES = ["Auth", "Organizations", "Locations", "Routers", "Guests", "Portals", "Billing", "Settings", "Branding", "Monitoring", "System", "API"];

interface ActionSpec {
  action: AuditAction;
  category: AuditCategory;
  module: string;
  status: AuditStatus;
  severity: AuditSeverity;
  message: string;
  resource: string;
}

const ACTIONS: ActionSpec[] = [
  { action: "user.login",                        category: "authentication", module: "Auth",          status: "success", severity: "info",     message: "User signed in",                       resource: "session" },
  { action: "user.logout",                       category: "authentication", module: "Auth",          status: "success", severity: "info",     message: "User signed out",                      resource: "session" },
  { action: "user.password_reset",               category: "authentication", module: "Auth",          status: "success", severity: "medium",   message: "Password reset completed",             resource: "credential" },
  { action: "user.mfa_enabled",                  category: "security",       module: "Auth",          status: "success", severity: "medium",   message: "Multi-factor authentication enabled",  resource: "mfa" },
  { action: "user.mfa_disabled",                 category: "security",       module: "Auth",          status: "warning", severity: "high",     message: "Multi-factor authentication disabled", resource: "mfa" },
  { action: "security.failed_login",             category: "security",       module: "Auth",          status: "failure", severity: "medium",   message: "Failed login attempt",                 resource: "session" },
  { action: "security.multiple_failed_logins",   category: "security",       module: "Auth",          status: "failure", severity: "high",     message: "Multiple failed logins detected",      resource: "session" },
  { action: "security.permission_changed",       category: "security",       module: "Organizations", status: "success", severity: "high",     message: "Role permissions updated",             resource: "role" },
  { action: "security.suspicious_activity",      category: "security",       module: "Monitoring",    status: "warning", severity: "critical", message: "Suspicious activity detected",         resource: "session" },
  { action: "security.unauthorized_access",      category: "security",       module: "API",           status: "failure", severity: "critical", message: "Unauthorized access attempt",          resource: "endpoint" },
  { action: "security.api_key_created",          category: "security",       module: "API",           status: "success", severity: "medium",   message: "API key created",                      resource: "api_key" },
  { action: "security.api_key_deleted",          category: "security",       module: "API",           status: "success", severity: "medium",   message: "API key revoked",                      resource: "api_key" },
  { action: "config.settings_changed",           category: "configuration",  module: "Settings",      status: "success", severity: "medium",   message: "Platform setting updated",             resource: "setting" },
  { action: "config.branding_updated",           category: "configuration",  module: "Branding",      status: "success", severity: "low",      message: "Brand theme updated",                  resource: "brand" },
  { action: "config.feature_flag_toggled",       category: "configuration",  module: "Settings",      status: "success", severity: "medium",   message: "Feature flag toggled",                 resource: "flag" },
  { action: "router.added",                      category: "network",        module: "Routers",       status: "success", severity: "info",     message: "Router provisioned",                   resource: "router" },
  { action: "router.updated",                    category: "network",        module: "Routers",       status: "success", severity: "low",      message: "Router configuration updated",         resource: "router" },
  { action: "router.deleted",                    category: "network",        module: "Routers",       status: "success", severity: "high",     message: "Router removed",                       resource: "router" },
  { action: "router.online",                     category: "network",        module: "Routers",       status: "success", severity: "info",     message: "Router came online",                   resource: "router" },
  { action: "router.offline",                    category: "network",        module: "Routers",       status: "failure", severity: "high",     message: "Router went offline",                  resource: "router" },
  { action: "network.wireguard_connected",       category: "network",        module: "Routers",       status: "success", severity: "info",     message: "WireGuard tunnel established",         resource: "tunnel" },
  { action: "network.wireguard_disconnected",    category: "network",        module: "Routers",       status: "warning", severity: "medium",   message: "WireGuard tunnel dropped",             resource: "tunnel" },
  { action: "network.radius_authentication",     category: "network",        module: "Routers",       status: "success", severity: "info",     message: "RADIUS authentication succeeded",      resource: "radius" },
  { action: "network.authentication_failed",     category: "network",        module: "Routers",       status: "failure", severity: "medium",   message: "RADIUS authentication failed",         resource: "radius" },
  { action: "portal.published",                  category: "configuration",  module: "Portals",       status: "success", severity: "low",      message: "Captive portal published",             resource: "portal" },
  { action: "guest.login",                       category: "guest",          module: "Guests",        status: "success", severity: "info",     message: "Guest signed in to WiFi",              resource: "guest" },
  { action: "guest.logout",                      category: "guest",          module: "Guests",        status: "success", severity: "info",     message: "Guest disconnected",                   resource: "guest" },
  { action: "guest.session_started",             category: "guest",          module: "Guests",        status: "success", severity: "info",     message: "Guest session started",                resource: "session" },
  { action: "guest.session_ended",               category: "guest",          module: "Guests",        status: "success", severity: "info",     message: "Guest session ended",                  resource: "session" },
  { action: "billing.updated",                   category: "billing",        module: "Billing",       status: "success", severity: "low",      message: "Billing details updated",              resource: "billing_profile" },
  { action: "billing.subscription_changed",      category: "billing",        module: "Billing",       status: "success", severity: "medium",   message: "Subscription plan changed",            resource: "subscription" },
  { action: "billing.invoice_created",           category: "billing",        module: "Billing",       status: "success", severity: "info",     message: "Invoice generated",                    resource: "invoice" },
  { action: "system.server_started",             category: "system",         module: "System",        status: "success", severity: "info",     message: "Application server started",           resource: "server" },
  { action: "system.server_restarted",           category: "system",         module: "System",        status: "success", severity: "medium",   message: "Application server restarted",         resource: "server" },
  { action: "system.backup_completed",           category: "system",         module: "System",        status: "success", severity: "info",     message: "Scheduled backup completed",           resource: "backup" },
  { action: "system.backup_failed",              category: "system",         module: "System",        status: "failure", severity: "critical", message: "Scheduled backup failed",              resource: "backup" },
  { action: "system.database_migration",         category: "system",         module: "System",        status: "success", severity: "medium",   message: "Database migration executed",          resource: "database" },
  { action: "system.cache_cleared",              category: "system",         module: "System",        status: "success", severity: "low",      message: "Cache cleared",                        resource: "cache" },
  { action: "system.queue_restarted",            category: "system",         module: "System",        status: "success", severity: "medium",   message: "Background worker restarted",          resource: "worker" },
  { action: "system.redis_connected",            category: "system",         module: "System",        status: "success", severity: "info",     message: "Redis connection established",         resource: "redis" },
  { action: "system.redis_failed",               category: "system",         module: "System",        status: "failure", severity: "high",     message: "Redis connection lost",                resource: "redis" },
  { action: "system.api_restarted",              category: "system",         module: "API",           status: "success", severity: "medium",   message: "API service restarted",                resource: "api" },
  { action: "org.created",                       category: "configuration",  module: "Organizations", status: "success", severity: "medium",   message: "Organization created",                 resource: "organization" },
  { action: "location.added",                    category: "configuration",  module: "Locations",     status: "success", severity: "low",      message: "Location added",                       resource: "location" },
  { action: "api.request",                       category: "api",            module: "API",           status: "success", severity: "info",     message: "API request",                          resource: "endpoint" },
];

function seed(): AuditLog[] {
  const rows: AuditLog[] = [];
  const now = Date.now();
  for (let i = 0; i < 320; i++) {
    const spec = ACTIONS[i % ACTIONS.length];
    const org = ORGS[i % ORGS.length];
    const loc = LOCATIONS[(i + 2) % LOCATIONS.length];
    const user = USERS[i % USERS.length];
    const ts = new Date(now - i * (1000 * 60 * (7 + (i % 30)))).toISOString();
    rows.push({
      id: `log_${(100000 + i).toString(36)}`,
      timestamp: ts,
      actor: user,
      organizationId: org.id,
      organizationName: org.name,
      locationId: loc.id,
      locationName: loc.name,
      module: spec.module,
      action: spec.action,
      category: spec.category,
      resource: spec.resource,
      resourceId: `${spec.resource}_${1000 + i}`,
      status: spec.status,
      severity: spec.severity,
      message: spec.message,
      context: {
        ipAddress: `${10 + (i % 240)}.${(i * 3) % 250}.${(i * 7) % 250}.${(i * 11) % 250}`,
        device: DEVICES[i % DEVICES.length],
        browser: BROWSERS[i % BROWSERS.length],
        os: OSES[i % OSES.length],
        location: CITIES[i % CITIES.length],
      },
      before: spec.category === "configuration" ? { value: "old" } : undefined,
      after: spec.category === "configuration" ? { value: "new" } : undefined,
      requestPayload: { method: "POST", path: `/api/v1/${spec.resource}`, body: { id: `${spec.resource}_${1000 + i}` } },
      responsePayload: { code: spec.status === "failure" ? 403 : 200, ok: spec.status !== "failure" },
      stackTrace:
        spec.status === "failure"
          ? `Error: ${spec.message}\n    at handler (/app/src/api/${spec.resource}.ts:42:11)\n    at run (/app/src/server.ts:88:7)`
          : undefined,
    });
  }
  return rows;
}

const store = { rows: seed() };

function applyFilters(rows: AuditLog[], f: AuditFilters): AuditLog[] {
  return rows.filter((r) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = [r.id, r.actor.name, r.actor.email, r.organizationName, r.context.ipAddress, r.resource, r.message, r.module]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.organizationId && f.organizationId !== "all" && r.organizationId !== f.organizationId) return false;
    if (f.locationId && f.locationId !== "all" && r.locationId !== f.locationId) return false;
    if (f.userId && f.userId !== "all" && r.actor.id !== f.userId) return false;
    if (f.category && f.category !== "all" && r.category !== f.category) return false;
    if (f.action && f.action !== "all" && r.action !== f.action) return false;
    if (f.module && f.module !== "all" && r.module !== f.module) return false;
    if (f.severity && f.severity !== "all" && r.severity !== f.severity) return false;
    if (f.status && f.status !== "all" && r.status !== f.status) return false;
    if (f.ipAddress && !r.context.ipAddress.includes(f.ipAddress)) return false;
    if (f.device && f.device !== "all" && r.context.device !== f.device) return false;
    if (f.browser && f.browser !== "all" && r.context.browser !== f.browser) return false;
    if (f.from && new Date(r.timestamp) < new Date(f.from)) return false;
    if (f.to && new Date(r.timestamp) > new Date(f.to)) return false;
    return true;
  });
}

function computeKpis(rows: AuditLog[]): AuditKpis {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return {
    totalLogs: rows.length,
    securityEvents: rows.filter((r) => r.category === "security").length,
    loginEvents: rows.filter((r) => r.action === "user.login" || r.action === "user.logout").length,
    configurationChanges: rows.filter((r) => r.category === "configuration").length,
    apiActivities: rows.filter((r) => r.category === "api").length,
    failedLogins: rows.filter((r) => r.action === "security.failed_login" || r.action === "security.multiple_failed_logins").length,
    criticalEvents: rows.filter((r) => r.severity === "critical").length,
    todaysActivities: rows.filter((r) => new Date(r.timestamp) >= startOfToday).length,
  };
}

let retention: RetentionSettings = {
  retentionDays: 180,
  autoCleanup: true,
  archiveEnabled: true,
  archiveAfterDays: 90,
  storageUsedMb: 812,
  storageQuotaMb: 4096,
};

export const auditService = {
  async list(filters: AuditFilters, page = 1, pageSize = 20, sort: { key: keyof AuditLog | "actor" | "context"; dir: "asc" | "desc" } = { key: "timestamp", dir: "desc" }): Promise<PaginatedLogs> {
    await delay();
    let rows = applyFilters(store.rows, filters);
    rows = [...rows].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av = sort.key === "actor" ? a.actor.name : sort.key === "context" ? a.context.ipAddress : (a as any)[sort.key];
      const bv = sort.key === "actor" ? b.actor.name : sort.key === "context" ? b.context.ipAddress : (b as any)[sort.key];
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
  },
  async kpis(): Promise<AuditKpis> {
    await delay(180);
    return computeKpis(store.rows);
  },
  async timeline(limit = 30): Promise<AuditLog[]> {
    await delay(180);
    return [...store.rows].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, limit);
  },
  async byCategory(category: AuditCategory, limit = 40): Promise<AuditLog[]> {
    await delay(180);
    return store.rows.filter((r) => r.category === category).slice(0, limit);
  },
  async byAction(actions: AuditAction[], limit = 40): Promise<AuditLog[]> {
    await delay(180);
    return store.rows.filter((r) => actions.includes(r.action)).slice(0, limit);
  },
  async liveFeed(): Promise<AuditLog[]> {
    await delay(120);
    // simulate new events at head
    const seed = store.rows.slice(0, 12).map((r) => ({
      ...r,
      id: `live_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 30_000)).toISOString(),
    }));
    return seed;
  },
  async userActivity(): Promise<UserActivityRecord[]> {
    await delay(200);
    return USERS.filter((u) => u.id !== "u_6").map((u, idx) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      lastLoginAt: new Date(Date.now() - idx * 3600_000).toISOString(),
      activeSessions: (idx % 3) + 1,
      devices: [DEVICES[idx % DEVICES.length], DEVICES[(idx + 2) % DEVICES.length]],
      browsers: [BROWSERS[idx % BROWSERS.length]],
      os: [OSES[idx % OSES.length]],
      loginHistory: Array.from({ length: 6 }).map((_, i) => ({
        at: new Date(Date.now() - (i + 1) * 4_800_000).toISOString(),
        ip: `10.${idx}.${i}.${(i * 17) % 240}`,
        device: DEVICES[(i + idx) % DEVICES.length],
        status: i === 2 ? ("failure" as AuditStatus) : ("success" as AuditStatus),
      })),
      logoutHistory: Array.from({ length: 4 }).map((_, i) => ({
        at: new Date(Date.now() - (i + 1) * 7_200_000).toISOString(),
        ip: `10.${idx}.${i}.${(i * 23) % 240}`,
      })),
    }));
  },
  async analytics(): Promise<AuditAnalytics> {
    await delay(220);
    const daily = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86_400_000);
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const total = 120 + Math.round(Math.sin(i / 2) * 40 + Math.random() * 40);
      return { date: label, total, security: Math.max(4, Math.round(total * 0.15)), api: Math.round(total * 0.5) };
    });
    return {
      daily,
      weekly: Array.from({ length: 8 }).map((_, i) => ({ week: `W${i + 1}`, total: 600 + Math.round(Math.random() * 400) })),
      monthly: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => ({ month: m, total: 2200 + Math.round(Math.sin(i) * 400 + Math.random() * 500) })),
      loginTrend: daily.map((d) => ({ date: d.date, success: 60 + Math.round(Math.random() * 30), failed: Math.round(Math.random() * 12) })),
      apiUsage: Array.from({ length: 24 }).map((_, h) => ({ hour: `${h.toString().padStart(2, "0")}:00`, requests: 200 + Math.round(Math.abs(Math.sin(h / 3)) * 900) })),
      configChanges: daily.map((d) => ({ date: d.date, changes: Math.round(Math.random() * 18) })),
      userActivity: USERS.slice(0, 5).map((u, i) => ({ name: u.name.split(" ")[0], value: 40 + Math.round(Math.random() * 80) + i * 5 })),
      categoryBreakdown: [
        { category: "Auth", value: 210 },
        { category: "Security", value: 92 },
        { category: "Config", value: 128 },
        { category: "Network", value: 180 },
        { category: "System", value: 74 },
        { category: "API", value: 260 },
        { category: "Billing", value: 45 },
        { category: "Guest", value: 300 },
      ],
    };
  },
  async retention(): Promise<RetentionSettings> {
    await delay(120);
    return retention;
  },
  async updateRetention(next: RetentionSettings): Promise<RetentionSettings> {
    await delay(220);
    retention = { ...next };
    return retention;
  },
  async pin(id: string, pinned: boolean): Promise<AuditLog | null> {
    await delay(100);
    const row = store.rows.find((r) => r.id === id);
    if (!row) return null;
    row.pinned = pinned;
    return row;
  },
  async get(id: string): Promise<AuditLog | null> {
    await delay(120);
    return store.rows.find((r) => r.id === id) ?? null;
  },
  facets() {
    const modules = Array.from(new Set(store.rows.map((r) => r.module)));
    const actions = Array.from(new Set(store.rows.map((r) => r.action)));
    const devices = Array.from(new Set(store.rows.map((r) => r.context.device)));
    const browsers = Array.from(new Set(store.rows.map((r) => r.context.browser)));
    return {
      organizations: ORGS,
      locations: LOCATIONS,
      users: USERS,
      modules: modules.length ? modules : MODULES,
      actions,
      devices,
      browsers,
      severities: ["info", "low", "medium", "high", "critical"] as AuditSeverity[],
      statuses: ["success", "failure", "warning", "pending"] as AuditStatus[],
      categories: ["authentication", "security", "configuration", "network", "system", "billing", "api", "user", "guest"] as AuditCategory[],
    };
  },
};

export type AuditFacets = ReturnType<typeof auditService.facets>;
