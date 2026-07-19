import type { UserRole } from "@/types/auth";
import type {
  AssignedOrganization,
  AssignmentEnvelope,
  BusinessUnit,
  FeatureFlag,
  ModuleId,
  ModulePermission,
  PermissionEnvelope,
  PermissionMap,
  RouterAction,
  RouterCapabilities,
  SidebarGroupDef,
  SidebarNode,
  TopbarConfig,
} from "@/types/permissions";
import type { DashboardLayout, DashboardWidget } from "@/types/dashboard-layout";
import { permissionsBus } from "@/lib/permissionsBus";

/**
 * Mock permissions endpoint. Shape mirrors what the real backend
 * will return so it can be swapped later without touching consumers.
 *
 *   GET /api/v1/me/permissions?locationId=<id> -> PermissionEnvelope
 *
 * Everything the sidebar renders — including group order, item order,
 * icon, badges, and locked state — comes from this payload. No route
 * files, buttons or widgets are permitted to hardcode a role check.
 */

const FULL_ACTIONS: Required<Omit<ModulePermission, "locked">> = {
  view: true, create: true, edit: true, delete: true, export: true,
  import: true, approve: true, execute: true, restart: true, configure: true,
};

const READ_ONLY: ModulePermission = { view: true, export: true };

const NEW_IA_MODULES: ModuleId[] = [
  "network-aps", "network-wan", "network-lan", "network-dhcp", "network-dns",
  "guests-live", "guests-sessions", "guests-blocklist",
  "policy-location", "policy-user", "policy-group",
  "policy-auth", "policy-bandwidth", "policy-network",
  "analytics-executive", "analytics-network", "analytics-guest",
  "analytics-device", "analytics-isp",
  "alerts", "admin-logs", "business-units",
  "documentation", "support-contact",
];

const PLATFORM_CONSOLE: ModuleId[] = [
  "dashboard",
  "customers",
  "location-master",
  "nas-management",
  "nas-id-generator",
  "policy-location",
  "plans-billing",
  "feature-catalog",
  "branding",
  "infrastructure",
  "audit",
  "settings",
];

const BASE_BY_ROLE: Record<UserRole, ModuleId[]> = {
  super_admin: [
    // FE-025: Platform Console is Super-Admin ONLY. No operational modules.
    ...PLATFORM_CONSOLE,
    // Extras kept accessible via deep-link for platform admin work
    "organizations", "locations", "vouchers",
  ],
  org_admin: [
    "dashboard", "customers", "location-master", "infrastructure", "voucher-master",
    "locations", "subscription", "audit", "settings",
    "routers", "guests", "portals", "monitoring", "analytics",
    "billing", "branding", "marketplace", "rbac",
    "integrations", "api-keys", "notifications", "exports", "help",
    "vouchers", "campaigns", "devices", "whitelist", "captive-portal",
    "vlan", "dscp", "firewall", "isp-routing",
    "workspace", "workspace-locations", "workspace-routers", "workspace-guests",
    "workspace-staff", "workspace-analytics", "workspace-reports",
    "workspace-billing", "workspace-notifications", "workspace-audit",
    "workspace-company", "workspace-help",
    ...NEW_IA_MODULES,
  ],
  location_manager: [
    "dashboard", "location-master", "voucher-master",
    "locations", "routers", "guests", "portals",
    "monitoring", "notifications", "help", "vouchers", "devices",
    "vlan", "guests-live", "guests-sessions", "guests-blocklist",
    "policy-location", "policy-user",
    "analytics-executive", "analytics-guest",
    "alerts", "documentation", "support-contact",
    "workspace", "workspace-locations", "workspace-routers", "workspace-guests",
    "workspace-staff", "workspace-notifications", "workspace-help",
  ],
  support_engineer: [
    "dashboard", "audit", "system", "routers", "monitoring",
    "network-monitoring", "isp-monitoring", "devices",
    "notifications", "help",
    "alerts", "admin-logs", "documentation", "support-contact",
    "analytics-network", "analytics-device", "analytics-isp",
    "workspace-audit", "workspace-help",
  ],
  read_only: [
    "dashboard", "guests", "analytics", "notifications", "help",
    "analytics-executive", "analytics-guest",
    "guests-live", "documentation",
    "workspace", "workspace-locations", "workspace-guests",
    "workspace-analytics", "workspace-notifications", "workspace-help",
  ],
};

/** Modules that stay visible-but-locked instead of hidden for a given role. */
const LOCKED_BY_ROLE: Partial<Record<UserRole, ModuleId[]>> = {
  org_admin: ["plans", "feature-management", "system"],
  location_manager: ["billing", "branding", "rbac", "policy-group", "policy-bandwidth"],
  read_only: ["portals", "monitoring", "billing", "branding", "settings", "policy-location", "policy-user"],
  support_engineer: ["billing", "branding"],
};

const FEATURES_BY_ROLE: Record<UserRole, Partial<Record<FeatureFlag, boolean>>> = {
  super_admin: {
    ai_assistant: true, premium_wifi: true, campaigns: true, smart_id: true,
    voucher: true, survey: true, webhooks: true, public_api: true,
    white_label: true, sso: true, marketplace: true,
  },
  org_admin: {
    ai_assistant: true, premium_wifi: true, campaigns: true, voucher: true,
    survey: true, webhooks: true, public_api: true, white_label: true, marketplace: true,
  },
  location_manager: { voucher: true, campaigns: true },
  support_engineer: { public_api: true, webhooks: true },
  read_only: {},
};

const ROUTER_ACTIONS_BY_ROLE: Record<UserRole, Partial<Record<RouterAction, boolean>>> = {
  super_admin: Object.fromEntries(
    ["restart", "reboot", "upgrade_firmware", "backup", "restore", "diagnostics",
     "ping", "traceroute", "isp_test", "bandwidth_test", "mac_table", "arp_table",
     "dhcp", "dns", "firewall", "vlan", "dscp", "queue"].map((a) => [a, true]),
  ) as Record<RouterAction, boolean>,
  org_admin: {
    restart: true, reboot: true, backup: true, restore: true, diagnostics: true,
    ping: true, traceroute: true, isp_test: true, bandwidth_test: true,
    mac_table: true, arp_table: true, dhcp: true, dns: true, firewall: true,
    vlan: true, dscp: true, queue: true,
  },
  location_manager: {
    restart: true, diagnostics: true, ping: true, traceroute: true,
    bandwidth_test: true, mac_table: true, arp_table: true,
  },
  support_engineer: {
    diagnostics: true, ping: true, traceroute: true, isp_test: true,
    bandwidth_test: true, mac_table: true, arp_table: true, dhcp: true, dns: true,
  },
  read_only: {},
};

const ICON_BY_MODULE: Partial<Record<ModuleId, string>> = {
  dashboard: "LayoutDashboard",
  "location-master": "MapPinned",
  infrastructure: "ServerCog",
  "voucher-master": "Ticket",
  "nas-management": "Router",
  "nas-id-generator": "QrCode",
  "feature-catalog": "ToggleRight",
  "plans-billing": "CreditCard",
  // Network
  routers: "Router",
  "network-aps": "Wifi",
  vlan: "Network",
  "isp-routing": "Cable",
  "network-wan": "Globe",
  "network-lan": "EthernetPort",
  dscp: "Gauge",
  firewall: "Shield",
  "network-dhcp": "Share2",
  "network-dns": "Server",
  // Guest management
  "guests-live": "Users",
  "guests-sessions": "Clock",
  "smart-id": "QrCode",
  vouchers: "Ticket",
  whitelist: "ListChecks",
  "guests-blocklist": "Ban",
  guests: "Users",
  // Policies
  "policy-location": "MapPinned",
  "policy-user": "UserCog",
  "policy-group": "Users2",
  "policy-auth": "KeyRound",
  "policy-bandwidth": "Gauge",
  "policy-network": "Network",
  // Analytics
  "analytics-executive": "PieChart",
  "analytics-network": "Activity",
  "analytics-guest": "Users",
  "analytics-device": "Smartphone",
  "analytics-isp": "Cable",
  analytics: "BarChart3",
  // Operations
  monitoring: "Activity",
  alerts: "BellRing",
  audit: "ScrollText",
  "admin-logs": "FileClock",
  // Administration
  organizations: "Building2",
  "business-units": "Building",
  locations: "MapPin",
  customers: "UserSquare2",
  rbac: "ShieldCheck",
  "feature-management": "ToggleRight",
  billing: "Receipt",
  subscription: "CreditCard",
  plans: "ClipboardList",
  // Support
  help: "LifeBuoy",
  documentation: "BookOpen",
  "support-contact": "MessageSquare",
  // System / misc
  system: "HeartPulse",
  settings: "Settings",
  integrations: "Plug",
  "api-keys": "KeyRound",
  notifications: "Bell",
  exports: "Download",
  branding: "Palette",
  marketplace: "Store",
  portals: "LayoutTemplate",
  // Workspace
  workspace: "LayoutDashboard",
  "workspace-locations": "MapPin",
  "workspace-routers": "Router",
  "workspace-guests": "Users",
  "workspace-staff": "UserSquare2",
  "workspace-analytics": "BarChart3",
  "workspace-reports": "ScrollText",
  "workspace-billing": "Receipt",
  "workspace-notifications": "Bell",
  "workspace-audit": "ScrollText",
  "workspace-company": "Building2",
  "workspace-help": "LifeBuoy",
};

const LABEL_BY_MODULE: Partial<Record<ModuleId, string>> = {
  dashboard: "Dashboard",
  "location-master": "Location Master",
  infrastructure: "Infrastructure",
  "voucher-master": "Voucher Master",
  routers: "Routers",
  "network-aps": "Access Points",
  vlan: "VLAN",
  "isp-routing": "ISP",
  "network-wan": "WAN",
  "network-lan": "LAN",
  dscp: "DSCP",
  firewall: "Firewall",
  "network-dhcp": "DHCP",
  "network-dns": "DNS",
  "guests-live": "Live Guests",
  "guests-sessions": "Sessions",
  "smart-id": "Smart ID",
  vouchers: "Voucher",
  whitelist: "Whitelist",
  "guests-blocklist": "Blocklist",
  guests: "Guests",
  "policy-location": "Location Policies",
  "policy-user": "User Policies",
  "policy-group": "Group Policies",
  "policy-auth": "Authentication Policies",
  "policy-bandwidth": "Bandwidth Policies",
  "policy-network": "Network Policies",
  "analytics-executive": "Executive Dashboard",
  "analytics-network": "Network Analytics",
  "analytics-guest": "Guest Analytics",
  "analytics-device": "Device Analytics",
  "analytics-isp": "ISP Analytics",
  analytics: "Analytics",
  monitoring: "Device Monitoring",
  alerts: "Alerts",
  audit: "Audit Logs",
  "admin-logs": "Admin Logs",
  organizations: "Organizations",
  "business-units": "Business Units",
  locations: "Locations",
  customers: "Customers",
  rbac: "Users & Roles",
  "feature-management": "Feature Assignment",
  billing: "Billing",
  subscription: "Subscription",
  plans: "Plans",
  help: "Help Center",
  documentation: "Documentation",
  "support-contact": "Contact Support",
  system: "System health",
  settings: "Platform settings",
  integrations: "Integrations",
  "api-keys": "API keys",
  notifications: "Notifications",
  exports: "Exports",
  branding: "White label",
  marketplace: "Marketplace",
  portals: "Portals",
  workspace: "Dashboard",
  "workspace-locations": "Locations",
  "workspace-routers": "Routers",
  "workspace-guests": "Guests",
  "workspace-staff": "Staff",
  "workspace-analytics": "Analytics",
  "workspace-reports": "Reports",
  "workspace-billing": "Billing",
  "workspace-notifications": "Notifications",
  "workspace-audit": "Audit logs",
  "workspace-company": "Company settings",
  "workspace-help": "Help center",
};

const ROUTE_BY_MODULE: Partial<Record<ModuleId, string>> = {
  dashboard: "/dashboard",
  "location-master": "/locations",
  infrastructure: "/routers",
  "voucher-master": "/vouchers",
  routers: "/routers",
  "network-aps": "/network/access-points",
  vlan: "/network/vlan",
  "isp-routing": "/network/isp",
  "network-wan": "/network/wan",
  "network-lan": "/network/lan",
  dscp: "/network/dscp",
  firewall: "/network/firewall",
  "network-dhcp": "/network/dhcp",
  "network-dns": "/network/dns",
  "guests-live": "/guests",
  "guests-sessions": "/guests/sessions",
  "smart-id": "/guests/smart-id",
  vouchers: "/guests/voucher",
  whitelist: "/guests/whitelist",
  "guests-blocklist": "/guests/blocklist",
  guests: "/guests",
  "policy-location": "/policies/location",
  "policy-user": "/policies/user",
  "policy-group": "/policies/group",
  "policy-auth": "/policies/authentication",
  "policy-bandwidth": "/policies/bandwidth",
  "policy-network": "/policies/network",
  "analytics-executive": "/analytics/executive",
  "analytics-network": "/analytics/network",
  "analytics-guest": "/analytics/guest",
  "analytics-device": "/analytics/device",
  "analytics-isp": "/analytics/isp",
  analytics: "/analytics",
  monitoring: "/monitoring",
  alerts: "/operations/alerts",
  audit: "/audit",
  "admin-logs": "/operations/admin-logs",
  organizations: "/organizations",
  "business-units": "/administration/business-units",
  locations: "/locations",
  customers: "/customers",
  rbac: "/rbac",
  "feature-management": "/feature-management",
  billing: "/billing",
  subscription: "/subscription",
  plans: "/plans",
  help: "/help",
  documentation: "/support/documentation",
  "support-contact": "/support/contact",
  system: "/system",
  settings: "/settings",
  integrations: "/integrations",
  "api-keys": "/api-keys",
  notifications: "/notifications",
  exports: "/exports",
  branding: "/branding",
  marketplace: "/marketplace",
  portals: "/portals",
  workspace: "/workspace",
  "workspace-locations": "/workspace/locations",
  "workspace-routers": "/workspace/routers",
  "workspace-guests": "/workspace/guests",
  "workspace-staff": "/workspace/staff",
  "workspace-analytics": "/workspace/analytics",
  "workspace-reports": "/workspace/reports",
  "workspace-billing": "/workspace/billing",
  "workspace-notifications": "/workspace/notifications",
  "workspace-audit": "/workspace/audit",
  "workspace-company": "/workspace/company",
  "workspace-help": "/workspace/help",
};

type GroupId =
  | "platform"
  | "dashboard"
  | "network"
  | "guests"
  | "policies"
  | "analytics"
  | "operations"
  | "administration"
  | "support"
  | "system"
  | "workspace";

const GROUP_META: Record<GroupId, { label: string; order: number }> = {
  platform:       { label: "CloudGuest",     order: 1 },
  dashboard:      { label: "Dashboard",      order: 10 },
  network:        { label: "Network",        order: 20 },
  guests:         { label: "Guest Management", order: 30 },
  policies:       { label: "Policies",       order: 40 },
  analytics:      { label: "Analytics",      order: 50 },
  operations:     { label: "Operations",     order: 60 },
  administration: { label: "Administration", order: 70 },
  support:        { label: "Support",        order: 80 },
  system:         { label: "System",         order: 90 },
  workspace:      { label: "Customer workspace", order: 5 },
};

/**
 * FE-024 Primary IA — a flat 10-item list surfaced at the top of the sidebar.
 * Everything else remains available in secondary groups below for power users.
 */
const PRIMARY_IA: ModuleId[] = [
  "dashboard",
  "customers",
  "location-master",
  "infrastructure",
  "voucher-master",
  "policy-location",
  "analytics",
  "billing",
  "audit",
  "settings",
];

const MODULE_GROUP: Partial<Record<ModuleId, GroupId>> = {
  dashboard: "dashboard",
  // Network
  routers: "network", "network-aps": "network", vlan: "network",
  "isp-routing": "network", "network-wan": "network", "network-lan": "network",
  dscp: "network", firewall: "network", "network-dhcp": "network", "network-dns": "network",
  // Guest management
  "guests-live": "guests", "guests-sessions": "guests", "smart-id": "guests",
  vouchers: "guests", whitelist: "guests", "guests-blocklist": "guests",
  // Policies
  "policy-user": "policies", "policy-group": "policies",
  "policy-auth": "policies", "policy-bandwidth": "policies", "policy-network": "policies",
  // Analytics
  "analytics-executive": "analytics", "analytics-network": "analytics",
  "analytics-guest": "analytics", "analytics-device": "analytics", "analytics-isp": "analytics",
  // Operations
  monitoring: "operations", alerts: "operations", "admin-logs": "operations",
  // Administration
  organizations: "administration", "business-units": "administration", locations: "administration",
  rbac: "administration", "feature-management": "administration",
  subscription: "administration", plans: "administration",
  // Support
  help: "support", documentation: "support", "support-contact": "support",
  // System
  system: "system", integrations: "system",
  "api-keys": "system", notifications: "system", exports: "system",
  branding: "system", marketplace: "system", portals: "system",
  guests: "guests",
};

const MODULE_ORDER: ModuleId[] = [
  // Network
  "routers", "network-aps", "vlan", "isp-routing", "network-wan", "network-lan",
  "dscp", "firewall", "network-dhcp", "network-dns",
  // Guests
  "guests-live", "guests-sessions", "smart-id", "vouchers", "whitelist", "guests-blocklist",
  // Policies
  "policy-user", "policy-group",
  "policy-auth", "policy-bandwidth", "policy-network",
  // Analytics
  "analytics-executive", "analytics-network", "analytics-guest",
  "analytics-device", "analytics-isp",
  // Operations
  "monitoring", "alerts", "admin-logs",
  // Administration
  "organizations", "business-units", "locations",
  "rbac", "feature-management", "subscription", "plans",
  // Support
  "help", "documentation", "support-contact",
  // System
  "system", "integrations", "api-keys", "notifications",
  "exports", "branding", "marketplace", "portals",
];



const WORKSPACE_ORDER: ModuleId[] = [
  "workspace", "workspace-locations", "workspace-routers", "workspace-guests",
  "workspace-staff", "workspace-analytics", "workspace-reports",
  "workspace-billing", "workspace-notifications", "workspace-audit",
  "workspace-company", "workspace-help",
];

function buildNode(id: ModuleId, order: number, locked: boolean): SidebarNode {
  return {
    id,
    moduleId: id,
    label: LABEL_BY_MODULE[id] ?? id,
    icon: ICON_BY_MODULE[id] ?? "Circle",
    to: ROUTE_BY_MODULE[id],
    order,
    locked,
  };
}

function buildConsoleSidebar(modules: PermissionMap): SidebarGroupDef[] {
  // Primary IA — the flat 10-item CloudGuest spine (FE-024).
  const primaryItems: SidebarNode[] = [];
  PRIMARY_IA.forEach((id, i) => {
    const m = modules[id];
    if (!m) return;
    if (!(m.view || m.locked)) return;
    primaryItems.push(buildNode(id, i, !!m.locked && !m.view));
  });
  const primaryGroup: SidebarGroupDef | null = primaryItems.length
    ? { id: "platform", label: GROUP_META.platform.label, order: GROUP_META.platform.order, items: primaryItems }
    : null;

  // Secondary groups — everything else bucketed by domain, hidden from the
  // primary IA to keep the sidebar clean while preserving deep-links.
  const byGroup = new Map<GroupId, SidebarNode[]>();
  MODULE_ORDER.forEach((id, i) => {
    if (PRIMARY_IA.includes(id)) return;
    const m = modules[id];
    if (!m) return;
    if (!(m.view || m.locked)) return;
    const groupId = MODULE_GROUP[id] ?? "operations";
    const arr = byGroup.get(groupId) ?? [];
    arr.push(buildNode(id, i, !!m.locked && !m.view));
    byGroup.set(groupId, arr);
  });
  const secondary = Array.from(byGroup.entries())
    .map(([id, items]) => ({ id, label: GROUP_META[id].label, order: GROUP_META[id].order, items }))
    .sort((a, b) => a.order - b.order);

  return primaryGroup ? [primaryGroup, ...secondary] : secondary;
}

function buildWorkspaceSidebar(modules: PermissionMap): SidebarGroupDef[] {
  const items: SidebarNode[] = [];
  WORKSPACE_ORDER.forEach((id, i) => {
    const m = modules[id];
    if (!m) return;
    if (!(m.view || m.locked)) return;
    items.push(buildNode(id, i, !!m.locked && !m.view));
  });
  if (items.length === 0) return [];
  return [{
    id: "workspace",
    label: GROUP_META.workspace.label,
    order: GROUP_META.workspace.order,
    items,
  }];
}

function delay<T>(v: T, ms = 200): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

/* ---------------- Overrides for live feature-flag toggling ---------------- */

const featureOverrides: Partial<Record<FeatureFlag, boolean>> = {};

/* ---------------- Assignments (Org → BU → Location) ---------------- */

const ASSIGNMENTS_BY_ROLE: Record<UserRole, AssignedOrganization[]> = {
  super_admin: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        { id: "BU-NIM-N", organizationId: "ORG-01000", name: "North India", region: "IN-N", locationIds: ["LOC-DEL", "LOC-JAI"] },
        { id: "BU-NIM-W", organizationId: "ORG-01000", name: "West India", region: "IN-W", locationIds: ["LOC-BOM", "LOC-GOA"] },
      ],
    },
    {
      id: "ORG-01001",
      name: "Vertex Retail",
      businessUnits: [
        { id: "BU-VER-US", organizationId: "ORG-01001", name: "US East", region: "US-E", locationIds: ["LOC-NYC", "LOC-CHI"] },
      ],
    },
  ],
  org_admin: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        { id: "BU-NIM-N", organizationId: "ORG-01000", name: "North India", region: "IN-N", locationIds: ["LOC-DEL", "LOC-JAI"] },
        { id: "BU-NIM-W", organizationId: "ORG-01000", name: "West India", region: "IN-W", locationIds: ["LOC-BOM", "LOC-GOA"] },
      ],
    },
  ],
  location_manager: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        { id: "BU-NIM-N", organizationId: "ORG-01000", name: "North India", region: "IN-N", locationIds: ["LOC-DEL"] },
      ],
    },
  ],
  support_engineer: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        { id: "BU-NIM-N", organizationId: "ORG-01000", name: "North India", region: "IN-N", locationIds: ["LOC-DEL", "LOC-JAI"] },
        { id: "BU-NIM-W", organizationId: "ORG-01000", name: "West India", region: "IN-W", locationIds: ["LOC-BOM", "LOC-GOA"] },
      ],
    },
  ],
  read_only: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        { id: "BU-NIM-N", organizationId: "ORG-01000", name: "North India", region: "IN-N", locationIds: ["LOC-DEL"] },
      ],
    },
  ],
};

/* ---------------- Dashboard layouts (backend-driven) ---------------- */

function widgetsForRole(role: UserRole): DashboardWidget[] {
  const base: DashboardWidget[] = [
    { id: "welcome", kind: "welcome", size: "xl", order: 0 },
    { id: "kpis", kind: "kpi-grid", size: "xl", order: 10, requires: { module: "dashboard" } },
  ];
  if (role === "super_admin") {
    return [
      ...base,
      { id: "trend", kind: "trend-chart", title: "Growth trends", size: "lg", order: 20, requires: { module: "analytics" } },
      { id: "health", kind: "health-chart", title: "Platform health", size: "md", order: 30, requires: { module: "system" } },
      { id: "usage", kind: "usage-chart", title: "Bandwidth usage", size: "md", order: 40, requires: { module: "monitoring" } },
      { id: "top-locs", kind: "top-locations", title: "Top locations", size: "md", order: 50, requires: { module: "locations" } },
      { id: "activity", kind: "recent-activity", title: "Recent activity", size: "lg", order: 60, requires: { module: "audit" } },
      { id: "notifs", kind: "notifications-preview", title: "Notifications", size: "md", order: 70, requires: { module: "notifications" } },
    ];
  }
  if (role === "org_admin" || role === "location_manager") {
    return [
      ...base,
      { id: "usage", kind: "usage-chart", title: "Live usage", size: "lg", order: 20, requires: { module: "monitoring" } },
      { id: "activity", kind: "recent-activity", title: "Recent activity", size: "lg", order: 30 },
      { id: "notifs", kind: "notifications-preview", title: "Notifications", size: "md", order: 40 },
      { id: "quick", kind: "quick-actions", title: "Quick actions", size: "md", order: 50 },
    ];
  }
  if (role === "support_engineer") {
    return [
      ...base,
      { id: "health", kind: "health-chart", title: "Router health", size: "lg", order: 20, requires: { module: "monitoring" } },
      { id: "activity", kind: "recent-activity", title: "Recent tickets", size: "lg", order: 30, requires: { module: "audit" } },
    ];
  }
  return [
    ...base,
    { id: "activity", kind: "recent-activity", title: "Recent activity", size: "xl", order: 20 },
  ];
}

/* ---------------- Topbar (backend-driven) ---------------- */

function topbarForRole(role: UserRole, features: Partial<Record<FeatureFlag, boolean>>): TopbarConfig {
  return {
    showGlobalSearch: true,
    showQuickActions: role !== "read_only",
    showNotifications: true,
    showThemeToggle: true,
    showLanguage: role === "super_admin" || role === "org_admin",
    showSupport: true,
    showSpaceChip: true,
    showProfileMenu: true,
    // features param preserved so real backend can flip based on flags
    ...(features ? {} : {}),
  };
}

function applyFeatureOverrides(
  base: Partial<Record<FeatureFlag, boolean>>,
): Partial<Record<FeatureFlag, boolean>> {
  return { ...base, ...featureOverrides };
}

export const permissionsService = {
  async getPermissions(role: UserRole, _locationId?: string): Promise<PermissionEnvelope> {
    const allowed = new Set(BASE_BY_ROLE[role] ?? []);
    const locked = new Set(LOCKED_BY_ROLE[role] ?? []);
    const modules: PermissionMap = {};
    for (const id of allowed) {
      modules[id] = role === "super_admin" || role === "org_admin"
        ? { ...FULL_ACTIONS }
        : role === "location_manager"
          ? { view: true, create: true, edit: true, export: true, execute: true, restart: true }
          : role === "support_engineer"
            ? { view: true, edit: true, export: true, execute: true, restart: true, configure: true }
            : READ_ONLY;
    }
    for (const id of locked) modules[id] = { view: false, locked: true };

    return delay({
      modules,
      features: applyFeatureOverrides(FEATURES_BY_ROLE[role]),
      routerActions: ROUTER_ACTIONS_BY_ROLE[role],
      locationScope: [],
      sidebar: {
        console: buildConsoleSidebar(modules),
        workspace: buildWorkspaceSidebar(modules),
      },
    });
  },

  async getAssignments(role: UserRole): Promise<AssignmentEnvelope> {
    const orgs = ASSIGNMENTS_BY_ROLE[role] ?? [];
    const totalBus = orgs.reduce((n, o) => n + o.businessUnits.length, 0);
    return delay({
      organizations: orgs,
      skipBusinessUnitStep: totalBus <= 1,
    });
  },

  async getDashboardLayout(role: UserRole, _locationId?: string): Promise<DashboardLayout> {
    const variant: DashboardLayout["variant"] =
      role === "super_admin" ? "super-admin"
        : role === "support_engineer" ? "support"
          : role === "read_only" ? "read-only"
            : "customer";
    return delay({ variant, widgets: widgetsForRole(role) });
  },

  async getTopbarConfig(role: UserRole): Promise<TopbarConfig> {
    return delay(topbarForRole(role, applyFeatureOverrides(FEATURES_BY_ROLE[role])));
  },

  async getRouterCapabilities(role: UserRole, routerId: string): Promise<RouterCapabilities> {
    return delay({ routerId, actions: ROUTER_ACTIONS_BY_ROLE[role] });
  },

  /** Dev / admin: instantly flip a feature flag and notify subscribers. */
  async updateFeatureFlag(flag: FeatureFlag, enabled: boolean): Promise<void> {
    featureOverrides[flag] = enabled;
    permissionsBus.emit({ type: "feature-flags:changed" });
    permissionsBus.emit({ type: "permissions:changed" });
  },

  /** Read the current in-memory override state (dev inspector). */
  getFeatureOverrides(): Partial<Record<FeatureFlag, boolean>> {
    return { ...featureOverrides };
  },
};

// Convenience export so business units are easily discoverable at module scope.
export type { BusinessUnit, AssignedOrganization, AssignmentEnvelope, TopbarConfig, RouterCapabilities };
export type { DashboardLayout, DashboardWidget };
