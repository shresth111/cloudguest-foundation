/**
 * Illustrative-only fixtures for the demo session. Read ONLY behind
 * `isDemo()` inside `useIspPage` / `useIspHistory` -- the demo token never
 * authenticates against the backend (see router.service.ts's own
 * DEMO_ROUTERS comment), so the demo never calls routerService/ispService.
 * `scripts/test-isp-page-render.mjs` asserts a real session never sees any
 * of these ids.
 *
 * The router and links are the same values the page shipped before the
 * console revamp; the history is new and deterministic (no Math.random), so
 * screenshots and tests are stable.
 */
import type { RouterDevice } from "@/types/router";
import type {
  IspHealthCheck,
  IspHealthCheckBucket,
  IspHealthCheckSummary,
  IspLink,
} from "@/types/isp";

export const DEMO_ISP_ROUTER: RouterDevice = {
  id: "router-demo-isp",
  locationId: "demo-location",
  locationName: "Demo Location",
  organizationId: "org-demo",
  organizationName: "Demo Org",
  name: "DEMO-EDGE-01",
  serialNumber: "SN-DEMO-ISP",
  macAddress: "AA:BB:CC:DD:EE:FF",
  model: "RB5009UG+S+",
  vendor: "MikroTik",
  routerOsVersion: "7.14",
  managementIpAddress: "10.20.0.1",
  publicIpAddress: "203.0.113.20",
  status: "online",
  lastSeenAt: new Date().toISOString(),
  lastHealthCheckAt: new Date().toISOString(),
  healthStatus: "healthy",
  hasApiCredentials: true,
  controllerState: null,
  controllerStateReason: null,
  controllerLastContactedAt: null,
  vendorClaimIsContradicted: false,
  settings: {},
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEMO_ISP_LINKS: IspLink[] = [
  {
    id: "isp-demo-1",
    routerId: DEMO_ISP_ROUTER.id,
    organizationId: "org-demo",
    locationId: "demo-location",
    providerName: "Airtel",
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
    latencyMs: 12.4,
    packetLossPercentage: 0,
    currentDownloadMbps: 118.2,
    currentUploadMbps: 24.6,
    lastCheckedAt: new Date().toISOString(),
    consecutiveUnhealthyCount: 0,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "isp-demo-2",
    routerId: DEMO_ISP_ROUTER.id,
    organizationId: "org-demo",
    locationId: "demo-location",
    providerName: "Jio",
    linkType: "wireless_4g",
    connectionMode: "dhcp",
    role: "backup",
    isActiveUplink: false,
    autoFailback: true,
    isEnabled: true,
    priority: 1,
    interface: "lte1",
    gatewayIpAddress: "203.0.113.9",
    dnsPrimary: "1.1.1.1",
    dnsSecondary: null,
    downloadBandwidthMbps: 100,
    uploadBandwidthMbps: 40,
    healthStatus: "degraded",
    healthStatusSource: "automated",
    unhealthySince: null,
    latencyMs: 89.1,
    packetLossPercentage: 3.2,
    currentDownloadMbps: 31.5,
    currentUploadMbps: 8.1,
    lastCheckedAt: new Date().toISOString(),
    consecutiveUnhealthyCount: 0,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

/** Deterministic 0..1 wobble. */
const wob = (i: number, k: number) => (Math.sin(i * 1.7 + k) + 1) / 2;

const PATTERN: Record<string, string[]> = {
  "isp-demo-1": ["healthy"],
  "isp-demo-2": ["degraded", "degraded", "healthy", "degraded"],
};

/** The last 30 raw checks for a demo link, newest first (the API's order). */
export function demoIspChecks(linkId: string): IspHealthCheck[] {
  const backup = linkId === "isp-demo-2";
  const pat = PATTERN[linkId] ?? ["healthy"];
  return Array.from({ length: 30 }, (_, i) => {
    // i = 0 is the newest.
    const status = backup
      ? i < 6
        ? "degraded"
        : pat[i % pat.length]
      : i === 17
        ? "degraded"
        : "healthy";
    return {
      id: `${linkId}-demo-check-${i}`,
      ispLinkId: linkId,
      checkedAt: new Date(Date.now() - i * 60_000).toISOString(),
      status,
      source: "automated",
      latencyMs: backup ? 60 + 40 * wob(i, 1) : status === "degraded" ? 84 : 10 + 5 * wob(i, 2),
      packetLossPercentage: status === "degraded" ? (backup ? 2 + 2 * wob(i, 3) : 2.1) : 0,
      errorMessage: null,
      downloadMbps: backup ? 1 + wob(i, 4) : 95 + 40 * wob(i, 5),
      uploadMbps: backup ? 0.4 + wob(i, 6) * 0.4 : 20 + 8 * wob(i, 7),
    };
  });
}

const RANGE_HOURS = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;
export type IspRange = keyof typeof RANGE_HOURS;
export const ISP_RANGE_HOURS = RANGE_HOURS;

/** Bucketed history for a demo link: hourly for 24h/7d, daily for 30d --
 * the same units the real summary endpoint returns. The backup line has one
 * short outage and a degraded stretch; the primary has one degraded hour. */
export function demoIspSummary(linkId: string, range: IspRange): IspHealthCheckSummary {
  const backup = linkId === "isp-demo-2";
  const unit: "hour" | "day" = range === "30d" ? "day" : "hour";
  const step = unit === "day" ? 86_400_000 : 3_600_000;
  const n = range === "30d" ? 30 : RANGE_HOURS[range];
  const now = Date.now();
  const end = Math.floor(now / step) * step;
  const perBucket = unit === "day" ? 1440 : 60;
  const buckets: IspHealthCheckBucket[] = Array.from({ length: n }, (_, k) => {
    const ago = n - 1 - k; // buckets back from now
    const startMs = end - ago * step;
    let unhealthy = 0;
    let degraded = 0;
    if (backup) {
      if (unit === "hour" && (ago === 7 || ago === 8)) unhealthy = ago === 7 ? 38 : 12;
      if (unit === "hour" && ago >= 0 && ago <= 2) degraded = 30;
      if (unit === "day" && ago === 0) {
        unhealthy = 50;
        degraded = 120;
      }
      if (unit === "day" && ago === 11) unhealthy = 140;
    } else {
      if (unit === "hour" && ago === 15) degraded = 18;
      if (unit === "hour" && ago === 40) unhealthy = 9;
      if (unit === "day" && ago === 1) degraded = 18;
      if (unit === "day" && ago === 19) unhealthy = 22;
    }
    const total = perBucket;
    const healthy = total - unhealthy - degraded;
    const hourOfDay = new Date(startMs).getHours();
    const busy =
      unit === "day"
        ? 0.6
        : Math.max(0.15, Math.sin(((hourOfDay - 7) / 24) * Math.PI * 2) * 0.5 + 0.5);
    const lat = backup
      ? 55 + 30 * wob(k, 1) + (degraded ? 30 : 0)
      : 11 + 4 * wob(k, 2) + (degraded ? 60 : 0) + (unhealthy ? 40 : 0);
    return {
      bucketStart: new Date(startMs).toISOString(),
      totalChecks: total,
      healthyCount: healthy,
      degradedCount: degraded,
      unhealthyCount: unhealthy,
      uptimePercentage: (100 * (total - unhealthy)) / total,
      avgLatencyMs: Math.round(lat * 10) / 10,
      avgPacketLossPercentage:
        Math.round(
          ((unhealthy ? 18 : 0) + (degraded ? 2.6 : 0) + (backup ? 0.3 * wob(k, 3) : 0)) * 10,
        ) / 10,
      avgDownloadMbps:
        unhealthy > total / 2
          ? null
          : Math.round((backup ? 1 + wob(k, 4) : 40 + 140 * busy * (0.8 + 0.4 * wob(k, 5))) * 10) /
            10,
      avgUploadMbps:
        unhealthy > total / 2
          ? null
          : Math.round((backup ? 0.5 : 8 + 30 * busy * (0.8 + 0.4 * wob(k, 6))) * 10) / 10,
      maxDownloadMbps: null,
    };
  });
  return {
    bucketUnit: unit,
    start: new Date(end - (n - 1) * step).toISOString(),
    end: new Date(now).toISOString(),
    buckets,
  };
}
