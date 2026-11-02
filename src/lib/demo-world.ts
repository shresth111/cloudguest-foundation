/**
 * THE DEMO WORLD. Demo workspace only (`isDemo()` / `isDemoSession()`).
 *
 * One source of truth for every demo venue: its routers (name, model,
 * check-in), its internet lines (role, health, speeds), its other hardware
 * (access points), its guests and its open problems. Every demo fixture in
 * the app derives from this module, so the dashboard, Guests, Devices,
 * Internet Connection, Security, Alerts, Fix a Problem, the insight cards
 * and the Reports venue pickers all tell the same story about the same
 * venue. Before this each screen carried its own hand-written fixture and
 * they disagreed (378 guests vs 24, 1 router vs 2, Airtel vs Jio, venues
 * that do not exist in this demo) -- the demo is the sales demo, the
 * product video and the website screenshots, so a prospect clicking around
 * saw the contradictions within a minute.
 *
 * GUESTS ARE ONE LIST. Each venue has a deterministic session roster (90
 * days, quiet nights, lunch and evening peaks, busier weekends, some
 * returning guests). Every guest number on every screen is COUNTED from
 * that roster, never typed in:
 *   - dashboard "Guests, last 24 hours" = distinct guests with a session
 *     that started in the window;
 *   - "Currently online" (dashboard) and "Online now" (Guests) = distinct
 *     guests with a session open right now;
 *   - Guests page "Total guests" = distinct guests on file (the whole
 *     roster), which is what that tile counts for a real account too, so it
 *     is larger than the 24-hour figure for the same honest reason;
 *   - insight cards, venue comparison, Reports = the same roster, windowed.
 *
 * ALERTS ARE DERIVED, not written: a router that stopped checking in, a
 * degraded or down internet line, an unstable or unresponsive access point
 * each raise exactly one alert. A venue cannot be "all good" in one place
 * and carry a critical alert in another.
 *
 * Pure: no React, no services, no `isDemo()` of its own. Callers own the
 * gate; `scripts/test-demo-world.mjs` pins that every screen agrees.
 */
import type { RawRouterLiveness } from "@/lib/location-liveness";
import type { RouterDevice } from "@/types/router";
import type { IspLink, IspConnectionMode, IspLinkRole } from "@/types/isp";

/* ── Shape ───────────────────────────────────────────────────────────── */

export interface DemoWorldRouter {
  id: string;
  name: string;
  model: string;
  serial: string;
  mac: string;
  /** `routers.status` as the API would store it. Note a router that went
   * quiet is still `online` in the database -- nothing writes the
   * transition; the stale check-in is what reveals it. */
  status: "online" | "provisioning";
  /** Minutes since its last check-in. */
  lastSeenMinutesAgo: number;
  lan: string;
  wan: string;
}

export interface DemoWorldIspLine {
  id: string;
  provider: string;
  linkType: "fiber" | "wireless_4g" | "broadband";
  connectionMode: IspConnectionMode;
  role: IspLinkRole;
  /** Carrying the venue's traffic right now. */
  inUse: boolean;
  downloadMbps: number;
  uploadMbps: number;
  health: "healthy" | "degraded" | "unhealthy";
  latencyMs: number | null;
  lossPercent: number | null;
  /** Live load, only on the line carrying traffic. */
  currentDownloadMbps: number | null;
  currentUploadMbps: number | null;
  /** Minutes since the router last measured this line. */
  checkedMinutesAgo: number;
  interface: string;
  gateway: string | null;
}

export interface DemoWorldHardware {
  name: string;
  mac: string;
  type: "Access Point" | "Printer" | "Camera" | "Other";
  floor: string;
  /** `unstable` = up, but its cable link dropped repeatedly today. */
  state: "up" | "unstable" | "down";
}

export interface DemoVenue {
  id: string;
  name: string;
  city: string;
  propertyType: string | null;
  routers: DemoWorldRouter[];
  /** The lines belong to the venue's first (edge) router. */
  isp: DemoWorldIspLine[];
  hardware: DemoWorldHardware[];
  guests: {
    /** Sessions started in the busiest hour of a weekday. 0 = no guests. */
    arrivalsPeakPerHour: number;
    /** Mean session length, minutes. */
    avgSessionMinutes: number;
    /** Share of sessions from a guest who has been here before. */
    returningShare: number;
  };
  /** Failed guest sign-ins today (dashboard chip + Needs attention). */
  failedLoginsToday: number;
  /** Uptime of the line in use, last 30 days; `null` with no line. */
  uptimePercent: number | null;
}

export const DEMO_ORG = { id: "org-1", name: "Acme Corp" } as const;

/* ── The venues ──────────────────────────────────────────────────────── */

/**
 * Eight venues spanning every liveness state the product can show:
 *   Mumbai HQ      live, healthy-ish: backup line degraded, one AP unstable
 *   Delhi Office   live, all good
 *   Bangalore DC   partly live: First floor router gone quiet (and its AP)
 *   Chennai Office live (a café)
 *   Hyderabad DC   not live: its only router went quiet ~3 h ago, line down
 *   Kolkata Office set up but the router has never checked in
 *   Pune Office    live, all good
 *   Ahmedabad DC   created, no router yet
 */
export const DEMO_VENUES: readonly DemoVenue[] = [
  {
    id: "loc-1",
    name: "Mumbai HQ",
    city: "Mumbai",
    propertyType: "office",
    routers: [
      {
        id: "r-1",
        name: "Lobby router",
        model: "RB5009UG+S+",
        serial: "DEMO-HQ-LOBBY",
        mac: "02:00:5E:00:00:01",
        status: "online",
        lastSeenMinutesAgo: 1,
        lan: "10.5.50.1",
        wan: "203.0.113.10",
      },
      {
        id: "r-1-floor2",
        name: "Floor 2 router",
        model: "hAP ax³",
        serial: "DEMO-HQ-FL2",
        mac: "02:00:5E:00:00:02",
        status: "online",
        lastSeenMinutesAgo: 2,
        lan: "10.5.50.2",
        wan: "203.0.113.10",
      },
    ],
    isp: [
      {
        id: "isp-loc-1-airtel",
        provider: "Airtel",
        linkType: "fiber",
        connectionMode: "static",
        role: "primary",
        inUse: true,
        downloadMbps: 500,
        uploadMbps: 200,
        health: "healthy",
        latencyMs: 12.4,
        lossPercent: 0,
        currentDownloadMbps: 118.2,
        currentUploadMbps: 24.6,
        checkedMinutesAgo: 0,
        interface: "ether1",
        gateway: "203.0.113.1",
      },
      {
        id: "isp-loc-1-jio",
        provider: "Jio",
        linkType: "wireless_4g",
        connectionMode: "dhcp",
        role: "backup",
        inUse: false,
        downloadMbps: 100,
        uploadMbps: 40,
        health: "degraded",
        latencyMs: 89.1,
        lossPercent: 3.2,
        currentDownloadMbps: null,
        currentUploadMbps: null,
        checkedMinutesAgo: 0,
        interface: "lte1",
        gateway: "203.0.113.9",
      },
    ],
    hardware: [
      {
        name: "AP TP Link 7",
        mac: "3C:64:CF:CE:2D:38",
        type: "Access Point",
        floor: "GF",
        state: "unstable",
      },
      {
        name: "EAP225-8C-90-2D-6D-53-26",
        mac: "8C:90:2D:6D:53:26",
        type: "Access Point",
        floor: "GF",
        state: "up",
      },
      {
        name: "EAP225-B0-19-21-73-E2-CA",
        mac: "B0:19:21:73:E2:CA",
        type: "Access Point",
        floor: "GF",
        state: "up",
      },
      {
        name: "EAP225-B0-19-21-74-0A-90",
        mac: "B0:19:21:74:0A:90",
        type: "Access Point",
        floor: "2F",
        state: "up",
      },
      {
        name: "EAP225-B0-19-21-74-0A-68",
        mac: "B0:19:21:74:0A:68",
        type: "Access Point",
        floor: "2F",
        state: "up",
      },
    ],
    guests: { arrivalsPeakPerHour: 60, avgSessionMinutes: 110, returningShare: 0.34 },
    failedLoginsToday: 12,
    uptimePercent: 99.97,
  },
  {
    id: "loc-2",
    name: "Delhi Office",
    city: "Delhi",
    propertyType: "office",
    routers: [
      {
        id: "r-2",
        name: "Front desk router",
        model: "hAP ax²",
        serial: "DEMO-DEL-FD",
        mac: "02:00:5E:00:00:21",
        status: "online",
        lastSeenMinutesAgo: 2,
        lan: "10.5.70.1",
        wan: "203.0.113.40",
      },
    ],
    isp: [
      {
        id: "isp-loc-2-jio",
        provider: "Jio",
        linkType: "fiber",
        connectionMode: "pppoe",
        role: "primary",
        inUse: true,
        downloadMbps: 300,
        uploadMbps: 100,
        health: "healthy",
        latencyMs: 9.8,
        lossPercent: 0,
        currentDownloadMbps: 64.3,
        currentUploadMbps: 11.9,
        checkedMinutesAgo: 0,
        interface: "ether1",
        gateway: "203.0.113.33",
      },
    ],
    hardware: [],
    guests: { arrivalsPeakPerHour: 30, avgSessionMinutes: 90, returningShare: 0.38 },
    failedLoginsToday: 4,
    uptimePercent: 99.99,
  },
  {
    id: "loc-3",
    name: "Bangalore DC",
    city: "Bangalore",
    propertyType: "coworking_space",
    routers: [
      {
        id: "r-3a",
        name: "Ground floor router",
        model: "RB5009UG+S+",
        serial: "DEMO-BLR-GF",
        mac: "02:00:5E:00:00:31",
        status: "online",
        lastSeenMinutesAgo: 1,
        lan: "10.5.90.1",
        wan: "203.0.113.50",
      },
      {
        id: "r-3b",
        name: "First floor router",
        model: "hAP ax lite",
        serial: "DEMO-BLR-1F",
        mac: "02:00:5E:00:00:32",
        status: "online",
        lastSeenMinutesAgo: 55,
        lan: "10.5.90.2",
        wan: "203.0.113.50",
      },
    ],
    isp: [
      {
        id: "isp-loc-3-jio",
        provider: "Jio",
        linkType: "fiber",
        connectionMode: "static",
        role: "primary",
        inUse: true,
        downloadMbps: 300,
        uploadMbps: 150,
        health: "healthy",
        latencyMs: 11.2,
        lossPercent: 0,
        currentDownloadMbps: 71.5,
        currentUploadMbps: 18.2,
        checkedMinutesAgo: 0,
        interface: "ether1",
        gateway: "203.0.113.49",
      },
      {
        id: "isp-loc-3-airtel",
        provider: "Airtel",
        linkType: "wireless_4g",
        connectionMode: "dhcp",
        role: "backup",
        inUse: false,
        downloadMbps: 100,
        uploadMbps: 40,
        health: "healthy",
        latencyMs: 41.7,
        lossPercent: 0,
        currentDownloadMbps: null,
        currentUploadMbps: null,
        checkedMinutesAgo: 0,
        interface: "lte1",
        gateway: "203.0.113.57",
      },
    ],
    hardware: [
      {
        name: "Ground floor AP",
        mac: "B0:19:21:75:11:02",
        type: "Access Point",
        floor: "GF",
        state: "up",
      },
      {
        name: "First floor AP",
        mac: "B0:19:21:75:11:3C",
        type: "Access Point",
        floor: "1F",
        state: "down",
      },
    ],
    guests: { arrivalsPeakPerHour: 22, avgSessionMinutes: 120, returningShare: 0.45 },
    failedLoginsToday: 3,
    uptimePercent: 99.9,
  },
  {
    id: "loc-4",
    name: "Chennai Office",
    city: "Chennai",
    propertyType: "cafe",
    routers: [
      {
        id: "r-4",
        name: "Counter router",
        model: "hAP ax²",
        serial: "DEMO-CHN-COUNTER",
        mac: "02:00:5E:00:00:03",
        status: "online",
        lastSeenMinutesAgo: 1,
        lan: "10.5.60.1",
        wan: "203.0.113.20",
      },
    ],
    isp: [
      {
        id: "isp-loc-4-airtel",
        provider: "Airtel",
        linkType: "fiber",
        connectionMode: "dhcp",
        role: "primary",
        inUse: true,
        downloadMbps: 250,
        uploadMbps: 100,
        health: "healthy",
        latencyMs: 13.1,
        lossPercent: 0,
        currentDownloadMbps: 38.4,
        currentUploadMbps: 7.2,
        checkedMinutesAgo: 0,
        interface: "ether1",
        gateway: "203.0.113.17",
      },
    ],
    hardware: [],
    guests: { arrivalsPeakPerHour: 18, avgSessionMinutes: 45, returningShare: 0.3 },
    failedLoginsToday: 2,
    uptimePercent: 99.95,
  },
  {
    id: "loc-5",
    name: "Hyderabad DC",
    city: "Hyderabad",
    propertyType: "hotel",
    routers: [
      {
        id: "r-5",
        name: "Reception router",
        model: "hAP ax²",
        serial: "DEMO-HYD-RECEP",
        mac: "02:00:5E:00:00:51",
        status: "online",
        lastSeenMinutesAgo: 190,
        lan: "10.5.100.1",
        wan: "203.0.113.60",
      },
    ],
    isp: [
      {
        id: "isp-loc-5-airtel",
        provider: "Airtel",
        linkType: "fiber",
        connectionMode: "static",
        role: "primary",
        inUse: true,
        downloadMbps: 200,
        uploadMbps: 100,
        health: "unhealthy",
        latencyMs: null,
        lossPercent: 100,
        currentDownloadMbps: null,
        currentUploadMbps: null,
        checkedMinutesAgo: 190,
        interface: "ether1",
        gateway: "203.0.113.59",
      },
    ],
    hardware: [],
    guests: { arrivalsPeakPerHour: 16, avgSessionMinutes: 150, returningShare: 0.4 },
    failedLoginsToday: 0,
    uptimePercent: 98.6,
  },
  {
    id: "loc-6",
    name: "Kolkata Office",
    city: "Kolkata",
    propertyType: null,
    routers: [
      {
        id: "r-6",
        name: "Lobby router",
        model: "hAP ax lite",
        serial: "DEMO-KOL-LOBBY",
        mac: "02:00:5E:00:00:61",
        // The real 2026-08-23 shape: enrolled (so a check-in time exists,
        // from the provisioning-token exchange) but never once heartbeated.
        status: "provisioning",
        lastSeenMinutesAgo: 185,
        lan: "10.5.110.1",
        wan: "203.0.113.70",
      },
    ],
    isp: [],
    hardware: [],
    guests: { arrivalsPeakPerHour: 0, avgSessionMinutes: 0, returningShare: 0 },
    failedLoginsToday: 0,
    uptimePercent: null,
  },
  {
    id: "loc-7",
    name: "Pune Office",
    city: "Pune",
    propertyType: "restaurant",
    routers: [
      {
        id: "r-7",
        name: "Bar router",
        model: "hAP ax²",
        serial: "DEMO-PUN-BAR",
        mac: "02:00:5E:00:00:71",
        status: "online",
        lastSeenMinutesAgo: 0,
        lan: "10.5.120.1",
        wan: "203.0.113.80",
      },
    ],
    isp: [
      {
        id: "isp-loc-7-jio",
        provider: "Jio",
        linkType: "fiber",
        connectionMode: "pppoe",
        role: "primary",
        inUse: true,
        downloadMbps: 350,
        uploadMbps: 100,
        health: "healthy",
        latencyMs: 10.6,
        lossPercent: 0,
        currentDownloadMbps: 52.9,
        currentUploadMbps: 9.4,
        checkedMinutesAgo: 0,
        interface: "ether1",
        gateway: "203.0.113.77",
      },
    ],
    hardware: [],
    guests: { arrivalsPeakPerHour: 24, avgSessionMinutes: 70, returningShare: 0.32 },
    failedLoginsToday: 5,
    uptimePercent: 99.98,
  },
  {
    id: "loc-8",
    name: "Ahmedabad DC",
    city: "Ahmedabad",
    propertyType: "hospital",
    // Created, never had hardware added.
    routers: [],
    isp: [],
    hardware: [],
    guests: { arrivalsPeakPerHour: 0, avgSessionMinutes: 0, returningShare: 0 },
    failedLoginsToday: 0,
    uptimePercent: null,
  },
];

export const DEMO_VENUE_NAMES: readonly string[] = DEMO_VENUES.map((v) => v.name);

/** The venue for an id. Unknown ids get `undefined`: a caller asking about
 * a venue this demo does not have must not be handed another venue's data. */
export function demoVenue(locationId: string | null | undefined): DemoVenue | undefined {
  return DEMO_VENUES.find((v) => v.id === locationId);
}

/** Every demo router, with the venue it sits in. */
export function demoAllRouters(): { venue: DemoVenue; router: DemoWorldRouter }[] {
  return DEMO_VENUES.flatMap((venue) => venue.routers.map((router) => ({ venue, router })));
}

/* ── Clock ───────────────────────────────────────────────────────────── */

/** "Now", rounded to the minute, so every screen read in the same minute
 * counts the same roster. */
export function demoNow(at: number = Date.now()): number {
  return Math.floor(at / 60_000) * 60_000;
}

const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** A router counts as checking in when heard from inside this many minutes
 * -- the same threshold `location-liveness.ts` uses. */
const SILENT_AFTER_MINUTES = 15;

export function demoRouterIsLive(r: DemoWorldRouter): boolean {
  return r.status === "online" && r.lastSeenMinutesAgo < SILENT_AFTER_MINUTES;
}

/* ── Routers, lines, hardware in the app's own shapes ────────────────── */

/** Raw `/locations/{id}/routers` rows, fed through the real liveness
 * derivation by the caller. */
export function demoRawRouters(venue: DemoVenue, now: number = demoNow()): RawRouterLiveness[] {
  return venue.routers.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    last_seen_at: iso(now - r.lastSeenMinutesAgo * MIN),
  }));
}

export function demoRouterDevices(
  locationId: string | null | undefined,
  now: number = demoNow(),
): RouterDevice[] {
  const venue = demoVenue(locationId);
  if (!venue) return [];
  return venue.routers.map((r) => toRouterDevice(venue, r, now));
}

export function toRouterDevice(venue: DemoVenue, r: DemoWorldRouter, now: number): RouterDevice {
  const seen = iso(now - r.lastSeenMinutesAgo * MIN);
  return {
    id: r.id,
    locationId: venue.id,
    locationName: venue.name,
    organizationId: DEMO_ORG.id,
    organizationName: DEMO_ORG.name,
    name: r.name,
    serialNumber: r.serial,
    macAddress: r.mac,
    model: r.model,
    vendor: "MikroTik",
    routerOsVersion: "7.19.4",
    managementIpAddress: r.lan,
    publicIpAddress: r.wan,
    status: r.status,
    lastSeenAt: seen,
    lastHealthCheckAt: seen,
    healthStatus: demoRouterIsLive(r) ? "healthy" : null,
    hasApiCredentials: true,
    controllerState: null,
    controllerStateReason: null,
    controllerLastContactedAt: null,
    lastRadiusAt: null,
    vendorClaimIsContradicted: false,
    settings: {},
    createdAt: iso(now - 90 * DAY),
    updatedAt: seen,
  };
}

/** A venue's internet lines as `/isp/links` rows. In-use line first. */
export function demoIspLinks(
  locationId: string | null | undefined,
  now: number = demoNow(),
): IspLink[] {
  const venue = demoVenue(locationId);
  if (!venue || venue.routers.length === 0) return [];
  const edge = venue.routers[0];
  return [...venue.isp]
    .sort((a, b) => Number(b.inUse) - Number(a.inUse))
    .map((l, i) => ({
      id: l.id,
      routerId: edge.id,
      organizationId: DEMO_ORG.id,
      locationId: venue.id,
      providerName: l.provider,
      linkType: l.linkType,
      connectionMode: l.connectionMode,
      role: l.role,
      isActiveUplink: l.inUse,
      autoFailback: true,
      isEnabled: true,
      priority: i,
      interface: l.interface,
      gatewayIpAddress: l.gateway,
      dnsPrimary: "1.1.1.1",
      dnsSecondary: "8.8.8.8",
      downloadBandwidthMbps: l.downloadMbps,
      uploadBandwidthMbps: l.uploadMbps,
      healthStatus: l.health,
      healthStatusSource: "automated",
      unhealthySince: l.health === "unhealthy" ? iso(now - l.checkedMinutesAgo * MIN) : null,
      latencyMs: l.latencyMs,
      packetLossPercentage: l.lossPercent,
      currentDownloadMbps: l.currentDownloadMbps,
      currentUploadMbps: l.currentUploadMbps,
      lastCheckedAt: iso(now - l.checkedMinutesAgo * MIN),
      consecutiveUnhealthyCount: l.health === "unhealthy" ? 12 : 0,
      createdAt: iso(now - 60 * DAY),
    }));
}

/** The line a venue's traffic is on, by link id (any venue). */
export function demoIspLine(linkId: string): DemoWorldIspLine | undefined {
  for (const v of DEMO_VENUES) {
    const l = v.isp.find((x) => x.id === linkId);
    if (l) return l;
  }
  return undefined;
}

/** "Airtel" / "No ISP link" -- the same labels the real dashboard uses. */
export function demoIspLabel(venue: DemoVenue): string {
  const inUse = venue.isp.find((l) => l.inUse) ?? venue.isp[0];
  return inUse ? inUse.provider : "No ISP link";
}

export function demoHardwareState(mac: string): DemoWorldHardware["state"] | undefined {
  const m = mac.toUpperCase();
  for (const v of DEMO_VENUES) {
    const h = v.hardware.find((x) => x.mac.toUpperCase() === m);
    if (h) return h.state;
  }
  return undefined;
}

/* ── Alerts (derived) ────────────────────────────────────────────────── */

export interface DemoWorldAlert {
  id: string;
  venueId: string;
  venueName: string;
  severity: "critical" | "warning";
  /** Plain words for a venue owner. */
  title: string;
  /** What raised it: a router / line / device name. */
  source: string;
  minutesAgo: number;
}

/** Every open problem at a venue, one alert per fact. Most severe first. */
export function demoVenueAlerts(venue: DemoVenue): DemoWorldAlert[] {
  const out: DemoWorldAlert[] = [];
  const add = (a: Omit<DemoWorldAlert, "id" | "venueId" | "venueName">) =>
    out.push({
      ...a,
      id: `alert-${venue.id}-${out.length + 1}`,
      venueId: venue.id,
      venueName: venue.name,
    });
  for (const r of venue.routers) {
    if (r.status === "provisioning") {
      add({
        severity: "warning",
        title: `${r.name} was set up but has not come online yet`,
        source: r.name,
        minutesAgo: r.lastSeenMinutesAgo,
      });
    } else if (!demoRouterIsLive(r)) {
      add({
        severity: "critical",
        title: `${r.name} has stopped checking in`,
        source: r.name,
        minutesAgo: r.lastSeenMinutesAgo - SILENT_AFTER_MINUTES,
      });
    }
  }
  for (const l of venue.isp) {
    if (l.health === "unhealthy") {
      add({
        severity: "critical",
        title: `${l.provider} internet line is down`,
        source: l.provider,
        minutesAgo: l.checkedMinutesAgo,
      });
    } else if (l.health === "degraded") {
      add({
        severity: "warning",
        title: `${l.provider} ${l.role === "backup" ? "backup " : ""}line is slow and dropping some traffic`,
        source: l.provider,
        minutesAgo: 18,
      });
    }
  }
  for (const h of venue.hardware) {
    if (h.state === "down") {
      add({
        severity: "warning",
        title: `${h.name} is not responding`,
        source: h.name,
        minutesAgo: 52,
      });
    } else if (h.state === "unstable") {
      add({
        severity: "warning",
        title: `${h.name} lost its cable connection 3 times today`,
        source: h.name,
        minutesAgo: 96,
      });
    }
  }
  return out.sort(
    (a, b) =>
      (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1) ||
      a.minutesAgo - b.minutesAgo,
  );
}

export function demoAllAlerts(): DemoWorldAlert[] {
  return DEMO_VENUES.flatMap(demoVenueAlerts).sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/* ── Guests: one roster per venue ────────────────────────────────────── */

/** How busy a venue is at hour `h` (0-23): ~0.08 overnight to ~1 at the
 * evening peak, with a lunch bump and a morning ramp. */
export const demoHourShape = (h: number) =>
  0.08 +
  0.55 * Math.exp(-((h - 13) ** 2) / 8) +
  0.92 * Math.exp(-((h - 19.5) ** 2) / 6) +
  0.25 * Math.exp(-((h - 9) ** 2) / 4);

/** Sunday..Saturday (Date#getDay order): busier weekends. */
const DAY_SHAPE = [0.95, 0.7, 0.72, 0.75, 0.8, 0.92, 1];

/** Deterministic 0..1 from an integer key. */
function jitter(n: number): number {
  return (((Math.sin(n * 12.9898 + 78.233) * 43758.5453) % 1) + 1) % 1;
}

export const DEMO_HISTORY_DAYS = 90;
/** No demo session lasts longer than this, so "open at T" only has to look
 * back this far. */
const MAX_SESSION_MINUTES = 240;

export type DemoAuthMethod = "otp_sms" | "otp_whatsapp" | "voucher" | "mac_whitelist";
const METHODS: DemoAuthMethod[] = ["otp_sms", "otp_whatsapp", "voucher", "mac_whitelist"];

export interface DemoRoster {
  venueId: string;
  now: number;
  /** Session start, ms, ascending. */
  start: Float64Array;
  /** Session length, minutes. */
  minutes: Uint16Array;
  /** Guest index (0..guestCount-1). Same guest = same person. */
  guest: Int32Array;
  /** Index into METHODS. A guest always signs in the same way. */
  method: Uint8Array;
  /** First session start per guest, ms. */
  firstSeen: Float64Array;
  guestCount: number;
}

const rosterCache = new Map<string, DemoRoster>();

/** A venue's deterministic session history up to `now`. Sessions stop when
 * the venue's last router went quiet: a router that does not check in does
 * not report sessions either. Venues with no live history have none. */
export function demoRoster(locationId: string, now: number = demoNow()): DemoRoster {
  const key = `${locationId}@${now}`;
  const hit = rosterCache.get(key);
  if (hit) return hit;
  if (rosterCache.size > 32) rosterCache.clear();

  const venue = demoVenue(locationId);
  const starts: number[] = [];
  const mins: number[] = [];
  const guests: number[] = [];
  let guestCount = 0;
  const live = venue?.routers.filter((r) => r.status === "online") ?? [];
  if (venue && venue.guests.arrivalsPeakPerHour > 0 && live.length > 0) {
    // Last time any router heard a guest. When every router has gone
    // quiet, the sessions it was carrying end there too: nothing reports a
    // guest as online through a router we cannot hear.
    const quietFor = Math.min(...live.map((r) => r.lastSeenMinutesAgo));
    const cutoff = now - quietFor * MIN;
    const allQuiet = quietFor >= SILENT_AFTER_MINUTES;
    const seed = Array.from(venue.id).reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973;
    const first = Math.floor((now - DEMO_HISTORY_DAYS * DAY) / HOUR) * HOUR;
    const { arrivalsPeakPerHour, avgSessionMinutes, returningShare } = venue.guests;
    for (let t = first, b = 0; t < cutoff; t += HOUR, b++) {
      const at = new Date(t);
      const shape = demoHourShape(at.getHours()) * DAY_SHAPE[at.getDay()];
      const k = seed * 100_003 + b;
      const n = Math.round(arrivalsPeakPerHour * shape * (0.85 + 0.3 * jitter(k)));
      for (let i = 0; i < n; i++) {
        const s = t + Math.floor(((i + jitter(k * 7 + i)) / n) * HOUR);
        if (s >= cutoff) break;
        const j = k * 131 + i;
        starts.push(s);
        // 40%..160% of the venue's average length, capped.
        const length = Math.min(
          MAX_SESSION_MINUTES,
          Math.max(5, Math.round(avgSessionMinutes * (0.4 + 1.2 * jitter(j + 3)))),
        );
        mins.push(
          allQuiet ? Math.max(1, Math.min(length, Math.floor((cutoff - s) / MIN))) : length,
        );
        if (guestCount > 0 && jitter(j + 5) < returningShare) {
          // A recent-ish guest coming back.
          const pool = Math.min(guestCount, 1500);
          guests.push(guestCount - 1 - Math.floor(jitter(j + 9) * pool));
        } else {
          guests.push(guestCount++);
        }
      }
    }
  }
  const n = starts.length;
  const roster: DemoRoster = {
    venueId: locationId,
    now,
    start: Float64Array.from(starts),
    minutes: Uint16Array.from(mins),
    guest: Int32Array.from(guests),
    method: new Uint8Array(n),
    firstSeen: new Float64Array(guestCount),
    guestCount,
  };
  roster.firstSeen.fill(Number.POSITIVE_INFINITY);
  for (let i = 0; i < n; i++) {
    const g = roster.guest[i];
    if (roster.start[i] < roster.firstSeen[g]) roster.firstSeen[g] = roster.start[i];
    roster.method[i] = guestMethodIndex(g);
  }
  rosterCache.set(key, roster);
  return roster;
}

/** 50% SMS, 22% WhatsApp, 16% voucher, 12% remembered device. */
function guestMethodIndex(g: number): number {
  const r = jitter(g * 17 + 3);
  return r < 0.5 ? 0 : r < 0.72 ? 1 : r < 0.88 ? 2 : 3;
}

export function demoMethodOf(roster: DemoRoster, i: number): DemoAuthMethod {
  return METHODS[roster.method[i]];
}

/** First index with start >= t. */
function lowerBound(a: Float64Array, t: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Session indexes that started in [from, to). */
export function demoSessionsIn(roster: DemoRoster, from: number, to: number): [number, number] {
  return [lowerBound(roster.start, from), lowerBound(roster.start, to)];
}

/** Session indexes open at instant `t` (started, not yet ended). */
export function demoOpenAt(roster: DemoRoster, t: number): number[] {
  const [a, b] = demoSessionsIn(roster, t - MAX_SESSION_MINUTES * MIN, t + 1);
  const out: number[] = [];
  for (let i = a; i < b; i++) if (roster.start[i] + roster.minutes[i] * MIN > t) out.push(i);
  return out;
}

function distinct(roster: DemoRoster, idx: Iterable<number>): number {
  const seen = new Set<number>();
  for (const i of idx) seen.add(roster.guest[i]);
  return seen.size;
}

function range(a: number, b: number): number[] {
  return Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);
}

/** Distinct guests and sessions that started in [from, to). */
export function demoGuestCounts(
  locationId: string,
  from: number,
  to: number,
  now: number = demoNow(),
): { guests: number; sessions: number; avgSessionMinutes: number | null } {
  const roster = demoRoster(locationId, now);
  const [a, b] = demoSessionsIn(roster, from, to);
  let total = 0;
  for (let i = a; i < b; i++) total += roster.minutes[i];
  return {
    guests: distinct(roster, range(a, b)),
    sessions: b - a,
    avgSessionMinutes: b > a ? Math.round(total / (b - a)) : null,
  };
}

/** Distinct guests online right now. */
export function demoOnlineNow(locationId: string, now: number = demoNow()): number {
  const roster = demoRoster(locationId, now);
  return distinct(roster, demoOpenAt(roster, now));
}

/** Highest number of distinct guests online at once in [from, to), sampled
 * every 15 minutes and at `to` itself (so it is never below "online now"). */
export function demoPeakOnline(
  locationId: string,
  from: number,
  to: number,
  now: number = demoNow(),
): number {
  const roster = demoRoster(locationId, now);
  let peak = 0;
  const step = 15 * MIN;
  for (let t = Math.ceil(from / step) * step; t < to; t += step) {
    peak = Math.max(peak, distinct(roster, demoOpenAt(roster, t)));
  }
  if (to >= now) peak = Math.max(peak, distinct(roster, demoOpenAt(roster, Math.min(to, now))));
  return peak;
}

/* ── Guest identities ────────────────────────────────────────────────── */

const FIRST = [
  "Aarav",
  "Priya",
  "Rohan",
  "Ananya",
  "Vikram",
  "Neha",
  "Kabir",
  "Isha",
  "Arjun",
  "Meera",
  "Siddharth",
  "Kavya",
  "Rahul",
  "Sneha",
  "Aditya",
  "Pooja",
  "Karan",
  "Divya",
  "Nikhil",
  "Riya",
  "John",
  "Sarah",
  "Alex",
  "Emily",
];
const LAST = [
  "Sharma",
  "Iyer",
  "Kapoor",
  "Reddy",
  "Nair",
  "Mehta",
  "Gupta",
  "Singh",
  "Rao",
  "Das",
  "Joshi",
  "Menon",
  "Patel",
  "Bose",
  "Khan",
  "Pillai",
];
const MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];
const DEVICES = [
  "iPhone 15",
  "Samsung S24",
  "MacBook Pro",
  "Pixel 8",
  "iPad Air",
  "Windows Laptop",
  "OnePlus 12",
  "Redmi Note 13",
];

export interface DemoGuestIdentity {
  name: string;
  email: string;
  phone: string;
  device: string;
  mac: string;
}

/** Stable identity for a guest index at a venue: same guest, same person
 * on every screen. */
export function demoGuestIdentity(locationId: string, g: number): DemoGuestIdentity {
  const v = Array.from(locationId).reduce((a, c) => a + c.charCodeAt(0), 0);
  const k = g * 7 + v;
  const first = FIRST[k % FIRST.length];
  const last = LAST[(g * 5 + Math.floor(g / FIRST.length) + v) % LAST.length];
  const num = 90000 + ((g * 7919 + v * 31) % 9999);
  const tail = String((g * 104729 + v) % 100000).padStart(5, "0");
  const hex = (n: number) => (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  return {
    name: `${first} ${last}`,
    email: `${first}.${last}${(g % 97) + 1}@${MAIL[g % MAIL.length]}`.toLowerCase(),
    phone: `+91 ${num} ${tail}`,
    device: DEVICES[(g + v) % DEVICES.length],
    mac: `02:1A:${hex(v)}:${hex(g >> 16)}:${hex(g >> 8)}:${hex(g)}`,
  };
}

/** The Guests page's rows: one per session, newest first. */
export interface DemoGuestRow {
  index: number;
  guest: number;
  identity: DemoGuestIdentity;
  startedAt: number;
  endedAt: number | null;
  minutes: number;
  online: boolean;
  method: DemoAuthMethod;
}

export function demoGuestRows(locationId: string, now: number = demoNow()): DemoGuestRow[] {
  const roster = demoRoster(locationId, now);
  const open = new Set(demoOpenAt(roster, now));
  const rows: DemoGuestRow[] = [];
  for (let i = roster.start.length - 1; i >= 0; i--) {
    const online = open.has(i);
    rows.push({
      index: i,
      guest: roster.guest[i],
      identity: demoGuestIdentity(locationId, roster.guest[i]),
      startedAt: roster.start[i],
      endedAt: online ? null : roster.start[i] + roster.minutes[i] * MIN,
      minutes: roster.minutes[i],
      online,
      method: demoMethodOf(roster, i),
    });
  }
  return rows;
}
