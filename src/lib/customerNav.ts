import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, BarChart3, FileText, Megaphone, Palette, Ticket, ShieldCheck, Shield,
  Monitor, UsersRound, Bot, Network, Settings2, Bell, Clock, BellRing, Zap, Globe, ScrollText,
  ClipboardList, Fingerprint, ArrowRightLeft, Server, Layers, PhoneCall, Route as RouteIcon, Bug,
  Rss, Gauge, UserCog, FileBarChart, LifeBuoy,
} from "lucide-react";

export type CustomerLoginRole = "owner" | "agent";

export interface CustomerNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: CustomerLoginRole[];
}

/** Single source of truth for the customer-workspace sidebar — shared by
 * the dashboard, users, and feature routes so they can't drift out of sync
 * with each other again. */
export const CUSTOMER_NAVS: CustomerNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "agent"] },
  { id: "users", label: "Users", icon: Users, roles: ["owner", "agent"] },
  { id: "analytics", label: "Analytics", icon: BarChart3, roles: ["owner", "agent"] },
  { id: "reports", label: "Reports", icon: FileText, roles: ["owner", "agent"] },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, roles: ["owner"] },
  { id: "portal", label: "Portal", icon: Palette, roles: ["owner"] },
  { id: "vouchers", label: "Vouchers", icon: Ticket, roles: ["owner", "agent"] },
  { id: "policies", label: "Policies", icon: ShieldCheck, roles: ["owner"] },
  { id: "whitelist", label: "Whitelist", icon: Shield, roles: ["owner"] },
  { id: "devices", label: "Devices", icon: Monitor, roles: ["owner", "agent"] },
  { id: "teams", label: "Teams", icon: UsersRound, roles: ["owner"] },
  { id: "agents", label: "Agents", icon: Bot, roles: ["owner"] },
  { id: "networking", label: "Networking", icon: Network, roles: ["owner"] },
  { id: "advanced", label: "Advanced", icon: Settings2, roles: ["owner"] },
  { id: "alerts", label: "Alerts", icon: Bell, roles: ["owner", "agent"] },
  { id: "business-hours", label: "Business Hours", icon: Clock, roles: ["owner"] },
  { id: "notification", label: "Notification", icon: BellRing, roles: ["owner"] },
  { id: "topup", label: "Top Up", icon: Zap, roles: ["owner", "agent"] },
  { id: "isp-details", label: "ISP Details", icon: Globe, roles: ["owner"] },
  { id: "audit", label: "Audit Log", icon: ScrollText, roles: ["owner", "agent"] },
  { id: "admin-logs", label: "Admin Logs", icon: ClipboardList, roles: ["owner", "agent"] },
  { id: "mac-auth", label: "MAC Auth", icon: Fingerprint, roles: ["owner"] },
  { id: "port-forwarding", label: "Port Forwarding", icon: ArrowRightLeft, roles: ["owner"] },
  { id: "dhcp", label: "DHCP Pool", icon: Server, roles: ["owner"] },
  { id: "vlans", label: "VLANs", icon: Layers, roles: ["owner"] },
  { id: "voip", label: "VOIP Priority", icon: PhoneCall, roles: ["owner"] },
  { id: "isp-routing", label: "ISP Routing", icon: RouteIcon, roles: ["owner"] },
  { id: "debugging", label: "Debugging", icon: Bug, roles: ["owner"] },
  { id: "hotspot", label: "Hotspot", icon: Rss, roles: ["owner"] },
  { id: "raas-dashboard", label: "RaaS Dashboard", icon: Gauge, roles: ["owner"] },
  { id: "raas-users", label: "RaaS Users", icon: UserCog, roles: ["owner"] },
  { id: "raas-reports", label: "RaaS Reports", icon: FileBarChart, roles: ["owner"] },
  { id: "help", label: "Help", icon: LifeBuoy, roles: ["owner", "agent"] },
];

/** Login-time landing preference (see `src/lib/roles.ts`), not an
 * authorization mechanism — only used to decide which sidebar items to
 * show, real access is still gated by actual permissions. */
export function getCustomerLoginRole(): CustomerLoginRole {
  if (typeof window === "undefined") return "owner";
  return (localStorage.getItem("cg_login_role") as CustomerLoginRole) || "owner";
}

export function customerNavsForRole(role: CustomerLoginRole): CustomerNavItem[] {
  return CUSTOMER_NAVS.filter((item) => item.roles.includes(role));
}
