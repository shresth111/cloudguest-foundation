import type { NasDevice } from "@/types/tenant";

/**
 * Standalone NAS registry used by Location Master (FE-024).
 *
 * Mirrors the shape that ships in tenant.service.ts but is keyed by
 * Location so any Location detail / NAS detail screen can fetch its
 * devices without going through a customer context. Real backend will
 * expose GET /api/v1/locations/:id/nas returning the same shape.
 */

export interface NasRuntime extends NasDevice {
  cpuPct: number;
  ramPct: number;
  temperatureC: number;
  trafficMbps: number;
  guestsOnline: number;
  uptimePct: number;
  firmwareUpToDate: boolean;
}

const MODELS = ["MikroTik CCR2004", "MikroTik CCR1036", "MikroTik RB5009", "MikroTik hAP ax3", "MikroTik hEX S"];
const ROS = ["7.14.2", "7.14.0", "7.13.5", "7.13.1", "7.12.3"];

function seed(n: number) {
  let s = n * 9301;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const NAS_BY_LOC: Record<string, NasRuntime[]> = {};

function ensure(locationId: string): NasRuntime[] {
  if (NAS_BY_LOC[locationId]) return NAS_BY_LOC[locationId];
  const rand = seed(locationId.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const count = 1 + Math.floor(rand() * 3);
  const short = locationId.slice(-4).toUpperCase();
  const rows: NasRuntime[] = Array.from({ length: count }).map((_, i) => {
    const status: NasDevice["status"] = rand() > 0.85 ? "degraded" : rand() > 0.95 ? "offline" : "online";
    return {
      id: `NAS-${short}-${String(100 + i).padStart(3, "0")}`,
      nasIdentifier: `cg-${short.toLowerCase()}-${100 + i}`,
      routerIdentity: `MT-${short}-${String(i + 1).padStart(2, "0")}`,
      name: `Edge ${short}-${i + 1}`,
      serialNumber: `SN-${short}-${String(1000 + i)}`,
      model: MODELS[i % MODELS.length],
      routerOsVersion: ROS[i % ROS.length],
      publicIp: `203.0.${100 + i}.${(locationId.charCodeAt(4) || 10) % 250}`,
      privateIp: `10.${10 + i}.${(locationId.charCodeAt(5) || 1) % 250}.1`,
      locationId,
      locationName: locationId,
      status,
      cpuPct: Math.floor(rand() * 70) + 5,
      ramPct: Math.floor(rand() * 60) + 20,
      temperatureC: 35 + Math.floor(rand() * 25),
      trafficMbps: Math.floor(rand() * 600),
      guestsOnline: Math.floor(rand() * 400),
      uptimePct: 95 + Math.round(rand() * 50) / 10,
      firmwareUpToDate: rand() > 0.4,
    };
  });
  NAS_BY_LOC[locationId] = rows;
  return rows;
}

function delay<T>(v: T, ms = 200): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export const nasService = {
  async listByLocation(locationId: string): Promise<NasRuntime[]> {
    return delay(ensure(locationId));
  },
  async get(locationId: string, nasId: string): Promise<NasRuntime | null> {
    return delay(ensure(locationId).find((n) => n.id === nasId) ?? null);
  },
  async countByLocation(locationId: string): Promise<number> {
    return delay(ensure(locationId).length, 50);
  },
  async runOperation(locationId: string, nasId: string, op: string): Promise<{ ok: true; op: string }> {
    // Placeholder: real backend will queue and stream progress.
    void ensure(locationId);
    return delay({ ok: true as const, op: `${nasId}:${op}` }, 400);
  },
};
