import { useQuery } from "@tanstack/react-query";
import { permissionsService } from "@/services/permissions.service";
import { useAuth } from "@/context/AuthContext";
import type {
  FeatureFlag,
  ModuleId,
  PermissionAction,
  PermissionEnvelope,
  PermissionMap,
  RouterAction,
  SidebarGroupDef,
} from "@/types/permissions";

const ACTIVE_LOC_KEY = "cg.workspace.activeLoc";

export const permissionKeys = {
  me: (role: string, locationId: string) => ["permissions", role, locationId] as const,
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

export function usePermissions() {
  const { user } = useAuth();
  const locationId = readActiveLocation();
  const q = useQuery({
    queryKey: permissionKeys.me(user?.role ?? "anon", locationId),
    queryFn: () => permissionsService.getPermissions(user!.role, locationId),
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
