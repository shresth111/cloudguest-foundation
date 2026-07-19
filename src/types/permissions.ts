export type ModuleId =
  | "dashboard"
  | "customers"
  | "organizations"
  | "locations"
  | "subscription"
  | "plans"
  | "feature-management"
  | "audit"
  | "system"
  | "settings"
  | "routers"
  | "guests"
  | "portals"
  | "monitoring"
  | "analytics"
  | "billing"
  | "branding"
  | "marketplace"
  | "rbac"
  | "integrations"
  | "api-keys"
  | "notifications"
  | "exports"
  | "help"
  | "vouchers"
  | "smart-id"
  | "whitelist"
  | "campaigns"
  | "devices"
  | "network-monitoring"
  | "isp-monitoring"
  | "dscp"
  | "vlan"
  | "isp-routing"
  | "firewall"
  | "mac-auth"
  | "mac-bypass"
  | "web-filter"
  | "captive-portal"
  | "guest-login"
  | "otp"
  | "survey"
  | "premium-wifi"
  | "radius"
  | "workspace"
  | "workspace-locations"
  | "workspace-routers"
  | "workspace-guests"
  | "workspace-staff"
  | "workspace-analytics"
  | "workspace-reports"
  | "workspace-billing"
  | "workspace-notifications"
  | "workspace-audit"
  | "workspace-company"
  | "workspace-help";

/** Standard per-module actions supported by the permission engine. */
export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "import"
  | "approve"
  | "execute"
  | "restart"
  | "configure";

export const ALL_ACTIONS: PermissionAction[] = [
  "view", "create", "edit", "delete", "export",
  "import", "approve", "execute", "restart", "configure",
];

export interface ModulePermission {
  view: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  export?: boolean;
  import?: boolean;
  approve?: boolean;
  execute?: boolean;
  restart?: boolean;
  configure?: boolean;
  /** When true, the module renders as a locked (disabled) item instead of being hidden. */
  locked?: boolean;
}

export type PermissionMap = Partial<Record<ModuleId, ModulePermission>>;

/** Router-level operational actions returned by the backend per user + router scope. */
export type RouterAction =
  | "restart"
  | "reboot"
  | "upgrade_firmware"
  | "backup"
  | "restore"
  | "diagnostics"
  | "ping"
  | "traceroute"
  | "isp_test"
  | "bandwidth_test"
  | "mac_table"
  | "arp_table"
  | "dhcp"
  | "dns"
  | "firewall"
  | "vlan"
  | "dscp"
  | "queue";

export type FeatureFlag =
  | "ai_assistant"
  | "premium_wifi"
  | "campaigns"
  | "smart_id"
  | "voucher"
  | "survey"
  | "webhooks"
  | "public_api"
  | "white_label"
  | "sso"
  | "marketplace";

/** Backend-shaped sidebar item. Frontend resolves `icon` via a name map. */
export interface SidebarNode {
  id: string;
  moduleId?: ModuleId;
  label: string;
  /** lucide-react icon name (kebab or PascalCase). */
  icon?: string;
  to?: string;
  order: number;
  badge?: { text: string; tone?: "default" | "primary" | "success" | "warning" | "danger" };
  counter?: number;
  locked?: boolean;
  children?: SidebarNode[];
}

export interface SidebarGroupDef {
  id: string;
  label: string;
  order: number;
  items: SidebarNode[];
}

export interface PermissionEnvelope {
  modules: PermissionMap;
  features: Partial<Record<FeatureFlag, boolean>>;
  routerActions: Partial<Record<RouterAction, boolean>>;
  /** Locations the user may access. Empty = all. */
  locationScope: string[];
  sidebar: {
    console: SidebarGroupDef[];
    workspace: SidebarGroupDef[];
  };
}
