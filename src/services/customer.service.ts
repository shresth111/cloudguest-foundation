import type { SiteType } from "@/types/location";

export interface ExistingCustomer {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  subscription: {
    plan: "trial" | "starter" | "professional" | "enterprise" | "custom";
    billingCycle: "monthly" | "quarterly" | "yearly";
    status: "active" | "trial" | "expired";
    expiryDate: string;
  };
  owner: {
    name: string;
    email: string;
    mobile: string;
    role: "Organization Admin";
    assignedLocations: number;
  };
  locations: Array<{ id: string; name: string; siteType: SiteType; city: string }>;
  status: "active" | "trial" | "suspended";
}

const SEEDED_EXISTING: ExistingCustomer[] = [
  {
    id: "CUST-1001",
    name: "John Hotels Pvt Ltd",
    organizationId: "ORG-01000",
    organizationName: "John Hotels Pvt Ltd",
    subscription: {
      plan: "professional",
      billingCycle: "yearly",
      status: "active",
      expiryDate: new Date(Date.now() + 220 * 86400000).toISOString(),
    },
    owner: {
      name: "John Meyers",
      email: "owner@existing.com",
      mobile: "+91 98200 11223",
      role: "Organization Admin",
      assignedLocations: 5,
    },
    locations: [
      { id: "LOC-90001", name: "Hotel Delhi", siteType: "hotel", city: "Delhi" },
      { id: "LOC-90002", name: "Hotel Mumbai", siteType: "hotel", city: "Mumbai" },
      { id: "LOC-90003", name: "Cafe Jaipur", siteType: "cafe", city: "Jaipur" },
      { id: "LOC-90004", name: "Hospital Noida", siteType: "hospital", city: "Noida" },
      { id: "LOC-90005", name: "Warehouse Pune", siteType: "warehouse", city: "Pune" },
    ],
    status: "active",
  },
  {
    id: "CUST-1002",
    name: "Aurora Retail Group",
    organizationId: "ORG-01001",
    organizationName: "Aurora Retail Group",
    subscription: {
      plan: "enterprise",
      billingCycle: "yearly",
      status: "active",
      expiryDate: new Date(Date.now() + 90 * 86400000).toISOString(),
    },
    owner: {
      name: "Priya Sharma",
      email: "priya@aurora.io",
      mobile: "+91 99010 44521",
      role: "Organization Admin",
      assignedLocations: 2,
    },
    locations: [
      { id: "LOC-90101", name: "Aurora Mall Bengaluru", siteType: "mall", city: "Bengaluru" },
      { id: "LOC-90102", name: "Aurora HQ Office", siteType: "office", city: "Bengaluru" },
    ],
    status: "active",
  },
  {
    id: "CUST-1003",
    name: "Blue Cedar Cafes",
    organizationId: "ORG-01002",
    organizationName: "Blue Cedar Cafes",
    subscription: {
      plan: "starter",
      billingCycle: "monthly",
      status: "trial",
      expiryDate: new Date(Date.now() + 12 * 86400000).toISOString(),
    },
    owner: {
      name: "Rahul Verma",
      email: "rahul@bluecedar.co",
      mobile: "+91 98111 22111",
      role: "Organization Admin",
      assignedLocations: 1,
    },
    locations: [
      { id: "LOC-90201", name: "Blue Cedar Cafe HSR", siteType: "cafe", city: "Bengaluru" },
    ],
    status: "trial",
  },
];

export interface LocationRouter {
  id: string;
  name: string;
  model: string;
  status: "online" | "offline" | "degraded";
  publicIp: string;
  uptime: string;
}
export interface LocationStaff {
  id: string;
  name: string;
  role: string;
  email: string;
  lastActive: string;
}
export interface LocationGuestStat {
  id: string;
  name: string;
  mac: string;
  connectedAt: string;
  dataMb: number;
  device: string;
}
export interface LocationAnalytics {
  activeGuests: number;
  peakConcurrent: number;
  dailySessions: number;
  dataConsumedGb: number;
  topDevice: string;
  satisfaction: number;
}
export interface LocationResources {
  routers: LocationRouter[];
  staff: LocationStaff[];
  guests: LocationGuestStat[];
  analytics: LocationAnalytics;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

function buildResources(locationId: string): LocationResources {
  const h = hash(locationId);
  const routerCount = 2 + (h % 3);
  const guestCount = 4 + (h % 4);
  const staffCount = 3 + (h % 3);
  const models = ["MikroTik hAP ax3", "MikroTik RB5009", "MikroTik CCR2004", "MikroTik hEX S"];
  const devices = ["iPhone", "Android", "MacBook", "Windows Laptop", "iPad"];
  const roles = ["Location Manager", "Front Desk", "IT Support", "Housekeeping Lead"];
  return {
    routers: Array.from({ length: routerCount }, (_, i) => ({
      id: `RTR-${locationId}-${i + 1}`,
      name: `Router ${i + 1}`,
      model: models[(h + i) % models.length],
      status: (["online", "online", "online", "degraded", "offline"] as const)[(h + i) % 5],
      publicIp: `203.0.113.${(h + i * 7) % 250}`,
      uptime: `${1 + ((h + i) % 45)}d ${((h + i * 3) % 24)}h`,
    })),
    staff: Array.from({ length: staffCount }, (_, i) => ({
      id: `USR-${locationId}-${i + 1}`,
      name: ["Anjali Rao", "Manish Gupta", "Sara Khan", "Vikram Singh", "Neha Iyer"][(h + i) % 5],
      role: roles[(h + i) % roles.length],
      email: `staff${i + 1}@${locationId.toLowerCase()}.cloudguest.io`,
      lastActive: `${(h + i) % 24}h ago`,
    })),
    guests: Array.from({ length: guestCount }, (_, i) => ({
      id: `GST-${locationId}-${i + 1}`,
      name: `Guest ${i + 1}`,
      mac: `AA:BB:CC:${((h + i) % 255).toString(16).padStart(2, "0").toUpperCase()}:11:${(i * 7 % 255).toString(16).padStart(2, "0").toUpperCase()}`,
      connectedAt: `${(h + i * 3) % 60}m ago`,
      dataMb: 80 + ((h + i * 13) % 900),
      device: devices[(h + i) % devices.length],
    })),
    analytics: {
      activeGuests: 40 + (h % 260),
      peakConcurrent: 120 + (h % 400),
      dailySessions: 500 + (h % 3500),
      dataConsumedGb: 15 + (h % 180),
      topDevice: devices[h % devices.length],
      satisfaction: 82 + (h % 15),
    },
  };
}

const LOCATION_RESOURCES: Record<string, LocationResources> = {};

function delay<T>(v: T, ms = 500): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export const customerService = {
  async listCustomers(): Promise<ExistingCustomer[]> {
    return delay(SEEDED_EXISTING, 200);
  },

  async getLocationResources(locationId: string): Promise<LocationResources> {
    const seed = LOCATION_RESOURCES[locationId] ?? buildResources(locationId);
    return delay(seed, 200);
  },
};
