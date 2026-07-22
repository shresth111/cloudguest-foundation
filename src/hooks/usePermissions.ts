import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { permissionsService } from "@/services/permissions.service";
import { useAuth } from "@/context/AuthContext";
import { legacyRoleBucket } from "@/lib/roles";
import { permissionsBus } from "@/lib/permissionsBus";
import type {
  AssignmentEnvelope,
  FeatureFlag,
  ModuleId,
  PermissionAction,
  PermissionEnvelope,
  PermissionMap,
  RouterAction,
  RouterCapabilities,
  SidebarGroupDef,
  TopbarConfig,
} from "@/types/permissions";
import type { DashboardLayout } from "@/types/dashboard-layout";

const ACTIVE_LOC_KEY = "cg.workspace.activeLoc";

export const permissionKeys = {
  me: (role: string, locationId: string) => ["permissions", role, locationId] as const,
  assignments: (role: string) => ["permissions", "assignments", role] as const,
  dashboardLayout: (role: string, locationId: string) =>
    ["permissions", "dashboard-layout", role, locationId] as const,
  topbar: (role: string) => ["permissions", "topbar", role] as const,
  router: (role: string, routerId: string) =>
    ["permissions", "router-caps", role, routerId] as const,
};

function readActiveLocation(): string {
  try {
    return localStorage.getItem(ACTIVE_LOC_KEY) ?? "all";
  } catch {
    return "all";
  }
}

const EMPTY_SIDEBAR: { console: SidebarGroupDef[]; workspace: SidebarGroupDef[] } = {
  console: [],
  workspace: [],
};

/**
 * Wire the pub/sub so any `permissionsBus.emit(...)` — a mock
 * feature-flag toggle today, a websocket push tomorrow — invalidates
 * the permission query. Every consumer subscribed via TanStack Query
 * re-renders automatically.
 */
function usePermissionBusInvalidation() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unsub = permissionsBus.subscribe((event) => {
      switch (event.type) {
        case "permissions:changed":
        case "feature-flags:changed":
          queryClient.invalidateQueries({ queryKey: ["permissions"] });
          break;
        case "dashboard-layout:changed":
          queryClient.invalidateQueries({ queryKey: ["permissions", "dashboard-layout"] });
          break;
        case "topbar:changed":
          queryClient.invalidateQueries({ queryKey: ["permissions", "topbar"] });
          break;
        case "router-capabilities:changed":
          queryClient.invalidateQueries({ queryKey: ["permissions", "router-caps"] });
          break;
      }
    });
    return () => { unsub(); };
  }, [queryClient]);
}

export function usePermissions() {
  usePermissionBusInvalidation();
  const { user, roles } = useAuth();
  const locationId = readActiveLocation();
  const bucket = legacyRoleBucket(roles);
  const q = useQuery({
    queryKey: permissionKeys.me(bucket, locationId),
    queryFn: () => permissionsService.getPermissions(bucket, locationId),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const envelope: PermissionEnvelope | undefined = q.data;
  const modules: PermissionMap = envelope?.modules ?? {};

  const can = (id: ModuleId, action: PermissionAction = "view") => !!modules[id]?.[action];
  const isLocked = (id: ModuleId) => !!modules[id]?.locked;
  const isVisible = (id: ModuleId) => can(id) || isLocked(id);

  const hasFeature = (flag: FeatureFlag) => !!envelope?.features?.[flag];
  const canRouterAction = (action: RouterAction) => !!envelope?.routerActions?.[action];

  const canAccessLocation = (id: string) => {
    const scope = envelope?.locationScope ?? [];
    return scope.length === 0 || scope.includes(id);
  };

  return {
    modules,
    can,
    isLocked,
    isVisible,
    hasFeature,
    canRouterAction,
    canAccessLocation,
    sidebar: envelope?.sidebar ?? EMPTY_SIDEBAR,
    features: envelope?.features ?? {},
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}

export function useAssignments() {
  const { user, roles } = useAuth();
  const bucket = legacyRoleBucket(roles);
  return useQuery<AssignmentEnvelope>({
    queryKey: permissionKeys.assignments(bucket),
    queryFn: () => permissionsService.getAssignments(bucket),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardLayout() {
  const { user, roles } = useAuth();
  const locationId = readActiveLocation();
  const bucket = legacyRoleBucket(roles);
  return useQuery<DashboardLayout>({
    queryKey: permissionKeys.dashboardLayout(bucket, locationId),
    queryFn: () => permissionsService.getDashboardLayout(bucket, locationId),
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useTopbarConfig() {
  const { user, roles } = useAuth();
  const bucket = legacyRoleBucket(roles);
  return useQuery<TopbarConfig>({
    queryKey: permissionKeys.topbar(bucket),
    queryFn: () => permissionsService.getTopbarConfig(bucket),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRouterCapabilities(routerId: string | undefined) {
  const { user, roles } = useAuth();
  const bucket = legacyRoleBucket(roles);
  return useQuery<RouterCapabilities>({
    queryKey: permissionKeys.router(bucket, routerId ?? "none"),
    queryFn: () => permissionsService.getRouterCapabilities(bucket, routerId!),
    enabled: !!user && !!routerId,
    staleTime: 60 * 1000,
  });
}
