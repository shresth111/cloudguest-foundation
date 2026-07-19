import type {
  ConnectedDevice,
  CreateRouterPayload,
  RouterAlert,
  RouterDevice,
  RouterListQuery,
  RouterListResult,
  RouterStatus,
  WireGuardPeer,
} from "@/types/router";

const ORGS = [
  ["ORG-01000", "Nimbus Hospitality"],
  ["ORG-01001", "Vertex Retail"],
  ["ORG-01002", "Halo Group"],
  ["ORG-01003", "Orbit Holdings"],
  ["ORG-01004", "Lumen Ventures"],
  ["ORG-01005", "Cascade Networks"],
];

const LOCATIONS = [
  ["LOC-02000", "Nimbus SF Downtown"],
  ["LOC-02001", "Vertex NYC Plaza"],
  ["LOC-02002", "Halo London Central"],
  ["LOC-02003", "Orbit Bengaluru North"],
  ["LOC-02004", "Lumen Singapore Airport"],
  ["LOC-02005", "Cascade Dubai Mall"],
  ["LOC-02006", "Nimbus Munich Riverside"],
  ["LOC-02007", "Vertex Sydney South"],
];

const MODELS = [
  "MikroTik CCR2004-1G-12S+2XS",
  "MikroTik CCR2116-12G-4S+",
  "MikroTik RB5009UG+S+IN",
  "MikroTik hEX S",
  "MikroTik hAP ax3",
  "MikroTik CRS326-24G-2S+",
];

const ROS = ["7.14.3", "7.13.5", "7.12.1", "7.15.2"];
const STATUSES: RouterStatus[] = [
  "online", "online", "online", "online", "online",
  "offline", "maintenance", "provisioning", "suspended", "error",
];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seedRandom(313);

function generate(count: number): RouterDevice[] {
  const out: RouterDevice[] = [];
  for (let i = 0; i < count; i++) {
    const [orgId, orgName] = ORGS[i % ORGS.length];
    const [locId, locName] = LOCATIONS[i % LOCATIONS.length];
    const model = MODELS[i % MODELS.length];
    const status = STATUSES[i % STATUSES.length];
    const online = status === "online";
    const ros = ROS[i % ROS.length];
    const created = new Date(Date.now() - Math.floor(rand() * 400) * 86400000);
    const lastSeen = new Date(Date.now() - Math.floor(rand() * (online ? 5 : 4000)) * 60000);
    out.push({
      id: `RTR-${String(30000 + i).padStart(5, "0")}`,
      name: `${locName.split(" ")[0]}-RTR-${String(i + 1).padStart(3, "0")}`,
      mikrotikIdentity: `mt-${orgName.split(" ")[0].toLowerCase()}-${i + 1}`,
      nasId: `nas-${orgId.toLowerCase()}-${1000 + i}`,
      organizationId: orgId,
      organizationName: orgName,
      locationId: locId,
      locationName: locName,
      model,
      serialNumber: `SN${String(1_000_000 + i * 17).padStart(8, "0")}`,
      routerOsVersion: ros,
      latestOsVersion: "7.15.2",
      publicIp: `${20 + (i % 200)}.${Math.floor(rand() * 250)}.${Math.floor(rand() * 250)}.${1 + (i % 250)}`,
      privateIp: `10.${i % 250}.${Math.floor(rand() * 250)}.1`,
      wireguardStatus: online ? (rand() > 0.15 ? "up" : "connecting") : "down",
      radiusStatus: online ? (rand() > 0.1 ? "running" : "error") : "stopped",
      internetStatus: online ? "online" : status === "maintenance" ? "degraded" : "offline",
      uptimeHours: online ? Math.floor(rand() * 8000) : 0,
      cpuPct: online ? 5 + Math.floor(rand() * 85) : 0,
      ramPct: online ? 20 + Math.floor(rand() * 70) : 0,
      storagePct: 10 + Math.floor(rand() * 80),
      temperatureC: online ? 35 + Math.floor(rand() * 30) : 0,
      latencyMs: online ? 5 + Math.floor(rand() * 90) : 0,
      packetLossPct: online ? Math.round(rand() * 40) / 10 : 0,
      activeGuests: online ? Math.floor(rand() * 400) : 0,
      activeSessions: online ? Math.floor(rand() * 1200) : 0,
      status,
      lastSeen: lastSeen.toISOString(),
      createdAt: created.toISOString(),
      wanIp: `203.0.${i % 250}.${1 + (i % 250)}`,
      lanIp: `192.168.${i % 200}.1`,
      dns: "1.1.1.1, 8.8.8.8",
      gateway: `203.0.${i % 250}.254`,
      timezone: ["America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Kolkata"][i % 4],
      sharedSecret: "•••••••••",
      apiPort: 8728,
      apiUsername: "cloudguest",
      services: {
        freeradius: true,
        wireguard: rand() > 0.1,
        captivePortal: true,
        guestWifi: true,
        monitoring: true,
        analytics: rand() > 0.2,
      },
    });
  }
  return out;
}

let ROUTERS: RouterDevice[] = generate(72);

function delay<T>(v: T, ms = 300): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), ms));
}

export const routerService = {
  async list(q: RouterListQuery): Promise<RouterListResult> {
    let rows = [...ROUTERS];
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s) ||
          r.mikrotikIdentity.toLowerCase().includes(s) ||
          r.serialNumber.toLowerCase().includes(s) ||
          r.publicIp.includes(s) ||
          r.locationName.toLowerCase().includes(s) ||
          r.organizationName.toLowerCase().includes(s),
      );
    }
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    if (q.organizationId && q.organizationId !== "all") rows = rows.filter((r) => r.organizationId === q.organizationId);
    if (q.locationId && q.locationId !== "all") rows = rows.filter((r) => r.locationId === q.locationId);
    if (q.model && q.model !== "all") rows = rows.filter((r) => r.model === q.model);
    if (q.sortBy) {
      const dir = q.sortDir === "desc" ? -1 : 1;
      const key = q.sortBy;
      rows.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av == null || bv == null) return 0;
        return av > bv ? dir : av < bv ? -dir : 0;
      });
    }
    const total = rows.length;
    const start = (q.page - 1) * q.pageSize;
    rows = rows.slice(start, start + q.pageSize);
    return delay({ rows, total });
  },

  async get(id: string): Promise<RouterDevice | null> {
    return delay(ROUTERS.find((r) => r.id === id) ?? null);
  },

  async create(payload: CreateRouterPayload): Promise<RouterDevice> {
    const id = `RTR-${String(30000 + ROUTERS.length).padStart(5, "0")}`;
    const org = ORGS.find(([oid]) => oid === payload.basic.organizationId) ?? ORGS[0];
    const loc = LOCATIONS.find(([lid]) => lid === payload.basic.locationId) ?? LOCATIONS[0];
    const router: RouterDevice = {
      id,
      name: payload.basic.name,
      mikrotikIdentity: payload.basic.mikrotikIdentity,
      nasId: payload.auth.nasId,
      organizationId: org[0],
      organizationName: org[1],
      locationId: loc[0],
      locationName: loc[1],
      model: payload.basic.model,
      serialNumber: payload.basic.serialNumber,
      routerOsVersion: "7.15.2",
      latestOsVersion: "7.15.2",
      publicIp: payload.network.wanIp,
      privateIp: payload.network.lanIp,
      wireguardStatus: "connecting",
      radiusStatus: "stopped",
      internetStatus: "online",
      uptimeHours: 0,
      cpuPct: 0,
      ramPct: 0,
      storagePct: 0,
      temperatureC: 0,
      latencyMs: 0,
      packetLossPct: 0,
      activeGuests: 0,
      activeSessions: 0,
      status: "provisioning",
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      wanIp: payload.network.wanIp,
      lanIp: payload.network.lanIp,
      dns: payload.network.dns,
      gateway: payload.network.gateway,
      timezone: payload.network.timezone,
      sharedSecret: "•••••••••",
      apiPort: payload.auth.apiPort,
      apiUsername: payload.auth.apiUsername,
      services: payload.services,
    };
    ROUTERS = [router, ...ROUTERS];
    return delay(router, 600);
  },

  async updateStatus(ids: string[], status: RouterStatus): Promise<void> {
    ROUTERS = ROUTERS.map((r) => (ids.includes(r.id) ? { ...r, status } : r));
    return delay(undefined, 400);
  },

  async remove(ids: string[]): Promise<void> {
    ROUTERS = ROUTERS.filter((r) => !ids.includes(r.id));
    return delay(undefined, 400);
  },

  async reboot(ids: string[]): Promise<void> {
    return delay(undefined, 500);
  },

  async upgrade(ids: string[]): Promise<void> {
    ROUTERS = ROUTERS.map((r) =>
      ids.includes(r.id) ? { ...r, routerOsVersion: r.latestOsVersion } : r,
    );
    return delay(undefined, 800);
  },

  organizations() {
    return ORGS.map(([id, name]) => ({ id, name }));
  },
  locations() {
    return LOCATIONS.map(([id, name]) => ({ id, name }));
  },
  models() {
    return MODELS;
  },

  async connectedDevices(routerId: string): Promise<ConnectedDevice[]> {
    const r = seedRandom(routerId.length + 7);
    const count = 6 + Math.floor(r() * 14);
    const out: ConnectedDevice[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        id: `${routerId}-DEV-${i}`,
        name: ["iPhone 15", "MacBook Pro", "Pixel 8", "Galaxy S24", "iPad Air", "ThinkPad X1", "Chromebook"][i % 7] + ` #${i + 1}`,
        mac: `AA:BB:${(10 + i).toString(16).padStart(2, "0").toUpperCase()}:${(20 + i).toString(16).padStart(2, "0").toUpperCase()}:${(30 + i).toString(16).padStart(2, "0").toUpperCase()}:${(40 + i).toString(16).padStart(2, "0").toUpperCase()}`,
        ip: `10.0.${i}.${100 + i}`,
        guestName: ["Sarah Chen", "Marcus Rivera", "Priya Patel", "Liam Ng", "Ava Reed", "Noah Kim"][i % 6],
        connectedSince: new Date(Date.now() - Math.floor(r() * 3 * 3600 * 1000)).toISOString(),
        downloadMb: Math.floor(r() * 900),
        uploadMb: Math.floor(r() * 200),
        rssi: -30 - Math.floor(r() * 50),
      });
    }
    return delay(out, 250);
  },

  async wireguardPeers(routerId: string): Promise<WireGuardPeer[]> {
    const r = seedRandom(routerId.length + 11);
    const count = 2 + Math.floor(r() * 3);
    const out: WireGuardPeer[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        id: `${routerId}-WG-${i}`,
        name: `peer-${i + 1}`,
        publicKey: `PubKey${Math.floor(r() * 1e10).toString(36)}=`,
        endpoint: `vpn-${i + 1}.cloudguest.io:51820`,
        allowedIps: `10.10.${i}.0/24`,
        lastHandshake: new Date(Date.now() - Math.floor(r() * 600) * 1000).toISOString(),
        status: r() > 0.2 ? "up" : "down",
      });
    }
    return delay(out, 200);
  },

  async alerts(routerId: string): Promise<RouterAlert[]> {
    const r = seedRandom(routerId.length + 5);
    const types: RouterAlert["type"][] = ["cpu", "memory", "offline", "wireguard", "radius", "wan"];
    const titles: Record<RouterAlert["type"], string> = {
      cpu: "High CPU usage sustained",
      memory: "Memory pressure detected",
      offline: "Router offline",
      wireguard: "WireGuard tunnel down",
      radius: "FreeRADIUS authentication failure",
      wan: "WAN link degraded",
    };
    const count = Math.floor(r() * 4);
    const out: RouterAlert[] = [];
    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(r() * types.length)];
      out.push({
        id: `${routerId}-AL-${i}`,
        type: t,
        title: titles[t],
        severity: (["info", "warning", "critical"] as const)[Math.floor(r() * 3)],
        raisedAt: new Date(Date.now() - Math.floor(r() * 86400) * 1000).toISOString(),
      });
    }
    return delay(out, 200);
  },
};
