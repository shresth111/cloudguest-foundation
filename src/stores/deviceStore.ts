/**
 * DEMO-ONLY fixture for monitored network hardware (Access Points,
 * Printers, Routers, Cameras). Real accounts have used
 * `services/deviceHardware.service.ts` against `GET /monitored-hardware`
 * since that file replaced this one; `hooks/useMonitoredHardware.ts` is
 * the single switch between the two. Everything here is invented from a
 * MAC hash, which is why it may only ever be reached through that hook's
 * `isDemo()` branch.
 *
 * The floor list used to live here too -- `FLOORS = ["5F"..."GF"]`, six
 * hardcoded strings that a real account was shown as if they were its own
 * floors, and which were also used to *filter* the floor tiles, so a
 * device on any other floor silently disappeared from them. That has moved
 * to `@/lib/device-floors`, which derives a venue's floors from its own
 * hardware rows. Nothing hardcodes a floor list any more.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DeviceType = "Access Point" | "Printer" | "Router" | "Camera" | "Other";

export interface MonitoredDevice {
  id: string;
  /** The location this hardware physically sits in -- a location's own
   * devices/floors are meaningless mixed with another location's. */
  locationId: string;
  name: string;
  mac: string;
  type: DeviceType;
  floor: string;
  status: "up" | "down";
  /** ISO timestamp the fixture last "saw" this device. Named for what it
   * is: this is the demo counterpart of the backend's `last_seen_at`, and
   * naming it after a status *change* is what let the UI print it as an
   * uptime.
   * See `@/lib/device-liveness`. */
  lastSeenAt: string;
  /** Fixture uptime, in seconds. Demo accounts get one for every device so
   * the screen exercises the real label; a REAL account only ever gets
   * this from the backend, and gets `null` for anything that is not a
   * managed router. */
  uptimeSeconds: number;
  /** Fixture reading timestamp -- always "just now", so the demo never
   * renders the stale-reading branch. */
  uptimeRecordedAt: string;
}

export const DEVICE_TYPES: DeviceType[] = ["Access Point", "Printer", "Router", "Camera", "Other"];

function seededRand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function hashMac(mac: string) {
  return Array.from(mac.toUpperCase()).reduce((a, c) => a + c.charCodeAt(0) * 31, 7);
}

/** Derives a stable simulated status, last-seen time and uptime from a MAC
 * address. The two timestamps are deliberately unrelated to each other --
 * that is the point of the fact they represent, and a fixture where they
 * always agreed would hide the very bug this shape exists to prevent. */
export function deriveStatus(mac: string): {
  status: "up" | "down";
  lastSeenAt: string;
  uptimeSeconds: number;
  uptimeRecordedAt: string;
} {
  const rand = seededRand(hashMac(mac));
  const isUp = rand() > 0.18;
  const hoursAgo = Math.floor(rand() * 96) + 1;
  const lastSeenAt = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  return {
    status: isUp ? "up" : "down",
    lastSeenAt,
    uptimeSeconds: Math.floor(rand() * 400000) + 600,
    uptimeRecordedAt: new Date().toISOString(),
  };
}

/** Derives a stable simulated CPU load (%) for an "up" device from its MAC. Null when down. */
export function deriveCpu(mac: string, status: "up" | "down"): number | null {
  if (status === "down") return null;
  const rand = seededRand(hashMac(mac) + 13);
  rand();
  rand(); // skip past the values deriveStatus already consumed for this seed family
  return Math.round(rand() * 80) + 5;
}

function seedDevice(
  locationId: string,
  name: string,
  mac: string,
  type: DeviceType,
  floor: string,
): MonitoredDevice {
  return { id: mac, locationId, name, mac, type, floor, ...deriveStatus(mac) };
}

// Mumbai HQ (loc-1) is the only location with hardware set up so far -- every
// other location shows empty until someone adds a device from its Devices page.
const SEED_DEVICES: MonitoredDevice[] = [
  seedDevice("loc-1", "AP TP Link 7", "3C:64:CF:CE:2D:38", "Access Point", "GF"),
  seedDevice("loc-1", "EAP225-8C-90-2D-6D-53-26", "8C:90:2D:6D:53:26", "Access Point", "GF"),
  seedDevice("loc-1", "EAP225-B0-19-21-73-E2-CA", "B0:19:21:73:E2:CA", "Access Point", "GF"),
  seedDevice("loc-1", "EAP225-B0-19-21-74-0A-90", "B0:19:21:74:0A:90", "Access Point", "GF"),
  seedDevice("loc-1", "EAP225-B0-19-21-74-0A-68", "B0:19:21:74:0A:68", "Access Point", "GF"),
];

interface DeviceState {
  devices: MonitoredDevice[];
  addDevice: (
    locationId: string,
    name: string,
    mac: string,
    type: DeviceType,
    floor: string,
  ) => void;
  removeDevice: (id: string) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      devices: SEED_DEVICES,
      addDevice: (locationId, name, mac, type, floor) =>
        set((s) => ({
          devices: [...s.devices, seedDevice(locationId, name || mac, mac, type, floor)],
        })),
      removeDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
    }),
    // Bumped to 3 for the rename of the old status-change field to
    // `lastSeenAt`, and the
    // two new uptime fields. No `migrate` on purpose: this store holds
    // nothing but regenerable demo fixtures, so discarding a v2 payload
    // reseeds it correctly, whereas carrying one forward would leave rows
    // whose `uptimeSeconds` is `undefined` -- the exact value every
    // `!= null` guard downstream is written to exclude.
    { name: "cg-monitored-devices", version: 3 },
  ),
);
