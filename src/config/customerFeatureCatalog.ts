/**
 * Pure data catalog of customer features (no component imports) so both the
 * agent-permission store and the render registry can depend on it without a
 * cycle. A feature id is the unit an owner grants to an agent.
 */
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Megaphone,
  Palette,
  Ticket,
  ShieldCheck,
  Shield,
  Fingerprint,
  Sun,
  Monitor,
  UsersRound,
  Bot,
  Network,
  Wifi,
  Server,
  Share2,
  Signal,
  Globe,
  Settings2,
  Ban,
  ScrollText,
  LifeBuoy,
  Radar,
} from "lucide-react";

export interface FeatureDef {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
  /** Core features an owner cannot revoke from an agent (baseline access). */
  core?: boolean;
}

export const FEATURE_GROUPS: { group: string; items: Omit<FeatureDef, "group">[] }[] = [
  {
    group: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, core: true },
      { id: "users", label: "Users", icon: Users },
      { id: "reports", label: "Reports", icon: FileText },
      { id: "alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    group: "Engagement",
    items: [
      { id: "campaigns", label: "Campaigns", icon: Megaphone },
      { id: "portal", label: "Portal", icon: Palette },
      { id: "vouchers", label: "Vouchers", icon: Ticket },
    ],
  },
  {
    group: "Access & Policy",
    items: [
      { id: "policies", label: "Access Rules", icon: ShieldCheck },
      { id: "whitelist", label: "Always Allowed", icon: Shield },
      { id: "mac-auth", label: "Trusted Devices", icon: Fingerprint },
      // Renamed from "Business Hours" -- the old label/visual design read
      // too close to a competitor's equivalent feature. Same id/route/
      // data, display name + icon only (Sun/Moon now echoes the guest-
      // facing open/closed states, see OperationsFeatures.tsx's
      // OpenHoursView and portal.closed.tsx).
      { id: "business-hours", label: "Open Hours", icon: Sun },
      { id: "background-image", label: "Background Image", icon: Palette },
    ],
  },
  {
    group: "Devices & Team",
    items: [
      { id: "devices", label: "Devices", icon: Monitor },
      { id: "teams", label: "Guest Groups", icon: UsersRound },
      { id: "agents", label: "Staff Access", icon: Bot },
    ],
  },
  {
    group: "Network",
    // "DHCP Pool"/"VLANs"/"VOIP Priority" renamed to plainer, less
    // acronym-heavy labels (same id/route/data -- see each component's own
    // note in src/components/network/*.tsx, which keeps the technical
    // title for the master console's separate /network/* routes). Port
    // Forwarding and Internet Connection were already plain, left as-is.
    items: [
      { id: "dhcp", label: "IP Addresses", icon: Server },
      { id: "vlans", label: "Network Zones", icon: Network },
      { id: "port-forwarding", label: "Port Forwarding", icon: Share2 },
      { id: "voip", label: "Call Priority", icon: Signal },
      { id: "website-blocking", label: "Website Blocking", icon: Ban },
      { id: "isp-details", label: "Internet Connection", icon: Globe },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "notification", label: "Notifications", icon: Bell },
      // Renamed from "Network Diagnostics" -- the old label/layout read too
      // close to a competitor's equivalent feature. Same id/route and
      // network_diagnostics/guestService data underneath, display name +
      // icon only (Terminal -> Wifi, previously-unused import here). See
      // OperationsFeatures.tsx's DebuggingView for the matching redesign.
      { id: "debugging", label: "Connection Tools", icon: Wifi },
    ],
  },
  {
    group: "Support & Logs",
    items: [
      { id: "tickets", label: "Support Tickets", icon: LifeBuoy, core: true },
      // "Audit Log" is no longer a separate grantable feature -- its real
      // data was merged into Admin Logs' own "Account Activity" section.
      { id: "admin-logs", label: "Logs", icon: ScrollText },
      // Guest session/login records -- see customerNav.ts's matching entry
      // and NetworkActivityLog.tsx for why this is a separate feature id
      // from "admin-logs", not a merge into it. Listed here (grantable, not
      // `core`) same as "admin-logs" is -- real access still requires the
      // owner login role (customerNav.ts's `roles: ["owner"]` and this
      // component's own render-time guard), so granting it to an agent has
      // no effect until that separate restriction is ever relaxed.
      { id: "network-activity", label: "Network Activity Log", icon: Radar },
    ],
  },
];

export const ALL_FEATURES: FeatureDef[] = FEATURE_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, group: g.group })),
);

export const FEATURE_BY_ID: Record<string, FeatureDef> = Object.fromEntries(
  ALL_FEATURES.map((f) => [f.id, f]),
);

export const CORE_FEATURE_IDS = ALL_FEATURES.filter((f) => f.core).map((f) => f.id);
