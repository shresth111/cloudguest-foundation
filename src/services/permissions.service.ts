import type { UserRole } from "@/types/auth";
import type { ModuleId, PermissionMap } from "@/types/permissions";

/**
 * Mock permissions endpoint. Shape mirrors what the real backend
 * will return so it can be swapped later without touching consumers.
 *
 * GET /api/v1/me/permissions -> { modules: PermissionMap }
 */

const BASE_BY_ROLE: Record<UserRole, ModuleId[]> = {
  super_admin: [
    "dashboard", "customers", "organizations", "locations", "subscription",
    "plans", "feature-management", "audit", "system", "settings",
    "routers", "guests", "portals", "monitoring", "analytics",
    "billing", "branding", "marketplace", "rbac",
    "integrations", "api-keys", "notifications", "exports", "help",
    "workspace", "workspace-locations", "workspace-routers", "workspace-guests",
    "workspace-staff", "workspace-analytics", "workspace-reports",
    "workspace-billing", "workspace-notifications", "workspace-audit",
    "workspace-company", "workspace-help",
  ],
  org_admin: [
    "dashboard", "locations", "subscription", "audit", "settings",
    "routers", "guests", "portals", "monitoring", "analytics",
    "billing", "branding", "marketplace", "rbac",
    "integrations", "api-keys", "notifications", "exports", "help",
    "workspace", "workspace-locations", "workspace-routers", "workspace-guests",
    "workspace-staff", "workspace-analytics", "workspace-reports",
    "workspace-billing", "workspace-notifications", "workspace-audit",
    "workspace-company", "workspace-help",
  ],
  location_manager: [
    "dashboard", "locations", "routers", "guests", "portals",
    "monitoring", "notifications", "help",
    "workspace", "workspace-locations", "workspace-routers", "workspace-guests",
    "workspace-staff", "workspace-notifications", "workspace-help",
  ],
  support_engineer: [
    "dashboard", "audit", "system", "routers", "monitoring",
    "notifications", "help", "workspace-audit", "workspace-help",
  ],
  read_only: [
    "dashboard", "guests", "analytics", "notifications", "help",
    "workspace", "workspace-locations", "workspace-guests",
    "workspace-analytics", "workspace-notifications", "workspace-help",
  ],
};

/** Modules that stay visible-but-locked instead of hidden for a given role. */
const LOCKED_BY_ROLE: Partial<Record<UserRole, ModuleId[]>> = {
  location_manager: ["analytics", "billing", "branding"],
  read_only: ["portals", "monitoring", "billing", "branding", "settings"],
  support_engineer: ["billing", "branding", "analytics"],
};

function delay<T>(v: T, ms = 250): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

export const permissionsService = {
  async getPermissions(role: UserRole): Promise<{ modules: PermissionMap }> {
    const allowed = new Set(BASE_BY_ROLE[role] ?? []);
    const locked = new Set(LOCKED_BY_ROLE[role] ?? []);
    const modules: PermissionMap = {};
    for (const id of allowed) modules[id] = { view: true };
    for (const id of locked) modules[id] = { view: false, locked: true };
    return delay({ modules });
  },
};
