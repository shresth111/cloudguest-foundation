import type { UserRole } from "@/types/auth";
import type { ModuleId } from "@/types/permissions";
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

export type NavGroup = "platform" | "operations" | "growth" | "system" | "support";

export interface NavItem {
  moduleId: ModuleId;
  label: string;
  to: string;
  icon: LucideIcon;
  roles: UserRole[];
  group?: NavGroup;
}

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  platform: "Platform administration",
  operations: "Operations",
  growth: "Growth",
  system: "System",
  support: "Support",
};

export const NAV_ITEMS: NavItem[] = [
  { moduleId: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, group: "platform", roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"] },
  { moduleId: "customers", label: "Customers", to: "/customers", icon: UserSquare2, group: "platform", roles: ["super_admin"] },
  { moduleId: "organizations", label: "Organizations", to: "/organizations", icon: Building2, group: "platform", roles: ["super_admin"] },
  { moduleId: "locations", label: "Locations", to: "/locations", icon: MapPin, group: "platform", roles: ["super_admin", "org_admin", "location_manager"] },
  { moduleId: "subscription", label: "Subscriptions", to: "/subscription", icon: Receipt, group: "platform", roles: ["super_admin", "org_admin"] },
  { moduleId: "plans", label: "Plans", to: "/plans", icon: ClipboardList, group: "platform", roles: ["super_admin"] },
  { moduleId: "feature-management", label: "Feature management", to: "/feature-management", icon: ToggleRight, group: "platform", roles: ["super_admin"] },
  { moduleId: "audit", label: "Audit logs", to: "/audit", icon: ScrollText, group: "platform", roles: ["super_admin", "org_admin", "support_engineer"] },
  { moduleId: "system", label: "System health", to: "/system", icon: HeartPulse, group: "platform", roles: ["super_admin", "support_engineer"] },
  { moduleId: "settings", label: "Platform settings", to: "/settings", icon: Settings, group: "platform", roles: ["super_admin", "org_admin"] },

  { moduleId: "routers", label: "Routers", to: "/routers", icon: RouterIcon, group: "operations", roles: ["super_admin", "org_admin", "location_manager", "support_engineer"] },
  { moduleId: "guests", label: "Guests", to: "/guests", icon: Users, group: "operations", roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { moduleId: "portals", label: "Portals", to: "/portals", icon: LayoutTemplate, group: "operations", roles: ["super_admin", "org_admin", "location_manager"] },
  { moduleId: "monitoring", label: "Monitoring", to: "/monitoring", icon: Activity, group: "operations", roles: ["super_admin", "org_admin", "location_manager", "support_engineer"] },
  { moduleId: "analytics", label: "Analytics", to: "/analytics", icon: BarChart3, group: "operations", roles: ["super_admin", "org_admin", "read_only"] },

  { moduleId: "billing", label: "Billing", to: "/billing", icon: Receipt, group: "growth", roles: ["super_admin", "org_admin"] },
  { moduleId: "branding", label: "White label", to: "/branding", icon: Palette, group: "growth", roles: ["super_admin", "org_admin"] },
  { moduleId: "marketplace", label: "Marketplace", to: "/marketplace", icon: Store, group: "growth", roles: ["super_admin", "org_admin"] },
  { moduleId: "rbac", label: "Users & Roles", to: "/rbac", icon: ShieldCheck, group: "growth", roles: ["super_admin", "org_admin"] },

  { moduleId: "integrations", label: "Integrations", to: "/integrations", icon: Plug, group: "system", roles: ["super_admin", "org_admin"] },
  { moduleId: "api-keys", label: "API keys", to: "/api-keys", icon: KeyRound, group: "system", roles: ["super_admin", "org_admin"] },
  { moduleId: "notifications", label: "Notifications", to: "/notifications", icon: Bell, group: "system", roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"] },
  { moduleId: "exports", label: "Exports", to: "/exports", icon: Download, group: "system", roles: ["super_admin", "org_admin"] },

  { moduleId: "help", label: "Help center", to: "/help", icon: LifeBuoy, group: "support", roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"] },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function groupedNavForRole(role: UserRole): Array<{ group: NavGroup; label: string; items: NavItem[] }> {
  const order: NavGroup[] = ["platform", "operations", "growth", "system", "support"];
  const items = navForRole(role);
  return order
    .map((group) => ({ group, label: NAV_GROUP_LABELS[group], items: items.filter((i) => (i.group ?? "operations") === group) }))
    .filter((g) => g.items.length > 0);
}

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  { moduleId: "workspace", label: "Dashboard", to: "/workspace", icon: LayoutDashboard, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { moduleId: "workspace-locations", label: "Locations", to: "/workspace/locations", icon: MapPin, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { moduleId: "workspace-routers", label: "Routers", to: "/workspace/routers", icon: RouterIcon, roles: ["super_admin", "org_admin", "location_manager"] },
  { moduleId: "workspace-guests", label: "Guests", to: "/workspace/guests", icon: Users, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { moduleId: "workspace-staff", label: "Staff", to: "/workspace/staff", icon: UserSquare2, roles: ["super_admin", "org_admin", "location_manager"] },
  { moduleId: "workspace-analytics", label: "Analytics", to: "/workspace/analytics", icon: BarChart3, roles: ["super_admin", "org_admin", "read_only"] },
  { moduleId: "workspace-reports", label: "Reports", to: "/workspace/reports", icon: ScrollText, roles: ["super_admin", "org_admin"] },
  { moduleId: "workspace-billing", label: "Billing", to: "/workspace/billing", icon: Receipt, roles: ["super_admin", "org_admin"] },
  { moduleId: "workspace-notifications", label: "Notifications", to: "/workspace/notifications", icon: Activity, roles: ["super_admin", "org_admin", "location_manager", "read_only"] },
  { moduleId: "workspace-audit", label: "Audit logs", to: "/workspace/audit", icon: ScrollText, roles: ["super_admin", "org_admin", "support_engineer"] },
  { moduleId: "workspace-company", label: "Company settings", to: "/workspace/company", icon: Building2, roles: ["super_admin", "org_admin"] },
  { moduleId: "workspace-help", label: "Help center", to: "/workspace/help", icon: LifeBuoy, roles: ["super_admin", "org_admin", "location_manager", "support_engineer", "read_only"] },
];

export function workspaceNavForRole(role: UserRole): NavItem[] {
  return WORKSPACE_NAV_ITEMS.filter((i) => i.roles.includes(role));
}

/** All roles land on the tiered Space picker; Super Admins see the Platform tile there too. */
export function homeRouteForRole(_role: UserRole): string {
  return "/select-space";
}

