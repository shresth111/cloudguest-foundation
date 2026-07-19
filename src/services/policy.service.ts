import type { Policy, PolicyKpis, PolicyScope } from "@/types/policy";

const now = Date.now();

let POLICIES: Policy[] = [
  {
    id: "pol_1", scope: "location", name: "Flagship Hotel — Guest",
    description: "Standard guest policy for the flagship hotel property.",
    status: "active", priority: 10,
    bandwidth: { downloadKbps: 8_000, uploadKbps: 4_000, burstDownloadKbps: 20_000 },
    quota: { dailyMB: 2_000, dailyMinutes: 720 },
    device: { maxDevicesPerGuest: 3, allowBYOD: true, blockedOSes: [] },
    authMethods: ["otp_sms", "voucher", "social"],
    timeWindow: { start: "00:00", end: "23:59", days: [0,1,2,3,4,5,6] },
    locationIds: ["loc_1"], userIds: [], groupIds: [], vlanIds: ["vlan_10"],
    createdAt: now - 86_400_000 * 20, updatedAt: now - 86_400_000,
  },
  {
    id: "pol_2", scope: "location", name: "Airport Lounge — Premium",
    description: "High-throughput policy bound to Premium VLAN.",
    status: "active", priority: 20,
    bandwidth: { downloadKbps: 50_000, uploadKbps: 25_000 },
    quota: { sessionMinutes: 240 },
    device: { maxDevicesPerGuest: 5, allowBYOD: true, blockedOSes: [] },
    authMethods: ["otp_email", "voucher", "pms"],
    locationIds: ["loc_2", "loc_3"], userIds: [], groupIds: [], vlanIds: ["vlan_40"],
    createdAt: now - 86_400_000 * 10, updatedAt: now - 86_400_000 * 2,
  },
  {
    id: "pol_3", scope: "user", name: "VIP Guests",
    description: "Unlimited access for VIP profiles.",
    status: "active", priority: 5,
    bandwidth: { downloadKbps: 100_000, uploadKbps: 50_000 },
    quota: {},
    device: { maxDevicesPerGuest: 10, allowBYOD: true, blockedOSes: [] },
    authMethods: ["otp_sms", "otp_email", "click_through"],
    locationIds: [], userIds: ["u_vip1", "u_vip2", "u_vip3"], groupIds: [], vlanIds: [],
    createdAt: now - 86_400_000 * 30, updatedAt: now - 86_400_000 * 5,
  },
  {
    id: "pol_4", scope: "user", name: "Blocked Repeat Offenders",
    description: "Manually blocked identities.",
    status: "active", priority: 1,
    bandwidth: { downloadKbps: 0, uploadKbps: 0 },
    quota: { dailyMB: 0 },
    device: { maxDevicesPerGuest: 0, allowBYOD: false, blockedOSes: [] },
    authMethods: [],
    locationIds: [], userIds: ["u_b1", "u_b2"], groupIds: [], vlanIds: [],
    createdAt: now - 86_400_000 * 15, updatedAt: now - 86_400_000 * 3,
  },
  {
    id: "pol_5", scope: "group", name: "Staff — Corporate",
    description: "Employees with RADIUS authentication.",
    status: "active", priority: 30,
    bandwidth: { downloadKbps: 30_000, uploadKbps: 15_000 },
    quota: {},
    device: { maxDevicesPerGuest: 4, allowBYOD: true, blockedOSes: [] },
    authMethods: ["radius"],
    locationIds: ["loc_1", "loc_2"], userIds: [], groupIds: ["grp_staff"], vlanIds: ["vlan_20"],
    createdAt: now - 86_400_000 * 60, updatedAt: now - 86_400_000 * 10,
  },
  {
    id: "pol_6", scope: "group", name: "Contractors",
    description: "Time-boxed access for on-site contractors.",
    status: "draft", priority: 40,
    bandwidth: { downloadKbps: 5_000, uploadKbps: 2_500 },
    quota: { dailyMinutes: 480 },
    device: { maxDevicesPerGuest: 2, allowBYOD: true, blockedOSes: [] },
    authMethods: ["voucher"],
    timeWindow: { start: "08:00", end: "18:00", days: [1,2,3,4,5] },
    locationIds: ["loc_1"], userIds: [], groupIds: ["grp_contractors"], vlanIds: ["vlan_10"],
    createdAt: now - 86_400_000 * 5, updatedAt: now - 86_400_000,
  },
];

function d<T>(v: T, ms = 220): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

function computeTargets(p: Policy): number {
  if (p.scope === "location") return p.locationIds.length;
  if (p.scope === "user") return p.userIds.length;
  return p.groupIds.length;
}

export const policyService = {
  async list(scope?: PolicyScope): Promise<Policy[]> {
    return d(scope ? POLICIES.filter((p) => p.scope === scope) : [...POLICIES]);
  },
  async get(id: string): Promise<Policy | undefined> {
    return d(POLICIES.find((p) => p.id === id));
  },
  async kpis(scope?: PolicyScope): Promise<PolicyKpis> {
    const src = scope ? POLICIES.filter((p) => p.scope === scope) : POLICIES;
    return d({
      total: src.length,
      active: src.filter((p) => p.status === "active").length,
      draft: src.filter((p) => p.status === "draft").length,
      assignedTargets: src.reduce((s, p) => s + computeTargets(p), 0),
    });
  },
  async create(input: Omit<Policy, "id" | "createdAt" | "updatedAt">): Promise<Policy> {
    const p: Policy = {
      ...input,
      id: `pol_${crypto.randomUUID().slice(0, 8)}`,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    POLICIES = [p, ...POLICIES];
    return d(p);
  },
  async update(id: string, patch: Partial<Policy>): Promise<Policy> {
    POLICIES = POLICIES.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p));
    return d(POLICIES.find((p) => p.id === id)!);
  },
  async remove(id: string): Promise<void> {
    POLICIES = POLICIES.filter((p) => p.id !== id);
    return d(undefined);
  },
};
