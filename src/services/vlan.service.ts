import type { Vlan, VlanKpis } from "@/types/vlan";

const now = Date.now();

let VLANS: Vlan[] = [
  {
    id: "vlan_10", vlanId: 10, name: "Guest-WiFi",
    description: "Public guest network segregated from corp traffic.",
    subnet: "10.10.0.0/22", gateway: "10.10.0.1",
    dnsPrimary: "1.1.1.1", dnsSecondary: "8.8.8.8",
    dhcpEnabled: true, dhcpRangeStart: "10.10.0.100", dhcpRangeEnd: "10.10.3.250",
    leaseMinutes: 240, isolation: true, isp: "primary",
    locationIds: ["loc_1", "loc_2", "loc_3"], routerIds: ["rtr_1", "rtr_2"],
    ssids: ["CloudGuest", "CloudGuest-5G"],
    status: "active", createdAt: now - 86_400_000 * 30, updatedAt: now - 86_400_000 * 2,
    clients: 342, throughputMbps: 128,
  },
  {
    id: "vlan_20", vlanId: 20, name: "Staff",
    description: "Employee devices with RADIUS auth.",
    subnet: "10.20.0.0/24", gateway: "10.20.0.1",
    dnsPrimary: "10.20.0.1", dhcpEnabled: true,
    dhcpRangeStart: "10.20.0.50", dhcpRangeEnd: "10.20.0.200",
    leaseMinutes: 1440, isolation: false, isp: "primary",
    locationIds: ["loc_1", "loc_2"], routerIds: ["rtr_1"], ssids: ["CloudCorp"],
    status: "active", createdAt: now - 86_400_000 * 60, updatedAt: now - 86_400_000 * 7,
    clients: 84, throughputMbps: 62,
  },
  {
    id: "vlan_30", vlanId: 30, name: "IoT",
    description: "Sensors, printers and BMS devices.",
    subnet: "10.30.0.0/24", gateway: "10.30.0.1",
    dnsPrimary: "1.1.1.1", dhcpEnabled: true,
    dhcpRangeStart: "10.30.0.10", dhcpRangeEnd: "10.30.0.240",
    leaseMinutes: 2880, isolation: true, isp: "secondary",
    locationIds: ["loc_1"], routerIds: ["rtr_1"], ssids: ["CloudIoT"],
    status: "active", createdAt: now - 86_400_000 * 20, updatedAt: now - 86_400_000,
    clients: 41, throughputMbps: 8,
  },
  {
    id: "vlan_40", vlanId: 40, name: "Premium-WiFi",
    description: "Paid tier — QoS priority, no isolation.",
    subnet: "10.40.0.0/23", gateway: "10.40.0.1",
    dnsPrimary: "1.1.1.1", dnsSecondary: "1.0.0.1",
    dhcpEnabled: true, dhcpRangeStart: "10.40.0.20", dhcpRangeEnd: "10.40.1.240",
    leaseMinutes: 720, isolation: false, isp: "primary",
    locationIds: ["loc_2", "loc_3"], routerIds: ["rtr_2"], ssids: ["CloudPremium"],
    status: "active", createdAt: now - 86_400_000 * 15, updatedAt: now - 86_400_000 * 3,
    clients: 96, throughputMbps: 210,
  },
  {
    id: "vlan_99", vlanId: 99, name: "Mgmt",
    description: "Out-of-band router management.",
    subnet: "192.168.99.0/24", gateway: "192.168.99.1",
    dnsPrimary: "192.168.99.1", dhcpEnabled: false, leaseMinutes: 0,
    isolation: true, isp: "none",
    locationIds: [], routerIds: ["rtr_1", "rtr_2", "rtr_3"], ssids: [],
    status: "active", createdAt: now - 86_400_000 * 120, updatedAt: now - 86_400_000 * 15,
    clients: 3, throughputMbps: 1,
  },
  {
    id: "vlan_50", vlanId: 50, name: "Voice",
    description: "SIP handsets with strict DSCP.",
    subnet: "10.50.0.0/24", gateway: "10.50.0.1",
    dnsPrimary: "10.50.0.1", dhcpEnabled: true,
    dhcpRangeStart: "10.50.0.20", dhcpRangeEnd: "10.50.0.180",
    leaseMinutes: 1440, isolation: false, isp: "primary",
    locationIds: ["loc_1"], routerIds: ["rtr_1"], ssids: [],
    status: "draft", createdAt: now - 86_400_000 * 5, updatedAt: now - 86_400_000,
    clients: 0, throughputMbps: 0,
  },
];

function d<T>(v: T, ms = 220): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export const vlanService = {
  async list(): Promise<Vlan[]> {
    return d([...VLANS]);
  },
  async get(id: string): Promise<Vlan | undefined> {
    return d(VLANS.find((v) => v.id === id));
  },
  async kpis(): Promise<VlanKpis> {
    const active = VLANS.filter((v) => v.status === "active");
    return d({
      total: VLANS.length,
      active: active.length,
      disabled: VLANS.filter((v) => v.status === "disabled").length,
      clients: VLANS.reduce((s, v) => s + v.clients, 0),
      totalThroughputMbps: VLANS.reduce((s, v) => s + v.throughputMbps, 0),
    });
  },
  async create(input: Omit<Vlan, "id" | "createdAt" | "updatedAt" | "clients" | "throughputMbps">): Promise<Vlan> {
    const v: Vlan = {
      ...input,
      id: `vlan_${crypto.randomUUID().slice(0, 8)}`,
      createdAt: Date.now(), updatedAt: Date.now(),
      clients: 0, throughputMbps: 0,
    };
    VLANS = [v, ...VLANS];
    return d(v);
  },
  async update(id: string, patch: Partial<Vlan>): Promise<Vlan> {
    VLANS = VLANS.map((v) => (v.id === id ? { ...v, ...patch, updatedAt: Date.now() } : v));
    return d(VLANS.find((v) => v.id === id)!);
  },
  async remove(id: string): Promise<void> {
    VLANS = VLANS.filter((v) => v.id !== id);
    return d(undefined);
  },
};
