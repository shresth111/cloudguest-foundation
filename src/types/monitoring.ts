export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type HealthStatus = "healthy" | "degraded" | "down";
export type IncidentPriority = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export type AlertType =
  | "router_offline"
  | "high_cpu"
  | "high_memory"
  | "high_temperature"
  | "wan_down"
  | "wireguard_down"
  | "radius_failure"
  | "portal_failure"
  | "high_packet_loss"
  | "internet_slow";

export interface MonitoringKpis {
  totalRouters: number;
  onlineRouters: number;
  offlineRouters: number;
  activeWireGuardTunnels: number;
  activeRadiusServers: number;
  internetUptime: number;
  activeGuestSessions: number;
  activeAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  avgCpu: number;
  avgMemory: number;
}

export interface LiveRouterRow {
  id: string;
  name: string;
  organization: string;
  location: string;
  wanStatus: "up" | "down" | "degraded";
  cpu: number;
  memory: number;
  temperature: number;
  latencyMs: number;
  packetLoss: number;
  activeGuests: number;
  uptimeHours: number;
  lastHeartbeat: string;
  status: "online" | "offline" | "maintenance";
}

export interface NetworkOverviewItem {
  key:
    | "router"
    | "wan"
    | "wireguard"
    | "radius"
    | "portal"
    | "guest_wifi"
    | "internet"
    | "dns";
  label: string;
  healthy: number;
  total: number;
  status: HealthStatus;
  detail: string;
}

export interface TimePoint {
  time: string;
  value: number;
}

export interface PerformanceSeries {
  cpu: TimePoint[];
  memory: TimePoint[];
  bandwidth: TimePoint[];
  latency: TimePoint[];
  packetLoss: TimePoint[];
  guests: TimePoint[];
  healthScore: TimePoint[];
  dailyUptime: TimePoint[];
  weeklyUptime: TimePoint[];
}

export interface Alert {
  id: string;
  type: AlertType;
  name: string;
  severity: AlertSeverity;
  organization: string;
  location: string;
  router: string;
  createdAt: string;
  status: AlertStatus;
  assignedEngineer?: string;
  message: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
  notes: IncidentNote[];
}

export interface IncidentNote {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface ServiceHealth {
  key:
    | "platform"
    | "router"
    | "database"
    | "api"
    | "wireguard"
    | "freeradius"
    | "notifications"
    | "sms";
  label: string;
  status: HealthStatus;
  uptime: number;
  latencyMs: number;
  description: string;
}

export interface MonitoringNotification {
  id: string;
  category: "critical" | "warning" | "maintenance" | "firmware" | "subscription";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface MonitoringSettings {
  cpuThreshold: number;
  memoryThreshold: number;
  packetLossThreshold: number;
  temperatureThreshold: number;
  autoRefreshSeconds: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
  slackNotifications: boolean;
  webhookUrl?: string;
}

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  router_offline: "Router Offline",
  high_cpu: "High CPU",
  high_memory: "High Memory",
  high_temperature: "High Temperature",
  wan_down: "WAN Down",
  wireguard_down: "WireGuard Down",
  radius_failure: "RADIUS Failure",
  portal_failure: "Captive Portal Failure",
  high_packet_loss: "High Packet Loss",
  internet_slow: "Internet Slow",
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};
