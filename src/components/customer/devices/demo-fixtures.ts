/**
 * DEMO-ONLY fixtures for the Devices page. Every export here is reached
 * only through an `isDemo()` branch (`useLocationDevices`,
 * `useMonitoredHardware`); `scripts/test-devices-inventory.mjs` asserts both
 * that the gate is in place and that the real branches never import these.
 *
 * Why they exist: on the demo host `useLocationDevices` resolved an
 * organization id first -- a backend call the demo has no backend for -- so
 * the traffic panel read "We could not read this venue's devices", and the
 * demo store's hardware carried no `health`, so the detail drawer had no port
 * or link facts to show. Both are demo-only gaps; nothing here is reachable
 * from a real session.
 */
import type { RouterLiveness } from "@/lib/location-liveness";
import type { RouterDevice } from "@/types/router";
import type { DeviceHealth, DeviceHealthEvent } from "@/lib/hardware-health";
import type { MonitoredDeviceRow } from "@/services/deviceHardware.service";
import { demoHardwareState, demoVenue } from "@/lib/demo-world";

/** The demo venue's routers, as the liveness summary in the store already
 * names them, so the inventory, the traffic picker and the Overview all
 * show the same routers. */
export function demoRouterDevices(
  locationId: string,
  routers: readonly RouterLiveness[] | null | undefined,
): RouterDevice[] {
  const now = new Date().toISOString();
  const venue = demoVenue(locationId);
  return (routers ?? []).map((r, i) => {
    // Model, serial and MAC from the demo world, so Devices names the same
    // hardware as Internet Connection and Security.
    const w = venue?.routers.find((x) => x.id === r.key);
    return {
      id: r.key,
      locationId,
      locationName: venue?.name ?? "",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      name: r.label,
      serialNumber: w?.serial ?? `DEMO-${r.key.toUpperCase()}`,
      macAddress:
        w?.mac ??
        `02:00:5E:00:0${i + 1}:${(16 + i * 7).toString(16).toUpperCase().padStart(2, "0")}`,
      model: w?.model ?? "hAP ax²",
      vendor: "MikroTik",
      routerOsVersion: "7.19.4",
      managementIpAddress: null,
      publicIpAddress: null,
      status: w?.status ?? "online",
      lastSeenAt: r.lastContactIso,
      lastHealthCheckAt: r.lastContactIso,
      healthStatus: r.state === "online" ? "healthy" : null,
      hasApiCredentials: true,
      controllerState: null,
      controllerStateReason: null,
      controllerLastContactedAt: null,
      lastRadiusAt: null,
      vendorClaimIsContradicted: false,
      settings: {},
      createdAt: now,
      updatedAt: now,
    } satisfies RouterDevice;
  });
}

function hash(s: string): number {
  return Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
}

/**
 * A plausible `health` object for a demo hardware row, derived from its MAC
 * so it is stable across renders. Spans the states the drawer explains:
 * mostly up behind a router port, one with a flapping link, and a down row
 * whose port has no link. `status` is set to agree with it, so every
 * consumer (counts, Needs Attention, topology) tells the same story.
 */
export function withDemoHealth(
  rows: readonly MonitoredDeviceRow[],
  now: number = Date.now(),
): MonitoredDeviceRow[] {
  return rows.map((d, idx) => {
    if (d.health) return d;
    const h = hash(d.mac);
    const port = `ether${2 + (idx % 4)}`;
    const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
    // The demo world says which device is down or unstable; the store's
    // `status` agrees with it (deviceStore seeds from the same world).
    const state = demoHardwareState(d.mac);
    const kind =
      d.status === "down" || state === "down" ? "down" : state === "unstable" ? "flapping" : "up";
    const events: DeviceHealthEvent[] =
      kind === "down"
        ? [
            {
              at: at(310),
              kind: "link_down",
              fromState: null,
              toState: null,
              reason: null,
              count: 1,
              detail: null,
            },
            {
              at: at(308),
              kind: "state",
              fromState: "up",
              toState: "down",
              reason: "port_link_down",
              count: null,
              detail: null,
            },
          ]
        : kind === "flapping"
          ? [
              {
                at: at(96),
                kind: "link_down",
                fromState: null,
                toState: null,
                reason: null,
                count: 3,
                detail: null,
              },
              {
                at: at(420),
                kind: "state",
                fromState: "up",
                toState: "degraded",
                reason: "link_flapping",
                count: null,
                detail: null,
              },
            ]
          : [];
    const health: DeviceHealth = {
      state: kind === "down" ? "down" : kind === "flapping" ? "degraded" : "up",
      reason:
        kind === "down"
          ? "port_link_down"
          : kind === "flapping"
            ? "link_flapping"
            : "liveness_probe",
      since: kind === "down" ? at(308) : kind === "flapping" ? at(420) : at(60 * (20 + (h % 50))),
      checkedAt: at(1),
      consecutiveFailures: kind === "down" ? 2 + (h % 3) : 0,
      lastOkAt: kind === "down" ? at(311) : at(1),
      lastRttMs: kind === "down" ? null : 1 + (h % 9),
      probeMethod: h % 3 === 0 ? "arp" : "icmp",
      portName: port,
      portRunning: kind !== "down",
      portLastLinkDownAt: kind === "up" ? null : kind === "down" ? at(310) : at(95),
      portLastLinkUpAt: kind === "flapping" ? at(94) : kind === "up" ? at(60 * 30) : null,
      linkFlaps24h: kind === "flapping" ? 3 : 0,
      clientsBehind: kind === "down" ? 0 : 3 + (h % 17),
      rxBps: kind === "down" ? null : 180_000 + (h % 900) * 1_000,
      txBps: kind === "down" ? null : 900_000 + (h % 4000) * 1_000,
      events24h: events,
    };
    return { ...d, health, status: kind === "down" ? "down" : "up" };
  });
}
