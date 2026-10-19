import type { NetLogEvent, NetLogPage, NetLogSummary, NetLogTopRouter } from "@/types/netlogs";
import type { IpdrItem, IpdrPage } from "@/types/ipdr";

/**
 * Demo-workspace fixtures for NetLogs (log lines + summary) and its
 * "Connections (IPDR)" tab. Served by `netlogs.service.ts` /
 * `ipdr.service.ts` when `isDemo()` -- the demo host never calls the backend.
 *
 * Everything is fake and deterministic: a seeded generator, not
 * `Math.random`, so the same rows come back on every render and every page
 * of "Load more". Times are offsets from one anchor taken on first use, so
 * the newest row is always "a few minutes ago" without the set shifting
 * while someone pages through it.
 *
 * Address plan (documentation and private ranges only):
 *   - guests: 10.5.50.x (Mumbai HQ), 10.5.60.x (Rooftop Café);
 *   - the routers' public addresses: 203.0.113.10 / 203.0.113.20;
 *   - outside destinations: 198.51.100.x, 203.0.113.5x, public DNS;
 *   - MACs in 02:00:5E:xx:xx:xx; phones 98000001xx.
 * No tunnel address or tunnel detail appears anywhere here, as on the real
 * customer surface.
 *
 * Pure (types only), so the script tests can bundle it on its own.
 */

// ---------------------------------------------------------------------------
// Shared fake venue
// ---------------------------------------------------------------------------

export const DEMO_HQ_LOCATION_ID = "loc-1";
export const DEMO_CAFE_LOCATION_ID = "loc-1-cafe";

export const DEMO_NETLOGS_LOCATIONS: readonly { id: string; name: string }[] = [
  { id: DEMO_HQ_LOCATION_ID, name: "Mumbai HQ" },
  { id: DEMO_CAFE_LOCATION_ID, name: "Mumbai HQ – Rooftop Café" },
];

export interface DemoNetLogRouter {
  id: string;
  name: string;
  hostname: string;
  locationId: string;
  /** The router's public (WAN) address: the IPDR "Translated IP". */
  publicIp: string;
  /** The guest pool's first three octets. */
  subnet: string;
  /** First host number this router hands out. */
  firstHost: number;
}

export const DEMO_NETLOGS_ROUTERS: readonly DemoNetLogRouter[] = [
  {
    id: "r-1",
    name: "Lobby router",
    hostname: "MUM-HQ-LOBBY",
    locationId: DEMO_HQ_LOCATION_ID,
    publicIp: "203.0.113.10",
    subnet: "10.5.50",
    firstHost: 20,
  },
  {
    id: "r-1-floor2",
    name: "Floor 2 router",
    hostname: "MUM-HQ-FL2",
    locationId: DEMO_HQ_LOCATION_ID,
    publicIp: "203.0.113.10",
    subnet: "10.5.50",
    firstHost: 120,
  },
  {
    id: "r-1-cafe",
    name: "Rooftop Café router",
    hostname: "MUM-CAFE-ROOF",
    locationId: DEMO_CAFE_LOCATION_ID,
    publicIp: "203.0.113.20",
    subnet: "10.5.60",
    firstHost: 20,
  },
];

/** Routers for a location, in the shape the NetLogs router picker reads. */
export function demoNetLogsRoutersFor(locationId: string | null): { id: string; name: string }[] {
  return DEMO_NETLOGS_ROUTERS.filter((r) => !locationId || r.locationId === locationId).map(
    (r) => ({ id: r.id, name: r.name }),
  );
}

export interface DemoGuest {
  name: string;
  phone: string;
  email: string;
  mac: string;
  /** Index into DEMO_NETLOGS_ROUTERS. */
  router: number;
  ip: string;
}

const GUEST_NAMES = [
  "Aarav S.",
  "Priya M.",
  "Rohan K.",
  "Ananya P.",
  "Vikram R.",
  "Neha G.",
  "Kabir J.",
  "Isha T.",
  "Arjun D.",
  "Meera N.",
  "Siddharth B.",
  "Kavya L.",
  "Dev C.",
  "Riya A.",
];

/** One identity per guest, reused by NetLogs, IPDR and Traffic Lens so the
 * same device carries the same address everywhere in the demo. */
export const DEMO_GUESTS: readonly DemoGuest[] = GUEST_NAMES.map((name, i) => {
  const router = i % 5 === 4 ? 2 : i % 2; // every fifth guest is at the café
  const r = DEMO_NETLOGS_ROUTERS[router];
  const local = name
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/\s+/g, ".");
  return {
    name,
    phone: `98000001${String(i + 11).padStart(2, "0")}`,
    email: `${local}@example.com`,
    mac: `02:00:5E:10:${hex(i + 1)}:${hex(0x30 + i * 7)}`,
    router,
    ip: `${r.subnet}.${r.firstHost + i}`,
  };
});

/** Venue equipment: never a guest. */
const DEMO_DEVICES = [
  { kind: "router", router: 0, ip: "10.5.50.1", mac: "02:00:5E:00:00:01" },
  { kind: "monitored_hardware", router: 0, ip: "10.5.50.5", mac: "02:00:5E:00:AA:05" },
  { kind: "authorized_mac", router: 1, ip: "10.5.50.8", mac: "02:00:5E:00:BB:08" },
  { kind: "monitored_hardware", router: 2, ip: "10.5.60.5", mac: "02:00:5E:00:CC:05" },
] as const;

const DESTINATIONS = [
  "198.51.100.14",
  "198.51.100.27",
  "198.51.100.44",
  "198.51.100.63",
  "198.51.100.88",
  "203.0.113.51",
  "203.0.113.57",
  "203.0.113.62",
] as const;

function hex(n: number): string {
  return (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Deterministic generation
// ---------------------------------------------------------------------------

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** mulberry32: a tiny seeded PRNG. Same seed, same sequence, every load. */
export function demoRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let anchor: number | null = null;

/** "Now" for the fixtures: taken once, on first use, rounded to the minute. */
export function demoAnchor(): number {
  if (anchor === null) anchor = Math.floor(Date.now() / MIN) * MIN - 2 * MIN;
  return anchor;
}

/** Tests only: pin the anchor. */
export function setDemoAnchorForTests(at: number | null): void {
  anchor = at;
  netLogCache = null;
  ipdrCache = null;
}

const SEVERITY_NAMES = [
  "emergency",
  "alert",
  "critical",
  "error",
  "warning",
  "notice",
  "info",
  "debug",
] as const;

/** The backend's headline for category + status (`classifier._SUMMARIES`). */
const SUMMARIES: Record<string, string> = {
  "dhcp/success": "IP assigned",
  "dhcp/released": "IP released",
  "hotspot_auth/success": "Guest signed in",
  "hotspot_auth/disconnected": "Guest signed out",
  "hotspot_auth/failure": "Guest sign-in failed",
  "radius/accept": "RADIUS accepted",
  "radius/reject": "RADIUS rejected",
  "firewall/blocked": "Traffic denied",
  "firewall/allowed": "Traffic allowed",
  "wireless/connected": "Device connected to WiFi",
  "wireless/disconnected": "Device disconnected from WiFi",
};

type Draft = Pick<NetLogEvent, "category" | "status" | "severity" | "message"> &
  Partial<Pick<NetLogEvent, "protocol" | "src_ip" | "dst_ip" | "device_mac" | "source">> & {
    summary?: string | null;
  };

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 4) return "x".repeat(d.length);
  return d.slice(0, 2) + "x".repeat(d.length - 4) + d.slice(-2);
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return "";
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

function pick<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length) % list.length];
}

function port(rnd: () => number): number {
  return 49152 + Math.floor(rnd() * 16000);
}

function draftFor(rnd: () => number, g: DemoGuest, r: DemoNetLogRouter): Draft {
  const roll = rnd();
  const dst = pick(rnd, DESTINATIONS);
  if (roll < 0.17) {
    const released = rnd() < 0.25;
    return {
      category: "dhcp",
      status: released ? "released" : "success",
      severity: 6,
      src_ip: g.ip,
      device_mac: g.mac,
      message: `dhcp-guests ${released ? "deassigned" : "assigned"} ${g.ip} for ${g.mac}`,
    };
  }
  if (roll < 0.36) {
    const failed = rnd() < 0.3;
    return {
      category: "hotspot_auth",
      source: "captive_portal",
      status: failed ? "failure" : "success",
      severity: failed ? 4 : 6,
      src_ip: g.ip,
      device_mac: g.mac,
      summary: failed ? "Invalid OTP" : undefined,
      message: failed
        ? `Sign-in failed for ${maskPhone(g.phone)} from ${g.ip}: Invalid OTP`
        : `Guest ${maskPhone(g.phone)} signed in from ${g.ip} (${g.mac}) with OTP`,
    };
  }
  if (roll < 0.5) {
    const rejected = rnd() < 0.2;
    return {
      category: "radius",
      source: "radius_server",
      status: rejected ? "reject" : "accept",
      severity: rejected ? 4 : 6,
      src_ip: g.ip,
      device_mac: g.mac,
      message: rejected
        ? `Access-Reject for ${g.mac} (NAS ${r.hostname}): session limit reached`
        : `Access-Accept for ${g.mac} (NAS ${r.hostname}), session timeout 3600s`,
    };
  }
  if (roll < 0.72) {
    const udp = rnd() < 0.4;
    if (udp) {
      const dns = rnd() < 0.6;
      const to = dns ? pick(rnd, ["8.8.8.8", "1.1.1.1"]) : dst;
      const toPort = dns ? 53 : 1900;
      return {
        category: "firewall",
        status: dns ? "allowed" : "blocked",
        severity: dns ? 6 : 5,
        protocol: "udp",
        src_ip: g.ip,
        dst_ip: to,
        device_mac: g.mac,
        message: `${dns ? "guest-dns accept" : "guest-block drop"} forward: in:bridge-guest out:ether1-wan, src-mac ${g.mac}, proto UDP, ${g.ip}:${port(rnd)}->${to}:${toPort}, len ${dns ? 74 : 132}`,
      };
    }
    const toPort = pick(rnd, [445, 23, 3389, 25]);
    return {
      category: "firewall",
      status: "blocked",
      severity: 4,
      protocol: "tcp",
      src_ip: g.ip,
      dst_ip: dst,
      device_mac: g.mac,
      message: `guest-block drop forward: in:bridge-guest out:ether1-wan, src-mac ${g.mac}, proto TCP (SYN), ${g.ip}:${port(rnd)}->${dst}:${toPort}, len 52`,
    };
  }
  if (roll < 0.9) {
    const gone = rnd() < 0.45;
    const signal = -48 - Math.floor(rnd() * 30);
    return {
      category: "wireless",
      status: gone ? "disconnected" : "connected",
      severity: 6,
      device_mac: g.mac,
      message: gone
        ? `${g.mac}@wlan1-guest: disconnected, received disassoc: sending station leaving (8)`
        : `${g.mac}@wlan1-guest: connected, signal strength ${signal}`,
    };
  }
  const sys = Math.floor(rnd() * 5);
  switch (sys) {
    case 0:
      return {
        category: "system",
        status: null,
        severity: 3,
        summary: "WAN link down",
        message: "ether1-wan link down",
      };
    case 1:
      return {
        category: "system",
        status: null,
        severity: 5,
        summary: "WAN link up",
        message: "ether1-wan link up (speed 1G, full duplex)",
      };
    case 2:
      return {
        category: "system",
        status: null,
        severity: 4,
        summary: "High CPU load",
        message: `system,warning CPU load ${86 + Math.floor(rnd() * 10)}% for 5 minutes`,
      };
    case 3:
      return {
        category: "system",
        status: null,
        severity: 3,
        summary: "DHCP pool nearly full",
        message: "dhcp-guests: pool guest-pool 95% used (242 of 254)",
      };
    default:
      return {
        category: "system",
        status: null,
        severity: 6,
        summary: "Clock synced",
        message: "ntp: clock synchronized to 203.0.113.123, offset 3ms",
      };
  }
}

let netLogCache: { at: number; rows: NetLogEvent[] } | null = null;

/** Every demo log line, newest first: ~60 in the last 24 hours and ~130
 * over the six days before, across 2 locations and 3 routers. */
export function demoNetLogEvents(): NetLogEvent[] {
  const at = demoAnchor();
  if (netLogCache?.at === at) return netLogCache.rows;
  const rnd = demoRandom(20261019);
  const offsets: number[] = [];
  for (let i = 0; i < 60; i += 1) offsets.push(Math.floor(rnd() * (DAY - 5 * MIN)) + MIN);
  for (let i = 0; i < 130; i += 1) offsets.push(DAY + Math.floor(rnd() * (6 * DAY - HOUR)));
  offsets.sort((a, b) => a - b);
  const rows = offsets.map((offset, i): NetLogEvent => {
    const g = pick(rnd, DEMO_GUESTS);
    const r = DEMO_NETLOGS_ROUTERS[g.router];
    const loc = DEMO_NETLOGS_LOCATIONS.find((l) => l.id === r.locationId)!;
    const d = draftFor(rnd, g, r);
    const source = d.source ?? "syslog";
    const received = at - offset;
    return {
      id: 905000 - i,
      received_at: new Date(received).toISOString(),
      device_time: source === "syslog" ? new Date(received - 1000).toISOString() : null,
      location_id: loc.id,
      location_name: loc.name,
      router_id: r.id,
      router_name: r.name,
      hostname: r.hostname,
      source,
      category: d.category,
      protocol: d.protocol ?? null,
      src_ip: d.src_ip ?? null,
      dst_ip: d.dst_ip ?? null,
      status: d.status,
      device_mac: d.device_mac ?? null,
      severity: d.severity,
      severity_name: d.severity === null ? null : SEVERITY_NAMES[d.severity],
      summary:
        d.summary !== undefined
          ? d.summary
          : (SUMMARIES[`${d.category}/${d.status ?? ""}`] ?? null),
      message: d.message,
    };
  });
  netLogCache = { at, rows };
  return rows;
}

// ---------------------------------------------------------------------------
// NetLogs: the backend's filters, applied client-side
// ---------------------------------------------------------------------------

function csvList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function instant(value: string | undefined, fallback: number): number {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : fallback;
}

/** The rows `params` selects (since/until, location, router, severity,
 * category, status, q), newest first. */
export function demoNetLogsFiltered(params: Record<string, string>): NetLogEvent[] {
  const until = instant(params.until, Number.POSITIVE_INFINITY);
  const since = instant(params.since, Number.NEGATIVE_INFINITY);
  const sev = csvList(params.severity);
  const cat = csvList(params.category);
  const st = csvList(params.status);
  const q = (params.q ?? "").trim().toLowerCase();
  return demoNetLogEvents().filter((e) => {
    const t = Date.parse(e.received_at);
    if (t < since || t >= until) return false;
    if (params.location_id && e.location_id !== params.location_id) return false;
    if (params.router_id && e.router_id !== params.router_id) return false;
    if (sev.length && !sev.includes(e.severity_name ?? "")) return false;
    if (cat.length && !cat.includes(e.category)) return false;
    if (st.length && !st.includes((e.status ?? "").toLowerCase())) return false;
    if (q) {
      const hay = [
        e.message,
        e.summary,
        e.src_ip,
        e.dst_ip,
        e.device_mac,
        e.hostname,
        e.router_name,
        e.location_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function windowOf(params: Record<string, string>): { since: string; until: string } {
  const at = Date.now();
  return {
    since: params.since ?? new Date(at - DAY).toISOString(),
    until: params.until ?? new Date(at).toISOString(),
  };
}

/** One page, `limit` rows from the offset in `cursor`. */
function pageOf<T>(rows: T[], params: Record<string, string>, fallbackLimit: number) {
  const limit = Math.max(1, Number(params.limit) || fallbackLimit);
  const offset = Math.max(0, Number(params.cursor) || 0);
  const items = rows.slice(offset, offset + limit);
  const next = offset + limit < rows.length ? String(offset + limit) : null;
  return { items, next };
}

export function demoNetLogsPage(params: Record<string, string>): NetLogPage {
  const { items, next } = pageOf(demoNetLogsFiltered(params), params, 100);
  return { feature_enabled: true, items, next_cursor: next, ...windowOf(params) };
}

function localDay(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function demoNetLogsSummary(params: Record<string, string>): NetLogSummary {
  const rows = demoNetLogsFiltered(params);
  const tz = params.tz || "UTC";
  const isError = (e: NetLogEvent) => e.severity !== null && e.severity <= 3;
  const isWarning = (e: NetLogEvent) => e.severity === 4;
  const days = new Map<string, NetLogSummary["by_day"][number]>();
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const routers = new Map<string, NetLogTopRouter>();
  for (const e of rows) {
    const day = localDay(e.received_at, tz);
    const d = days.get(day) ?? { day, total: 0, errors: 0, warnings: 0, by_category: {} };
    d.total += 1;
    if (isError(e)) d.errors += 1;
    if (isWarning(e)) d.warnings += 1;
    d.by_category[e.category] = (d.by_category[e.category] ?? 0) + 1;
    days.set(day, d);
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    const sevKey = e.severity_name ?? "unknown";
    bySeverity[sevKey] = (bySeverity[sevKey] ?? 0) + 1;
    const key = e.router_id ?? "";
    const r = routers.get(key) ?? {
      router_id: e.router_id,
      router_name: e.router_name,
      location_id: e.location_id,
      location_name: e.location_name,
      total: 0,
      errors: 0,
      warnings: 0,
    };
    r.total += 1;
    if (isError(e)) r.errors += 1;
    if (isWarning(e)) r.warnings += 1;
    routers.set(key, r);
  }
  return {
    feature_enabled: true,
    ...windowOf(params),
    timezone: tz,
    totals: {
      events: rows.length,
      errors: rows.filter(isError).length,
      warnings: rows.filter(isWarning).length,
    },
    by_day: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    by_category: byCategory,
    by_severity: bySeverity,
    top_routers: [...routers.values()].sort((a, b) => b.total - a.total),
  };
}

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // The backend's formula-injection guard.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvOf(header: readonly string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** The backend's `CSV_COLUMNS`, from the same filtered rows. */
export const DEMO_NETLOGS_CSV_COLUMNS = [
  "received_at",
  "device_time",
  "location",
  "router",
  "host",
  "category",
  "protocol",
  "src_ip",
  "dst_ip",
  "status",
  "severity",
  "device_mac",
  "summary",
  "message",
] as const;

export function demoNetLogsCsv(params: Record<string, string>): string {
  return csvOf(
    DEMO_NETLOGS_CSV_COLUMNS,
    demoNetLogsFiltered(params).map((e) => [
      e.received_at,
      e.device_time,
      e.location_name,
      e.router_name,
      e.hostname,
      e.category,
      e.protocol,
      e.src_ip,
      e.dst_ip,
      e.status,
      e.severity_name,
      e.device_mac,
      e.summary,
      e.message,
    ]),
  );
}

// ---------------------------------------------------------------------------
// IPDR
// ---------------------------------------------------------------------------

/** `DD-MM-YYYY HH:MM` in IST (UTC+05:30, no DST), as the backend writes it. */
export function istMinute(ms: number): string {
  const d = new Date(ms + 330 * MIN);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** `1d 9h 7m 1s`, leading zero units dropped (backend `online_time`). */
export function onlineTime(seconds: number): string {
  let rest = Math.max(0, Math.floor(seconds));
  const parts: [number, string][] = [];
  for (const [size, unit] of [
    [86_400, "d"],
    [3_600, "h"],
    [60, "m"],
    [1, "s"],
  ] as const) {
    parts.push([Math.floor(rest / size), unit]);
    rest %= size;
  }
  while (parts.length > 1 && parts[0][0] === 0) parts.shift();
  return parts.map(([v, u]) => `${v}${u}`).join(" ");
}

/** A demo IPDR record: the unmasked values the CSV carries, plus the
 * on-screen row built from them. */
interface DemoIpdrRecord {
  item: IpdrItem;
  phone: string;
  email: string;
  userId: string;
}

let ipdrCache: { at: number; rows: DemoIpdrRecord[] } | null = null;

/** ~50 connections over the last 24 hours, newest first: guest rows from
 * their WiFi sessions, a few venue-equipment (`device`) rows and two that
 * no session or device explains (`unknown`). */
export function demoIpdrRecords(): DemoIpdrRecord[] {
  const at = demoAnchor();
  if (ipdrCache?.at === at) return ipdrCache.rows;
  const rnd = demoRandom(4230423);
  const rows: DemoIpdrRecord[] = [];
  const destinations: readonly [string, number, number][] = [
    ["198.51.100.14", 443, 6],
    ["198.51.100.27", 443, 17],
    ["198.51.100.44", 443, 6],
    ["198.51.100.63", 5222, 6],
    ["198.51.100.88", 443, 6],
    ["203.0.113.51", 80, 6],
    ["203.0.113.57", 443, 6],
    ["203.0.113.62", 123, 17],
    ["8.8.8.8", 53, 17],
    ["1.1.1.1", 53, 17],
  ];
  const PROTO: Record<number, string> = { 6: "TCP", 17: "UDP" };

  const push = (
    ts: number,
    who:
      | { kind: "guest"; g: DemoGuest; start: number; end: number }
      | { kind: "device"; d: (typeof DEMO_DEVICES)[number] }
      | { kind: "unknown"; router: number; ip: string },
  ) => {
    const [dstIp, dstPort, proto] = pick(rnd, destinations);
    const routerIdx =
      who.kind === "guest" ? who.g.router : who.kind === "device" ? who.d.router : who.router;
    const r = DEMO_NETLOGS_ROUTERS[routerIdx];
    const srcIp = who.kind === "guest" ? who.g.ip : who.kind === "device" ? who.d.ip : who.ip;
    const merged = rnd() < 0.08;
    const srcPort = merged ? null : port(rnd);
    const roll = rnd();
    const nat = roll < 0.6 ? "nat_event" : roll < 0.88 ? "derived" : "ambiguous";
    const natPort = srcPort === null ? null : nat === "nat_event" ? port(rnd) : srcPort;
    const guest = who.kind === "guest" ? who.g : null;
    const phone = guest?.phone ?? "";
    const email = guest?.email ?? "";
    const userId = guest ? guest.phone : who.kind === "device" ? "device" : "unknown";
    const mac = who.kind === "guest" ? who.g.mac : who.kind === "device" ? who.d.mac : "";
    const allocStart = who.kind === "guest" ? who.start : null;
    const allocEnd = who.kind === "guest" ? who.end : null;
    rows.push({
      phone,
      email,
      userId,
      item: {
        time_stamp_ist: istMinute(ts),
        name: guest?.name ?? "",
        contact_no: maskPhone(phone),
        alternate_contact_no: "",
        email: maskEmail(email),
        user_id: guest ? maskPhone(phone) : userId,
        source_ip: srcIp,
        source_port: srcPort === null ? "" : String(srcPort),
        translated_ip: r.publicIp,
        translated_port: natPort === null ? "" : String(natPort),
        allocation: "Dynamic",
        destination_ip: dstIp,
        destination_port: String(dstPort),
        protocol: PROTO[proto] ?? String(proto),
        allocation_start_ist: allocStart === null ? "" : istMinute(allocStart),
        allocation_end_ist: allocEnd === null ? "" : istMinute(allocEnd),
        total_online_time:
          allocStart === null || allocEnd === null
            ? ""
            : onlineTime((allocEnd - allocStart) / 1000),
        mac,
        ts: new Date(ts).toISOString(),
        location_id: r.locationId,
        router_id: r.id,
        translated_source: nat,
        ts_source: "flow",
        user_known: who.kind === "guest",
        ports_merged: merged,
        user_class: who.kind,
        device_kind: who.kind === "device" ? who.d.kind : null,
        mac_source: who.kind === "guest" ? "session" : who.kind === "device" ? "inventory" : null,
        allocation_source: who.kind === "guest" ? "session" : null,
        nat_event_only: nat === "nat_event" && rnd() < 0.1,
      },
    });
  };

  // Guest sessions: each guest had one session in the last day; 3 rows each.
  DEMO_GUESTS.forEach((g, i) => {
    const length = (40 + Math.floor(rnd() * 200)) * MIN;
    const end = at - ((i * 95 * MIN) % (22 * HOUR)) - Math.floor(rnd() * 20) * MIN;
    const start = end - length;
    const count = i < 2 ? 4 : 3;
    for (let k = 0; k < count; k += 1) {
      push(start + Math.floor(rnd() * length), { kind: "guest", g, start, end });
    }
  });
  DEMO_DEVICES.forEach((d) => {
    for (let k = 0; k < 2; k += 1) push(at - Math.floor(rnd() * 23 * HOUR), { kind: "device", d });
  });
  push(at - 3 * HOUR - 11 * MIN, { kind: "unknown", router: 0, ip: "10.5.50.201" });
  push(at - 9 * HOUR - 42 * MIN, { kind: "unknown", router: 2, ip: "10.5.60.77" });

  rows.sort((a, b) => Date.parse(b.item.ts) - Date.parse(a.item.ts));
  ipdrCache = { at, rows };
  return rows;
}

function normMac(v: string): string {
  return v.replace(/[^0-9a-f]/gi, "").toUpperCase();
}

function ipdrFiltered(params: Record<string, string>): DemoIpdrRecord[] {
  const until = instant(params.until, Number.POSITIVE_INFINITY);
  const since = instant(params.since, Number.NEGATIVE_INFINITY);
  const phone = (params.phone ?? "").replace(/\D/g, "");
  const userId = (params.user_id ?? "").trim().toLowerCase();
  const mac = normMac(params.mac ?? "");
  const ip = (params.ip ?? "").trim();
  return demoIpdrRecords().filter(({ item, phone: full, userId: uid }) => {
    const t = Date.parse(item.ts);
    if (t < since || t >= until) return false;
    if (params.guests_only === "true" && item.user_class !== "guest") return false;
    if (params.location_id && item.location_id !== params.location_id) return false;
    if (params.router_id && item.router_id !== params.router_id) return false;
    if (phone && !full.endsWith(phone.slice(-10))) return false;
    if (userId && uid.toLowerCase() !== userId) return false;
    if (mac && normMac(item.mac) !== mac) return false;
    if (ip && ![item.source_ip, item.translated_ip, item.destination_ip].includes(ip)) return false;
    return true;
  });
}

function istDay(ms: number): string {
  return istMinute(ms).slice(0, 10).split("-").reverse().join("-");
}

export function demoIpdrPage(params: Record<string, string>): IpdrPage {
  const { items, next } = pageOf(
    ipdrFiltered(params).map((r) => r.item),
    params,
    100,
  );
  const { since, until } = windowOf(params);
  // Every IST day the window touches reads as fully held: no gap notice.
  const coverage = [] as IpdrPage["coverage"];
  const first = Date.parse(since);
  const last = Date.parse(until);
  if (!params.cursor && Number.isFinite(first) && Number.isFinite(last)) {
    const seen = new Set<string>();
    for (let t = first; t <= last && seen.size < 800; t += HOUR) seen.add(istDay(t));
    seen.add(istDay(last));
    for (const day of seen)
      coverage.push({
        day,
        archived: 0,
        live: 1,
        records_incomplete: false,
        unreadable: 0,
        status: "live",
      });
  }
  return { since, until, items, next_cursor: next, coverage };
}

/** The 18 CERT-In columns, unmasked (full phone, e-mail, user id). */
export function demoIpdrCsv(params: Record<string, string>, header: readonly string[]): string {
  return csvOf(
    header,
    ipdrFiltered(params).map(({ item, phone, email, userId }) => [
      item.time_stamp_ist,
      item.name,
      phone,
      "",
      email,
      userId,
      item.source_ip,
      item.source_port,
      item.translated_ip,
      item.translated_port,
      item.allocation,
      item.destination_ip,
      item.destination_port,
      item.protocol,
      item.allocation_start_ist,
      item.allocation_end_ist,
      item.total_online_time,
      item.mac,
    ]),
  );
}

/** The NetLogs / IPDR CSV names the backend would use. */
export function demoCsvFilename(kind: "netlogs" | "ipdr"): string {
  const d = new Date(demoAnchor() + 330 * MIN);
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  return kind === "ipdr" ? `ipdr-demo-${stamp}.csv` : `netlogs-demo-${stamp}.csv`;
}
