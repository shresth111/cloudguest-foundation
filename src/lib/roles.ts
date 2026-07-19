import type { UserRole } from "@/types/auth";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Router as RouterIcon,
  Users,
  UserSquare2,
  LayoutTemplate,
  ShieldCheck,
  Activity,
  BarChart3,
  LifeBuoy,
  Settings,
  Receipt,
  Palette,
  ScrollText,
  Store,
  KeyRound,
  Plug,
  HeartPulse,
  Bell,
  Download,
  ClipboardList,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";





export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  org_admin: "Organization Admin",
  location_manager: "Location Manager",
  support_engineer: "Support Engineer",
  read_only: "Read Only",
};

export const ROLE_BADGE_VARIANT: Record<UserRole, "default" | "secondary" | "outline" | "destructive"> = {
  super_admin: "destructive",
  org_admin: "default",
  location_manager: "secondary",
  support_engineer: "secondary",
  read_only: "outline",
};

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"],
  },
  {
    label: "Organizations",
    to: "/organizations",
    icon: Building2,
    roles: ["super_admin"],
  },
  {
    label: "Customers",
    to: "/customers",
    icon: UserSquare2,
    roles: ["super_admin"],
  },
  {
    label: "Locations",
    to: "/locations",
    icon: MapPin,
    roles: ["super_admin", "org_admin", "location_manager"],
  },
  {
    label: "Routers",
    to: "/routers",
    icon: RouterIcon,
    roles: ["super_admin", "org_admin", "location_manager", "support_engineer"],
  },
  {
    label: "Guests",
    to: "/guests",
    icon: Users,
    roles: ["super_admin", "org_admin", "location_manager", "read_only"],
  },
  {
    label: "Portals",
    to: "/portals",
    icon: LayoutTemplate,
    roles: ["super_admin", "org_admin", "location_manager"],
  },
  {
    label: "Monitoring",
    to: "/monitoring",
    icon: Activity,
    roles: ["super_admin", "org_admin", "location_manager", "support_engineer"],
  },
  {
    label: "Analytics",
    to: "/analytics",
    icon: BarChart3,
    roles: ["super_admin", "org_admin", "read_only"],
  },
  {
    label: "Billing",
    to: "/billing",
    icon: Receipt,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "White label",
    to: "/branding",
    icon: Palette,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "Users & Roles",
    to: "/rbac",
    icon: ShieldCheck,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "Audit logs",
    to: "/audit",
    icon: ScrollText,
    roles: ["super_admin", "org_admin", "support_engineer"],
  },

  {
    label: "Marketplace",
    to: "/marketplace",
    icon: Store,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "Subscription",
    to: "/subscription",
    icon: Receipt,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "Integrations",
    to: "/integrations",
    icon: Plug,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "API keys",
    to: "/api-keys",
    icon: KeyRound,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "System health",
    to: "/system",
    icon: HeartPulse,
    roles: ["super_admin", "support_engineer"],
  },
  {
    label: "Notifications",
    to: "/notifications",
    icon: Bell,
    roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"],
  },
  {
    label: "Exports",
    to: "/exports",
    icon: Download,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "Help center",
    to: "/help",
    icon: LifeBuoy,
    roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"],
  },
  {
    label: "Settings",
    to: "/settings",
    icon: Settings,
    roles: ["super_admin", "org_admin"],
  },
];


export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/workspace", icon: LayoutDashboard, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { label: "Locations", to: "/workspace/locations", icon: MapPin, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { label: "Routers", to: "/workspace/routers", icon: RouterIcon, roles: ["super_admin", "org_admin", "location_manager"] },
  { label: "Guests", to: "/workspace/guests", icon: Users, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { label: "Staff", to: "/workspace/staff", icon: UserSquare2, roles: ["super_admin", "org_admin", "location_manager"] },
  { label: "Analytics", to: "/workspace/analytics", icon: BarChart3, roles: ["super_admin", "org_admin", "read_only"] },
  { label: "Reports", to: "/workspace/reports", icon: ScrollText, roles: ["super_admin", "org_admin"] },
  { label: "Billing", to: "/workspace/billing", icon: Receipt, roles: ["super_admin", "org_admin"] },
  { label: "Notifications", to: "/workspace/notifications", icon: Activity, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { label: "Audit logs", to: "/workspace/audit", icon: ScrollText, roles: ["super_admin", "org_admin", "support_engineer"] },
  { label: "Company settings", to: "/workspace/company", icon: Building2, roles: ["super_admin", "org_admin"] },
  { label: "Help center", to: "/workspace/help", icon: LifeBuoy, roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"] },
];

export function workspaceNavForRole(role: UserRole): NavItem[] {
  return WORKSPACE_NAV_ITEMS.filter((i) => i.roles.includes(role));
}

/** Post-login landing route per role — Super Admin keeps the global console, everyone else lands in the customer workspace. */
export function homeRouteForRole(role: UserRole): string {
  return role === "super_admin" ? "/dashboard" : "/workspace";
}

