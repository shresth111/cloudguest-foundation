/**
 * Monitored network hardware (Access Points, Printers, Routers, Cameras) --
 * added manually from a location's Devices page by MAC address, type, and
 * floor. Up/down status and "since" duration are derived from the MAC
 * itself (a stand-in for a real ping/poll feed) so a device's status is
 * stable across renders instead of flickering randomly.
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
  /** ISO timestamp of the last observed status change -- drives the "since" duration. */
  statusChangedAt: string;
}

export const FLOORS = ["5F", "4F", "3F", "2F", "1F", "GF"];
export const DEVICE_TYPES: DeviceType[] = ["Access Point", "Printer", "Router", "Camera", "Other"];

function seededRand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function hashMac(mac: string) {
  return Array.from(mac.toUpperCase()).reduce((a, c) => a + c.charCodeAt(0) * 31, 7);
}

/** Derives a stable simulated status + "since" timestamp from a MAC address. */
export function deriveStatus(mac: string): { status: "up" | "down"; statusChangedAt: string } {
  const rand = seededRand(hashMac(mac));
  const isUp = rand() > 0.18;
  const hoursAgo = Math.floor(rand() * 96) + 1;
  const statusChangedAt = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  return { status: isUp ? "up" : "down", statusChangedAt };
}

/** Derives a stable simulated CPU load (%) for an "up" device from its MAC. Null when down. */
export function deriveCpu(mac: string, status: "up" | "down"): number | null {
  if (status === "down") return null;
  const rand = seededRand(hashMac(mac) + 13);
  rand(); rand(); // skip past the values deriveStatus already consumed for this seed family
  return Math.round(rand() * 80) + 5;
}

/** Formats an ISO timestamp into a short "since" duration, e.g. "2d 4h" or "18m". */
export function formatSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function seedDevice(locationId: string, name: string, mac: string, type: DeviceType, floor: string): MonitoredDevice {
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
  addDevice: (locationId: string, name: string, mac: string, type: DeviceType, floor: string) => void;
  removeDevice: (id: string) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      devices: SEED_DEVICES,
      addDevice: (locationId, name, mac, type, floor) =>
        set((s) => ({ devices: [...s.devices, seedDevice(locationId, name || mac, mac, type, floor)] })),
      removeDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
    }),
    { name: "cg-monitored-devices", version: 2 },
  ),
);
