import type {
  Alert,
  AlertStatus,
  AlertType,
  Incident,
  IncidentNote,
  IncidentPriority,
  IncidentStatus,
  LiveRouterRow,
  MonitoringKpis,
  MonitoringNotification,
  MonitoringSettings,
  NetworkOverviewItem,
  PerformanceSeries,
  ServiceHealth,
  AlertSeverity,
} from "@/types/monitoring";
import { ALERT_TYPE_LABEL } from "@/types/monitoring";

const ORGS = ["Acme Hotels", "Skyline Cafés", "Northwind Corp", "Metro Airports", "Harbor Retail"];
const LOCATIONS = ["HQ Lobby", "Downtown Branch", "Terminal 2", "Rooftop Bar", "West Wing", "Warehouse", "Front Desk"];
const ENGINEERS = ["Priya Shah", "Marco Rossi", "Ada Chen", "Kenji Tanaka", "Lucas Silva"];

const rand = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 10);

const seedRouters = (): LiveRouterRow[] =>
  Array.from({ length: 42 }).map((_, i) => {
    const status = Math.random() < 0.85 ? "online" : Math.random() < 0.6 ? "offline" : "maintenance";
    const wan = status === "offline" ? "down" : Math.random() < 0.1 ? "degraded" : "up";
    return {
      id: `rtr_${1000 + i}`,
      name: `MikroTik-${1000 + i}`,
      organization: pick(ORGS),
      location: pick(LOCATIONS),
      wanStatus: wan,
      cpu: rand(8, status === "online" ? 92 : 5),
      memory: rand(20, status === "online" ? 88 : 15),
      temperature: rand(38, 78),
      latencyMs: rand(4, 240),
      packetLoss: rand(0, 6),
      activeGuests: status === "online" ? Math.floor(rand(0, 260)) : 0,
      uptimeHours: Math.floor(rand(1, 2200)),
      lastHeartbeat: new Date(Date.now() - Math.floor(rand(1, 900)) * 1000).toISOString(),
      status,
    };
  });

const seedSeries = (n: number, min: number, max: number, spanMinutes = 30): { time: string; value: number }[] =>
  Array.from({ length: n }).map((_, i) => ({
    time: new Date(Date.now() - (n - i) * spanMinutes * 60000).toISOString(),
    value: rand(min, max),
  }));

const seedAlerts = (): Alert[] => {
  const types: AlertType[] = [
    "router_offline",
    "high_cpu",
    "high_memory",
    "high_temperature",
    "wan_down",
    "wireguard_down",
    "radius_failure",
    "portal_failure",
    "high_packet_loss",
    "internet_slow",
  ];
  const sev: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];
  const status: AlertStatus[] = ["open", "acknowledged", "resolved"];
  return Array.from({ length: 34 }).map((_, i) => {
    const type = types[i % types.length];
    return {
      id: `alt_${5000 + i}`,
      type,
      name: ALERT_TYPE_LABEL[type],
      severity: pick(sev),
      organization: pick(ORGS),
      location: pick(LOCATIONS),
      router: `MikroTik-${1000 + Math.floor(Math.random() * 42)}`,
      createdAt: new Date(Date.now() - Math.floor(rand(1, 60 * 60 * 12)) * 1000).toISOString(),
      status: pick(status),
      assignedEngineer: Math.random() < 0.55 ? pick(ENGINEERS) : undefined,
      message: `${ALERT_TYPE_LABEL[type]} detected on router with degraded conditions.`,
    };
  });
};

const seedIncidents = (): Incident[] => {
  const priorities: IncidentPriority[] = ["P1", "P2", "P3", "P4"];
  const statuses: IncidentStatus[] = ["open", "investigating", "resolved", "closed"];
  return Array.from({ length: 12 }).map((_, i) => {
    const created = new Date(Date.now() - Math.floor(rand(1, 60 * 60 * 48)) * 1000);
    const status = pick(statuses);
    return {
      id: `INC-${2400 + i}`,
      title: [
        "WAN outage in Terminal 2",
        "RADIUS auth spikes across HQ",
        "Portal 500 errors on Skyline Cafés",
        "WireGuard tunnel flapping",
        "MikroTik CPU sustained > 90%",
      ][i % 5],
      description:
        "Automated correlation from monitoring detected sustained degradation. Investigate uplink, restart affected services if needed.",
      priority: priorities[i % priorities.length],
      status,
      assignedTo: Math.random() < 0.7 ? pick(ENGINEERS) : undefined,
      createdAt: created.toISOString(),
      resolvedAt: status === "resolved" || status === "closed" ? new Date(created.getTime() + 60 * 60000).toISOString() : undefined,
      notes: [
        { id: uid(), author: "System", message: "Incident opened by correlator.", createdAt: created.toISOString() },
      ],
    };
  });
};

const seedNotifications = (): MonitoringNotification[] => {
  const cats: MonitoringNotification["category"][] = [
    "critical",
    "warning",
    "maintenance",
    "firmware",
    "subscription",
  ];
  const titles: Record<MonitoringNotification["category"], string> = {
    critical: "Critical alert triggered",
    warning: "Warning: elevated CPU",
    maintenance: "Scheduled maintenance window",
    firmware: "Firmware update available",
    subscription: "Subscription renewal upcoming",
  };
  return Array.from({ length: 14 }).map((_, i) => {
    const category = cats[i % cats.length];
    return {
      id: uid(),
      category,
      title: titles[category],
      message: "Automatically generated notification from the monitoring pipeline.",
      createdAt: new Date(Date.now() - i * 45 * 60000).toISOString(),
      read: i > 5,
    };
  });
};

let ROUTERS = seedRouters();
let ALERTS = seedAlerts();
let INCIDENTS = seedIncidents();
let NOTIFS = seedNotifications();

const SETTINGS: MonitoringSettings = {
  cpuThreshold: 85,
  memoryThreshold: 90,
  packetLossThreshold: 3,
  temperatureThreshold: 70,
  autoRefreshSeconds: 30,
  emailNotifications: true,
  smsNotifications: false,
  slackNotifications: true,
  webhookUrl: "",
};

const delay = <T,>(v: T, ms = 320): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

export const monitoringService = {
  async getKpis(): Promise<MonitoringKpis> {
    const online = ROUTERS.filter((r) => r.status === "online").length;
    const offline = ROUTERS.filter((r) => r.status === "offline").length;
    return delay({
      totalRouters: ROUTERS.length,
      onlineRouters: online,
      offlineRouters: offline,
      activeWireGuardTunnels: 38,
      activeRadiusServers: 6,
      internetUptime: 99.972,
      activeGuestSessions: ROUTERS.reduce((s, r) => s + r.activeGuests, 0),
      activeAlerts: ALERTS.filter((a) => a.status !== "resolved").length,
      criticalAlerts: ALERTS.filter((a) => a.severity === "critical" && a.status !== "resolved").length,
      warningAlerts: ALERTS.filter((a) => ["high", "medium"].includes(a.severity) && a.status !== "resolved").length,
      avgCpu: Math.round(ROUTERS.reduce((s, r) => s + r.cpu, 0) / ROUTERS.length),
      avgMemory: Math.round(ROUTERS.reduce((s, r) => s + r.memory, 0) / ROUTERS.length),
    });
  },

  async getNetworkOverview(): Promise<NetworkOverviewItem[]> {
    const total = ROUTERS.length;
    const online = ROUTERS.filter((r) => r.status === "online").length;
    const wanUp = ROUTERS.filter((r) => r.wanStatus === "up").length;
    const items: NetworkOverviewItem[] = [
      { key: "router", label: "Router status", healthy: online, total, status: online / total > 0.9 ? "healthy" : "degraded", detail: `${online} online` },
      { key: "wan", label: "WAN status", healthy: wanUp, total, status: wanUp / total > 0.9 ? "healthy" : "degraded", detail: `${wanUp} uplinks up` },
      { key: "wireguard", label: "WireGuard status", healthy: 38, total: 40, status: "healthy", detail: "38 tunnels up" },
      { key: "radius", label: "RADIUS status", healthy: 6, total: 6, status: "healthy", detail: "All servers responding" },
      { key: "portal", label: "Captive portals", healthy: 22, total: 24, status: "degraded", detail: "2 portals unpublished" },
      { key: "guest_wifi", label: "Guest WiFi", healthy: online, total, status: "healthy", detail: "Broadcast active" },
      { key: "internet", label: "Internet health", healthy: 1, total: 1, status: "healthy", detail: "Avg 42ms latency" },
      { key: "dns", label: "DNS health", healthy: 2, total: 2, status: "healthy", detail: "Primary + secondary" },
    ];
    return delay(items);
  },

  async getLiveRouters(): Promise<LiveRouterRow[]> {
    // Jitter values to simulate live updates
    ROUTERS = ROUTERS.map((r) => ({
      ...r,
      cpu: Math.max(2, Math.min(99, r.cpu + rand(-4, 4))),
      memory: Math.max(10, Math.min(99, r.memory + rand(-2, 2))),
      latencyMs: Math.max(2, r.latencyMs + rand(-8, 8)),
      packetLoss: Math.max(0, Math.min(10, r.packetLoss + rand(-0.4, 0.4))),
      lastHeartbeat: r.status === "online" ? new Date().toISOString() : r.lastHeartbeat,
    }));
    return delay([...ROUTERS], 200);
  },

  async getPerformanceSeries(): Promise<PerformanceSeries> {
    return delay({
      cpu: seedSeries(24, 15, 90, 60),
      memory: seedSeries(24, 30, 85, 60),
      bandwidth: seedSeries(24, 40, 900, 60),
      latency: seedSeries(24, 10, 180, 60),
      packetLoss: seedSeries(24, 0, 4, 60),
      guests: seedSeries(24, 40, 800, 60),
      healthScore: seedSeries(24, 70, 100, 60),
      dailyUptime: seedSeries(24, 98, 100, 60),
      weeklyUptime: seedSeries(7, 96, 100, 60 * 24),
    });
  },

  async getAlerts(): Promise<Alert[]> {
    return delay([...ALERTS]);
  },

  async setAlertStatus(id: string, status: AlertStatus): Promise<Alert> {
    ALERTS = ALERTS.map((a) => (a.id === id ? { ...a, status } : a));
    return delay(ALERTS.find((a) => a.id === id)!);
  },

  async assignAlert(id: string, engineer: string): Promise<Alert> {
    ALERTS = ALERTS.map((a) => (a.id === id ? { ...a, assignedEngineer: engineer } : a));
    return delay(ALERTS.find((a) => a.id === id)!);
  },

  async getIncidents(): Promise<Incident[]> {
    return delay([...INCIDENTS]);
  },

  async updateIncident(id: string, patch: Partial<Incident>): Promise<Incident> {
    INCIDENTS = INCIDENTS.map((i) => (i.id === id ? { ...i, ...patch } : i));
    return delay(INCIDENTS.find((i) => i.id === id)!);
  },

  async addIncidentNote(id: string, note: Omit<IncidentNote, "id" | "createdAt">): Promise<Incident> {
    INCIDENTS = INCIDENTS.map((i) =>
      i.id === id
        ? {
            ...i,
            notes: [...i.notes, { ...note, id: uid(), createdAt: new Date().toISOString() }],
          }
        : i,
    );
    return delay(INCIDENTS.find((i) => i.id === id)!);
  },

  async getServiceHealth(): Promise<ServiceHealth[]> {
    return delay([
      { key: "platform", label: "Overall platform", status: "healthy", uptime: 99.98, latencyMs: 42, description: "All core services operational" },
      { key: "router", label: "Router fleet", status: "degraded", uptime: 99.4, latencyMs: 88, description: "2 routers reporting elevated CPU" },
      { key: "database", label: "Database", status: "healthy", uptime: 99.99, latencyMs: 12, description: "Primary + replicas healthy" },
      { key: "api", label: "API Gateway", status: "healthy", uptime: 99.95, latencyMs: 68, description: "p95 within target" },
      { key: "wireguard", label: "WireGuard", status: "healthy", uptime: 99.9, latencyMs: 34, description: "All tunnels handshaking" },
      { key: "freeradius", label: "FreeRADIUS", status: "healthy", uptime: 99.97, latencyMs: 22, description: "Auth success 99.7%" },
      { key: "notifications", label: "Notification service", status: "healthy", uptime: 99.99, latencyMs: 15, description: "Queue drained" },
      { key: "sms", label: "SMS gateway", status: "degraded", uptime: 98.1, latencyMs: 240, description: "Elevated latency on APAC route" },
    ]);
  },

  async getNotifications(): Promise<MonitoringNotification[]> {
    return delay([...NOTIFS]);
  },

  async markNotificationRead(id: string) {
    NOTIFS = NOTIFS.map((n) => (n.id === id ? { ...n, read: true } : n));
    return delay(true);
  },

  async getSettings(): Promise<MonitoringSettings> {
    return delay({ ...SETTINGS });
  },

  async updateSettings(patch: Partial<MonitoringSettings>): Promise<MonitoringSettings> {
    Object.assign(SETTINGS, patch);
    return delay({ ...SETTINGS });
  },

  async restartRouter(id: string) {
    ROUTERS = ROUTERS.map((r) => (r.id === id ? { ...r, status: "maintenance" } : r));
    return delay(true, 600);
  },
};
