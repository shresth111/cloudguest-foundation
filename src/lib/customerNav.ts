import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, FileText, Megaphone, Palette, Ticket, ShieldCheck, Shield,
  Monitor, UsersRound, Bot, Network, Settings2, Bell, Clock, Globe, ScrollText,
  Fingerprint, ArrowRightLeft, Server, Signal, Wifi,
  LifeBuoy, Share2, Terminal,
} from "lucide-react";

export type CustomerLoginRole = "owner" | "agent";

export interface CustomerNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: CustomerLoginRole[];
}

export interface CustomerNavGroup {
  id: string;
  label: string;
  items: CustomerNavItem[];
}

/** Single source of truth for the customer-workspace sidebar — shared by
 * the dashboard, users, and feature routes (via the shared `CustomerSidebar`
 * component, see src/components/customer/CustomerSidebar.tsx) so they can't
 * drift out of sync with each other again.
 *
 * Grouped into the same seven sections every customer page's sidebar
 * renders (Overview / Engagement / Access & Policy / Devices & Team /
 * Network / Operations / Support & Logs) -- this is the canonical grouping;
 * `CUSTOMER_NAVS` below is just this flattened for call sites that only
 * need the plain list (id/icon/role lookups, the "is this a known feature
 * id" check, etc). */
export const CUSTOMER_NAV_GROUPS: CustomerNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "agent"] },
      { id: "users", label: "Users", icon: Users, roles: ["owner", "agent"] },
      { id: "reports", label: "Reports", icon: FileText, roles: ["owner", "agent"] },
      { id: "alerts", label: "Alerts", icon: Bell, roles: ["owner", "agent"] },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    items: [
      { id: "campaigns", label: "Campaigns", icon: Megaphone, roles: ["owner"] },
      { id: "portal", label: "Portal", icon: Palette, roles: ["owner"] },
      { id: "vouchers", label: "Vouchers", icon: Ticket, roles: ["owner", "agent"] },
    ],
  },
  {
    id: "access-policy",
    label: "Access & Policy",
    items: [
      { id: "policies", label: "Policies", icon: ShieldCheck, roles: ["owner"] },
      { id: "whitelist", label: "Whitelist", icon: Shield, roles: ["owner"] },
      { id: "mac-auth", label: "Trusted Devices", icon: Fingerprint, roles: ["owner"] },
      { id: "business-hours", label: "Business Hours", icon: Clock, roles: ["owner"] },
      { id: "background-image", label: "Background Image", icon: Palette, roles: ["owner"] },
    ],
  },
  {
    id: "devices-team",
    label: "Devices & Team",
    items: [
      { id: "devices", label: "Devices", icon: Monitor, roles: ["owner", "agent"] },
      { id: "teams", label: "Guest Groups", icon: UsersRound, roles: ["owner"] },
      { id: "agents", label: "Staff Access", icon: Bot, roles: ["owner"] },
    ],
  },
  {
    id: "network",
    label: "Network",
    items: [
      { id: "hotspot", label: "Hotspot", icon: Wifi, roles: ["owner"] },
      { id: "dhcp", label: "IP Address Pool", icon: Server, roles: ["owner"] },
      { id: "vlans", label: "VLANs", icon: Network, roles: ["owner"] },
      { id: "port-forwarding", label: "Port Forwarding", icon: Share2, roles: ["owner"] },
      { id: "voip", label: "VOIP Priority", icon: Signal, roles: ["owner"] },
      { id: "isp-routing", label: "Internet Failover", icon: ArrowRightLeft, roles: ["owner"] },
      { id: "isp-details", label: "Internet Connection", icon: Globe, roles: ["owner"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "advanced", label: "Advanced", icon: Settings2, roles: ["owner"] },
      { id: "notification", label: "Notification", icon: Bell, roles: ["owner"] },
      { id: "debugging", label: "Network Diagnostics", icon: Terminal, roles: ["owner"] },
    ],
  },
  {
    id: "support-logs",
    label: "Support & Logs",
    items: [
      { id: "tickets", label: "Support Tickets", icon: LifeBuoy, roles: ["owner", "agent"] },
      // The former separate "Audit Log" tab was merged into Admin Logs' own
      // "Account Activity" section -- one log destination, not two. Owner-only
      // -- see customer.$locationId.$feature.tsx's own AdminLogsView render
      // for the same restriction and why (a real, org-wide login + change
      // audit trail, independently enforced by the backend too).
      { id: "admin-logs", label: "Logs", icon: ScrollText, roles: ["owner"] },
    ],
  },
];

/** Flattened view of CUSTOMER_NAV_GROUPS, for call sites that just need the
 * plain item list (id/role lookups) rather than the grouped rendering. */
export const CUSTOMER_NAVS: CustomerNavItem[] = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items);

/** Login-time landing preference (see `src/lib/roles.ts`), not an
 * authorization mechanism — only used to decide which sidebar items to
 * show, real access is still gated by actual permissions. */
export function getCustomerLoginRole(): CustomerLoginRole {
  if (typeof window === "undefined") return "owner";
  // Validate, don't just cast: `cg_login_role` can hold "super-admin" left
  // over from a Master Console login in the same browser (master-login.tsx
  // sets it on operator sign-in and it's never a valid CustomerLoginRole).
  // An unvalidated cast made customerNavsForRole() filter against a role
  // string no CUSTOMER_NAVS entry lists, silently emptying the sidebar --
  // the real guard against this session ever reaching here at all is
  // requireCustomerSession() (see src/lib/authGuards.ts), this is just a
  // defensive fallback so a bad value degrades to "owner" instead of to
  // an unrecognized role.
  const stored = localStorage.getItem("cg_login_role");
  return stored === "agent" ? "agent" : "owner";
}

export function customerNavsForRole(role: CustomerLoginRole): CustomerNavItem[] {
  return CUSTOMER_NAVS.filter((item) => item.roles.includes(role));
}

/** Same role-based filter as `customerNavsForRole`, but keeping the section
 * groups (and dropping groups left empty by the filter) -- this is what the
 * shared `CustomerSidebar` component renders. */
export function customerNavGroupsForRole(role: CustomerLoginRole): CustomerNavGroup[] {
  return CUSTOMER_NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((item) => item.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);
}
