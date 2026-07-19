import type {
  CreateOrgPayload,
  OrgListQuery,
  OrgListResult,
  OrgStatus,
  Organization,
} from "@/types/organization";

const INDUSTRIES = ["Hospitality", "Retail", "Education", "Healthcare", "F&B", "Coworking", "Transport"];
const CITIES = [
  ["USA", "California", "San Francisco", "America/Los_Angeles"],
  ["USA", "New York", "New York", "America/New_York"],
  ["UK", "England", "London", "Europe/London"],
  ["India", "Karnataka", "Bengaluru", "Asia/Kolkata"],
  ["Singapore", "Central", "Singapore", "Asia/Singapore"],
  ["UAE", "Dubai", "Dubai", "Asia/Dubai"],
  ["Germany", "Bavaria", "Munich", "Europe/Berlin"],
];
const PLANS: Organization["plan"][] = ["starter", "growth", "business", "enterprise"];
const STATUSES: OrgStatus[] = ["active", "active", "active", "trial", "suspended", "expired", "pending_verification"];

function seedRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRandom(42);

function generate(count: number): Organization[] {
  const out: Organization[] = [];
  for (let i = 0; i < count; i++) {
    const [country, state, city, tz] = CITIES[i % CITIES.length];
    const plan = PLANS[i % PLANS.length];
    const status = STATUSES[i % STATUSES.length];
    const industry = INDUSTRIES[i % INDUSTRIES.length];
    const created = new Date(Date.now() - Math.floor(rand() * 400) * 86400000);
    const expiry = new Date(created.getTime() + 365 * 86400000);
    out.push({
      id: `ORG-${String(1000 + i).padStart(5, "0")}`,
      name: `${["Nimbus", "Vertex", "Halo", "Orbit", "Lumen", "Cascade", "Atlas", "Meridian"][i % 8]} ${["Hospitality", "Retail", "Group", "Holdings", "Ventures", "Networks"][i % 6]}`,
      businessName: `${["Nimbus", "Vertex", "Halo", "Orbit", "Lumen", "Cascade", "Atlas", "Meridian"][i % 8]} Pvt Ltd`,
      type: (["enterprise", "smb", "hospitality", "retail", "education", "healthcare"] as const)[i % 6],
      industry,
      companySize: ["1-10", "11-50", "51-200", "201-500", "500+"][i % 5],
      gstNumber: `29ABCDE${1000 + i}F1Z5`,
      website: `https://${["nimbus", "vertex", "halo", "orbit", "lumen"][i % 5]}.io`,
      contactName: ["Ava Chen", "Marco Silva", "Priya Rao", "Liam O'Neil", "Sara Kim"][i % 5],
      contactEmail: `contact${i}@${["nimbus", "vertex", "halo"][i % 3]}.io`,
      contactPhone: `+1 415 555 0${100 + i}`,
      contactDesignation: ["Founder", "IT Director", "COO", "GM", "CTO"][i % 5],
      country,
      state,
      city,
      address: `${100 + i} Market Street`,
      zipCode: `${94000 + i}`,
      timezone: tz,
      plan,
      billingCycle: (["monthly", "quarterly", "annual"] as const)[i % 3],
      trial: status === "trial",
      expiryDate: expiry.toISOString(),
      activeLocations: 2 + Math.floor(rand() * 40),
      activeRouters: 4 + Math.floor(rand() * 120),
      activeGuests: 50 + Math.floor(rand() * 5000),
      monthlyRevenue: 200 + Math.floor(rand() * 12000),
      activeSessions: Math.floor(rand() * 400),
      uptimePct: 97 + Math.round(rand() * 30) / 10,
      status,
      createdAt: created.toISOString(),
    });
  }
  return out;
}

let ORGS: Organization[] = generate(87);

function delay<T>(v: T, ms = 300): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), ms));
}

export const organizationService = {
  async list(q: OrgListQuery): Promise<OrgListResult> {
    let rows = [...ORGS];
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.id.toLowerCase().includes(s) ||
          r.contactEmail.toLowerCase().includes(s) ||
          r.contactName.toLowerCase().includes(s),
      );
    }
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    if (q.plan && q.plan !== "all") rows = rows.filter((r) => r.plan === q.plan);
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

  async get(id: string): Promise<Organization | null> {
    return delay(ORGS.find((r) => r.id === id) ?? null);
  },

  async create(payload: CreateOrgPayload): Promise<Organization> {
    const id = `ORG-${String(10000 + ORGS.length).padStart(5, "0")}`;
    const now = new Date();
    const org: Organization = {
      id,
      name: payload.basic.name,
      businessName: payload.basic.businessName,
      type: "enterprise",
      industry: payload.basic.industry,
      companySize: payload.basic.companySize,
      gstNumber: payload.basic.gstNumber,
      website: payload.basic.website,
      contactName: payload.contact.contactName,
      contactEmail: payload.contact.contactEmail,
      contactPhone: payload.contact.contactPhone,
      contactDesignation: payload.contact.contactDesignation,
      country: payload.address.country,
      state: payload.address.state,
      city: payload.address.city,
      address: payload.address.address,
      zipCode: payload.address.zipCode,
      timezone: payload.address.timezone,
      plan: payload.subscription.plan,
      billingCycle: payload.subscription.billingCycle,
      trial: payload.subscription.trial,
      expiryDate: payload.subscription.expiryDate,
      activeLocations: 0,
      activeRouters: 0,
      activeGuests: 0,
      monthlyRevenue: 0,
      activeSessions: 0,
      uptimePct: 100,
      status: payload.subscription.trial ? "trial" : "pending_verification",
      createdAt: now.toISOString(),
    };
    ORGS = [org, ...ORGS];
    return delay(org, 600);
  },

  async updateStatus(ids: string[], status: OrgStatus): Promise<void> {
    ORGS = ORGS.map((r) => (ids.includes(r.id) ? { ...r, status } : r));
    return delay(undefined, 400);
  },

  async remove(ids: string[]): Promise<void> {
    ORGS = ORGS.filter((r) => !ids.includes(r.id));
    return delay(undefined, 400);
  },

  async resetAdminPassword(id: string): Promise<{ tempPassword: string }> {
    void id;
    return delay({ tempPassword: `Temp!${Math.random().toString(36).slice(2, 10)}` }, 500);
  },
};
