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

const BASE_BY_ROLE: Record<UserRole, ModuleId[]> = {
  super_admin: [
    "dashboard", "customers", "organizations", "locations", "subscription",
    "plans", "feature-management", "audit", "system", "settings",
    "routers", "guests", "portals", "monitoring", "analytics",
    "billing", "branding", "marketplace", "rbac",
    "integrations", "api-keys", "notifications", "exports", "help",
    "vouchers", "smart-id", "whitelist", "campaigns", "devices",
    "network-monitoring", "isp-monitoring", "dscp", "vlan", "isp-routing",
    "firewall", "mac-auth", "mac-bypass", "web-filter", "captive-portal",
    "guest-login", "otp", "survey", "premium-wifi", "radius",
    "workspace", "workspace-locations", "workspace-routers", "workspace-guests",
    "workspace-staff", "workspace-analytics", "workspace-reports",
    "workspace-billing", "workspace-notifications", "workspace-audit",
    "workspace-company", "workspace-help",
    ...NEW_IA_MODULES,
  ],
  org_admin: [
    "dashboard", "locations", "subscription", "audit", "settings",
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
    "dashboard", "locations", "routers", "guests", "portals",
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
  customers: "UserSquare2",
  organizations: "Building2",
  locations: "MapPin",
  subscription: "Receipt",
  plans: "ClipboardList",
  "feature-management": "ToggleRight",
  audit: "ScrollText",
  system: "HeartPulse",
  settings: "Settings",
  routers: "Router",
  guests: "Users",
  portals: "LayoutTemplate",
  monitoring: "Activity",
  analytics: "BarChart3",
  billing: "Receipt",
  branding: "Palette",
  marketplace: "Store",
  rbac: "ShieldCheck",
  integrations: "Plug",
  "api-keys": "KeyRound",
  notifications: "Bell",
  exports: "Download",
  help: "LifeBuoy",
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
  customers: "Customers",
  organizations: "Organizations",
  locations: "Locations",
  subscription: "Subscriptions",
  plans: "Plans",
  "feature-management": "Feature management",
  audit: "Audit logs",
  system: "System health",
  settings: "Platform settings",
  routers: "Routers",
  guests: "Guests",
  portals: "Portals",
  monitoring: "Monitoring",
  analytics: "Analytics",
  billing: "Billing",
  branding: "White label",
  marketplace: "Marketplace",
  rbac: "Users & Roles",
  integrations: "Integrations",
  "api-keys": "API keys",
  notifications: "Notifications",
  exports: "Exports",
  help: "Help center",
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
  customers: "/customers",
  organizations: "/organizations",
  locations: "/locations",
  subscription: "/subscription",
  plans: "/plans",
  "feature-management": "/feature-management",
  audit: "/audit",
  system: "/system",
  settings: "/settings",
  routers: "/routers",
  guests: "/guests",
  portals: "/portals",
  monitoring: "/monitoring",
  analytics: "/analytics",
  billing: "/billing",
  branding: "/branding",
  marketplace: "/marketplace",
  rbac: "/rbac",
  integrations: "/integrations",
  "api-keys": "/api-keys",
  notifications: "/notifications",
  exports: "/exports",
  help: "/help",
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

type GroupId = "platform" | "operations" | "growth" | "system" | "support" | "workspace";

const GROUP_META: Record<GroupId, { label: string; order: number }> = {
  platform: { label: "Platform administration", order: 10 },
  operations: { label: "Operations", order: 20 },
  growth: { label: "Growth", order: 30 },
  system: { label: "System", order: 40 },
  support: { label: "Support", order: 50 },
  workspace: { label: "Customer workspace", order: 5 },
};

const MODULE_GROUP: Partial<Record<ModuleId, GroupId>> = {
  dashboard: "platform", customers: "platform", organizations: "platform",
  locations: "platform", subscription: "platform", plans: "platform",
  "feature-management": "platform", audit: "platform", system: "platform",
  settings: "platform",
  routers: "operations", guests: "operations", portals: "operations",
  monitoring: "operations", analytics: "operations",
  billing: "growth", branding: "growth", marketplace: "growth", rbac: "growth",
  integrations: "system", "api-keys": "system", notifications: "system", exports: "system",
  help: "support",
};

const MODULE_ORDER: ModuleId[] = [
  "dashboard", "customers", "organizations", "locations", "subscription",
  "plans", "feature-management", "audit", "system", "settings",
  "routers", "guests", "portals", "monitoring", "analytics",
  "billing", "branding", "marketplace", "rbac",
  "integrations", "api-keys", "notifications", "exports", "help",
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
  const byGroup = new Map<GroupId, SidebarNode[]>();
  MODULE_ORDER.forEach((id, i) => {
    const m = modules[id];
    if (!m) return;
    const visible = m.view || m.locked;
    if (!visible) return;
    const groupId = MODULE_GROUP[id] ?? "operations";
    const arr = byGroup.get(groupId) ?? [];
    arr.push(buildNode(id, i, !!m.locked && !m.view));
    byGroup.set(groupId, arr);
  });
  return Array.from(byGroup.entries())
    .map(([id, items]) => ({ id, label: GROUP_META[id].label, order: GROUP_META[id].order, items }))
    .sort((a, b) => a.order - b.order);
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
