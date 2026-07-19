import type { UserRole } from "@/types/auth";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Wifi,
  Users,
  ShieldCheck,
  BarChart3,
  LifeBuoy,
  Settings,
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
    label: "Locations",
    to: "/dashboard",
    icon: MapPin,
    roles: ["super_admin", "org_admin", "location_manager"],
  },
  {
    label: "Networks",
    to: "/dashboard",
    icon: Wifi,
    roles: ["super_admin", "org_admin", "location_manager", "support_engineer"],
  },
  {
    label: "Guests",
    to: "/dashboard",
    icon: Users,
    roles: ["super_admin", "org_admin", "location_manager", "read_only"],
  },
  {
    label: "Analytics",
    to: "/dashboard",
    icon: BarChart3,
    roles: ["super_admin", "org_admin", "read_only"],
  },
  {
    label: "Security",
    to: "/dashboard",
    icon: ShieldCheck,
    roles: ["super_admin", "org_admin"],
  },
  {
    label: "Support",
    to: "/dashboard",
    icon: LifeBuoy,
    roles: ["super_admin", "support_engineer"],
  },
  {
    label: "Settings",
    to: "/dashboard",
    icon: Settings,
    roles: ["super_admin", "org_admin"],
  },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}
