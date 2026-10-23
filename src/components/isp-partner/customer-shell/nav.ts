/**
 * The customer workspace's nav inside the partner console (ADDENDUM_04).
 *
 * Same groups, same order, same ids and same labels as the customer
 * dashboard's own sidebar (`src/lib/customerNav.ts` CUSTOMER_NAV_GROUPS on
 * origin/main). That file is NOT imported here on purpose: the customer
 * sidebar keys visibility off customer roles and customer permission keys,
 * while an ISP user holds `isp_*` keys on the ISP org. A copy with its own
 * gates is the only way to keep the customer file untouched.
 *
 * Drift is caught, not trusted: `scripts/test-isp-partner-customer-shell.mjs`
 * bundles both files and fails when a group, an item, a label or the order
 * differs.
 *
 * What each field means:
 *  - `scope`: "customer" pages work for the whole customer; "location" pages
 *    need the location picked at the top of the workspace (`?location=`), and
 *    the shell pins it for the request shim (`VenueScope`) before they mount;
 *    "isp" pages are the ISP's own (Staff Access, Support Tickets, ...) and
 *    say so.
 *  - `anyOf`: the `isp_*` grants that show the row (any one is enough). A
 *    hidden row is a convenience; the backend pins every key.
 *  - `addon`: a paid add-on. Shown only when Master allowed it for this ISP
 *    AND it is on for the customer (ADDENDUM_04 §2). Until the allowance
 *    endpoint exists (B6) the allowance is "none", the documented default.
 */
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Bell,
  Bot,
  BrickWall,
  FileText,
  Fingerprint,
  Globe,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Logs,
  Megaphone,
  Monitor,
  Network,
  Palette,
  Radar,
  ScrollText,
  Send,
  Server,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Sun,
  Ticket,
  Users,
  UsersRound,
  Waypoints,
  Wifi,
} from "lucide-react";

export type PartnerFeatureScope = "customer" | "location" | "isp";

/** The add-on feature keys (backend `ADDON_FEATURE_KEYS`). */
export type PartnerAddonKey =
  | "guest_marketing"
  | "guest_marketing_byo"
  | "traffic_flow"
  | "traffic_flow_records";

export interface PartnerNavItem {
  /** Same id as the customer dashboard's nav item. Also the URL segment. */
  id: string;
  label: string;
  icon: LucideIcon;
  scope: PartnerFeatureScope;
  anyOf: readonly string[];
  addon?: PartnerAddonKey;
}

export interface PartnerNavGroup {
  id: string;
  label: string;
  items: readonly PartnerNavItem[];
}

export const PARTNER_CUSTOMER_NAV_GROUPS: readonly PartnerNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        scope: "customer",
        anyOf: ["isp_partner.read"],
      },
      {
        id: "users",
        label: "Guests",
        icon: Users,
        scope: "customer",
        anyOf: ["isp_partner.read", "isp_access.read"],
      },
      {
        id: "reports",
        label: "Reports",
        icon: FileText,
        scope: "customer",
        anyOf: ["isp_partner.read"],
      },
      { id: "alerts", label: "Alerts", icon: Bell, scope: "location", anyOf: ["isp_monitor.read"] },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    items: [
      {
        id: "portal",
        label: "Portal",
        icon: Palette,
        scope: "location",
        anyOf: ["isp_partner.read"],
      },
      {
        id: "campaigns",
        label: "Login Page Offers",
        icon: Megaphone,
        scope: "location",
        anyOf: ["isp_access.read", "isp_engage.read"],
      },
      {
        id: "vouchers",
        label: "Vouchers",
        icon: Ticket,
        scope: "location",
        anyOf: ["isp_coupons.read", "isp_engage.read"],
      },
    ],
  },
  {
    // Its own group on the customer dashboard too (Marketing add-on).
    id: "marketing",
    label: "Marketing",
    items: [
      {
        id: "marketing",
        label: "Guest Messaging",
        icon: Send,
        scope: "location",
        anyOf: ["isp_engage.read"],
        addon: "guest_marketing",
      },
    ],
  },
  {
    id: "access-policy",
    label: "Access & Policy",
    items: [
      {
        id: "policies",
        label: "Access Rules",
        icon: ShieldCheck,
        scope: "location",
        anyOf: ["isp_access.read"],
      },
      {
        id: "whitelist",
        label: "Guest Allow-list",
        icon: Shield,
        scope: "location",
        anyOf: ["isp_access.read"],
      },
      {
        id: "mac-auth",
        label: "Trusted Devices",
        icon: Fingerprint,
        scope: "location",
        anyOf: ["isp_access.read"],
      },
      {
        id: "business-hours",
        label: "Open Hours",
        icon: Sun,
        scope: "location",
        anyOf: ["isp_access.read"],
      },
    ],
  },
  {
    id: "devices-team",
    label: "Devices & Team",
    items: [
      {
        id: "devices",
        label: "Devices",
        icon: Monitor,
        scope: "location",
        anyOf: ["isp_partner.read", "isp_monitor.read", "tr069.read"],
      },
      {
        id: "teams",
        label: "Guest Groups",
        icon: UsersRound,
        scope: "location",
        anyOf: ["isp_access.read"],
      },
      // Customers have no users (founder rule): Staff Access is the ISP's own
      // staff, with per-customer confinement (ADDENDUM_04 "Changed").
      {
        id: "agents",
        label: "Staff Access",
        icon: Bot,
        scope: "isp",
        anyOf: ["isp_partner.assign"],
      },
    ],
  },
  {
    id: "network",
    label: "Network",
    items: [
      {
        id: "dhcp",
        label: "IP Addresses",
        icon: Server,
        scope: "location",
        anyOf: ["isp_network.read"],
      },
      {
        id: "vlans",
        label: "Network Zones",
        icon: Network,
        scope: "location",
        anyOf: ["isp_network.read"],
      },
      {
        id: "port-forwarding",
        label: "Port Forwarding",
        icon: Share2,
        scope: "location",
        anyOf: ["isp_network.read"],
      },
      {
        id: "voip",
        label: "Call Priority",
        icon: Signal,
        scope: "location",
        anyOf: ["isp_network.read"],
      },
      {
        id: "isp-details",
        label: "Internet Connection",
        icon: Globe,
        scope: "location",
        anyOf: ["isp_network.read"],
      },
      {
        id: "traffic-lens",
        label: "Traffic Lens",
        icon: Waypoints,
        scope: "location",
        anyOf: ["isp_network.read"],
        addon: "traffic_flow",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      {
        id: "security",
        label: "Security Score",
        icon: ShieldAlert,
        scope: "location",
        anyOf: ["isp_security.read"],
      },
      {
        id: "blocking",
        label: "Block Websites",
        icon: Ban,
        scope: "location",
        anyOf: ["isp_security.read"],
      },
      {
        id: "firewall",
        label: "Firewall",
        icon: BrickWall,
        scope: "location",
        anyOf: ["isp_security.read"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "debugging",
        label: "Fix a Problem",
        icon: Wifi,
        scope: "location",
        anyOf: ["isp_ops.execute"],
      },
    ],
  },
  {
    id: "support-logs",
    label: "Support & Logs",
    items: [
      // ISP -> Wyfy tickets (ADDENDUM_04 "Changed"): the ISP is the requester.
      {
        id: "tickets",
        label: "Support Tickets",
        icon: LifeBuoy,
        scope: "isp",
        anyOf: ["isp_support.read"],
      },
      // What ISP staff did, across customers; owner/admin (isp_partner.assign).
      {
        id: "admin-logs",
        label: "Staff Activity",
        icon: ScrollText,
        scope: "customer",
        anyOf: ["isp_partner.assign"],
      },
      {
        id: "network-activity",
        label: "Guest Connection Records",
        icon: Radar,
        scope: "customer",
        anyOf: ["isp_logs.read"],
      },
      { id: "netlogs", label: "NetLogs", icon: Logs, scope: "customer", anyOf: ["isp_logs.read"] },
      // ISP docs, not the venue help page. No grant needed.
      { id: "how-it-works", label: "How It Works", icon: HelpCircle, scope: "isp", anyOf: [] },
    ],
  },
];

export const PARTNER_CUSTOMER_NAV: readonly PartnerNavItem[] = PARTNER_CUSTOMER_NAV_GROUPS.flatMap(
  (g) => g.items,
);

export const DEFAULT_PARTNER_FEATURE = "dashboard";

export function findPartnerNavItem(id: string): PartnerNavItem | undefined {
  return PARTNER_CUSTOMER_NAV.find((i) => i.id === id);
}

/** An item is visible when any one of its grants is held (none = everyone). */
export function itemVisible(item: PartnerNavItem, can: (permission: string) => boolean): boolean {
  return item.anyOf.length === 0 || item.anyOf.some((p) => can(p));
}

/** The groups this user sees; a group left empty by the filter is dropped. */
export function visiblePartnerNavGroups(can: (permission: string) => boolean): PartnerNavGroup[] {
  return PARTNER_CUSTOMER_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => itemVisible(i, can)),
  })).filter((g) => g.items.length > 0);
}
