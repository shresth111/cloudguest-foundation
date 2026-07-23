/**
 * Pure data catalog of customer features (no component imports) so both the
 * agent-permission store and the render registry can depend on it without a
 * cycle. A feature id is the unit an owner grants to an agent.
 */
import type { ComponentType } from "react";
import {
  LayoutDashboard, Users, FileText, Bell, Megaphone, Palette, Ticket,
  ShieldCheck, Shield, Fingerprint, Clock, Monitor, UsersRound, Bot, Network, Wifi,
  Server, Share2, Signal, ArrowRightLeft, Globe, Settings2, Gauge, Terminal,
  ScrollText, LifeBuoy,
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
      { id: "policies", label: "Policies", icon: ShieldCheck },
      { id: "whitelist", label: "Whitelist", icon: Shield },
      { id: "mac-auth", label: "MAC Auth", icon: Fingerprint },
      { id: "business-hours", label: "Business Hours", icon: Clock },
    ],
  },
  {
    group: "Devices & Team",
    items: [
      { id: "devices", label: "Devices", icon: Monitor },
      { id: "teams", label: "Teams", icon: UsersRound },
      { id: "agents", label: "Agents", icon: Bot },
    ],
  },
  {
    group: "Network",
    items: [
      { id: "networking", label: "Networking", icon: Network },
      { id: "hotspot", label: "Hotspot", icon: Wifi },
      { id: "dhcp", label: "DHCP Pool", icon: Server },
      { id: "vlans", label: "VLANs", icon: Network },
      { id: "port-forwarding", label: "Port Forwarding", icon: Share2 },
      { id: "voip", label: "VOIP Priority", icon: Signal },
      { id: "isp-routing", label: "ISP Routing", icon: ArrowRightLeft },
      { id: "isp-details", label: "ISP Details", icon: Globe },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "advanced", label: "Advanced", icon: Settings2 },
      { id: "topup", label: "Top Up", icon: Gauge },
      { id: "notification", label: "Notification", icon: Bell },
      { id: "debugging", label: "Debugging", icon: Terminal },
    ],
  },
  {
    group: "Support & Logs",
    items: [
      { id: "tickets", label: "Support Tickets", icon: LifeBuoy, core: true },
      { id: "audit", label: "Audit Log", icon: ScrollText },
      { id: "admin-logs", label: "Admin Logs", icon: ScrollText },
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
