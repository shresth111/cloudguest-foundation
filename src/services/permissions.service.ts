import type { LegacyRoleBucket as UserRole } from "@/lib/roles";
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
import { rbacService } from "@/services/rbac.service";

/**
 * The module tree/action-map/sidebar below is a frontend-owned IA
 * (information architecture) table, not backend data -- there is no
 * "sidebar layout" or "dashboard widget order" concept in the real
 * backend, so BASE_BY_ROLE/LOCKED_BY_ROLE/etc. legitimately stay local.
 *
 * What IS real: `getPermissions` additionally fetches the caller's actual
 * RBAC permission keys (GET /users/{id}/permissions, via
 * rbacService.getUserPermissions -- already a live integration) and, for
 * the subset of modules with an unambiguous backend permission-domain
 * match (MODULE_PERMISSION_PREFIX below), downgrades `view` to false when
 * the real backend says the user lacks `<prefix>.read`. This only ever
 * *removes* a grant the static table over-offered -- it never adds one --
 * and fails open (falls back to the static table untouched) if the fetch
 * errors, e.g. a non-admin bucket lacking `users.read` on itself gets a
 * 403 from that endpoint. Modules with no clean single backend-domain
 * match (dashboard, workspace-*, rbac, guests, portals, ...) are left
 * exactly as the static table decides, same as before this change.
 */
const MODULE_PERMISSION_PREFIX: Partial<Record<ModuleId, string>> = {
  organizations: "organizations",
  locations: "locations",
  "location-master": "locations",
  subscription: "subscriptions",
  audit: "audit_logs",
  routers: "routers",
  monitoring: "monitoring",
  billing: "billing",
  vlan: "vlan",
  "api-keys": "api_keys",
  notifications: "notifications",
  campaigns: "campaigns",
  dscp: "qos",
  "isp-routing": "isp_routing",
  firewall: "firewall",
  "mac-auth": "mac_authorization",
  "queue-management": "queue_management",
  "port-forwarding": "port_forwarding",
  "guest-access": "guest_access",
  "guest-teams": "guest_teams",
  hotspot: "hotspot",
  "captive-portal": "captive_portal",
  otp: "otp",
  radius: "radius",
  "network-dhcp": "dhcp",
  "network-dns": "dns",
  "policy-location": "policy",
  "policy-user": "policy",
  "policy-group": "policy",
  "policy-auth": "policy",
  "policy-bandwidth": "policy",
  "policy-network": "policy",
  analytics: "analytics",
  "analytics-executive": "analytics",
  "analytics-network": "analytics",
  "analytics-guest": "analytics",
  "analytics-device": "analytics",
  "analytics-isp": "analytics",
  "voucher-master": "voucher",
};

/**
 * Real permission keys the current user actually holds, or `null` if they
 * couldn't be fetched (no user id yet, or the endpoint rejected the call --
 * e.g. RequirePermission("users.read") on GET /users/{id}/permissions
 * means only admin-bucket callers can read their own key set today). A
 * `null` result means "don't override the static table" -- see module
 * docstring above.
 */
async function fetchRealPermissionKeys(userId: string | undefined): Promise<Set<string> | null> {
  if (!userId) return null;
  try {
    const keys = await rbacService.getUserPermissions(userId);
    return new Set(keys);
  } catch {
    return null;
  }
}

/** Modules to downgrade to `view: false` given a real permission-key set. */
function modulesDeniedByReal(realKeys: Set<string>): Set<ModuleId> {
  const denied = new Set<ModuleId>();
  for (const [moduleId, prefix] of Object.entries(MODULE_PERMISSION_PREFIX) as [
    ModuleId,
    string,
  ][]) {
    if (!realKeys.has(`${prefix}.read`)) denied.add(moduleId);
  }
  return denied;
}

const FULL_ACTIONS: Required<Omit<ModulePermission, "locked">> = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  export: true,
  import: true,
  approve: true,
  execute: true,
  restart: true,
  configure: true,
};

const READ_ONLY: ModulePermission = { view: true, export: true };

const NEW_IA_MODULES: ModuleId[] = [
  "network-aps",
  "network-wan",
  "network-lan",
  "network-dhcp",
  "network-dns",
  "guests-live",
  "policy-location",
  "policy-user",
  "policy-group",
  "policy-auth",
  "policy-bandwidth",
  "policy-network",
  "analytics-executive",
  "analytics-network",
  "analytics-guest",
  "analytics-device",
  "analytics-isp",
  "business-units",
  "documentation",
  "support-contact",
];

const PLATFORM_CONSOLE: ModuleId[] = [
  "dashboard",
  "location-master",
  "nas-management",
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
    "organizations",
    "locations",
  ],
  org_admin: [
    "dashboard",
    "location-master",
    "infrastructure",
    "voucher-master",
    "locations",
    "subscription",
    "audit",
    "settings",
    "routers",
    "guests",
    "portals",
    "monitoring",
    "analytics",
    "billing",
    "branding",
    "marketplace",
    "rbac",
    "integrations",
    "api-keys",
    "notifications",
    "exports",
    "help",
    "campaigns",
    "devices",
    "captive-portal",
    "vlan",
    "dscp",
    "firewall",
    "isp-routing",
    "mac-auth",
    "queue-management",
    "port-forwarding",
    "guest-access",
    "guest-teams",
    "hotspot",
    "workspace",
    "workspace-locations",
    "workspace-routers",
    "workspace-guests",
    "workspace-analytics",
    "workspace-reports",
    "workspace-billing",
    "workspace-notifications",
    "workspace-company",
    "workspace-help",
    ...NEW_IA_MODULES,
  ],
  location_manager: [
    "dashboard",
    "location-master",
    "voucher-master",
    "locations",
    "routers",
    "guests",
    "portals",
    "monitoring",
    "notifications",
    "help",
    "devices",
    "vlan",
    "guests-live",
    "mac-auth",
    "guest-access",
    "guest-teams",
    "hotspot",
    "policy-location",
    "policy-user",
    "analytics-executive",
    "analytics-guest",
    "documentation",
    "support-contact",
    "workspace",
    "workspace-locations",
    "workspace-routers",
    "workspace-guests",
    "workspace-notifications",
    "workspace-help",
  ],
  support_engineer: [
    "dashboard",
    "audit",
    "routers",
    "monitoring",
    "network-monitoring",
    "isp-monitoring",
    "devices",
    "notifications",
    "help",
    "documentation",
    "support-contact",
    "analytics-network",
    "analytics-device",
    "analytics-isp",
    "workspace-help",
  ],
  read_only: [
    "dashboard",
    "guests",
    "analytics",
    "notifications",
    "help",
    "analytics-executive",
    "analytics-guest",
    "guests-live",
    "documentation",
    "workspace",
    "workspace-locations",
    "workspace-guests",
    "workspace-analytics",
    "workspace-notifications",
    "workspace-help",
  ],
};

/** Modules that stay visible-but-locked instead of hidden for a given role. */
const LOCKED_BY_ROLE: Partial<Record<UserRole, ModuleId[]>> = {
  org_admin: ["plans", "feature-management"],
  location_manager: ["billing", "branding", "rbac", "policy-group", "policy-bandwidth"],
  read_only: [
    "portals",
    "monitoring",
    "billing",
    "branding",
    "settings",
    "policy-location",
    "policy-user",
  ],
  support_engineer: ["billing", "branding"],
};

const FEATURES_BY_ROLE: Record<UserRole, Partial<Record<FeatureFlag, boolean>>> = {
  super_admin: {
    ai_assistant: true,
    premium_wifi: true,
    campaigns: true,
    smart_id: true,
    voucher: true,
    survey: true,
    webhooks: true,
    public_api: true,
    white_label: true,
    sso: true,
    marketplace: true,
  },
  org_admin: {
    ai_assistant: true,
    premium_wifi: true,
    campaigns: true,
    voucher: true,
    survey: true,
    webhooks: true,
    public_api: true,
    white_label: true,
    marketplace: true,
  },
  location_manager: { voucher: true, campaigns: true },
  support_engineer: { public_api: true, webhooks: true },
  read_only: {},
};

const ROUTER_ACTIONS_BY_ROLE: Record<UserRole, Partial<Record<RouterAction, boolean>>> = {
  super_admin: Object.fromEntries(
    [
      "restart",
      "reboot",
      "upgrade_firmware",
      "backup",
      "restore",
      "diagnostics",
      "ping",
      "traceroute",
      "isp_test",
      "bandwidth_test",
      "mac_table",
      "arp_table",
      "dhcp",
      "dns",
      "firewall",
      "vlan",
      "dscp",
      "queue",
    ].map((a) => [a, true]),
  ) as Record<RouterAction, boolean>,
  org_admin: {
    restart: true,
    reboot: true,
    backup: true,
    restore: true,
    diagnostics: true,
    ping: true,
    traceroute: true,
    isp_test: true,
    bandwidth_test: true,
    mac_table: true,
    arp_table: true,
    dhcp: true,
    dns: true,
    firewall: true,
    vlan: true,
    dscp: true,
    queue: true,
  },
  location_manager: {
    restart: true,
    diagnostics: true,
    ping: true,
    traceroute: true,
    bandwidth_test: true,
    mac_table: true,
    arp_table: true,
  },
  support_engineer: {
    diagnostics: true,
    ping: true,
    traceroute: true,
    isp_test: true,
    bandwidth_test: true,
    mac_table: true,
    arp_table: true,
    dhcp: true,
    dns: true,
  },
  read_only: {},
};

const ICON_BY_MODULE: Partial<Record<ModuleId, string>> = {
  dashboard: "LayoutDashboard",
  "location-master": "MapPinned",
  infrastructure: "ServerCog",
  "voucher-master": "Ticket",
  "nas-management": "Router",
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
  "mac-auth": "Fingerprint",
  "queue-management": "ListOrdered",
  "port-forwarding": "ArrowRightLeft",
  hotspot: "Wifi",
  // Guest management
  "guests-live": "Users",
  guests: "Users",
  campaigns: "Megaphone",
  "guest-access": "ShieldCheck",
  "guest-teams": "Users2",
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
  audit: "ScrollText",
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
  "workspace-analytics": "BarChart3",
  "workspace-reports": "ScrollText",
  "workspace-billing": "Receipt",
  "workspace-notifications": "Bell",
  "workspace-company": "Building2",
  "workspace-help": "LifeBuoy",
};

const LABEL_BY_MODULE: Partial<Record<ModuleId, string>> = {
  dashboard: "Dashboard",
  "location-master": "Location Master",
  infrastructure: "Infrastructure",
  "voucher-master": "Voucher Master",
  "nas-management": "NAS Management",
  "feature-catalog": "Feature Catalog",
  "plans-billing": "Plans & Billing",
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
  "mac-auth": "MAC Authorization",
  "queue-management": "Queue Management",
  "port-forwarding": "Port Forwarding",
  hotspot: "Hotspot Profiles",
  "guests-live": "Live Guests",
  guests: "Guests",
  campaigns: "Campaigns",
  "guest-access": "Guest Access Rules",
  "guest-teams": "Guest Teams",
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
  audit: "Audit Logs",
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
  "workspace-analytics": "Analytics",
  "workspace-reports": "Reports",
  "workspace-billing": "Billing",
  "workspace-notifications": "Notifications",
  "workspace-company": "Company settings",
  "workspace-help": "Help center",
};

const ROUTE_BY_MODULE: Partial<Record<ModuleId, string>> = {
  dashboard: "/dashboard",
  "location-master": "/locations",
  infrastructure: "/infrastructure",
  "voucher-master": "/vouchers",
  "nas-management": "/nas",
  "feature-catalog": "/feature-catalog",
  "plans-billing": "/plans",
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
  "mac-auth": "/network/mac-authorization",
  "queue-management": "/network/queue-management",
  "port-forwarding": "/network/port-forwarding",
  hotspot: "/network/hotspot",
  "guests-live": "/guests",
  guests: "/guests",
  campaigns: "/campaigns",
  "guest-access": "/guests/access-rules",
  "guest-teams": "/guests/teams",
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
  audit: "/audit",
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
  "workspace-analytics": "/workspace/analytics",
  "workspace-reports": "/workspace/reports",
  "workspace-billing": "/workspace/billing",
  "workspace-notifications": "/workspace/notifications",
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
  platform: { label: "CloudGuest", order: 1 },
  dashboard: { label: "Dashboard", order: 10 },
  network: { label: "Network", order: 20 },
  guests: { label: "Guest Management", order: 30 },
  policies: { label: "Policies", order: 40 },
  analytics: { label: "Analytics", order: 50 },
  operations: { label: "Operations", order: 60 },
  administration: { label: "Administration", order: 70 },
  support: { label: "Support", order: 80 },
  system: { label: "System", order: 90 },
  workspace: { label: "Customer workspace", order: 5 },
};

/**
 * FE-024 Primary IA — a flat list surfaced at the top of the sidebar.
 * Everything else remains available in secondary groups below for power users.
 */
const PRIMARY_IA: ModuleId[] = [
  "dashboard",
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
  routers: "network",
  "network-aps": "network",
  vlan: "network",
  "isp-routing": "network",
  "network-wan": "network",
  "network-lan": "network",
  dscp: "network",
  firewall: "network",
  "network-dhcp": "network",
  "network-dns": "network",
  "mac-auth": "network",
  "queue-management": "network",
  "port-forwarding": "network",
  hotspot: "network",
  // Guest management
  "guests-live": "guests",
  campaigns: "guests",
  "guest-access": "guests",
  "guest-teams": "guests",
  // Policies
  "policy-user": "policies",
  "policy-group": "policies",
  "policy-auth": "policies",
  "policy-bandwidth": "policies",
  "policy-network": "policies",
  // Analytics
  "analytics-executive": "analytics",
  "analytics-network": "analytics",
  "analytics-guest": "analytics",
  "analytics-device": "analytics",
  "analytics-isp": "analytics",
  // Operations
  monitoring: "operations",
  // Administration
  organizations: "administration",
  "business-units": "administration",
  locations: "administration",
  rbac: "administration",
  "feature-management": "administration",
  subscription: "administration",
  plans: "administration",
  // Support
  help: "support",
  documentation: "support",
  "support-contact": "support",
  // System
  integrations: "system",
  "api-keys": "system",
  notifications: "system",
  exports: "system",
  branding: "system",
  marketplace: "system",
  portals: "system",
  guests: "guests",
};

const MODULE_ORDER: ModuleId[] = [
  // Network
  "routers",
  "network-aps",
  "vlan",
  "isp-routing",
  "network-wan",
  "network-lan",
  "dscp",
  "firewall",
  "network-dhcp",
  "network-dns",
  "mac-auth",
  "queue-management",
  "port-forwarding",
  "hotspot",
  // Guests
  "guests-live",
  "campaigns",
  "guest-access",
  "guest-teams",
  // Policies
  "policy-user",
  "policy-group",
  "policy-auth",
  "policy-bandwidth",
  "policy-network",
  // Analytics
  "analytics-executive",
  "analytics-network",
  "analytics-guest",
  "analytics-device",
  "analytics-isp",
  // Operations
  "monitoring",
  // Administration
  "organizations",
  "business-units",
  "locations",
  "rbac",
  "feature-management",
  "subscription",
  "plans",
  // Support
  "help",
  "documentation",
  "support-contact",
  // System
  "integrations",
  "api-keys",
  "notifications",
  "exports",
  "branding",
  "marketplace",
  "portals",
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
    ? {
        id: "platform",
        label: GROUP_META.platform.label,
        order: GROUP_META.platform.order,
        items: primaryItems,
      }
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

function buildPlatformConsoleSidebar(modules: PermissionMap): SidebarGroupDef[] {
  const items: SidebarNode[] = [];
  PLATFORM_CONSOLE.forEach((id, i) => {
    const m = modules[id];
    if (!m) return;
    if (!(m.view || m.locked)) return;
    items.push(buildNode(id, i, !!m.locked && !m.view));
  });
  if (items.length === 0) return [];
  return [
    {
      id: "platform",
      label: "Platform Console",
      order: 1,
      items,
    },
  ];
}

/**
 * The customer workspace's full nav tree (Organization/Network/Guest
 * Access/Captive Portal/Monitoring/Analytics/Automation/Security/
 * Settings), per the IA the user specified directly. Every leaf links to
 * an already-real, already-backend-wired page -- reusing the platform
 * console's own pages (scoped to the signed-in user's own org via the
 * same X-Organization-Id/session mechanism those pages already use) per
 * the confirmed "new nav shell linking to existing real pages" approach,
 * rather than duplicating ~50 pages that mostly already exist. A few
 * leaves (Provisioning, Radius, OTP, Session Policies, Auto Provisioning)
 * have no dedicated real page yet -- those point at the closest existing
 * real page rather than a dead link; see the inline comment on each.
 *
 * Deliberately NOT built on the generic ModuleId/MODULE_PERMISSION_PREFIX
 * system every other sidebar group uses: that system is one ModuleId ->
 * one canonical route, and this tree needs several *different* labels
 * pointing at the *same* underlying route (e.g. "Audit Logs" and "Admin
 * Logs" both -> /audit), which the 1:1 mapping doesn't support cleanly.
 * The real permission check still happens where it matters -- each
 * destination page/route enforces its own RequirePermission-backed access
 * control server-side -- this tree just isn't individually gated leaf-by-
 * leaf the way MODULE_PERMISSION_PREFIX-covered items are.
 */
function buildOwnerWorkspaceSidebar(): SidebarGroupDef[] {
  const g = (id: string, label: string, order: number, items: Omit<SidebarNode, "order">[]) => ({
    id,
    label,
    order,
    items: items.map((it, i) => ({ ...it, order: i })),
  });

  return [
    g("ws-overview", "Overview", 0, [
      { id: "ws-dashboard", label: "Dashboard", icon: "LayoutDashboard", to: "/workspace" },
    ]),
    g("ws-organization", "Organization", 10, [
      { id: "ws-org-locations", label: "Locations", icon: "MapPin", to: "/workspace/locations" },
      // /rbac's listUsers omits X-Organization-Id -- traced into
      // backend/app/domains/user/service.py's list_users: when the header
      // is absent it returns EVERY user platform-wide, with no check that
      // the caller is actually Super Admin first. A real cross-tenant
      // leak for any org-scoped Owner/Agent -- see workspace.pending-scope.tsx.
      { id: "ws-org-users", label: "Users", icon: "Users", to: "/workspace/pending-scope" },
      { id: "ws-org-roles", label: "Roles", icon: "ShieldCheck", to: "/workspace/pending-scope" },
    ]),
    g("ws-network", "Network", 20, [
      { id: "ws-net-routers", label: "Routers", icon: "Router", to: "/workspace/routers" },
      // No dedicated provisioning workflow page yet -- routers list is the
      // real, closest entry point today.
      { id: "ws-net-provisioning", label: "Provisioning", icon: "ServerCog", to: "/workspace/routers" },
      { id: "ws-net-vlan", label: "VLAN", icon: "Network", to: "/network/vlan" },
      { id: "ws-net-dhcp", label: "DHCP", icon: "Share2", to: "/network/dhcp" },
      { id: "ws-net-hotspot", label: "Hotspot", icon: "Wifi", to: "/network/hotspot" },
      // RADIUS clients are managed via the NAS registry -- but /nas fans
      // out across EVERY organization (no per-org scoping exists there),
      // a real cross-tenant leak if linked from the customer workspace.
      // Routers is the closest safe, already org-scoped destination until
      // a workspace-scoped NAS view exists.
      { id: "ws-net-radius", label: "Radius", icon: "Radio", to: "/workspace/routers" },
      { id: "ws-net-firewall", label: "Firewall", icon: "Shield", to: "/network/firewall" },
    ]),
    g("ws-guest-access", "Guest Access", 30, [
      // portal.service.ts's list() fans out across every organization
      // (fetchAllConfigs) with no per-org filter -- same leak class as
      // NAS/Users. Every /portals-linked leaf below is neutralized until
      // that service gets real org scoping.
      { id: "ws-ga-login-methods", label: "Login Methods", icon: "KeyRound", to: "/workspace/pending-scope" },
      // voucher.service.ts's own comment: "Platform-wide 'Voucher Master'
      // view -- omits X-Organization-Id" -- deliberate for the platform
      // console, but a real leak if reachable from the customer workspace.
      { id: "ws-ga-voucher", label: "Voucher", icon: "Ticket", to: "/workspace/pending-scope" },
      // OTP attempt/rate policy -- there's no separate OTP admin page.
      { id: "ws-ga-otp", label: "OTP", icon: "Smartphone", to: "/policies/authentication" },
      { id: "ws-ga-social", label: "Social Login", icon: "Users2", to: "/workspace/pending-scope" },
      { id: "ws-ga-whitelist", label: "Whitelist", icon: "Fingerprint", to: "/network/mac-authorization" },
      { id: "ws-ga-session-policies", label: "Session Policies", icon: "Clock", to: "/policies/user" },
    ]),
    g("ws-captive-portal", "Captive Portal", 40, [
      { id: "ws-cp-branding", label: "Branding", icon: "Palette", to: "/branding" },
      { id: "ws-cp-templates", label: "Templates", icon: "LayoutTemplate", to: "/workspace/pending-scope" },
      { id: "ws-cp-landing", label: "Landing Page", icon: "LayoutTemplate", to: "/workspace/pending-scope" },
      { id: "ws-cp-campaigns", label: "Campaigns", icon: "Megaphone", to: "/campaigns" },
      { id: "ws-cp-surveys", label: "Surveys", icon: "MessageSquare", to: "/campaigns" },
      { id: "ws-cp-redirect", label: "Redirect URL", icon: "Globe", to: "/workspace/pending-scope" },
    ]),
    g("ws-monitoring", "Monitoring", 50, [
      { id: "ws-mon-live-users", label: "Live Users", icon: "Users", to: "/guests" },
      { id: "ws-mon-sessions", label: "Active Sessions", icon: "Activity", to: "/monitoring" },
      { id: "ws-mon-device-health", label: "Device Health", icon: "HeartPulse", to: "/monitoring" },
      { id: "ws-mon-isp", label: "ISP Status", icon: "Cable", to: "/network/isp" },
      { id: "ws-mon-wan", label: "WAN Health", icon: "Signal", to: "/network/wan" },
      { id: "ws-mon-alerts", label: "Alerts", icon: "BellRing", to: "/monitoring" },
    ]),
    g("ws-analytics", "Analytics", 60, [
      { id: "ws-an-user", label: "User Report", icon: "PieChart", to: "/analytics/guest" },
      { id: "ws-an-voucher", label: "Voucher Report", icon: "Ticket", to: "/workspace/pending-scope" },
      { id: "ws-an-otp", label: "OTP Report", icon: "BarChart3", to: "/analytics" },
      // billing.service.ts's getSnapshot() fans out across every
      // organization (fetchAllOrganizations) -- same leak class as NAS.
      { id: "ws-an-revenue", label: "Revenue Report", icon: "Receipt", to: "/workspace/pending-scope" },
      { id: "ws-an-campaign", label: "Campaign Report", icon: "Megaphone", to: "/campaigns" },
      { id: "ws-an-export", label: "Export", icon: "Download", to: "/exports" },
    ]),
    g("ws-automation", "Automation", 70, [
      { id: "ws-auto-reports", label: "Scheduled Reports", icon: "FileClock", to: "/analytics" },
      // No dedicated auto-provisioning workflow yet -- routers list is the
      // real, closest entry point today.
      { id: "ws-auto-provisioning", label: "Auto Provisioning", icon: "ServerCog", to: "/workspace/routers" },
      { id: "ws-auto-webhooks", label: "Webhooks", icon: "Plug", to: "/api-keys" },
      { id: "ws-auto-integrations", label: "Integrations", icon: "Plug", to: "/settings" },
    ]),
    g("ws-security", "Security", 80, [
      // audit.service.ts's AuditListQuery has no organizationId field at
      // all -- structurally impossible to scope from the frontend today,
      // and the underlying /audit/entries list is platform-wide.
      { id: "ws-sec-audit", label: "Audit Logs", icon: "ScrollText", to: "/workspace/pending-scope" },
      { id: "ws-sec-admin-logs", label: "Admin Logs", icon: "ScrollText", to: "/workspace/pending-scope" },
      { id: "ws-sec-api-keys", label: "API Keys", icon: "KeyRound", to: "/api-keys" },
      { id: "ws-sec-sso", label: "SSO", icon: "ShieldAlert", to: "/settings" },
      { id: "ws-sec-mfa", label: "MFA", icon: "ShieldCheck", to: "/account" },
    ]),
    g("ws-settings", "Settings", 90, [
      { id: "ws-set-branding", label: "Branding", icon: "Palette", to: "/branding" },
      { id: "ws-set-domains", label: "Domains", icon: "Globe", to: "/branding" },
      { id: "ws-set-email", label: "Email", icon: "Mail", to: "/settings" },
      { id: "ws-set-sms", label: "SMS", icon: "MessageSquare", to: "/settings" },
      { id: "ws-set-billing", label: "Billing", icon: "Receipt", to: "/workspace/billing" },
      { id: "ws-set-subscription", label: "Subscription", icon: "CreditCard", to: "/subscription" },
      { id: "ws-set-integrations", label: "Integrations", icon: "Plug", to: "/settings" },
    ]),
  ];
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
        {
          id: "BU-NIM-N",
          organizationId: "ORG-01000",
          name: "North India",
          region: "IN-N",
          locationIds: ["LOC-DEL", "LOC-JAI"],
        },
        {
          id: "BU-NIM-W",
          organizationId: "ORG-01000",
          name: "West India",
          region: "IN-W",
          locationIds: ["LOC-BOM", "LOC-GOA"],
        },
      ],
    },
    {
      id: "ORG-01001",
      name: "Vertex Retail",
      businessUnits: [
        {
          id: "BU-VER-US",
          organizationId: "ORG-01001",
          name: "US East",
          region: "US-E",
          locationIds: ["LOC-NYC", "LOC-CHI"],
        },
      ],
    },
  ],
  org_admin: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        {
          id: "BU-NIM-N",
          organizationId: "ORG-01000",
          name: "North India",
          region: "IN-N",
          locationIds: ["LOC-DEL", "LOC-JAI"],
        },
        {
          id: "BU-NIM-W",
          organizationId: "ORG-01000",
          name: "West India",
          region: "IN-W",
          locationIds: ["LOC-BOM", "LOC-GOA"],
        },
      ],
    },
  ],
  location_manager: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        {
          id: "BU-NIM-N",
          organizationId: "ORG-01000",
          name: "North India",
          region: "IN-N",
          locationIds: ["LOC-DEL"],
        },
      ],
    },
  ],
  support_engineer: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        {
          id: "BU-NIM-N",
          organizationId: "ORG-01000",
          name: "North India",
          region: "IN-N",
          locationIds: ["LOC-DEL", "LOC-JAI"],
        },
        {
          id: "BU-NIM-W",
          organizationId: "ORG-01000",
          name: "West India",
          region: "IN-W",
          locationIds: ["LOC-BOM", "LOC-GOA"],
        },
      ],
    },
  ],
  read_only: [
    {
      id: "ORG-01000",
      name: "Nimbus Hospitality",
      businessUnits: [
        {
          id: "BU-NIM-N",
          organizationId: "ORG-01000",
          name: "North India",
          region: "IN-N",
          locationIds: ["LOC-DEL"],
        },
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
      {
        id: "trend",
        kind: "trend-chart",
        title: "Growth trends",
        size: "lg",
        order: 20,
        requires: { module: "analytics" },
      },
      {
        id: "health",
        kind: "health-chart",
        title: "Platform health",
        size: "md",
        order: 30,
        requires: { module: "monitoring" },
      },
      {
        id: "usage",
        kind: "usage-chart",
        title: "Bandwidth usage",
        size: "md",
        order: 40,
        requires: { module: "monitoring" },
      },
      {
        id: "top-locs",
        kind: "top-locations",
        title: "Top locations",
        size: "md",
        order: 50,
        requires: { module: "locations" },
      },
      {
        id: "activity",
        kind: "recent-activity",
        title: "Recent activity",
        size: "lg",
        order: 60,
        requires: { module: "audit" },
      },
      {
        id: "notifs",
        kind: "notifications-preview",
        title: "Notifications",
        size: "md",
        order: 70,
        requires: { module: "notifications" },
      },
    ];
  }
  if (role === "org_admin" || role === "location_manager") {
    return [
      ...base,
      {
        id: "usage",
        kind: "usage-chart",
        title: "Live usage",
        size: "lg",
        order: 20,
        requires: { module: "monitoring" },
      },
      { id: "activity", kind: "recent-activity", title: "Recent activity", size: "lg", order: 30 },
      {
        id: "notifs",
        kind: "notifications-preview",
        title: "Notifications",
        size: "md",
        order: 40,
      },
      { id: "quick", kind: "quick-actions", title: "Quick actions", size: "md", order: 50 },
    ];
  }
  if (role === "support_engineer") {
    return [
      ...base,
      {
        id: "health",
        kind: "health-chart",
        title: "Router health",
        size: "lg",
        order: 20,
        requires: { module: "monitoring" },
      },
      {
        id: "activity",
        kind: "recent-activity",
        title: "Recent tickets",
        size: "lg",
        order: 30,
        requires: { module: "audit" },
      },
    ];
  }
  return [
    ...base,
    { id: "activity", kind: "recent-activity", title: "Recent activity", size: "xl", order: 20 },
  ];
}

/* ---------------- Topbar (backend-driven) ---------------- */

function topbarForRole(
  role: UserRole,
  features: Partial<Record<FeatureFlag, boolean>>,
): TopbarConfig {
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
  async getPermissions(
    role: UserRole,
    _locationId?: string,
    userId?: string,
  ): Promise<PermissionEnvelope> {
    const allowed = new Set(BASE_BY_ROLE[role] ?? []);
    const locked = new Set(LOCKED_BY_ROLE[role] ?? []);
    const modules: PermissionMap = {};
    for (const id of allowed) {
      modules[id] =
        role === "super_admin" || role === "org_admin"
          ? { ...FULL_ACTIONS }
          : role === "location_manager"
            ? { view: true, create: true, edit: true, export: true, execute: true, restart: true }
            : role === "support_engineer"
              ? {
                  view: true,
                  edit: true,
                  export: true,
                  execute: true,
                  restart: true,
                  configure: true,
                }
              : READ_ONLY;
    }
    for (const id of locked) modules[id] = { view: false, locked: true };

    // Real-permission downgrade -- see MODULE_PERMISSION_PREFIX's docstring.
    // Never grants beyond what the static table above already decided.
    const realKeys = await fetchRealPermissionKeys(userId);
    if (realKeys) {
      for (const id of modulesDeniedByReal(realKeys)) {
        if (modules[id]) modules[id] = { ...modules[id], view: false };
      }
    }

    // FE-025: Super Admin's *console* sidebar (outside /workspace) is the
    // Platform Console only. Inside /workspace, every role -- including
    // super_admin, who workspace.tsx's own ALLOWED list already lets in --
    // gets the same real Owner workspace tree; AppSidebar picks between
    // these two arrays purely on the current pathname, not role.
    const consoleSidebar: SidebarGroupDef[] =
      role === "super_admin" ? buildPlatformConsoleSidebar(modules) : buildConsoleSidebar(modules);
    const workspaceSidebar: SidebarGroupDef[] = buildOwnerWorkspaceSidebar();

    return delay({
      modules,
      features: applyFeatureOverrides(FEATURES_BY_ROLE[role]),
      routerActions: ROUTER_ACTIONS_BY_ROLE[role],
      locationScope: [],
      sidebar: { console: consoleSidebar, workspace: workspaceSidebar },
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
      role === "super_admin"
        ? "super-admin"
        : role === "support_engineer"
          ? "support"
          : role === "read_only"
            ? "read-only"
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
export type {
  BusinessUnit,
  AssignedOrganization,
  AssignmentEnvelope,
  TopbarConfig,
  RouterCapabilities,
};
export type { DashboardLayout, DashboardWidget };
