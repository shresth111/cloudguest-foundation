import type { RouterDevice } from "@/types/router";
import type {
  CreateFirewallRulePayload,
  FirewallBandStatus,
  FirewallPushResult,
  FirewallRule,
  FirewallRuleListQuery,
  FirewallRuleListResult,
  FloodLimitPreset,
  FloodLimitState,
  GuestIsolationPort,
  GuestIsolationState,
  UpdateFirewallRulePayload,
} from "@/types/firewall";
import type {
  ContentFilterApp,
  ContentFilterAppList,
  ContentFilterCategory,
  ContentFilterListQuery,
  ContentFilterListResult,
  ContentFilterRule,
  CreateContentFilterRulePayload,
  UpdateContentFilterRulePayload,
} from "@/types/contentFilter";
import type {
  WebCategory,
  WebCategoryCatalogue,
  WebFilterLocationPolicy,
  WebFilterRouterStatus,
} from "@/types/dns-filtering";
import type { SecurityFeature, SecurityOverview } from "@/types/security";
import type { ConnectedDevice, ConnectedDeviceListResult } from "@/types/connected-device";
import type { DhcpLease } from "@/types/dhcp";
import type {
  CreatePortForwardingPayload,
  PortForwardingListQuery,
  PortForwardingListResult,
  PortForwardingRule,
  UpdatePortForwardingPayload,
} from "@/types/port-forwarding";

/**
 * Demo-workspace fixtures for the Security area: Firewall (rules, flood
 * limit, guest isolation, Apply), Block Websites (specific websites, apps,
 * Cloudflare categories, bypass protection, the Advanced rule list), the
 * Security Score, and Port Forwarding. Served by the services
 * (`firewall.service.ts`, `contentFilter.service.ts`,
 * `dns-filtering.service.ts`, `security.service.ts`,
 * `port-forwarding.service.ts`, and the firewall rule dialog's device picker
 * in `connected-device.service.ts` / `dhcp.service.ts`) when the session is
 * the demo -- the demo host never calls the backend for any of it.
 *
 * Same fake venue as `netlogs-demo.ts` / `traffic-lens-demo.ts`: Mumbai HQ
 * (`loc-1`) with its Lobby and Floor 2 routers, and the Rooftop Café
 * (`loc-1-cafe`). Any other demo venue gets one "Main router" with the same
 * baseline, so no venue in the demo shows an empty Security page.
 *
 * WRITES. The demo behaves like the rest of the demo account (see
 * `useDisconnectSession`'s local patch): a change is applied to this
 * module's in-memory state and the next read returns it, so a toggle stays
 * toggled and an added rule appears in the list. Nothing is saved anywhere;
 * a reload starts from the seed again.
 *
 * Address plan (documentation and private ranges only):
 *   - guest network 10.5.50.0/24 (Mumbai HQ), 10.5.60.0/24 (Rooftop Café);
 *   - staff network 10.5.40.0/24 (printer, CCTV recorder, reception PC);
 *   - the routers' public addresses 203.0.113.10 / 203.0.113.20;
 *   - outside addresses 198.51.100.x / 203.0.113.128/25;
 *   - website names under example.com / .net / .org;
 *   - MACs 02:00:5E:xx:xx:xx.
 * No tunnel address or tunnel detail appears here, as on the real customer
 * surface. No phone numbers and no guest names.
 *
 * Pure (types only), so the script tests can bundle it on its own.
 */

// ---------------------------------------------------------------------------
// The venue's routers
// ---------------------------------------------------------------------------

export const DEMO_FW_HQ_LOCATION_ID = "loc-1";
export const DEMO_FW_CAFE_LOCATION_ID = "loc-1-cafe";

const GUEST_NET_HQ = "10.5.50.0/24";
const GUEST_NET_CAFE = "10.5.60.0/24";
const GUEST_NET_OTHER = "10.5.80.0/24";
const STAFF_NET = "10.5.40.0/24";

const PRINTER = { mac: "02:00:5E:00:AA:25", ip: "10.5.40.25", name: "Front-desk printer" };
const NVR = { mac: "02:00:5E:00:AA:30", ip: "10.5.40.30", name: "CCTV recorder" };
const MEETING_TV = { mac: "02:00:5E:00:AA:40", ip: "10.5.40.40", name: "Meeting-room TV" };

interface VenueRouterSeed {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  model: string;
  serial: string;
  mac: string;
  lan: string;
  wan: string;
  guestNet: string;
  /** Profile for the seeded rules / switches. */
  profile: "lobby" | "floor2" | "cafe" | "other";
}

const HQ_ROUTERS: readonly VenueRouterSeed[] = [
  {
    id: "r-1",
    locationId: DEMO_FW_HQ_LOCATION_ID,
    locationName: "Mumbai HQ",
    name: "Lobby router",
    model: "RB5009UG+S+",
    serial: "DEMO-HQ-LOBBY",
    mac: "02:00:5E:00:00:01",
    lan: "10.5.50.1",
    wan: "203.0.113.10",
    guestNet: GUEST_NET_HQ,
    profile: "lobby",
  },
  {
    id: "r-1-floor2",
    locationId: DEMO_FW_HQ_LOCATION_ID,
    locationName: "Mumbai HQ",
    name: "Floor 2 router",
    model: "hAP ax³",
    serial: "DEMO-HQ-FL2",
    mac: "02:00:5E:00:00:02",
    lan: "10.5.50.2",
    wan: "203.0.113.10",
    guestNet: GUEST_NET_HQ,
    profile: "floor2",
  },
  {
    id: "r-1-cafe",
    locationId: DEMO_FW_CAFE_LOCATION_ID,
    locationName: "Mumbai HQ – Rooftop Café",
    name: "Rooftop Café router",
    model: "hAP ax²",
    serial: "DEMO-CAFE-ROOF",
    mac: "02:00:5E:00:00:03",
    lan: "10.5.60.1",
    wan: "203.0.113.20",
    guestNet: GUEST_NET_CAFE,
    profile: "cafe",
  },
];

/** One anchor per page load, so timestamps read "a few minutes ago" without
 * moving while someone looks at them. */
let anchor: number | null = null;
function now(): number {
  if (anchor === null) anchor = Date.now();
  return anchor;
}
function ago(minutes: number): string {
  return new Date(now() - minutes * 60_000).toISOString();
}

const seedsById = new Map<string, VenueRouterSeed>(HQ_ROUTERS.map((r) => [r.id, r]));

function seedsFor(locationId: string): VenueRouterSeed[] {
  const known = HQ_ROUTERS.filter((r) => r.locationId === locationId);
  if (known.length) return known;
  const other: VenueRouterSeed = {
    id: `${locationId}-main-router`,
    locationId,
    locationName: "",
    name: "Main router",
    model: "hAP ax²",
    serial: `DEMO-${locationId.toUpperCase()}`,
    mac: "02:00:5E:00:00:10",
    lan: "10.5.80.1",
    wan: "203.0.113.30",
    guestNet: GUEST_NET_OTHER,
    profile: "other",
  };
  seedsById.set(other.id, other);
  return [other];
}

function seedOf(routerId: string): VenueRouterSeed | null {
  return seedsById.get(routerId) ?? null;
}

function toRouterDevice(s: VenueRouterSeed): RouterDevice {
  return {
    id: s.id,
    locationId: s.locationId,
    locationName: s.locationName,
    organizationId: "org-1",
    organizationName: "Acme Corp",
    name: s.name,
    serialNumber: s.serial,
    macAddress: s.mac,
    model: s.model,
    vendor: "MikroTik",
    routerOsVersion: "7.19.4",
    managementIpAddress: s.lan,
    publicIpAddress: s.wan,
    status: "online",
    lastSeenAt: ago(1),
    lastHealthCheckAt: ago(1),
    healthStatus: "healthy",
    hasApiCredentials: true,
    controllerState: null,
    controllerStateReason: null,
    controllerLastContactedAt: null,
    vendorClaimIsContradicted: false,
    settings: {},
    createdAt: ago(90 * 24 * 60),
    updatedAt: ago(1),
  };
}

/** The routers a Security screen lists for a venue. */
export function demoVenueRouters(locationId: string): RouterDevice[] {
  return seedsFor(locationId).map(toRouterDevice);
}

function routersAt(locationId: string | null | undefined): VenueRouterSeed[] {
  if (!locationId) return [...HQ_ROUTERS];
  return seedsFor(locationId);
}

let idSeq = 0;
function newId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-demo-new-${idSeq}`;
}

function page<T>(rows: T[], p: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const start = (Math.max(1, p) - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    total: rows.length,
    totalPages,
    hasNext: p < totalPages,
    hasPrevious: p > 1,
  };
}

// ---------------------------------------------------------------------------
// Firewall rules
// ---------------------------------------------------------------------------

const PRIVATE_MARK = "wyfy-template:private-networks";
const PRIVATE_RANGES = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];

function deviceTag(end: "who" | "where", d: { mac: string; ip: string; name: string }): string {
  return `wyfy-device:${end}:${d.mac}@${d.ip}:${d.name}`;
}

type RuleSeed = Partial<FirewallRule> & Pick<FirewallRule, "name" | "action" | "priority">;

function seedRules(s: VenueRouterSeed): FirewallRule[] {
  const g = s.guestNet;
  const base = (r: RuleSeed, i: number): FirewallRule => ({
    id: `fw-${s.id}-${i + 1}`,
    routerId: s.id,
    organizationId: "org-1",
    locationId: s.locationId,
    chain: "forward",
    protocol: "all",
    sourceAddress: g,
    destinationAddress: null,
    sourcePort: null,
    destinationPort: null,
    inInterface: null,
    comment: null,
    isEnabled: true,
    createdAt: ago((40 - i) * 24 * 60),
    devicePushStatus: "active",
    devicePushError: null,
    devicePushedAt: ago(3 * 24 * 60),
    ...r,
  });

  const privateNetworks: RuleSeed[] = PRIVATE_RANGES.map((range, i) => ({
    name: `Keep guests off ${range}`,
    action: "drop",
    destinationAddress: range,
    comment: PRIVATE_MARK,
    priority: 20 + i,
  }));
  const torrents: RuleSeed[] = [
    {
      name: "Block BitTorrent (TCP 6881)",
      action: "drop",
      protocol: "tcp",
      destinationPort: 6881,
      comment: "File-sharing apps eat the venue's bandwidth.",
      priority: 30,
    },
    {
      name: "Block BitTorrent (UDP 6881)",
      action: "drop",
      protocol: "udp",
      destinationPort: 6881,
      priority: 31,
    },
  ];

  let rules: RuleSeed[];
  switch (s.profile) {
    case "lobby":
      rules = [
        {
          name: "Guests may print at the front desk",
          action: "accept",
          protocol: "tcp",
          destinationAddress: `${PRINTER.ip}/32`,
          destinationPort: 9100,
          comment: `Boarding passes and tickets.\n${deviceTag("where", PRINTER)}`,
          priority: 10,
        },
        ...privateNetworks,
        ...torrents,
        {
          name: "Block remote desktop from guests",
          action: "drop",
          protocol: "tcp",
          destinationPort: 3389,
          priority: 40,
        },
        {
          name: "Block outgoing mail servers (spam)",
          action: "drop",
          protocol: "tcp",
          destinationPort: 25,
          comment: "Guests send mail through their provider's app instead.",
          priority: 50,
        },
        {
          name: "Block a known scam network",
          action: "drop",
          destinationAddress: "198.51.100.0/24",
          comment: "Added after the bank's fraud notice.",
          priority: 60,
          devicePushStatus: "pending",
          devicePushedAt: null,
          createdAt: ago(25),
        },
        {
          name: "Block live-streaming uploads during events",
          action: "drop",
          protocol: "tcp",
          destinationPort: 1935,
          priority: 70,
          isEnabled: false,
          devicePushStatus: null,
          devicePushedAt: null,
        },
        {
          name: "Protect the router's own settings",
          chain: "input",
          action: "drop",
          protocol: "tcp",
          destinationPort: 8291,
          priority: 90,
        },
      ];
      break;
    case "floor2":
      rules = [
        {
          name: "Guests may cast to the meeting-room TV",
          action: "accept",
          protocol: "tcp",
          destinationAddress: `${MEETING_TV.ip}/32`,
          destinationPort: 8009,
          comment: deviceTag("where", MEETING_TV),
          priority: 10,
        },
        {
          name: "Keep guests off the staff network",
          action: "drop",
          destinationAddress: STAFF_NET,
          comment: "Staff laptops, CCTV and the reception PC.",
          priority: 20,
        },
        {
          name: "Keep guests away from the CCTV recorder",
          action: "drop",
          destinationAddress: `${NVR.ip}/32`,
          comment: deviceTag("where", NVR),
          priority: 21,
        },
        ...torrents,
      ];
      break;
    default:
      rules = [...privateNetworks, ...torrents];
  }
  return rules.map(base);
}

const rulesByRouter = new Map<string, FirewallRule[]>();

function rulesOf(routerId: string): FirewallRule[] {
  let rows = rulesByRouter.get(routerId);
  if (!rows) {
    const s = seedOf(routerId);
    rows = s ? seedRules(s) : [];
    rulesByRouter.set(routerId, rows);
  }
  return rows;
}

function findRule(id: string): { rows: FirewallRule[]; index: number } | null {
  for (const s of seedsById.values()) {
    const rows = rulesOf(s.id);
    const index = rows.findIndex((r) => r.id === id);
    if (index >= 0) return { rows, index };
  }
  return null;
}

export function demoFirewallList(q: FirewallRuleListQuery): FirewallRuleListResult {
  const rows = q.routerId
    ? rulesOf(q.routerId)
    : [...seedsById.values()].flatMap((s) => rulesOf(s.id));
  return page(
    rows.map((r) => ({ ...r })),
    q.page,
    q.pageSize,
  );
}

export function demoFirewallCreate(p: CreateFirewallRulePayload): FirewallRule {
  const s = seedOf(p.routerId);
  const rule: FirewallRule = {
    id: newId("fw"),
    routerId: p.routerId,
    organizationId: "org-1",
    locationId: s?.locationId ?? DEMO_FW_HQ_LOCATION_ID,
    name: p.name,
    chain: p.chain ?? "forward",
    action: p.action ?? "accept",
    protocol: p.protocol ?? "all",
    sourceAddress: p.sourceAddress ?? null,
    destinationAddress: p.destinationAddress ?? null,
    sourcePort: p.sourcePort ?? null,
    destinationPort: p.destinationPort ?? null,
    inInterface: p.inInterface ?? null,
    priority: p.priority ?? 100,
    comment: p.comment ?? null,
    isEnabled: p.isEnabled ?? true,
    createdAt: new Date().toISOString(),
    devicePushStatus: "pending",
    devicePushError: null,
    devicePushedAt: null,
  };
  rulesOf(p.routerId).push(rule);
  return { ...rule };
}

export function demoFirewallUpdate(id: string, p: UpdateFirewallRulePayload): FirewallRule {
  const hit = findRule(id);
  if (!hit) throw new Error("This rule no longer exists.");
  const prev = hit.rows[hit.index];
  const patch = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
  const next: FirewallRule = { ...prev, ...patch, devicePushStatus: "pending" };
  hit.rows[hit.index] = next;
  return { ...next };
}

export function demoFirewallRemove(id: string): void {
  const hit = findRule(id);
  if (hit) hit.rows.splice(hit.index, 1);
}

/** Apply: every switched-on between-network rule is now on the router,
 * every switched-off one has been taken off. */
export function demoFirewallPush(routerId: string): FirewallPushResult {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  const pushedAt = new Date().toISOString();
  const rows = rulesOf(routerId);
  rows.forEach((r, i) => {
    if (r.chain !== "forward") return;
    if (r.isEnabled) {
      if (r.devicePushStatus === "active") unchanged += 1;
      else added += 1;
      rows[i] = {
        ...r,
        devicePushStatus: "active",
        devicePushError: null,
        devicePushedAt: pushedAt,
      };
    } else {
      if (r.devicePushStatus !== null) removed += 1;
      rows[i] = { ...r, devicePushStatus: null, devicePushError: null, devicePushedAt: null };
    }
  });
  return { routerId, added, removed, unchanged, rules: rows.map((r) => ({ ...r })) };
}

export function demoFirewallBand(routerId: string): FirewallBandStatus | null {
  const s = seedOf(routerId);
  if (!s) return null;
  return {
    state: "ready",
    reason: null,
    checkedAt: ago(2),
    guestNetworks: [s.guestNet],
    // The router itself answers guests' lookups, so the private-networks
    // switch needs no DNS exception.
    guestDnsServers: [s.lan],
  };
}

// ---------------------------------------------------------------------------
// Flood limit and guest isolation
// ---------------------------------------------------------------------------

const FLOOD_CAPS = { relaxed: 300, normal: 150, strict: 80 } as const;

const floodByRouter = new Map<string, FloodLimitState>();

function floodOf(routerId: string): FloodLimitState | null {
  const s = seedOf(routerId);
  if (!s) return null;
  let state = floodByRouter.get(routerId);
  if (!state) {
    const preset: Exclude<FloodLimitPreset, "off"> =
      s.profile === "floor2" ? "strict" : s.profile === "cafe" ? "relaxed" : "normal";
    state = {
      routerId,
      preset,
      limit: FLOOD_CAPS[preset],
      enabled: true,
      consistent: true,
      bandState: "ready",
      guestNetworks: [s.guestNet],
      presets: { ...FLOOD_CAPS },
      checkedAt: ago(2),
    };
    floodByRouter.set(routerId, state);
  }
  return state;
}

export function demoFloodLimit(routerId: string): FloodLimitState | null {
  const state = floodOf(routerId);
  return state ? { ...state, presets: { ...state.presets } } : null;
}

export function demoSetFloodLimit(routerId: string, preset: FloodLimitPreset): FloodLimitState {
  const prev = floodOf(routerId);
  if (!prev) throw new Error("This router is not part of the demo venue.");
  const next: FloodLimitState =
    preset === "off"
      ? { ...prev, enabled: false, preset: null, limit: null, checkedAt: new Date().toISOString() }
      : {
          ...prev,
          enabled: true,
          preset,
          limit: FLOOD_CAPS[preset],
          consistent: true,
          checkedAt: new Date().toISOString(),
        };
  floodByRouter.set(routerId, next);
  return { ...next, presets: { ...next.presets } };
}

function isolationPorts(s: VenueRouterSeed, on: boolean): GuestIsolationPort[] {
  const wired = (name: string, running: boolean): GuestIsolationPort => ({
    interface: name,
    running,
    isolatable: true,
    isolated: on,
    excludedReason: null,
    isRadio: false,
  });
  const radio = (name: string): GuestIsolationPort => ({
    interface: name,
    running: true,
    isolatable: true,
    isolated: on,
    excludedReason: null,
    isRadio: true,
  });
  const wan: GuestIsolationPort = {
    interface: "ether1",
    running: true,
    isolatable: false,
    isolated: false,
    excludedReason: "wan",
    isRadio: false,
  };
  switch (s.profile) {
    case "lobby":
      return [
        wan,
        wired("ether2", true),
        wired("ether3", true),
        wired("ether4", true),
        wired("ether5", false),
      ];
    case "floor2":
      return [wan, wired("ether2", true), wired("ether3", true), radio("wifi1"), radio("wifi2")];
    default:
      return [wan, wired("ether2", true), radio("wifi1"), radio("wifi2")];
  }
}

const isolationOn = new Map<string, boolean>();

export function demoGuestIsolation(routerId: string): GuestIsolationState | null {
  const s = seedOf(routerId);
  if (!s) return null;
  const on = isolationOn.get(routerId) ?? true;
  const ports = isolationPorts(s, on);
  const guestPorts = ports.filter((p) => p.isolatable);
  const radios = ports.filter((p) => p.isRadio);
  const apPorts = guestPorts.filter((p) => !p.isRadio && p.running).length;
  return {
    routerId,
    enabled: on,
    consistent: true,
    betweenPorts: on,
    routedGuard: on,
    radiosIsolated: radios.length ? on : null,
    bandState: "ready",
    guestPorts: guestPorts.length,
    isolatedPorts: on ? guestPorts.length : 0,
    apPorts,
    apIsolationNeeded: apPorts > 0,
    ports,
    refusal: null,
    summary: on
      ? `Guests on different access points can't reach each other (${apPorts} access point port(s)).`
      : "Guests can reach each other.",
    checkedAt: ago(2),
  };
}

export function demoSetGuestIsolation(routerId: string, enabled: boolean): GuestIsolationState {
  if (!seedOf(routerId)) throw new Error("This router is not part of the demo venue.");
  isolationOn.set(routerId, enabled);
  return demoGuestIsolation(routerId) as GuestIsolationState;
}

// ---------------------------------------------------------------------------
// Rule dialog: the device picker
// ---------------------------------------------------------------------------

function device(
  s: VenueRouterSeed,
  i: number,
  d: {
    mac: string;
    ip: string;
    hostname: string | null;
    vendor: string | null;
    comment?: string | null;
    guest?: boolean;
    active?: boolean;
    type?: string;
  },
): ConnectedDevice {
  return {
    id: `dev-${s.id}-${i}`,
    routerId: s.id,
    organizationId: "org-1",
    locationId: s.locationId,
    macAddress: d.mac,
    ipAddress: d.ip,
    hostname: d.hostname,
    vendor: d.vendor,
    connectionType: d.type ?? "wired",
    interface: d.type === "wireless" ? "wifi1" : "ether3",
    signalStrengthDbm: d.type === "wireless" ? -58 : null,
    isActive: d.active ?? true,
    connectedAt: ago(180 + i * 7),
    lastSeenAt: ago(1 + i),
    comment: d.comment ?? null,
    guestId: d.guest ? `guest-demo-${i}` : null,
    createdAt: ago(30 * 24 * 60),
  };
}

function devicesFor(s: VenueRouterSeed): ConnectedDevice[] {
  const prefix = s.guestNet.split(".").slice(0, 3).join(".");
  const venue =
    s.profile === "lobby"
      ? [
          { ...PRINTER, hostname: "frontdesk-printer", vendor: "Brother", comment: PRINTER.name },
          { ...NVR, hostname: "nvr-01", vendor: "Hikvision", comment: NVR.name },
          {
            mac: "02:00:5E:00:AA:11",
            ip: "10.5.40.11",
            hostname: "reception-pc",
            vendor: "Dell",
            comment: "Reception PC",
          },
        ]
      : s.profile === "floor2"
        ? [
            { ...MEETING_TV, hostname: "meeting-tv", vendor: "Sony", comment: MEETING_TV.name },
            { ...NVR, hostname: "nvr-01", vendor: "Hikvision", comment: NVR.name },
          ]
        : [
            {
              mac: "02:00:5E:00:CC:05",
              ip: `${prefix}.5`,
              hostname: "pos-terminal",
              vendor: "Ingenico",
              comment: "Billing counter",
            },
          ];
  const guests = [21, 22, 23, 24].map((n) => ({
    mac: `02:00:5E:00:${s.profile === "cafe" ? "60" : "50"}:${String(n).padStart(2, "0")}`,
    ip: `${prefix}.${n}`,
    hostname: null,
    vendor: n % 2 ? "Apple" : "Samsung",
    guest: true,
    type: "wireless",
    active: n !== 24,
  }));
  return [...venue, ...guests].map((d, i) => device(s, i + 1, d));
}

export function demoConnectedDevices(
  routerId: string,
  p: number,
  size: number,
): ConnectedDeviceListResult {
  const s = seedOf(routerId);
  return page(s ? devicesFor(s) : [], p, size);
}

const keptAddress = new Set<string>([PRINTER.mac]);

export function demoDhcpLeases(routerId: string): DhcpLease[] {
  const s = seedOf(routerId);
  if (!s) return [];
  return devicesFor(s).map((d) => ({
    macAddress: d.macAddress,
    address: d.ipAddress,
    dynamic: !keptAddress.has(d.macAddress),
    status: "bound",
    hostName: d.hostname,
    server: d.guestId ? "guest-dhcp" : "staff-dhcp",
    disabled: false,
  }));
}

export function demoKeepLeaseAddress(
  routerId: string,
  macAddress: string,
  ipAddress: string,
): { changed: boolean; lease: DhcpLease } {
  const mac = macAddress.toUpperCase();
  const changed = !keptAddress.has(mac);
  keptAddress.add(mac);
  const lease = demoDhcpLeases(routerId).find((l) => l.macAddress === mac) ?? {
    macAddress: mac,
    address: ipAddress,
    dynamic: false,
    status: "bound",
    hostName: null,
    server: "staff-dhcp",
    disabled: false,
  };
  return { changed, lease };
}

// ---------------------------------------------------------------------------
// Block Websites: specific websites, internet addresses, apps
// ---------------------------------------------------------------------------

interface DemoApp {
  key: string;
  name: string;
  category: string;
  note: string | null;
  domains: string[];
}

/** A trimmed copy of the backend's curated app catalogue (same keys and
 * names; a few names per app rather than every one). */
const APP_CATALOGUE: readonly DemoApp[] = [
  {
    key: "youtube",
    name: "YouTube",
    category: "streaming",
    note: null,
    domains: ["youtube.com", "youtu.be", "googlevideo.com", "ytimg.com"],
  },
  {
    key: "instagram",
    name: "Instagram",
    category: "social_media",
    note: null,
    domains: ["instagram.com", "cdninstagram.com", "ig.me"],
  },
  {
    key: "facebook",
    name: "Facebook and Messenger",
    category: "social_media",
    note: null,
    domains: ["facebook.com", "fb.com", "messenger.com"],
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    category: "social_media",
    note: "WhatsApp can reconnect through its own built-in addresses.",
    domains: ["whatsapp.com", "whatsapp.net", "wa.me"],
  },
  {
    key: "short_video",
    name: "TikTok, Moj and Josh",
    category: "social_media",
    note: "This also blocks ShareChat, which runs Moj.",
    domains: ["tiktok.com", "tiktokcdn.com", "mojapp.in", "sharechat.com", "myjosh.in"],
  },
  {
    key: "snapchat",
    name: "Snapchat",
    category: "social_media",
    note: null,
    domains: ["snapchat.com", "sc-cdn.net"],
  },
  {
    key: "netflix",
    name: "Netflix",
    category: "streaming",
    note: null,
    domains: ["netflix.com", "nflxvideo.net"],
  },
  {
    key: "jiohotstar",
    name: "JioHotstar",
    category: "streaming",
    note: null,
    domains: ["hotstar.com", "jiohotstar.com", "jiocinema.com"],
  },
  {
    key: "battle_royale",
    name: "BGMI, PUBG Mobile and Free Fire",
    category: "gaming",
    note: "A match already in progress is not cut off.",
    domains: ["battlegroundsmobileindia.com", "pubgmobile.com", "freefiremobile.com"],
  },
  {
    key: "torrents",
    name: "Torrent sites and trackers",
    category: "custom",
    note: "Torrent apps can still find each other without these sites.",
    domains: ["torrent-index.example.com", "tracker.example.net", "magnet-search.example.org"],
  },
];

const APP_LIMITATIONS = [
  "This blocks the website names an app uses. It does not recognise the app itself, so some apps may still get through.",
  "An app that is already open, or that connects without looking up a name, can keep working until it reconnects.",
  "A device using its own DNS or a VPN, or a phone on mobile data, is not covered.",
];

/** Staff on Floor 2 have social apps switched off; guests keep them. */
function appsBlockedAt(s: VenueRouterSeed): string[] {
  if (s.profile === "floor2")
    return ["torrents", "instagram", "facebook", "short_video", "snapchat"];
  return ["torrents"];
}

type SiteSeed = {
  name: string;
  value: string;
  category: ContentFilterCategory;
  comment?: string;
  ip?: boolean;
};

function sitesAt(s: VenueRouterSeed): SiteSeed[] {
  const common: SiteSeed[] = [
    { name: "free-movies.example.com", value: "free-movies.example.com", category: "streaming" },
    {
      name: "proxy-unblock.example.net",
      value: "proxy-unblock.example.net",
      category: "custom",
      comment: "Web proxy used to get round the filter.",
    },
    { name: "bet-now.example.org", value: "bet-now.example.org", category: "gambling" },
  ];
  const addresses: SiteSeed[] = [
    {
      name: "Known scam server",
      value: "198.51.100.66/32",
      category: "custom",
      comment: "Reported by the bank's fraud desk.",
      ip: true,
    },
    {
      name: "Ad-fraud network",
      value: "203.0.113.128/25",
      category: "custom",
      ip: true,
    },
  ];
  if (s.profile === "lobby") return [...common, ...addresses];
  if (s.profile === "floor2")
    return [
      ...common,
      {
        name: "game-portal.example.com",
        value: "game-portal.example.com",
        category: "gaming",
        comment: "Staff network: no gaming during working hours.",
      },
    ];
  return common;
}

const contentByRouter = new Map<string, ContentFilterRule[]>();

function appRules(s: VenueRouterSeed, app: DemoApp, at: string): ContentFilterRule[] {
  return app.domains.map((d, i) => ({
    id: newId(`cf-${s.id}-${app.key}-${i}`),
    routerId: s.id,
    organizationId: "org-1",
    locationId: s.locationId,
    name: `${app.name}: ${d}`,
    category: (app.category as ContentFilterCategory) ?? "custom",
    valueType: "domain",
    value: d,
    comment: null,
    appKey: app.key,
    isEnabled: true,
    devicePushStatus: "active",
    devicePushError: null,
    devicePushedAt: at,
    createdAt: at,
  }));
}

function contentOf(routerId: string): ContentFilterRule[] {
  let rows = contentByRouter.get(routerId);
  if (!rows) {
    const s = seedOf(routerId);
    rows = [];
    if (s) {
      sitesAt(s).forEach((site, i) => {
        rows!.push({
          id: `cf-${s.id}-${i + 1}`,
          routerId: s.id,
          organizationId: "org-1",
          locationId: s.locationId,
          name: site.name,
          category: site.category,
          valueType: site.ip ? "ip_cidr" : "domain",
          value: site.value,
          comment: site.comment ?? null,
          appKey: null,
          isEnabled: true,
          devicePushStatus: "active",
          devicePushError: null,
          devicePushedAt: ago((12 - i) * 24 * 60),
          createdAt: ago((20 - i) * 24 * 60),
        });
      });
      for (const key of appsBlockedAt(s)) {
        const app = APP_CATALOGUE.find((a) => a.key === key);
        if (app) rows.push(...appRules(s, app, ago(9 * 24 * 60)));
      }
    }
    contentByRouter.set(routerId, rows);
  }
  return rows;
}

function findContent(id: string): { rows: ContentFilterRule[]; index: number } | null {
  for (const s of seedsById.values()) {
    const rows = contentOf(s.id);
    const index = rows.findIndex((r) => r.id === id);
    if (index >= 0) return { rows, index };
  }
  return null;
}

export function demoContentFilterList(q: ContentFilterListQuery): ContentFilterListResult {
  let rows = q.routerId
    ? contentOf(q.routerId)
    : [...seedsById.values()].flatMap((s) => contentOf(s.id));
  if (q.excludeAppRules) rows = rows.filter((r) => !r.appKey);
  return page(
    rows.map((r) => ({ ...r })),
    q.page,
    q.pageSize,
  );
}

export function demoContentFilterCreate(p: CreateContentFilterRulePayload): ContentFilterRule {
  const s = seedOf(p.routerId);
  const rule: ContentFilterRule = {
    id: newId("cf"),
    routerId: p.routerId,
    organizationId: "org-1",
    locationId: s?.locationId ?? DEMO_FW_HQ_LOCATION_ID,
    name: p.name,
    category: p.category ?? "custom",
    valueType: p.valueType,
    value: p.value,
    comment: p.comment ?? null,
    appKey: null,
    isEnabled: p.isEnabled ?? true,
    devicePushStatus: "pending",
    devicePushError: null,
    devicePushedAt: null,
    createdAt: new Date().toISOString(),
  };
  contentOf(p.routerId).push(rule);
  return { ...rule };
}

export function demoContentFilterUpdate(
  id: string,
  p: UpdateContentFilterRulePayload,
): ContentFilterRule {
  const hit = findContent(id);
  if (!hit) throw new Error("This rule no longer exists.");
  const patch = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
  const next: ContentFilterRule = {
    ...hit.rows[hit.index],
    ...patch,
    devicePushStatus: "pending",
  };
  hit.rows[hit.index] = next;
  return { ...next };
}

export function demoContentFilterRemove(id: string): void {
  const hit = findContent(id);
  if (hit) hit.rows.splice(hit.index, 1);
}

export function demoContentFilterPush(id: string): ContentFilterRule {
  const hit = findContent(id);
  if (!hit) throw new Error("This rule no longer exists.");
  const next: ContentFilterRule = {
    ...hit.rows[hit.index],
    devicePushStatus: "active",
    devicePushError: null,
    devicePushedAt: new Date().toISOString(),
  };
  hit.rows[hit.index] = next;
  return { ...next };
}

function appState(routerId: string, app: DemoApp): ContentFilterApp {
  const rows = contentOf(routerId);
  const targets = app.domains.map((d) => {
    const rule = rows.find((r) => r.valueType === "domain" && r.value === d) ?? null;
    return {
      valueType: "domain" as const,
      value: d,
      ruleId: rule?.id ?? null,
      owned: !!rule && rule.appKey === app.key,
      isEnabled: !!rule?.isEnabled,
      devicePushStatus: rule?.devicePushStatus ?? null,
      devicePushError: rule?.devicePushError ?? null,
    };
  });
  const on = targets.filter((t) => t.isEnabled).length;
  return {
    key: app.key,
    name: app.name,
    category: app.category,
    note: app.note,
    state: on === 0 ? "not_blocked" : on === targets.length ? "blocked" : "partly_blocked",
    pushStatus: on === 0 ? null : "active",
    targets,
  };
}

export function demoContentFilterApps(routerId: string): ContentFilterAppList {
  return {
    routerId,
    items: APP_CATALOGUE.map((a) => appState(routerId, a)),
    limitations: [...APP_LIMITATIONS],
  };
}

export function demoBlockApp(routerId: string, appKey: string): ContentFilterApp {
  const s = seedOf(routerId);
  const app = APP_CATALOGUE.find((a) => a.key === appKey);
  if (!s || !app) throw new Error("This app is not in the list.");
  const rows = contentOf(routerId);
  const have = new Set(rows.filter((r) => r.valueType === "domain").map((r) => r.value));
  const at = new Date().toISOString();
  rows.push(...appRules(s, app, at).filter((r) => !have.has(r.value)));
  return appState(routerId, app);
}

export function demoUnblockApp(routerId: string, appKey: string): ContentFilterApp {
  const app = APP_CATALOGUE.find((a) => a.key === appKey);
  if (!app) throw new Error("This app is not in the list.");
  const rows = contentOf(routerId);
  for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].appKey === appKey) rows.splice(i, 1);
  return appState(routerId, app);
}

// ---------------------------------------------------------------------------
// Block Websites: categories (Cloudflare) and bypass protection
// ---------------------------------------------------------------------------

function cat(
  id: number,
  name: string,
  description: string,
  subcategories: WebCategory[] = [],
  isSecurity = false,
): WebCategory {
  return {
    id,
    name,
    description,
    categoryClass: "free",
    beta: false,
    isSecurity,
    subcategories,
  };
}

const CATEGORIES: readonly WebCategory[] = [
  cat(
    21,
    "Security threats",
    "Malware, phishing, scams and other sites that attack the people who visit them.",
    [
      cat(80, "Malware", "Sites that host or spread malicious software."),
      cat(83, "Phishing", "Sites that pose as a bank, a shop or a login page to steal details."),
      cat(68, "Command and control", "Servers that remote-control infected devices."),
      cat(117, "Cryptomining", "Sites that use the visitor's device to mine cryptocurrency."),
      cat(131, "Scams", "Fake shops, fake prizes and fake support lines."),
    ],
    true,
  ),
  cat(2, "Adult themes", "Sexual content and nudity.", [
    cat(67, "Nudity", "Images of nudity."),
    cat(125, "Pornography", "Sexually explicit material."),
  ]),
  cat(99, "Gambling", "Betting, casinos and lotteries.", [
    cat(100, "Online betting", "Sports betting and online casinos."),
  ]),
  cat(17, "Questionable content", "Content most venues don't want on their network.", [
    cat(34, "Piracy", "Unlicensed films, music and software."),
    cat(85, "Proxies and anonymisers", "Services built to get round filters."),
  ]),
  cat(15, "Society and lifestyle", "Everyday interests and communities.", [
    cat(149, "Social networks", "Social media sites and apps."),
    cat(150, "Dating", "Dating sites and apps."),
  ]),
  cat(6, "Entertainment", "Video, music and games.", [
    cat(164, "Video streaming", "Film and TV streaming services."),
    cat(165, "Online games", "Browser and app games."),
  ]),
];

const flatIds = (c: WebCategory): number[] => [c.id, ...c.subcategories.map((x) => x.id)];
const byName = (name: string) => CATEGORIES.find((c) => c.name === name) as WebCategory;

/** The account default: harmful websites only. Mumbai HQ has its own list
 * on top of it. */
const ORG_DEFAULT_IDS = flatIds(byName("Security threats"));
const HQ_IDS = [
  ...flatIds(byName("Security threats")),
  ...flatIds(byName("Adult themes")),
  ...flatIds(byName("Gambling")),
  85,
].sort((a, b) => a - b);

const venueCategories = new Map<string, number[]>([[DEMO_FW_HQ_LOCATION_ID, HQ_IDS]]);

export function demoWebCategories(): WebCategoryCatalogue {
  return { state: "ready", items: structuredCloneCategories(CATEGORIES) };
}

function structuredCloneCategories(items: readonly WebCategory[]): WebCategory[] {
  return items.map((c) => ({ ...c, subcategories: structuredCloneCategories(c.subcategories) }));
}

export function demoWebFilterLocationPolicy(locationId: string): WebFilterLocationPolicy {
  const own = venueCategories.get(locationId) ?? null;
  return {
    locationId,
    organizationId: "org-1",
    effectiveCategoryIds: [...(own ?? ORG_DEFAULT_IDS)],
    source: own ? "location" : "organization",
    locationCategoryIds: own ? [...own] : null,
    organizationCategoryIds: [...ORG_DEFAULT_IDS],
  };
}

const WEB_FILTER_LIMITATIONS = [
  "Enforced by Cloudflare Gateway at the DNS layer, not by the router.",
  "Devices using their own DNS, DNS-over-HTTPS or DNS-over-TLS are not covered unless DNS bypass hardening is on -- and even then DoH to an unlisted server looks like ordinary HTTPS and still gets through.",
  "Blocks whole domains only: no URL paths, no in-app content.",
];

interface WebFilterRouterSeed {
  enabled: boolean;
  bypass: boolean;
  pushedAt: string;
}

const webFilterByRouter = new Map<string, WebFilterRouterSeed>();

function webFilterSeed(routerId: string): WebFilterRouterSeed | null {
  const s = seedOf(routerId);
  if (!s) return null;
  let seed = webFilterByRouter.get(routerId);
  if (!seed) {
    seed = { enabled: true, bypass: s.profile !== "cafe", pushedAt: ago(6 * 24 * 60) };
    webFilterByRouter.set(routerId, seed);
  }
  return seed;
}

export function demoWebFilterRouterStatus(routerId: string): WebFilterRouterStatus {
  const s = seedOf(routerId);
  const seed = webFilterSeed(routerId);
  if (!s || !seed) throw new Error("This router is not part of the demo venue.");
  const policy = demoWebFilterLocationPolicy(s.locationId);
  return {
    routerId,
    enabled: seed.enabled,
    state: seed.enabled ? "active" : "disabled",
    devicePushStatus: "active",
    devicePushError: null,
    devicePushedAt: seed.pushedAt,
    effectiveCategoryIds: policy.effectiveCategoryIds,
    policySource: policy.source,
    bypassHardeningEnabled: seed.bypass,
    bypassHardeningStatus: seed.bypass ? "active" : "off",
    bypassHardeningError: null,
    routerosVersion: "7.19.4",
    limitations: [...WEB_FILTER_LIMITATIONS],
  };
}

export function demoSetWebFilterLocationPolicy(
  locationId: string,
  categoryIds: number[],
): WebFilterLocationPolicy {
  venueCategories.set(
    locationId,
    [...new Set(categoryIds)].sort((a, b) => a - b),
  );
  for (const s of seedsFor(locationId)) {
    const seed = webFilterSeed(s.id);
    if (seed) seed.pushedAt = new Date().toISOString();
  }
  return demoWebFilterLocationPolicy(locationId);
}

export function demoWebFilterRouterAction(
  routerId: string,
  action: { kind: "enable" } | { kind: "disable" } | { kind: "bypass"; enabled: boolean },
): WebFilterRouterStatus {
  const seed = webFilterSeed(routerId);
  if (!seed) throw new Error("This router is not part of the demo venue.");
  if (action.kind === "enable") seed.enabled = true;
  else if (action.kind === "disable") {
    seed.enabled = false;
    seed.bypass = false;
  } else seed.bypass = action.enabled;
  seed.pushedAt = new Date().toISOString();
  return demoWebFilterRouterStatus(routerId);
}

// ---------------------------------------------------------------------------
// Security Score
// ---------------------------------------------------------------------------

/** Mirrors the backend's weights (security/constants.py): per occurrence,
 * cap. Rate factors divide by their denominator. */
const WEIGHTS = {
  fleet_reporting: [60, 40],
  block_push_integrity: [30, 25],
  rogue_dhcp_guard: [10, 15],
  alert_pressure: [5, 10],
} as const;

function penalty(key: keyof typeof WEIGHTS, affected: number, denominator: number | null): number {
  const [per, cap] = WEIGHTS[key];
  if (denominator === null) return Math.min(cap, per * affected);
  if (denominator <= 0) return 0;
  return Math.min(cap, Math.round((per * affected) / denominator));
}

export function demoSecurityOverview(locationId?: string | null): SecurityOverview {
  const routers = routersAt(locationId);
  const content = routers.flatMap((s) => contentOf(s.id)).filter((r) => r.isEnabled);
  const domains = content.filter((r) => r.valueType === "domain").length;
  const addresses = content.filter((r) => r.valueType === "ip_cidr").length;
  const notApplied = content.filter((r) => r.devicePushStatus !== "active").length;
  const firewallRules = routers.flatMap((s) => rulesOf(s.id)).filter((r) => r.isEnabled).length;
  const blockedDevices = 2;
  const openAlerts = 1;
  const interfaces = routers.length * 2;
  const unguarded = 0;

  const factors = [
    {
      key: "fleet_reporting",
      label: "Gateways reporting",
      penalty: penalty("fleet_reporting", 0, routers.length),
      maxPenalty: WEIGHTS.fleet_reporting[1],
      affected: 0,
      available: true,
      detail: `${routers.length} of ${routers.length} gateways checked in within the last 10 minutes.`,
    },
    {
      key: "block_push_integrity",
      label: "Blocks applied to the gateway",
      penalty: penalty("block_push_integrity", notApplied, domains + addresses),
      maxPenalty: WEIGHTS.block_push_integrity[1],
      affected: notApplied,
      available: true,
      detail: notApplied
        ? "Enabled blocks that have not reached a gateway are not blocking anything yet."
        : "Every enabled block has reached its gateway.",
    },
    {
      key: "rogue_dhcp_guard",
      label: "Rogue DHCP guard",
      penalty: penalty("rogue_dhcp_guard", unguarded, interfaces),
      maxPenalty: WEIGHTS.rogue_dhcp_guard[1],
      affected: unguarded,
      available: true,
      detail: "Every checked interface is guarded.",
    },
    {
      key: "alert_pressure",
      label: "Unresolved alerts",
      penalty: penalty("alert_pressure", openAlerts, null),
      maxPenalty: WEIGHTS.alert_pressure[1],
      affected: openAlerts,
      available: true,
      detail: `${openAlerts} alert(s) are triggered or acknowledged and not yet resolved.`,
    },
  ];
  const score = Math.max(0, 100 - factors.reduce((n, f) => n + f.penalty, 0));
  const band = score >= 90 ? "excellent" : score >= 75 ? "good" : score >= 50 ? "fair" : "poor";
  const counter = (key: string, label: string, count: number, source: string) => ({
    key,
    label,
    count,
    available: true,
    unavailableReason: null,
    source,
  });
  const generatedAt = new Date().toISOString();
  return {
    score: {
      score,
      band,
      maxScore: 100,
      available: true,
      unavailableReason: null,
      factors,
      computedAt: generatedAt,
    },
    counters: [
      counter("blocked_domains", "Blocked domains", domains, "content_filter_rules"),
      counter("blocked_addresses", "Blocked IP addresses", addresses, "content_filter_rules"),
      counter("blocks_not_applied", "Blocks not yet applied", notApplied, "content_filter_rules"),
      counter("blocked_devices", "Blocked devices", blockedDevices, "device_access_rules"),
      counter("firewall_rules", "Firewall rules", firewallRules, "firewall_rules"),
      counter(
        "rogue_dhcp_unguarded",
        "Interfaces without a DHCP guard",
        unguarded,
        "router_rogue_dhcp_statuses",
      ),
      counter("open_alerts", "Unresolved alerts", openAlerts, "alerts"),
      // The same two the real backend reports as unavailable: the platform
      // has no event capture, and the demo does not pretend otherwise.
      {
        key: "threats_detected",
        label: "Threats detected",
        count: null,
        available: false,
        unavailableReason:
          "This platform does not collect gateway log events, so no threat count can be produced.",
        source: null,
      },
      {
        key: "threats_blocked",
        label: "Threats blocked",
        count: null,
        available: false,
        unavailableReason:
          "Requires the same event capture as threats detected. Configured blocks are reported separately, and each says whether it has reached a gateway.",
        source: null,
      },
    ],
    fleet: {
      routersTotal: routers.length,
      routersReporting: routers.length,
      routersStale: 0,
      routersUnhealthy: 0,
      noManagedGateway: false,
    },
    generatedAt,
  };
}

const feature = (
  key: string,
  label: string,
  availability: SecurityFeature["availability"],
  detail: string,
): SecurityFeature => ({ key, label, availability, enforcement: null, detail });

/** The backend's capability matrix (security/constants.py), same keys and
 * availability, details shortened. */
export function demoSecurityCapabilities(): SecurityFeature[] {
  return [
    feature(
      "zone_to_zone_firewall",
      "Zone-to-zone firewall",
      "available",
      "Rules between your networks, applied to the router in order.",
    ),
    feature(
      "domain_blocking_dns",
      "Domain blocking (DNS)",
      "available",
      "Applies to devices that use this router to look up website names.",
    ),
    feature(
      "domain_blocking_sni",
      "Domain blocking (HTTPS hostname)",
      "requires_additional_technology",
      "Built and pushed with every blocked website, but not yet proven on a real router.",
    ),
    feature(
      "ip_and_cidr_blocking",
      "IP and CIDR blocking",
      "available",
      "Inbound and outbound both work for literal addresses.",
    ),
    feature(
      "device_isolation",
      "Device isolation and blocking",
      "available",
      "Blocking a device by its hardware address cuts it off now and on every reconnect.",
    ),
    feature(
      "guest_client_isolation",
      "Guest isolation (guests can't see each other)",
      "available",
      "Guests on different access points can't reach each other; turn on AP isolation in each access point for guests on the same one.",
    ),
    feature(
      "rogue_dhcp_detection",
      "Rogue DHCP detection",
      "available",
      "Already implemented and already monitored.",
    ),
    feature(
      "connection_flood_protection",
      "Connection and brute-force limits",
      "available",
      "Caps how many connections one guest device can hold.",
    ),
    feature(
      "web_category_filtering",
      "Web category filtering",
      "available",
      "Cloudflare decides which website belongs to which category, at the name lookup.",
    ),
    feature(
      "dns_bypass_protection",
      "DNS bypass protection",
      "requires_additional_technology",
      "Stops default settings and casual workarounds, not a determined user.",
    ),
    feature(
      "application_control",
      "Application control",
      "available",
      "Blocks the website names an app uses.",
    ),
    feature(
      "threat_intelligence",
      "Threat intelligence (malware, phishing, botnet)",
      "available",
      "Cloudflare's Security threats category.",
    ),
    feature(
      "geo_blocking",
      "Geo blocking",
      "requires_additional_technology",
      "Needs a country address list this platform does not maintain yet.",
    ),
    feature(
      "per_application_traffic",
      "Per-application traffic accounting",
      "not_supported",
      "The router cannot tell apps apart inside encrypted traffic.",
    ),
    feature(
      "ids_ips",
      "Intrusion detection and prevention",
      "not_supported",
      "Needs a dedicated security appliance.",
    ),
    feature(
      "url_path_filtering",
      "URL path and keyword filtering",
      "not_supported",
      "Would require reading inside encrypted traffic.",
    ),
  ];
}

// ---------------------------------------------------------------------------
// Port forwarding
// ---------------------------------------------------------------------------

const forwardsByRouter = new Map<string, PortForwardingRule[]>();

function forwardsOf(routerId: string): PortForwardingRule[] {
  let rows = forwardsByRouter.get(routerId);
  if (!rows) {
    const s = seedOf(routerId);
    rows = [];
    if (s?.profile === "lobby") {
      const base = {
        routerId: s.id,
        organizationId: "org-1",
        locationId: s.locationId,
        destinationAddress: null,
        devicePushError: null,
      };
      rows.push(
        {
          ...base,
          id: `pf-${s.id}-1`,
          name: "CCTV remote viewing",
          protocol: "tcp",
          sourceAddress: "198.51.100.0/24",
          destinationPort: 8443,
          internalAddress: NVR.ip,
          internalPort: 443,
          description: "Only the security company's office can open it.",
          isEnabled: true,
          devicePushStatus: "active",
          devicePushedAt: ago(14 * 24 * 60),
          createdAt: ago(30 * 24 * 60),
        },
        {
          ...base,
          id: `pf-${s.id}-2`,
          name: "Door-access controller (vendor support)",
          protocol: "tcp",
          sourceAddress: "198.51.100.40/32",
          destinationPort: 4370,
          internalAddress: "10.5.40.35",
          internalPort: 4370,
          description: "Switched on only when the vendor is working on it.",
          isEnabled: false,
          devicePushStatus: "pending",
          devicePushedAt: null,
          createdAt: ago(8 * 24 * 60),
        },
      );
    }
    forwardsByRouter.set(routerId, rows);
  }
  return rows;
}

function findForward(id: string): { rows: PortForwardingRule[]; index: number } | null {
  for (const s of seedsById.values()) {
    const rows = forwardsOf(s.id);
    const index = rows.findIndex((r) => r.id === id);
    if (index >= 0) return { rows, index };
  }
  return null;
}

export function demoPortForwardingList(q: PortForwardingListQuery): PortForwardingListResult {
  const rows = q.routerId
    ? forwardsOf(q.routerId)
    : [...seedsById.values()].flatMap((s) => forwardsOf(s.id));
  return page(
    rows.map((r) => ({ ...r })),
    q.page,
    q.pageSize,
  );
}

export function demoPortForwardingCreate(p: CreatePortForwardingPayload): PortForwardingRule {
  const s = seedOf(p.routerId);
  const rule: PortForwardingRule = {
    id: newId("pf"),
    routerId: p.routerId,
    organizationId: "org-1",
    locationId: s?.locationId ?? DEMO_FW_HQ_LOCATION_ID,
    name: p.name,
    protocol: p.protocol ?? "tcp",
    sourceAddress: p.sourceAddress ?? null,
    destinationAddress: p.destinationAddress ?? null,
    destinationPort: p.destinationPort,
    internalAddress: p.internalAddress,
    internalPort: p.internalPort,
    description: p.description ?? null,
    isEnabled: p.isEnabled ?? true,
    devicePushStatus: "pending",
    devicePushError: null,
    devicePushedAt: null,
    createdAt: new Date().toISOString(),
  };
  forwardsOf(p.routerId).push(rule);
  return { ...rule };
}

export function demoPortForwardingUpdate(
  id: string,
  p: UpdatePortForwardingPayload,
): PortForwardingRule {
  const hit = findForward(id);
  if (!hit) throw new Error("This rule no longer exists.");
  const patch = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
  const next: PortForwardingRule = {
    ...hit.rows[hit.index],
    ...patch,
    devicePushStatus: "pending",
  };
  hit.rows[hit.index] = next;
  return { ...next };
}

export function demoPortForwardingRemove(id: string): void {
  const hit = findForward(id);
  if (hit) hit.rows.splice(hit.index, 1);
}

export function demoPortForwardingPush(id: string): PortForwardingRule {
  const hit = findForward(id);
  if (!hit) throw new Error("This rule no longer exists.");
  const next: PortForwardingRule = {
    ...hit.rows[hit.index],
    devicePushStatus: "active",
    devicePushError: null,
    devicePushedAt: new Date().toISOString(),
  };
  hit.rows[hit.index] = next;
  return { ...next };
}
