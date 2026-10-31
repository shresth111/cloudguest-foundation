/**
 * Illustrative-only fixtures for the demo session. Read ONLY behind
 * `isDemo()` inside `useIspPage` / `useIspHistory` -- the demo token never
 * authenticates against the backend, so the demo never calls
 * routerService/ispService. `scripts/test-isp-page-render.mjs` asserts a
 * real session never sees any of these ids.
 *
 * The routers and lines are the venue's own, from the demo world
 * (`@/lib/demo-world`), so this page names the same router, model and
 * carriers as the dashboard, Devices and Fix a Problem. The history is
 * deterministic (no Math.random) and follows each line's current health:
 * a degraded line has a degraded recent stretch, a down line has been down
 * since its router went quiet.
 */
import type { RouterDevice } from "@/types/router";
import type {
  IspHealthCheck,
  IspHealthCheckBucket,
  IspHealthCheckSummary,
  IspLink,
} from "@/types/isp";
import { demoIspLine, demoIspLinks, demoRouterDevices } from "@/lib/demo-world";

/** The venue's routers. The lines hang off the first (edge) router. */
export function demoIspRouters(locationId: string | undefined): RouterDevice[] {
  return demoRouterDevices(locationId);
}

/** The lines on one of the venue's routers. */
export function demoIspLinksFor(locationId: string | undefined, routerId: string): IspLink[] {
  return demoIspLinks(locationId).filter((l) => l.routerId === routerId);
}

/** Deterministic 0..1 wobble. */
const wob = (i: number, k: number) => (Math.sin(i * 1.7 + k) + 1) / 2;

/** A degraded line flickers between degraded and healthy. */
const DEGRADED_PATTERN = ["degraded", "degraded", "healthy", "degraded"];

/** Lines on a mobile/backup connection have the slow, lossy profile. */
function isWeakLine(linkId: string): boolean {
  const l = demoIspLine(linkId);
  return !!l && (l.health === "degraded" || l.linkType === "wireless_4g");
}

/** The last 30 raw checks for a demo link, newest first (the API's order). */
export function demoIspChecks(linkId: string): IspHealthCheck[] {
  const line = demoIspLine(linkId);
  const health = line?.health ?? "healthy";
  const backup = isWeakLine(linkId);
  const quietFor = line?.checkedMinutesAgo ?? 0;
  return Array.from({ length: 30 }, (_, i) => {
    // i = 0 is the newest.
    const status =
      health === "unhealthy"
        ? "unhealthy"
        : health === "degraded"
          ? i < 6
            ? "degraded"
            : DEGRADED_PATTERN[i % DEGRADED_PATTERN.length]
          : i === 17 && !backup
            ? "degraded"
            : "healthy";
    return {
      id: `${linkId}-demo-check-${i}`,
      ispLinkId: linkId,
      checkedAt: new Date(Date.now() - (quietFor + i) * 60_000).toISOString(),
      status,
      source: "automated",
      latencyMs:
        status === "unhealthy"
          ? null
          : backup
            ? 60 + 40 * wob(i, 1)
            : status === "degraded"
              ? 84
              : 10 + 5 * wob(i, 2),
      packetLossPercentage:
        status === "unhealthy"
          ? 100
          : status === "degraded"
            ? backup
              ? 2 + 2 * wob(i, 3)
              : 2.1
            : 0,
      errorMessage: null,
      downloadMbps: status === "unhealthy" ? null : backup ? 1 + wob(i, 4) : 95 + 40 * wob(i, 5),
      uploadMbps:
        status === "unhealthy" ? null : backup ? 0.4 + wob(i, 6) * 0.4 : 20 + 8 * wob(i, 7),
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
  const backup = isWeakLine(linkId);
  const line = demoIspLine(linkId);
  const downForMs = line?.health === "unhealthy" ? line.checkedMinutesAgo * 60_000 : 0;
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
    // Only a line that is degraded NOW has the degraded recent stretch.
    if (backup && line?.health !== "degraded" && ago <= (unit === "hour" ? 2 : 0)) degraded = 0;
    // A line that is down has been down since its last good check.
    if (downForMs) {
      const overlap = Math.max(
        0,
        Math.min(startMs + step, now) - Math.max(startMs, now - downForMs),
      );
      if (overlap > 0) {
        unhealthy = Math.min(perBucket, Math.max(unhealthy, Math.round(overlap / 60_000)));
        degraded = Math.min(degraded, perBucket - unhealthy);
      }
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
