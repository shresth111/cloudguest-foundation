import { api } from "@/services/api";
import { locationService } from "@/services/location.service";
import { routerService } from "@/services/router.service";
import { guestService } from "@/services/guest.service";
import type { Location } from "@/types/location";

/* ── Types ─────────────────────────────────────────────────── */

/** Minimal shape read from `/locations/{id}/routers` and `/guest-sessions`
 * (raw backend snake_case) -- listLocations() hits these directly to enrich
 * the location picker without pulling in router.service.ts/guest.service.ts's
 * full normalization + org-wide fan-out helpers. */
interface RawRouterStatus { status: string; }
interface RawGuestSessionStatus { status: string; bytes_downloaded?: number; bytes_uploaded?: number; }

export interface NavItem { id: string; label: string; module: string; }

export interface CustomerLocationSummary {
  id: string; name: string; city: string;
  status: "online" | "offline" | "degraded";
  onlineUsers: number; routerHealth: number;
  bandwidth: string; isp: string; lastSync: string;
  organizationId: string; organizationName: string;
  routersTotal: number; routersOnline: number;
  sessionsActive: number; sessionsTotal: number;
}

export interface CustomerDashboardData {
  health: { systemHealth: string; routersOnline: string; isp: string; networkLoad: string };
  kpis: { onlineUsers: number; activeSessions: number; routersOnline: number; totalRouters: number; todayGuests: number; avgSession: number; peakConcurrent: number; failedLogins: number; newToday: number; slaUptime: number; };
  usersTrend: { hour: string; users: number }[];
  recentUsers: { id: string; name: string; email: string; device: string; time: string; status: string }[];
  recentAlerts: { type: "error" | "warning" | "success" | "info"; msg: string; time: string }[];
  deviceDistribution: { name: string; value: number }[];
  hourlySessions: { hour: string; sessions: number }[];
}

export interface CustomerUsersData { users: { id: string; name: string; email: string; device: string; mac: string; ip: string; duration: string; download: string; status: "online" | "offline" | "idle"; }[]; total: number; page: number; pageSize: number; }

export interface CustomerFeatureData {
  analytics?: { totalSessions: number; uniqueGuests: number; returningRate: number; avgDuration: number; };
  campaigns?: { id: string; name: string; status: string; impressions: number; conversions: number }[];
  vouchers?: { code: string; plan: string; status: string; used: number }[];
  portal?: { status: string; theme: string; authMethods: string[]; languages: string[] };
  audit?: { action: string; user: string; time: string; status: string }[];
  devices?: { mac: string; ip: string; device: string; firstSeen: string; lastSeen: string }[];
  macAuth?: { id: string; mac: string; type: string; expiresAt: string | null; comment: string | null; enabled: boolean }[];
}

/* ── Demo Data ─────────────────────────────────────────────── */

const DEMO_LOCATIONS: CustomerLocationSummary[] = [
  { id: "loc-1", name: "Mumbai HQ", city: "Mumbai", status: "online", onlineUsers: 142, routerHealth: 98, bandwidth: "450 Mbps", isp: "Tata Communications", lastSync: "Just now", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 4, routersOnline: 4, sessionsActive: 142, sessionsTotal: 892 },
  { id: "loc-2", name: "Delhi Office", city: "Delhi", status: "online", onlineUsers: 98, routerHealth: 95, bandwidth: "300 Mbps", isp: "Airtel", lastSync: "2 min ago", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 3, routersOnline: 3, sessionsActive: 98, sessionsTotal: 456 },
  { id: "loc-3", name: "Bangalore DC", city: "Bangalore", status: "degraded", onlineUsers: 76, routerHealth: 72, bandwidth: "180 Mbps", isp: "Jio", lastSync: "5 min ago", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 2, routersOnline: 1, sessionsActive: 76, sessionsTotal: 312 },
  { id: "loc-4", name: "Chennai Office", city: "Chennai", status: "online", onlineUsers: 54, routerHealth: 99, bandwidth: "250 Mbps", isp: "ACT Fibernet", lastSync: "1 min ago", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 2, routersOnline: 2, sessionsActive: 54, sessionsTotal: 234 },
  { id: "loc-5", name: "Hyderabad DC", city: "Hyderabad", status: "offline", onlineUsers: 0, routerHealth: 0, bandwidth: "0 Mbps", isp: "Airtel", lastSync: "15 min ago", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 2, routersOnline: 0, sessionsActive: 0, sessionsTotal: 0 },
  { id: "loc-6", name: "Kolkata Office", city: "Kolkata", status: "online", onlineUsers: 32, routerHealth: 91, bandwidth: "200 Mbps", isp: "Tata Communications", lastSync: "3 min ago", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 1, routersOnline: 1, sessionsActive: 32, sessionsTotal: 156 },
  { id: "loc-7", name: "Pune Office", city: "Pune", status: "online", onlineUsers: 67, routerHealth: 97, bandwidth: "350 Mbps", isp: "Jio", lastSync: "Just now", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 2, routersOnline: 2, sessionsActive: 67, sessionsTotal: 345 },
  { id: "loc-8", name: "Ahmedabad DC", city: "Ahmedabad", status: "online", onlineUsers: 89, routerHealth: 93, bandwidth: "280 Mbps", isp: "BSNL", lastSync: "4 min ago", organizationId: "org-1", organizationName: "Acme Corp", routersTotal: 2, routersOnline: 2, sessionsActive: 89, sessionsTotal: 423 },
];

const DEMO_NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", module: "dashboard" }, { id: "users", label: "Users", module: "guest_sessions" },
  { id: "analytics", label: "Analytics", module: "analytics" }, { id: "reports", label: "Reports", module: "reports" },
  { id: "campaigns", label: "Campaigns", module: "campaigns" }, { id: "portal", label: "Portal", module: "captive_portal" },
  { id: "vouchers", label: "Vouchers", module: "voucher" }, { id: "policies", label: "Policies", module: "policy" },
  { id: "whitelist", label: "Whitelist", module: "guest_access" }, { id: "devices", label: "Devices", module: "connected_devices" },
  { id: "teams", label: "Teams", module: "guest_teams" }, { id: "agents", label: "Agents", module: "roles" },
  { id: "networking", label: "Networking", module: "dhcp" }, { id: "advanced", label: "Advanced", module: "system_settings" },
  { id: "audit", label: "Audit Logs", module: "audit_logs" }, { id: "help", label: "Help", module: "notifications" },
];

/* ── Helpers ───────────────────────────────────────────────── */

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("cloudguest_token") === "demo-access-token";
}

let cachedOrgId: string | null = null;
/** Resolves the current session's organization id for endpoints that
 * require X-Organization-Id (e.g. MAC authorization -- see
 * backend/app/domains/mac_authorization/service.py's OrganizationRequiredError).
 * Callers already run inside getFeatureData's try/catch, so a throw here
 * just falls back to demo data like any other failure. */
async function resolveOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const { data } = await api.get<{ items: Array<{ id: string }> }>("/organizations", { params: { page_size: 1 } });
  const id = data.items[0]?.id;
  if (!id) throw new Error("No organization found for the current session");
  cachedOrgId = id;
  return id;
}

/** Buckets session user-agent strings into the OS categories the dashboard
 * chart shows. Deliberately simple substring sniffing, not a full UA
 * parser library -- good enough for a breakdown chart, not for anything
 * security- or billing-sensitive. */
function deviceDistributionFrom(sessions: { userAgent: string | null }[]): { name: string; value: number }[] {
  const counts: Record<string, number> = { iOS: 0, Android: 0, Windows: 0, macOS: 0, Linux: 0, Other: 0 };
  for (const s of sessions) {
    const ua = (s.userAgent ?? "").toLowerCase();
    if (!ua) { counts.Other++; continue; }
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) counts.iOS++;
    else if (ua.includes("android")) counts.Android++;
    else if (ua.includes("windows")) counts.Windows++;
    else if (ua.includes("mac os") || ua.includes("macintosh")) counts.macOS++;
    else if (ua.includes("linux")) counts.Linux++;
    else counts.Other++;
  }
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
}

/* ── Customer Service ──────────────────────────────────────── */

export const customerService = {
  /* ── Sidebar / Nav ─────────────────────────────────────── */
  async getNav(): Promise<NavItem[]> {
    if (isDemo()) return DEMO_NAV;
    try {
      const { data } = await api.get<{ items: { id: string; label: string; module: string }[] }>("/dashboard/sidebar");
      return data?.items?.map((i) => ({ id: i.id, label: i.label, module: i.module })) ?? [];
    } catch {
      return [];
    }
  },

  /* ── Location Switcher ─────────────────────────────────── */
  /**
   * Was a sequential `for (org) { for (loc) { await router; await sessions } }`
   * loop, where the per-location `routerService.list()` / `guestService.listSessions()`
   * calls each *internally* re-fan-out across every organization just to
   * resolve the one location's org id (see router.service.ts's
   * `fetchAllLocations()`, guest.service.ts's `fanOutPerOrg()`) -- so every
   * location cost O(orgs) extra requests on top of the O(orgs) already paid
   * to list locations, and every one of those requests was awaited one at a
   * time. With N orgs and L locations that's on the order of L*N sequential
   * round trips, which is what produced the "stuck loading" bug as test orgs
   * accumulated in the dev DB. Fixed by (1) fetching every org's locations in
   * parallel, matching location.service.ts's own `fetchAllLocations()`
   * `allSettled` pattern, and (2) enriching every location in parallel too,
   * hitting `/locations/{id}/routers` and `/guest-sessions?location_id=` directly
   * (org id is already known from step 1, so there's no need to re-resolve it)
   * instead of going through routerService/guestService's expensive fan-out helpers.
   */
  async listLocations(): Promise<CustomerLocationSummary[]> {
    if (isDemo()) return DEMO_LOCATIONS;
    try {
      const { data: orgData } = await api.get<{ items: { id: string; name: string }[] }>("/organizations", { params: { page_size: 100 } });
      const orgs = orgData?.items ?? [];

      const perOrg = await Promise.allSettled(
        orgs.map(async (org) => {
          const locs = await locationService.list({ organizationId: org.id, page: 1, pageSize: 50 });
          return (locs?.rows ?? []).map((loc) => ({ loc, orgId: org.id, orgName: org.name }));
        }),
      );
      const locOrgPairs = perOrg
        .filter((r): r is PromiseFulfilledResult<{ loc: Location; orgId: string; orgName: string }[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);

      const enriched = await Promise.allSettled(
        locOrgPairs.map(async ({ loc, orgId, orgName }) => {
          const [routersR, sessionsR] = await Promise.allSettled([
            api.get<{ items: RawRouterStatus[] }>(`/locations/${loc.id}/routers`, {
              params: { page_size: 100 },
              headers: { "X-Organization-Id": orgId },
            }),
            api.get<{ items: RawGuestSessionStatus[] }>("/guest-sessions", {
              params: { location_id: loc.id, page_size: 50 },
              headers: { "X-Organization-Id": orgId },
            }),
          ]);
          const routers = routersR.status === "fulfilled" ? routersR.value.data?.items ?? [] : [];
          const sessions = sessionsR.status === "fulfilled" ? sessionsR.value.data?.items ?? [] : [];
          const onR = routers.filter((r) => r.status === "online").length;
          const tR = routers.length || 1;
          const active = sessions.filter((s) => s.status === "active").length;
          const summary: CustomerLocationSummary = {
            id: loc.id, name: loc.name, city: loc.city,
            status: onR === 0 && tR > 0 ? "offline" : onR < tR ? "degraded" : "online",
            onlineUsers: active, routerHealth: Math.round((onR / tR) * 100),
            bandwidth: `${(sessions.reduce((s, se) => s + (se.bytes_downloaded || 0) + (se.bytes_uploaded || 0), 0) / 1e6).toFixed(0)} MB`,
            isp: "Active", lastSync: "Just now",
            organizationId: orgId, organizationName: orgName,
            routersTotal: routers.length, routersOnline: onR, sessionsActive: active, sessionsTotal: sessions.length,
          };
          return summary;
        }),
      );
      const results = enriched
        .filter((r): r is PromiseFulfilledResult<CustomerLocationSummary> => r.status === "fulfilled")
        .map((r) => r.value);

      return results;
    } catch {
      return [];
    }
  },

  /* ── Executive Dashboard ───────────────────────────────── */
  async getDashboard(locationId: string): Promise<DashboardDataResult> {
    if (isDemo()) {
      return {
        health: { systemHealth: "98%", routersOnline: "4/4", isp: "Tata Communications", networkLoad: "42%" },
        kpis: { onlineUsers: 1247, activeSessions: 892, routersOnline: 18, totalRouters: 20, todayGuests: 456, avgSession: 34, peakConcurrent: 234, failedLogins: 12, newToday: 89, slaUptime: 99.97 },
        usersTrend: Array.from({ length: 24 }, (_, i) => ({ hour: `${i}`, users: 20 + ((i * 17) % 120) })),
        deviceDistribution: [{ name: "iOS", value: 35 }, { name: "Android", value: 28 }, { name: "Windows", value: 18 }, { name: "macOS", value: 12 }, { name: "Linux", value: 5 }, { name: "Other", value: 2 }],
        hourlySessions: [{ hour: "00", sessions: 45 }, { hour: "04", sessions: 22 }, { hour: "08", sessions: 156 }, { hour: "12", sessions: 289 }, { hour: "16", sessions: 342 }, { hour: "20", sessions: 198 }],
        recentUsers: [{ id: "u1", name: "John Doe", email: "john@email.com", device: "iPhone 15", time: "2 min ago", status: "online" }, { id: "u2", name: "Jane Smith", email: "jane@email.com", device: "Samsung S24", time: "5 min ago", status: "online" }, { id: "u3", name: "Raj Kumar", email: "raj@email.com", device: "MacBook Pro", time: "12 min ago", status: "online" }, { id: "u4", name: "Priya Sharma", email: "priya@email.com", device: "Pixel 8", time: "18 min ago", status: "online" }, { id: "u5", name: "Alex Chen", email: "alex@email.com", device: "iPad Air", time: "25 min ago", status: "online" }, { id: "u6", name: "Sarah Wilson", email: "sarah@email.com", device: "Windows Laptop", time: "32 min ago", status: "offline" }],
        recentAlerts: [{ type: "warning" as const, msg: "Router GW-02 signal degradation", time: "2 min ago" }, { type: "success" as const, msg: "ISP failover completed", time: "8 min ago" }, { type: "error" as const, msg: "Bandwidth threshold at Mumbai HQ", time: "15 min ago" }, { type: "info" as const, msg: "Firmware update for GW-05", time: "22 min ago" }],
      };
    }
    // Real API composition
    const [rR, sR, aR, hR] = await Promise.allSettled([
      routerService.list({ locationId, page: 1, pageSize: 100 }),
      guestService.listSessions({ locationId, page: 1, pageSize: 100 }),
      api.get<{ items: { severity: string; title: string; created_at: string }[] }>("/alerts", { params: { page_size: 10 } }),
      api.get<{ routers_online: number; routers_offline: number; total_guests: number; active_sessions: number }>("/dashboard/organization"),
    ]);
    const routers = rR.status === "fulfilled" ? rR.value.rows : [];
    const sessions = sR.status === "fulfilled" ? sR.value.rows : [];
    const alerts = aR.status === "fulfilled" ? aR.value.data?.items ?? [] : [];
    const health = hR.status === "fulfilled" ? hR.value.data ?? null : null;
    const onR = routers.filter((r) => r.status === "online").length;
    const tR = routers.length || 1;
    const today = new Date().toISOString().slice(0, 10);
    const hourly = new Array(24).fill(0);
    sessions.forEach((s) => { if (s.startedAt) hourly[new Date(s.startedAt).getHours()]++; });
    return {
      health: { systemHealth: `${Math.round((onR / tR) * 100)}%`, routersOnline: `${onR}/${routers.length}`, isp: health ? "Active" : "Unknown", networkLoad: `${Math.min(100, Math.round(sessions.length / 5))}%` },
      kpis: { onlineUsers: sessions.filter((s) => s.status === "active").length, activeSessions: sessions.length, routersOnline: onR, totalRouters: routers.length, todayGuests: sessions.filter((s) => s.startedAt?.startsWith(today)).length, avgSession: sessions.length > 0 ? Math.round(sessions.reduce((s, se) => s + (se.bytesDownloaded || 0), 0) / sessions.length / 1e6) : 0, peakConcurrent: Math.max(...hourly), failedLogins: 0, newToday: sessions.filter((s) => s.startedAt?.startsWith(today)).length, slaUptime: 99.9 },
      usersTrend: hourly.map((c, i) => ({ hour: `${i}`, users: c })),
      deviceDistribution: deviceDistributionFrom(sessions),
      hourlySessions: hourly.map((c, i) => ({ hour: `${i}`, sessions: c })),
      recentUsers: sessions.slice(0, 6).map((s) => ({ id: s.id, name: s.guestIdentifier || "Guest", email: s.guestIdentifier, device: s.deviceId ?? "", time: timeAgo(s.startedAt), status: s.status === "active" ? "online" as const : "offline" as const })),
      recentAlerts: alerts.slice(0, 5).map((a) => ({ type: a.severity === "critical" ? "error" as const : "warning" as const, msg: a.title, time: timeAgo(a.created_at) })),
    };
  },

  /* ── Users ─────────────────────────────────────────────── */
  async getUsers(locationId: string, search?: string, status?: string, page = 1, pageSize = 20): Promise<CustomerUsersData> {
    if (isDemo()) {
      const all = Array.from({ length: 24 }, (_, i) => ({
        id: `u-${i}`, name: ["John Doe", "Jane Smith", "Raj Kumar", "Priya Sharma", "Alex Chen", "Sarah Wilson", "Mike Brown", "Emily Davis"][i % 8],
        email: `user${i + 1}@email.com`, device: ["iPhone 15", "Samsung S24", "MacBook Pro", "Pixel 8", "iPad Air", "Windows Laptop"][i % 6],
        mac: `00:1A:${10 + i}`, ip: `10.0.${Math.floor(i / 8) + 1}.${100 + i}`, duration: `${15 + (i % 6) * 10} min`,
        download: `${(Math.random() * 500).toFixed(0)} MB`, status: (i < 16 ? "online" : i < 20 ? "idle" : "offline") as "online" | "offline" | "idle",
      }));
      let f = [...all]; if (search) { const q = search.toLowerCase(); f = f.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)); }
      if (status && status !== "all") f = f.filter((u) => u.status === status);
      return { users: f.slice((page - 1) * pageSize, page * pageSize), total: f.length, page, pageSize };
    }
    try {
      const res = await guestService.listSessions({ locationId, page, pageSize });
      let users = res.rows.map((s) => ({
        id: s.id, name: s.guestIdentifier || "Guest", email: s.guestIdentifier, device: s.deviceId ?? "", mac: s.deviceId ?? "",
        ip: s.ipAddress ?? "", duration: s.startedAt && s.endedAt ? `${Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)} min` : "Active",
        download: `${Math.round((s.bytesDownloaded || 0) / 1e6)} MB`, status: (s.status === "active" ? "online" : s.status === "paused" ? "idle" : "offline") as "online" | "offline" | "idle",
      }));
      if (search) { const q = search.toLowerCase(); users = users.filter((u) => u.name.toLowerCase().includes(q)); }
      if (status && status !== "all") users = users.filter((u) => u.status === status);
      return { users, total: res.total ?? users.length, page, pageSize };
    } catch { return { users: [], total: 0, page, pageSize }; }
  },

  async disconnectSession(sessionId: string): Promise<void> {
    if (isDemo()) return;
    await api.post(`/guest-sessions/${sessionId}/disconnect`);
  },

  /* ── Feature Data ──────────────────────────────────────── */
  async getFeatureData(feature: string, locationId: string): Promise<CustomerFeatureData> {
    if (isDemo()) return getDemoFeatureData(feature);

    try {
      switch (feature) {
        case "analytics": {
          const [summary, guests] = await Promise.allSettled([
            api.get<{ visitors: number; unique_guests: number; returning_guests: number; average_session_duration_seconds: number | null }>("/guest-analytics/summary").catch(() => null),
            api.get<{ items: any[] }>("/guest-analytics/top-devices").catch(() => null),
          ]);
          const s = summary.status === "fulfilled" && summary.value?.data ? summary.value.data : null;
          return { analytics: { totalSessions: s?.visitors ?? 0, uniqueGuests: s?.unique_guests ?? 0, returningRate: s?.returning_guests ?? 0, avgDuration: (s?.average_session_duration_seconds ?? 0) / 60 } };
        }
        case "campaigns": {
          const { data } = await api.get<{ items: { id: string; name: string; status: string }[] }>("/campaigns", { params: { page_size: 20 } }).catch(() => ({ data: { items: [] } }));
          return { campaigns: (data?.items ?? []).map((c) => ({ id: c.id, name: c.name, status: c.status, impressions: 0, conversions: 0 })) };
        }
        case "vouchers": {
          const { data } = await api.get<{ items: { code?: string; plan?: string; status: string; used_count?: number }[] }>("/voucher-batches", { params: { page_size: 20 } }).catch(() => ({ data: { items: [] } }));
          return { vouchers: data?.items?.map((v) => ({ code: v.code ?? "", plan: v.plan ?? "", status: v.status, used: v.used_count ?? 0 })) ?? [] };
        }
        case "portal": {
          const caption = locationId ? await api.get(`/captive-portal`, { params: { location_id: locationId } }).catch(() => null) : null;
          return { portal: { status: "Live", theme: "Enterprise Blue", authMethods: ["Email OTP", "SMS", "Voucher"], languages: ["EN", "HI", "AR"] } };
        }
        case "audit": {
          const { data } = await api.get<{ items: { action: string; description: string; actor_user_id: string | null; created_at: string }[] }>("/audit/entries", { params: { page_size: 10 } }).catch(() => ({ data: { items: [] } }));
          return { audit: (data?.items ?? []).map((a) => ({ action: a.description ?? a.action, user: a.actor_user_id ?? "system", time: timeAgo(a.created_at), status: "info" })) };
        }
        case "devices": {
          const { data } = await api.get<{ items: { mac_address: string; ip_address: string; hostname: string | null; connected_at: string; last_seen_at: string }[] }>("/connected-devices", { params: { location_id: locationId, page_size: 10 } }).catch(() => ({ data: { items: [] } }));
          return { devices: (data?.items ?? []).map((d) => ({ mac: d.mac_address, ip: d.ip_address, device: d.hostname ?? "Unknown", firstSeen: timeAgo(d.connected_at), lastSeen: timeAgo(d.last_seen_at) })) };
        }
        case "mac-auth": {
          const orgId = await resolveOrgId();
          const { data } = await api.get<{ items: { id: string; mac_address: string; authorization_type: string; expires_at: string | null; comment: string | null; is_enabled: boolean }[] }>(
            "/mac-authorization/entries",
            { params: { location_id: locationId, page: 1, page_size: 50 }, headers: { "X-Organization-Id": orgId } },
          );
          return { macAuth: data.items.map((e) => ({ id: e.id, mac: e.mac_address, type: e.authorization_type, expiresAt: e.expires_at, comment: e.comment, enabled: e.is_enabled })) };
        }
        default: return {};
      }
    } catch { return getDemoFeatureData(feature); }
  },
};

type DashboardDataResult = CustomerDashboardData;

function getDemoFeatureData(feature: string): CustomerFeatureData {
  switch (feature) {
    case "analytics": return { analytics: { totalSessions: 1892, uniqueGuests: 847, returningRate: 34, avgDuration: 28 } };
    case "campaigns": return { campaigns: [{ id: "1", name: "Summer Promo", status: "active", impressions: 2841, conversions: 423 }, { id: "2", name: "New Year", status: "draft", impressions: 0, conversions: 0 }] };
    case "vouchers": return { vouchers: [{ code: "VCH-8821", plan: "1h", status: "active", used: 3 }, { code: "VCH-8822", plan: "24h", status: "active", used: 12 }] };
    case "portal": return { portal: { status: "Live", theme: "Enterprise Blue", authMethods: ["Email OTP", "SMS", "Voucher"], languages: ["EN", "HI", "AR"] } };
    case "audit": return { audit: [{ action: "Guest login via OTP", user: "guest@email.com", time: "2 min ago", status: "success" }, { action: "Voucher created", user: "reception", time: "18 min ago", status: "info" }, { action: "Router restart", user: "system", time: "1h ago", status: "success" }, { action: "Portal updated", user: "manager", time: "3h ago", status: "info" }] };
    case "devices": return { devices: [{ mac: "00:1A:2B:3C:4D:5E", ip: "10.0.1.42", device: "iPhone 15", firstSeen: "Today", lastSeen: "Just now" }, { mac: "AA:BB:CC:DD:EE:FF", ip: "10.0.1.87", device: "MacBook Pro", firstSeen: "Today", lastSeen: "2 min ago" }] };
    case "mac-auth": return { macAuth: [
      { id: "1", mac: "7C:70:DB:B5:76:92", type: "permanent", expiresAt: null, comment: "Front desk tablet", enabled: true },
      { id: "2", mac: "9E:CB:12:2C:02:52", type: "temporary", expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(), comment: "Contractor laptop", enabled: true },
      { id: "3", mac: "C2:7C:20:00:F2:24", type: "permanent", expiresAt: null, comment: null, enabled: false },
    ] };
    default: return {};
  }
}
