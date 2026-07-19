import type {
  CreateLocationPayload,
  Location,
  LocationListQuery,
  LocationListResult,
  LocationStatus,
  SiteType,
} from "@/types/location";

const CITIES: Array<[string, string, string, string, number, number]> = [
  ["USA", "California", "San Francisco", "America/Los_Angeles", 37.7749, -122.4194],
  ["USA", "New York", "New York", "America/New_York", 40.7128, -74.006],
  ["UK", "England", "London", "Europe/London", 51.5074, -0.1278],
  ["India", "Karnataka", "Bengaluru", "Asia/Kolkata", 12.9716, 77.5946],
  ["Singapore", "Central", "Singapore", "Asia/Singapore", 1.3521, 103.8198],
  ["UAE", "Dubai", "Dubai", "Asia/Dubai", 25.2048, 55.2708],
  ["Germany", "Bavaria", "Munich", "Europe/Berlin", 48.1351, 11.582],
  ["Australia", "NSW", "Sydney", "Australia/Sydney", -33.8688, 151.2093],
];

const SITE_TYPES: SiteType[] = ["hotel", "cafe", "restaurant", "hospital", "school", "office", "mall", "airport"];
const STATUSES: LocationStatus[] = ["active", "active", "active", "active", "maintenance", "offline", "pending", "suspended", "inactive"];
const ORGS = [
  ["ORG-01000", "Nimbus Hospitality"],
  ["ORG-01001", "Vertex Retail"],
  ["ORG-01002", "Halo Group"],
  ["ORG-01003", "Orbit Holdings"],
  ["ORG-01004", "Lumen Ventures"],
  ["ORG-01005", "Cascade Networks"],
];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRandom(101);

function generate(count: number): Location[] {
  const out: Location[] = [];
  for (let i = 0; i < count; i++) {
    const [country, state, city, tz, lat, lng] = CITIES[i % CITIES.length];
    const [orgId, orgName] = ORGS[i % ORGS.length];
    const siteType = SITE_TYPES[i % SITE_TYPES.length];
    const status = STATUSES[i % STATUSES.length];
    const created = new Date(Date.now() - Math.floor(rand() * 500) * 86400000);
    const internet: Location["internetStatus"] =
      status === "offline" ? "offline" : status === "maintenance" ? "degraded" : "online";
    out.push({
      id: `LOC-${String(2000 + i).padStart(5, "0")}`,
      name: `${orgName.split(" ")[0]} ${city} ${["Downtown", "Airport", "Central", "Riverside", "North", "South", "Plaza"][i % 7]}`,
      organizationId: orgId,
      organizationName: orgName,
      siteType,
      country,
      state,
      city,
      address: `${100 + i} ${["Market", "King", "Queen", "Broadway", "Park"][i % 5]} Street`,
      zipCode: `${94000 + i}`,
      latitude: lat + (rand() - 0.5) * 0.4,
      longitude: lng + (rand() - 0.5) * 0.4,
      timezone: tz,
      isp: ["Comcast", "Airtel", "Jio", "AT&T", "BT", "Etisalat", "Deutsche Telekom"][i % 7],
      primaryWan: `${["FTTH", "MPLS", "LTE", "Fiber"][i % 4]} ${100 + Math.floor(rand() * 900)}Mbps`,
      secondaryWan: i % 3 === 0 ? "LTE Failover 50Mbps" : undefined,
      internetSpeedMbps: 100 + Math.floor(rand() * 900),
      publicIp: `${10 + (i % 240)}.${Math.floor(rand() * 250)}.${Math.floor(rand() * 250)}.${1 + (i % 250)}`,
      dns: ["8.8.8.8, 8.8.4.4", "1.1.1.1, 1.0.0.1", "9.9.9.9"][i % 3],
      routerCount: 1 + Math.floor(rand() * 20),
      activeGuests: Math.floor(rand() * 800),
      todaysSessions: Math.floor(rand() * 4000),
      bandwidthUsageMbps: Math.floor(rand() * 900),
      uptimePct: 95 + Math.round(rand() * 50) / 10,
      activeAlerts: Math.floor(rand() * 6),
      guestWifiEnabled: rand() > 0.15,
      captivePortalEnabled: rand() > 0.2,
      voucherLogin: rand() > 0.5,
      otpLogin: rand() > 0.4,
      pmsIntegration: siteType === "hotel" && rand() > 0.4,
      socialLogin: rand() > 0.5,
      internetStatus: internet,
      subscriptionStatus: (["active", "active", "trial", "expired"] as const)[i % 4],
      status,
      createdAt: created.toISOString(),
    });
  }
  return out;
}

let LOCATIONS: Location[] = generate(64);

function delay<T>(v: T, ms = 300): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), ms));
}

export const locationService = {
  async list(q: LocationListQuery): Promise<LocationListResult> {
    let rows = [...LOCATIONS];
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s) ||
          r.city.toLowerCase().includes(s) ||
          r.organizationName.toLowerCase().includes(s) ||
          r.address.toLowerCase().includes(s),
      );
    }
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    if (q.siteType && q.siteType !== "all") rows = rows.filter((r) => r.siteType === q.siteType);
    if (q.organizationId && q.organizationId !== "all") rows = rows.filter((r) => r.organizationId === q.organizationId);
    if (q.country && q.country !== "all") rows = rows.filter((r) => r.country === q.country);
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

  async listAll(): Promise<Location[]> {
    return delay([...LOCATIONS], 200);
  },

  async get(id: string): Promise<Location | null> {
    return delay(LOCATIONS.find((r) => r.id === id) ?? null);
  },

  async create(payload: CreateLocationPayload): Promise<Location> {
    const id = `LOC-${String(20000 + LOCATIONS.length).padStart(5, "0")}`;
    const org = ORGS.find(([oid]) => oid === payload.basic.organizationId) ?? ORGS[0];
    const location: Location = {
      id,
      name: payload.basic.name,
      organizationId: org[0],
      organizationName: org[1],
      siteType: payload.basic.siteType,
      country: payload.address.country,
      state: payload.address.state,
      city: payload.address.city,
      address: payload.address.address,
      zipCode: payload.address.zipCode,
      latitude: payload.address.latitude,
      longitude: payload.address.longitude,
      timezone: payload.address.timezone,
      isp: payload.network.isp,
      primaryWan: payload.network.primaryWan,
      secondaryWan: payload.network.secondaryWan,
      internetSpeedMbps: payload.network.internetSpeedMbps,
      publicIp: payload.network.publicIp,
      dns: payload.network.dns,
      routerCount: 0,
      activeGuests: 0,
      todaysSessions: 0,
      bandwidthUsageMbps: 0,
      uptimePct: 100,
      activeAlerts: 0,
      guestWifiEnabled: payload.settings.guestWifiEnabled,
      captivePortalEnabled: payload.settings.captivePortalEnabled,
      voucherLogin: payload.settings.voucherLogin,
      otpLogin: payload.settings.otpLogin,
      pmsIntegration: payload.settings.pmsIntegration,
      socialLogin: payload.settings.socialLogin,
      internetStatus: "online",
      subscriptionStatus: "active",
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    LOCATIONS = [location, ...LOCATIONS];
    return delay(location, 600);
  },

  async updateStatus(ids: string[], status: LocationStatus): Promise<void> {
    LOCATIONS = LOCATIONS.map((r) => (ids.includes(r.id) ? { ...r, status } : r));
    return delay(undefined, 400);
  },

  async remove(ids: string[]): Promise<void> {
    LOCATIONS = LOCATIONS.filter((r) => !ids.includes(r.id));
    return delay(undefined, 400);
  },

  async clone(id: string): Promise<Location | null> {
    const src = LOCATIONS.find((r) => r.id === id);
    if (!src) return null;
    const newId = `LOC-${String(20000 + LOCATIONS.length).padStart(5, "0")}`;
    const clone: Location = {
      ...src,
      id: newId,
      name: `${src.name} (Copy)`,
      status: "pending",
      createdAt: new Date().toISOString(),
      activeGuests: 0,
      todaysSessions: 0,
      activeAlerts: 0,
    };
    LOCATIONS = [clone, ...LOCATIONS];
    return delay(clone, 500);
  },

  organizations() {
    return ORGS.map(([id, name]) => ({ id, name }));
  },

  countries() {
    return Array.from(new Set(CITIES.map((c) => c[0])));
  },
};
