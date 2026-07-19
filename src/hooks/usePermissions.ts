import { useQuery } from "@tanstack/react-query";
import { permissionsService } from "@/services/permissions.service";
import { useAuth } from "@/context/AuthContext";
import type { ModuleId, PermissionMap } from "@/types/permissions";

export const permissionKeys = {
  me: (role: string) => ["permissions", role] as const,
};

export function usePermissions() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: permissionKeys.me(user?.role ?? "anon"),
    queryFn: () => permissionsService.getPermissions(user!.role),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const modules: PermissionMap = q.data?.modules ?? {};
  const can = (id: ModuleId) => !!modules[id]?.view;
  const isLocked = (id: ModuleId) => !!modules[id]?.locked;
  const isVisible = (id: ModuleId) => can(id) || isLocked(id);

  return { modules, can, isLocked, isVisible, isLoading: q.isLoading };
}
