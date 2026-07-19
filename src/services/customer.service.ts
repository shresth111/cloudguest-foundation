import { locationService } from "./location.service";
import type { Location, SiteType } from "@/types/location";

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
      { id: "LOC-90005", name: "Warehouse Pune", siteType: "other", city: "Pune" },
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


function delay<T>(v: T, ms = 500): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export interface OwnerCheckResult {
  exists: boolean;
  customer?: ExistingCustomer;
}

export interface ProvisioningPayload {
  lookup: { email: string; mobile?: string };
  property: {
    type: string;
    name: string;
    code: string;
    country: string;
    state: string;
    city: string;
    address: string;
    timezone: string;
    latitude: number;
    longitude: number;
    logoUrl?: string;
  };
  owner: {
    name: string;
    email: string;
    mobile: string;
    username: string;
    tempPassword: string;
    forcePasswordReset: boolean;
    role: "Organization Admin";
  };
  router: {
    serialNumber: string;
    model: string;
    routerOsVersion: string;
    publicIp: string;
    privateIp: string;
    wireGuardEnabled: boolean;
  };
  subscription: {
    plan: "trial" | "starter" | "professional" | "enterprise" | "custom";
    billingCycle: "monthly" | "quarterly" | "yearly";
    expiryDate: string;
    keepExisting?: boolean;
  };
  features: Record<string, boolean>;
  limits: {
    locations: number;
    routers: number;
    guests: number;
    concurrentSessions: number;
    staffUsers: number;
    apiKeys: number;
    storageGb: number;
    smsCredits: number;
    emailCredits: number;
  };
  isExistingCustomer: boolean;
  existingCustomerId?: string;
}

export interface ProvisioningResult {
  customerId: string;
  organizationId: string;
  locationId: string;
  ownerUsername: string;
  ownerTempPassword: string;
  loginUrl: string;
  isNew: boolean;
}

export const customerService = {
  async checkOwner(email: string): Promise<OwnerCheckResult> {
    const found = SEEDED_EXISTING.find(
      (c) => c.owner.email.toLowerCase() === email.trim().toLowerCase(),
    );
    return delay(found ? { exists: true, customer: found } : { exists: false }, 700);
  },

  async listCustomers(): Promise<ExistingCustomer[]> {
    return delay(SEEDED_EXISTING, 200);
  },

  async provision(payload: ProvisioningPayload): Promise<ProvisioningResult> {
    // Add the location into the location service so it appears in tables.
    try {
      const loc = await locationService.create({
        basic: {
          name: payload.property.name,
          organizationId: payload.isExistingCustomer
            ? payload.existingCustomerId ?? "ORG-01000"
            : "ORG-01000",
          siteType: (payload.property.type as SiteType) ?? "hotel",
        },
        address: {
          country: payload.property.country,
          state: payload.property.state,
          city: payload.property.city,
          address: payload.property.address,
          zipCode: "00000",
          latitude: payload.property.latitude || 0,
          longitude: payload.property.longitude || 0,
          timezone: payload.property.timezone,
        },
        network: {
          isp: "Provisioned",
          primaryWan: "Fiber 500Mbps",
          internetSpeedMbps: 500,
          publicIp: payload.router.publicIp || "203.0.113.1",
          dns: "8.8.8.8, 1.1.1.1",
        },
        settings: {
          guestWifiEnabled: payload.features.guestWifi ?? true,
          captivePortalEnabled: payload.features.captivePortal ?? true,
          voucherLogin: payload.features.voucherLogin ?? false,
          otpLogin: payload.features.mobileOtp ?? true,
          pmsIntegration: payload.features.pms ?? false,
          socialLogin: payload.features.socialLogin ?? false,
        },
      });

      // Add to existing customer's locations list if applicable
      if (payload.isExistingCustomer && payload.existingCustomerId) {
        const cust = SEEDED_EXISTING.find((c) => c.id === payload.existingCustomerId);
        if (cust) {
          cust.locations = [
            ...cust.locations,
            {
              id: loc.id,
              name: payload.property.name,
              siteType: (payload.property.type as SiteType) ?? "hotel",
              city: payload.property.city,
            },
          ];
          cust.owner.assignedLocations = cust.locations.length;
        }
      }

      return delay(
        {
          customerId: payload.isExistingCustomer
            ? payload.existingCustomerId ?? "CUST-1001"
            : `CUST-${Math.floor(2000 + Math.random() * 8000)}`,
          organizationId: loc.organizationId,
          locationId: loc.id,
          ownerUsername: payload.owner.username,
          ownerTempPassword: payload.owner.tempPassword,
          loginUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/login`,
          isNew: !payload.isExistingCustomer,
        },
        400,
      );
    } catch (e) {
      throw e;
    }
  },

  seededExistingEmail: "owner@existing.com",
};

export function generateUsername(name: string, email: string): string {
  const base =
    (name || email.split("@")[0] || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || "user";
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${base}.${suffix}`;
}

export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const cryptoObj =
    typeof crypto !== "undefined" && "getRandomValues" in crypto ? crypto : null;
  const rand = cryptoObj
    ? () => {
        const arr = new Uint32Array(1);
        cryptoObj.getRandomValues(arr);
        return arr[0] / 2 ** 32;
      }
    : Math.random;
  for (let i = 0; i < length; i++) out += chars[Math.floor(rand() * chars.length)];
  return out;
}

export function generateLocationCode(type: string, city: string): string {
  const t = (type || "loc").slice(0, 3).toUpperCase();
  const c = (city || "xxx").slice(0, 3).toUpperCase();
  const n = Math.floor(1000 + Math.random() * 8999);
  return `${t}-${c}-${n}`;
}
