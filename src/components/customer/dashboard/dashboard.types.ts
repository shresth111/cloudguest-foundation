import type { IspLink, IspHealthCheck, IspSpeedTestResult } from "@/types/isp";

export const WAN_HEALTH_STYLE: Record<
  string,
  { label: string; dot: string; text: string; bar: string }
> = {
  healthy: {
    label: "Online",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  degraded: {
    label: "Degraded",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  unhealthy: {
    label: "Offline",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
  },
  unknown: {
    label: "Unknown",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    bar: "bg-muted-foreground/30",
  },
};

export const WAN_CONNECTION_MODE_LABEL: Record<string, string> = {
  static: "Static IP",
  dhcp: "DHCP",
  pppoe: "PPPoE",
};

/** "Down since 3h 12m ago" -- built from `IspLink.unhealthySince`, which is
 * itself computed server-side from real health-check history. */
export function formatDownDuration(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  if (ms < 60_000) return "under a minute";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export const DEMO_WAN_LINK: IspLink = {
  id: "isp-demo-dashboard",
  routerId: "router-demo",
  organizationId: "org-demo",
  locationId: "demo-location",
  providerName: "Airtel Business",
  linkType: "fiber",
  connectionMode: "static",
  role: "primary",
  isActiveUplink: true,
  autoFailback: true,
  isEnabled: true,
  priority: 0,
  interface: "ether1",
  gatewayIpAddress: "203.0.113.1",
  dnsPrimary: "1.1.1.1",
  dnsSecondary: "8.8.8.8",
  downloadBandwidthMbps: 500,
  uploadBandwidthMbps: 200,
  healthStatus: "healthy",
  healthStatusSource: "automated",
  unhealthySince: null,
  latencyMs: 14.2,
  packetLossPercentage: 0,
  currentDownloadMbps: 132.4,
  currentUploadMbps: 28.1,
  lastCheckedAt: new Date().toISOString(),
  consecutiveUnhealthyCount: 0,
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
};

export const DEMO_WAN_BACKUP_LINK: IspLink = {
  id: "isp-demo-dashboard-backup",
  routerId: "router-demo",
  organizationId: "org-demo",
  locationId: "demo-location",
  providerName: "Jio Fiber",
  linkType: "fiber",
  connectionMode: "dhcp",
  role: "backup",
  isActiveUplink: false,
  autoFailback: true,
  isEnabled: true,
  priority: 1,
  interface: "ether2",
  gatewayIpAddress: null,
  dnsPrimary: "1.1.1.1",
  dnsSecondary: "8.8.8.8",
  downloadBandwidthMbps: 300,
  uploadBandwidthMbps: 150,
  healthStatus: "healthy",
  healthStatusSource: "automated",
  unhealthySince: null,
  latencyMs: 19.6,
  packetLossPercentage: 0,
  currentDownloadMbps: null,
  currentUploadMbps: null,
  lastCheckedAt: new Date().toISOString(),
  consecutiveUnhealthyCount: 0,
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
};

export const DEMO_WAN_CHECKS: IspHealthCheck[] = [
  "healthy",
  "healthy",
  "healthy",
  "degraded",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
  "healthy",
].map((status, i) => ({
  id: `demo-wan-check-${i}`,
  ispLinkId: DEMO_WAN_LINK.id,
  checkedAt: new Date(Date.now() - (11 - i) * 5 * 60000).toISOString(),
  status,
  source: "automated",
  latencyMs: status === "degraded" ? 92 : 12 + i,
  packetLossPercentage: status === "degraded" ? 2.1 : 0,
  errorMessage: null,
  downloadMbps: 100 + i * 2,
  uploadMbps: 20 + i,
}));

export const DEMO_BANDWIDTH_CHECKS: IspHealthCheck[] = Array.from({ length: 60 }, (_, i) => {
  const dip = i >= 28 && i <= 33;
  const download = dip ? 16 + (i % 3) * 2 : Math.round((95 + 25 * Math.sin(i / 5)) * 10) / 10;
  const upload = dip ? 3 + (i % 2) : Math.round((22 + 6 * Math.sin(i / 5 + 1)) * 10) / 10;
  return {
    id: `demo-bandwidth-check-${i}`,
    ispLinkId: DEMO_WAN_LINK.id,
    checkedAt: new Date(Date.now() - (59 - i) * 60_000).toISOString(),
    status: dip ? "degraded" : "healthy",
    source: "automated",
    latencyMs: dip ? 86 : 13,
    packetLossPercentage: dip ? 2.8 : 0,
    errorMessage: null,
    downloadMbps: download,
    uploadMbps: upload,
  };
}).reverse();

export const BANDWIDTH_POLL_INTERVAL_MS = 20_000;

export type WanSummaryState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; links: IspLink[]; checks: IspHealthCheck[] };

export type BandwidthSeriesState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; link: IspLink; checks: IspHealthCheck[]; otherLinks: IspLink[] };

export type SpeedTestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: IspSpeedTestResult }
  | { status: "error"; message: string };
