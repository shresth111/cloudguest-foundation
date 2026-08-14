/**
 * Static placeholder data for the Super Admin (Master) dashboard. This is
 * the seam a per-resource TanStack Query hook against the platform API
 * replaces -- shape mirrors what those endpoints are expected to return.
 */

export interface Customer {
  id: string;
  name: string;
  type: "Hotel" | "Cafe" | "Mall" | "Hospital" | "Co-working" | "Retail";
  email: string;
  phone: string;
  plan: "Starter" | "Growth" | "Enterprise";
  locations: number;
  online: number;
  mrr: number;
  status: "active" | "trial" | "suspended";
  since: string;
  region: string;
  modules: string[];
}

export interface PlatformLocation {
  id: string;
  code: string; // type-prefixed series code, e.g. HT001
  client: string;
  type: Customer["type"];
  region: string;
  online: number;
  status: "online" | "degraded" | "offline";
}

export interface Invoice {
  id: string;
  customer: string;
  plan: Customer["plan"];
  amount: number;
  date: string;
  status: "paid" | "due" | "overdue";
}

export interface FleetRouter {
  id: string;
  name: string;
  ip: string;
  model: string;
  customer: string;
  location: string;
  firmware: string;
  firmwareLatest: boolean;
  clients: number;
  uptime: string;
  status: "online" | "degraded" | "offline";
}

export interface Ticket {
  id: string;
  subject: string;
  customer: string;
  priority: "Urgent" | "High" | "Normal";
  status: "Open" | "Pending" | "Resolved";
  assignee: string;
  updated: string;
}

export interface NasNode {
  id: string;
  host: string;
  region: string;
  authPerSec: number;
  latencyMs: number;
  status: "online" | "degraded";
}

export const MODULES = [
  "Dashboard", "Users", "Analytics", "Reports", "Campaigns", "Portal", "Vouchers",
  "Policies", "Whitelist", "Devices", "Teams", "Agents", "Networking", "Hotspot",
  "DHCP", "VLANs", "Port Forwarding", "VOIP", "ISP Routing", "RaaS", "Alerts",
];

export const CUSTOMERS: Customer[] = [
  { id: "c-1", name: "The Hosteller", type: "Hotel", email: "ops@thehosteller.com", phone: "+91 98450 11223", plan: "Enterprise", locations: 12, online: 486, mrr: 2400, status: "active", since: "Mar 2024", region: "South", modules: ["Dashboard","Users","Analytics","Vouchers","Hotspot","RaaS","Campaigns","Portal"] },
  { id: "c-2", name: "Third Wave Coffee", type: "Cafe", email: "it@thirdwave.in", phone: "+91 90080 44556", plan: "Growth", locations: 34, online: 812, mrr: 1700, status: "active", since: "Jul 2024", region: "West", modules: ["Dashboard","Users","Analytics","Vouchers","Portal"] },
  { id: "c-3", name: "Phoenix Marketcity", type: "Mall", email: "facilities@phoenix.com", phone: "+91 91670 88991", plan: "Enterprise", locations: 6, online: 1240, mrr: 3100, status: "active", since: "Jan 2024", region: "West", modules: ["Dashboard","Users","Analytics","Hotspot","VLANs","ISP Routing","Alerts"] },
  { id: "c-4", name: "Apollo Hospitals", type: "Hospital", email: "network@apollo.com", phone: "+91 93810 22114", plan: "Enterprise", locations: 9, online: 640, mrr: 2900, status: "active", since: "Nov 2023", region: "South", modules: ["Dashboard","Users","Policies","VLANs","Whitelist","Alerts"] },
  { id: "c-5", name: "WeWork India", type: "Co-working", email: "ops@wework.co.in", phone: "+91 99720 55447", plan: "Growth", locations: 22, online: 930, mrr: 1900, status: "trial", since: "Jun 2026", region: "North", modules: ["Dashboard","Users","Analytics","Vouchers"] },
  { id: "c-6", name: "Reliance Trends", type: "Retail", email: "wifi@trends.com", phone: "+91 90040 33220", plan: "Starter", locations: 48, online: 210, mrr: 900, status: "suspended", since: "Feb 2025", region: "North", modules: ["Dashboard","Users","Portal"] },
  { id: "c-7", name: "Chai Point", type: "Cafe", email: "tech@chaipoint.com", phone: "+91 97310 66558", plan: "Growth", locations: 51, online: 388, mrr: 1500, status: "active", since: "Sep 2024", region: "South", modules: ["Dashboard","Users","Analytics","Vouchers","Campaigns"] },
  { id: "c-8", name: "Lemon Tree Hotels", type: "Hotel", email: "corp.it@lemontree.com", phone: "+91 98110 99002", plan: "Enterprise", locations: 18, online: 720, mrr: 3300, status: "active", since: "Apr 2024", region: "North", modules: ["Dashboard","Users","Analytics","Hotspot","RaaS","Portal","Alerts"] },
];

const CODE_PREFIX: Record<Customer["type"], string> = {
  Hotel: "HT", Cafe: "CAFE", Mall: "MALL", Hospital: "HOSP", "Co-working": "COWK", Retail: "RTL",
};

export function seriesCode(type: Customer["type"], n: number): string {
  return `${CODE_PREFIX[type]}${String(n).padStart(3, "0")}`;
}

export const LOCATIONS: PlatformLocation[] = [
  { id: "l-1", code: "HT001", client: "The Hosteller", type: "Hotel", region: "South", online: 48, status: "online" },
  { id: "l-2", code: "HT002", client: "The Hosteller", type: "Hotel", region: "South", online: 33, status: "online" },
  { id: "l-3", code: "CAFE001", client: "Third Wave Coffee", type: "Cafe", region: "West", online: 21, status: "online" },
  { id: "l-4", code: "CAFE014", client: "Third Wave Coffee", type: "Cafe", region: "West", online: 0, status: "offline" },
  { id: "l-5", code: "MALL001", client: "Phoenix Marketcity", type: "Mall", region: "West", online: 412, status: "online" },
  { id: "l-6", code: "HOSP002", client: "Apollo Hospitals", type: "Hospital", region: "South", online: 96, status: "degraded" },
  { id: "l-7", code: "COWK007", client: "WeWork India", type: "Co-working", region: "North", online: 128, status: "online" },
  { id: "l-8", code: "RTL021", client: "Reliance Trends", type: "Retail", region: "North", online: 0, status: "offline" },
];

export const INVOICES: Invoice[] = [
  { id: "INV-2041", customer: "The Hosteller", plan: "Enterprise", amount: 2400, date: "01 Jul 2026", status: "paid" },
  { id: "INV-2042", customer: "Phoenix Marketcity", plan: "Enterprise", amount: 3100, date: "01 Jul 2026", status: "paid" },
  { id: "INV-2043", customer: "Third Wave Coffee", plan: "Growth", amount: 1700, date: "03 Jul 2026", status: "due" },
  { id: "INV-2044", customer: "Reliance Trends", plan: "Starter", amount: 900, date: "20 Jun 2026", status: "overdue" },
  { id: "INV-2045", customer: "Lemon Tree Hotels", plan: "Enterprise", amount: 3300, date: "01 Jul 2026", status: "paid" },
  { id: "INV-2046", customer: "Chai Point", plan: "Growth", amount: 1500, date: "05 Jul 2026", status: "due" },
];

export const ROUTERS: FleetRouter[] = [
  { id: "r-1", name: "HT001-CORE", ip: "10.20.1.1", model: "RB5009", customer: "The Hosteller", location: "HT001", firmware: "7.15.2", firmwareLatest: true, clients: 142, uptime: "42d", status: "online" },
  { id: "r-2", name: "MALL001-EDGE", ip: "10.30.1.1", model: "CCR2004", customer: "Phoenix Marketcity", location: "MALL001", firmware: "7.14.0", firmwareLatest: false, clients: 380, uptime: "88d", status: "online" },
  { id: "r-3", name: "HOSP002-A", ip: "10.40.2.1", model: "RB5009", customer: "Apollo Hospitals", location: "HOSP002", firmware: "7.15.2", firmwareLatest: true, clients: 96, uptime: "12d", status: "degraded" },
  { id: "r-4", name: "CAFE014-AP", ip: "10.50.14.1", model: "hAP ax3", customer: "Third Wave Coffee", location: "CAFE014", firmware: "7.13.5", firmwareLatest: false, clients: 0, uptime: "—", status: "offline" },
  { id: "r-5", name: "COWK007-CORE", ip: "10.60.7.1", model: "RB5009", customer: "WeWork India", location: "COWK007", firmware: "7.15.2", firmwareLatest: true, clients: 128, uptime: "27d", status: "online" },
];

export const TICKETS: Ticket[] = [
  { id: "TK-8801", subject: "OTP not delivering on Airtel", customer: "The Hosteller", priority: "Urgent", status: "Open", assignee: "Neha", updated: "6 min ago" },
  { id: "TK-8802", subject: "Portal logo not updating", customer: "Chai Point", priority: "Normal", status: "Pending", assignee: "Rohan", updated: "1 hour ago" },
  { id: "TK-8803", subject: "Router HOSP002-A keeps rebooting", customer: "Apollo Hospitals", priority: "High", status: "Open", assignee: "Neha", updated: "2 hours ago" },
  { id: "TK-8804", subject: "Add VLAN for staff network", customer: "WeWork India", priority: "Normal", status: "Resolved", assignee: "Amir", updated: "yesterday" },
  { id: "TK-8805", subject: "Billing overdue reminder dispute", customer: "Reliance Trends", priority: "High", status: "Pending", assignee: "Rohan", updated: "yesterday" },
];

export const NAS_NODES: NasNode[] = [
  { id: "n-1", host: "radius-blr-1", region: "South", authPerSec: 214, latencyMs: 12, status: "online" },
  { id: "n-2", host: "radius-mum-1", region: "West", authPerSec: 331, latencyMs: 9, status: "online" },
  { id: "n-3", host: "radius-del-1", region: "North", authPerSec: 188, latencyMs: 21, status: "degraded" },
];

export const REGIONS = [
  { region: "South", tenants: 3 },
  { region: "West", tenants: 2 },
  { region: "North", tenants: 3 },
  { region: "East", tenants: 1 },
];

// 24h platform sessions (synthetic, smooth-ish curve)
export const SESSIONS_24H = [
  1200, 980, 760, 640, 590, 620, 910, 1480, 2100, 2680, 3020, 3180,
  3240, 3160, 3010, 2980, 3120, 3360, 3520, 3410, 2980, 2440, 1880, 1460,
].map((v, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, sessions: v }));

export const PLATFORM_KPIS = [
  { key: "tenants", label: "Tenants", value: "8", delta: "+2 this month" },
  { key: "locations", label: "Active Locations", value: "200", delta: "+14" },
  { key: "online", label: "Online Users", value: "5,426", delta: "live" },
  { key: "mrr", label: "MRR", value: "$17.7k", delta: "+8.4%" },
  { key: "routers", label: "Routers Online", value: "182/196", delta: "93%" },
  { key: "radius", label: "RADIUS Auth/s", value: "733", delta: "nominal" },
  { key: "incidents", label: "Open Incidents", value: "3", delta: "1 urgent" },
  { key: "trials", label: "Trials", value: "1", delta: "expiring 7d" },
];
