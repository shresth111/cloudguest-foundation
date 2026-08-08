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
  Clock,
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
  Terminal,
  ScrollText,
  LifeBuoy,
  Link2,
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
      { id: "short-links", label: "Short Links", icon: Link2 },
    ],
  },
  {
    group: "Access & Policy",
    items: [
      { id: "policies", label: "Access Rules", icon: ShieldCheck },
      { id: "whitelist", label: "Always Allowed", icon: Shield },
      { id: "mac-auth", label: "Trusted Devices", icon: Fingerprint },
      { id: "business-hours", label: "Business Hours", icon: Clock },
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
    items: [
      { id: "dhcp", label: "DHCP Pool", icon: Server },
      { id: "vlans", label: "VLANs", icon: Network },
      { id: "port-forwarding", label: "Port Forwarding", icon: Share2 },
      { id: "voip", label: "VOIP Priority", icon: Signal },
      { id: "isp-details", label: "Internet Connection", icon: Globe },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "notification", label: "Notifications", icon: Bell },
      { id: "debugging", label: "Network Diagnostics", icon: Terminal },
    ],
  },
  {
    group: "Support & Logs",
    items: [
      { id: "tickets", label: "Support Tickets", icon: LifeBuoy, core: true },
      // "Audit Log" is no longer a separate grantable feature -- its real
      // data was merged into Admin Logs' own "Account Activity" section.
      { id: "admin-logs", label: "Logs", icon: ScrollText },
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
