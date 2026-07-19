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

export interface ModulePermission {
  view: boolean;
  /** When true, the module renders in the sidebar as a locked (disabled) item instead of being hidden. */
  locked?: boolean;
}

export type PermissionMap = Partial<Record<ModuleId, ModulePermission>>;
