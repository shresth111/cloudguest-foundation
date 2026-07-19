import type {
  AuditRow,
  AuthPoint,
  DeviceTypeSlice,
  GrowthPoint,
  Kpi,
  LocationRow,
  NotificationItem,
  OrgRow,
  PaymentRow,
  RevenuePoint,
  RouterHealth,
  RouterRow,
  SearchResult,
  SessionRow,
  TicketRow,
  TopOrgUsage,
  TrendPoint,
} from "@/types/dashboard";

const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

// Deterministic-ish random so charts stay stable across renders
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export const superAdminService = {
  async getKpis(): Promise<Kpi[]> {
    await delay(400);
    return [
      { key: "orgs_total", label: "Total Organizations", value: "1,284", delta: "+42", trend: "up", hint: "vs last month" },
      { key: "orgs_active", label: "Active Organizations", value: "1,196", delta: "+3.1%", trend: "up" },
      { key: "locations", label: "Total Locations", value: "8,942", delta: "+184", trend: "up" },
      { key: "routers_active", label: "Active Routers", value: "24,318", delta: "+312", trend: "up" },
      { key: "routers_online", label: "Online Routers", value: "23,704", delta: "97.5%", trend: "flat" },
      { key: "routers_offline", label: "Offline Routers", value: "614", delta: "-38", trend: "down" },
      { key: "guests_active", label: "Active Guests", value: "182,430", delta: "+8.2%", trend: "up" },
      { key: "devices", label: "Connected Devices", value: "298,712", delta: "+6.4%", trend: "up" },
      { key: "sessions", label: "Active Sessions", value: "72,148", delta: "Live", trend: "flat" },
      { key: "mrr", label: "Revenue (MRR)", value: "$482,904", delta: "+11.3%", trend: "up", hint: "MoM" },
      { key: "expiring", label: "Expiring Subscriptions", value: "38", delta: "next 30d", trend: "flat" },
      { key: "tickets", label: "Open Support Tickets", value: "142", delta: "-12", trend: "down" },
    ];
  },

  async getGuestTrend(): Promise<TrendPoint[]> {
    await delay(350);
    const rnd = seeded(11);
    return Array.from({ length: 30 }, (_, i) => ({
      date: `Day ${i + 1}`,
      value: Math.round(4000 + rnd() * 3000 + i * 60),
    }));
  },

  async getRevenueTrend(): Promise<RevenuePoint[]> {
    await delay(300);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, i) => ({
      month: m,
      mrr: 280000 + i * 18000 + Math.round(Math.sin(i) * 12000),
      arr: (280000 + i * 18000) * 12,
    }));
  },

  async getRouterHealth(): Promise<RouterHealth> {
    await delay(200);
    return { online: 23704, warning: 218, offline: 614 };
  },

  async getAuthStats(): Promise<AuthPoint[]> {
    await delay(300);
    const rnd = seeded(7);
    return Array.from({ length: 14 }, (_, i) => ({
      date: `D${i + 1}`,
      success: Math.round(9000 + rnd() * 2000),
      failed: Math.round(200 + rnd() * 400),
    }));
  },

  async getTopOrgs(): Promise<TopOrgUsage[]> {
    await delay(250);
    return [
      { name: "Aurora Hotels", usage: 92 },
      { name: "NovaMalls", usage: 84 },
      { name: "Skyline Airports", usage: 78 },
      { name: "MetroTransit", usage: 66 },
      { name: "Cafe Verona", usage: 54 },
      { name: "GreenLeaf Resorts", usage: 47 },
    ];
  },

  async getDeviceDistribution(): Promise<DeviceTypeSlice[]> {
    await delay(200);
    return [
      { type: "Mobile", value: 62 },
      { type: "Laptop", value: 22 },
      { type: "Tablet", value: 11 },
      { type: "IoT", value: 5 },
    ];
  },

  async getDailyActive(): Promise<TrendPoint[]> {
    await delay(280);
    const rnd = seeded(19);
    return Array.from({ length: 7 }, (_, i) => ({
      date: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      value: Math.round(24000 + rnd() * 12000),
    }));
  },

  async getMonthlyGrowth(): Promise<GrowthPoint[]> {
    await delay(320);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, i) => ({
      month: m,
      orgs: 60 + i * 8 + Math.round(Math.sin(i) * 4),
      locations: 320 + i * 42 + Math.round(Math.cos(i) * 20),
    }));
  },

  async getRecentOrgs(): Promise<OrgRow[]> {
    await delay(220);
    return [
      { id: "o1", name: "Nimbus Coworks", plan: "Enterprise", locations: 24, createdAt: "2h ago", status: "active" },
      { id: "o2", name: "Harbor Hotels", plan: "Growth", locations: 12, createdAt: "5h ago", status: "active" },
      { id: "o3", name: "Kite Cafés", plan: "Starter", locations: 3, createdAt: "1d ago", status: "pending" },
      { id: "o4", name: "Meridian Malls", plan: "Enterprise", locations: 48, createdAt: "2d ago", status: "active" },
      { id: "o5", name: "Sunset Resorts", plan: "Growth", locations: 8, createdAt: "3d ago", status: "inactive" },
    ];
  },

  async getRecentLocations(): Promise<LocationRow[]> {
    await delay(220);
    return [
      { id: "l1", name: "Downtown Flagship", org: "Nimbus Coworks", city: "Austin, TX", addedAt: "1h ago", status: "active" },
      { id: "l2", name: "Marina Terminal", org: "Skyline Airports", city: "Dubai", addedAt: "3h ago", status: "active" },
      { id: "l3", name: "Riverside Plaza", org: "Meridian Malls", city: "Chicago, IL", addedAt: "6h ago", status: "warning" },
      { id: "l4", name: "Old Town Café", org: "Kite Cafés", city: "Lisbon", addedAt: "1d ago", status: "active" },
    ];
  },

  async getRecentRouters(): Promise<RouterRow[]> {
    await delay(200);
    return [
      { id: "r1", serial: "CG-4821-A2", model: "CG-Pro X2", org: "Harbor Hotels", registeredAt: "22m ago", status: "online" },
      { id: "r2", serial: "CG-4820-A1", model: "CG-Mini", org: "Kite Cafés", registeredAt: "1h ago", status: "online" },
      { id: "r3", serial: "CG-4819-B7", model: "CG-Pro X2", org: "Meridian Malls", registeredAt: "3h ago", status: "offline" },
      { id: "r4", serial: "CG-4818-C4", model: "CG-Edge", org: "Aurora Hotels", registeredAt: "5h ago", status: "online" },
    ];
  },

  async getRecentSessions(): Promise<SessionRow[]> {
    await delay(200);
    return [
      { id: "s1", guest: "guest_8241", org: "Aurora Hotels", location: "Downtown", startedAt: "just now", duration: "12m" },
      { id: "s2", guest: "guest_8240", org: "NovaMalls", location: "Riverside", startedAt: "2m ago", duration: "26m" },
      { id: "s3", guest: "guest_8239", org: "Skyline Airports", location: "T2", startedAt: "6m ago", duration: "48m" },
      { id: "s4", guest: "guest_8238", org: "MetroTransit", location: "Central", startedAt: "12m ago", duration: "8m" },
    ];
  },

  async getRecentPayments(): Promise<PaymentRow[]> {
    await delay(220);
    return [
      { id: "p1", org: "Aurora Hotels", amount: 4800, method: "Card ••4242", paidAt: "1h ago", status: "paid" },
      { id: "p2", org: "NovaMalls", amount: 12400, method: "ACH", paidAt: "3h ago", status: "paid" },
      { id: "p3", org: "Kite Cafés", amount: 320, method: "Card ••1121", paidAt: "6h ago", status: "failed" },
      { id: "p4", org: "Harbor Hotels", amount: 2100, method: "Card ••9910", paidAt: "1d ago", status: "paid" },
    ];
  },

  async getRecentTickets(): Promise<TicketRow[]> {
    await delay(220);
    return [
      { id: "t1", subject: "AP offline in T2", org: "Skyline Airports", priority: "urgent", updatedAt: "8m ago", status: "open" },
      { id: "t2", subject: "Captive portal timeout", org: "Aurora Hotels", priority: "high", updatedAt: "34m ago", status: "open" },
      { id: "t3", subject: "Billing question", org: "Kite Cafés", priority: "low", updatedAt: "2h ago", status: "open" },
      { id: "t4", subject: "Firmware update failed", org: "Meridian Malls", priority: "medium", updatedAt: "5h ago", status: "resolved" },
    ];
  },

  async getRecentAudit(): Promise<AuditRow[]> {
    await delay(200);
    return [
      { id: "a1", actor: "alex@cloudguest.io", action: "Created organization", target: "Nimbus Coworks", at: "12m ago" },
      { id: "a2", actor: "priya@acme.com", action: "Updated plan", target: "Harbor Hotels", at: "1h ago" },
      { id: "a3", actor: "system", action: "Auto-suspended router", target: "CG-4819-B7", at: "3h ago" },
      { id: "a4", actor: "diego@acme.com", action: "Invited user", target: "manager+2@acme.com", at: "5h ago" },
    ];
  },

  async getNotifications(): Promise<NotificationItem[]> {
    await delay(200);
    return [
      { id: "n1", kind: "router", title: "Router offline", message: "CG-4819-B7 at Riverside Plaza has been offline for 12 minutes.", at: "2m ago", unread: true },
      { id: "n2", kind: "billing", title: "Payment failed", message: "Kite Cafés payment of $320 failed. Retry scheduled.", at: "1h ago", unread: true },
      { id: "n3", kind: "subscription", title: "Subscription expiring", message: "3 subscriptions expire in the next 7 days.", at: "3h ago", unread: true },
      { id: "n4", kind: "warning", title: "High auth failure rate", message: "Aurora Hotels — Downtown exceeded 4% failed auths.", at: "5h ago" },
      { id: "n5", kind: "alert", title: "Firmware rollout complete", message: "v3.4.2 deployed to 1,204 routers.", at: "1d ago" },
      { id: "n6", kind: "system", title: "Scheduled maintenance", message: "Reporting service maintenance Sunday 02:00 UTC.", at: "2d ago" },
    ];
  },

  async search(query: string): Promise<SearchResult[]> {
    await delay(150);
    const q = query.toLowerCase().trim();
    const all: SearchResult[] = [
      { id: "1", type: "organization", title: "Aurora Hotels", subtitle: "Enterprise · 42 locations" },
      { id: "2", type: "organization", title: "NovaMalls", subtitle: "Growth · 18 locations" },
      { id: "3", type: "location", title: "Downtown Flagship", subtitle: "Nimbus Coworks · Austin, TX" },
      { id: "4", type: "location", title: "Marina Terminal", subtitle: "Skyline Airports · Dubai" },
      { id: "5", type: "router", title: "CG-4821-A2", subtitle: "Harbor Hotels · Online" },
      { id: "6", type: "router", title: "CG-4819-B7", subtitle: "Meridian Malls · Offline" },
      { id: "7", type: "guest", title: "guest_8241", subtitle: "Aurora Hotels · Downtown" },
      { id: "8", type: "ticket", title: "AP offline in T2", subtitle: "Urgent · Skyline Airports" },
    ];
    if (!q) return all.slice(0, 6);
    return all.filter((r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q));
  },
};
