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

export interface NasReservation {
  id: string;
  reservedAt: string;
  status: "reserved" | "assigned" | "released";
  assignedLocationId?: string;
  note?: string;
}

const RESERVATIONS: NasReservation[] = [
  { id: "NAS-DEL-0001", reservedAt: new Date(Date.now() - 3 * 86400000).toISOString(), status: "assigned", assignedLocationId: "LOC-02001", note: "Delhi Airport T3" },
  { id: "NAS-MUM-0001", reservedAt: new Date(Date.now() - 2 * 86400000).toISOString(), status: "assigned", assignedLocationId: "LOC-02002", note: "Mumbai HQ" },
  { id: "NAS-BLR-0001", reservedAt: new Date(Date.now() - 1 * 86400000).toISOString(), status: "reserved", note: "Bengaluru pipeline" },
  { id: "NAS-DEL-0002", reservedAt: new Date().toISOString(), status: "reserved" },
];

const CITY_SEQ: Record<string, number> = { DEL: 2, MUM: 1, BLR: 1, HYD: 0, PUN: 0, CHN: 0 };

function padId(city: string, n: number) {
  return `NAS-${city.toUpperCase()}-${String(n).padStart(4, "0")}`;
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
    void ensure(locationId);
    return delay({ ok: true as const, op: `${nasId}:${op}` }, 400);
  },

  /** Flatten every NAS across every seeded location for the NAS Management inventory. */
  async listAllNas(seedLocations: string[]): Promise<NasRuntime[]> {
    const out: NasRuntime[] = [];
    for (const loc of seedLocations) out.push(...ensure(loc));
    return delay(out, 250);
  },

  /* ---------------- NAS ID Generator ---------------- */

  async listReservations(): Promise<NasReservation[]> {
    return delay([...RESERVATIONS].sort((a, b) => (a.reservedAt < b.reservedAt ? 1 : -1)), 150);
  },

  async isNasIdAvailable(id: string): Promise<boolean> {
    return delay(!RESERVATIONS.find((r) => r.id === id && r.status !== "released"), 80);
  },

  async generateNasId(cityCode: string): Promise<string> {
    const code = cityCode.toUpperCase();
    const next = (CITY_SEQ[code] ?? 0) + 1;
    CITY_SEQ[code] = next;
    const id = padId(code, next);
    RESERVATIONS.unshift({ id, reservedAt: new Date().toISOString(), status: "reserved" });
    return delay(id, 200);
  },

  async reserveNasId(id: string, note?: string): Promise<NasReservation> {
    const upper = id.toUpperCase().trim();
    if (RESERVATIONS.find((r) => r.id === upper && r.status !== "released")) {
      throw new Error(`NAS ID ${upper} already exists`);
    }
    const row: NasReservation = { id: upper, reservedAt: new Date().toISOString(), status: "reserved", note };
    RESERVATIONS.unshift(row);
    return delay(row, 200);
  },

  async releaseNasId(id: string): Promise<void> {
    const idx = RESERVATIONS.findIndex((r) => r.id === id);
    if (idx >= 0) RESERVATIONS[idx] = { ...RESERVATIONS[idx], status: "released" };
    return delay(undefined, 150);
  },
};
