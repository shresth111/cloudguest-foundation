import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, FileText, Megaphone, Palette, Ticket, ShieldCheck, Shield,
  Monitor, UsersRound, Bot, Network, Settings2, Bell, Clock, Globe, ScrollText,
  Fingerprint, ArrowRightLeft, Server, PhoneCall,
  Rss, LifeBuoy, Share2, Terminal,
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
/** Mirrors the NAV_GROUPS in customer.$locationId.$feature.tsx (and
 * src/config/customerFeatureCatalog.ts) exactly -- id, icon, and roles must
 * stay in sync or the sidebar drifts out of step with the feature routes it
 * links to. */
export const CUSTOMER_NAVS: CustomerNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "agent"] },
  { id: "users", label: "Users", icon: Users, roles: ["owner", "agent"] },
  { id: "reports", label: "Reports", icon: FileText, roles: ["owner", "agent"] },
  { id: "alerts", label: "Alerts", icon: Bell, roles: ["owner", "agent"] },
  { id: "campaigns", label: "Campaigns", icon: Megaphone, roles: ["owner"] },
  { id: "portal", label: "Portal", icon: Palette, roles: ["owner"] },
  { id: "vouchers", label: "Vouchers", icon: Ticket, roles: ["owner", "agent"] },
  { id: "policies", label: "Policies", icon: ShieldCheck, roles: ["owner"] },
  { id: "whitelist", label: "Whitelist", icon: Shield, roles: ["owner"] },
  { id: "mac-auth", label: "MAC Auth", icon: Fingerprint, roles: ["owner"] },
  { id: "business-hours", label: "Business Hours", icon: Clock, roles: ["owner"] },
  { id: "background-image", label: "Background Image", icon: Palette, roles: ["owner"] },
  { id: "devices", label: "Devices", icon: Monitor, roles: ["owner", "agent"] },
  { id: "teams", label: "Teams", icon: UsersRound, roles: ["owner"] },
  { id: "agents", label: "Agents", icon: Bot, roles: ["owner"] },
  { id: "hotspot", label: "Hotspot", icon: Rss, roles: ["owner"] },
  { id: "dhcp", label: "DHCP Pool", icon: Server, roles: ["owner"] },
  { id: "vlans", label: "VLANs", icon: Network, roles: ["owner"] },
  { id: "port-forwarding", label: "Port Forwarding", icon: Share2, roles: ["owner"] },
  { id: "voip", label: "VOIP Priority", icon: PhoneCall, roles: ["owner"] },
  { id: "isp-routing", label: "ISP Routing", icon: ArrowRightLeft, roles: ["owner"] },
  { id: "isp-details", label: "ISP Details", icon: Globe, roles: ["owner"] },
  { id: "advanced", label: "Advanced", icon: Settings2, roles: ["owner"] },
  { id: "notification", label: "Notification", icon: Bell, roles: ["owner"] },
  { id: "debugging", label: "Debugging", icon: Terminal, roles: ["owner"] },
  { id: "tickets", label: "Support Tickets", icon: LifeBuoy, roles: ["owner", "agent"] },
  { id: "audit", label: "Audit Log", icon: ScrollText, roles: ["owner", "agent"] },
  { id: "admin-logs", label: "Admin Logs", icon: ScrollText, roles: ["owner", "agent"] },
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
