import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rbacService } from "@/services/rbac.service";
import type {
  AssignRolePayload,
  CloneRolePayload,
  CreateRolePayload,
  CreateUserPayload,
  InviteUserPayload,
  LoginAttemptListQuery,
  UpdateRolePayload,
  UpdateUserPayload,
  UserListQuery,
} from "@/types/rbac";

export const rbacKeys = {
  kpis: ["rbac", "kpis"] as const,
  users: (q: UserListQuery) => ["rbac", "users", q] as const,
  user: (id: string) => ["rbac", "user", id] as const,
  roles: ["rbac", "roles"] as const,
  permissionGroups: ["rbac", "permission-groups"] as const,
  permissions: (groupId?: string) => ["rbac", "permissions", groupId] as const,
  loginAttempts: (q: LoginAttemptListQuery) => ["rbac", "login-attempts", q] as const,
  userPermissions: (userId: string) => ["rbac", "user-permissions", userId] as const,
  userRoleAssignments: (userId: string) => ["rbac", "user-role-assignments", userId] as const,
  organizations: ["rbac", "organizations"] as const,
  locations: ["rbac", "locations"] as const,
};

// -- KPIs ---------------------------------------------------------------------

export const useRbacKpis = () =>
  useQuery({ queryKey: rbacKeys.kpis, queryFn: rbacService.getKpis });

// -- Users --------------------------------------------------------------------

export const useRbacUsers = (q: UserListQuery) =>
  useQuery({ queryKey: rbacKeys.users(q), queryFn: () => rbacService.listUsers(q) });

export const useRbacUserDetail = (id: string) =>
  useQuery({
    queryKey: rbacKeys.user(id),
    queryFn: () => rbacService.getUserDetail(id),
    enabled: !!id,
  });

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => rbacService.createUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac", "users"] });
      qc.invalidateQueries({ queryKey: rbacKeys.kpis });
    },
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => rbacService.inviteUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac", "users"] });
      qc.invalidateQueries({ queryKey: rbacKeys.kpis });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      rbacService.updateUser(id, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["rbac", "users"] });
      qc.invalidateQueries({ queryKey: rbacKeys.user(vars.id) });
    },
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rbacService.activateUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac", "users"] });
      qc.invalidateQueries({ queryKey: rbacKeys.kpis });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rbacService.deactivateUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac", "users"] });
      qc.invalidateQueries({ queryKey: rbacKeys.kpis });
    },
  });
}

// -- Permissions / Permission Groups -----------------------------------------

export const useRbacPermissionGroups = () =>
  useQuery({ queryKey: rbacKeys.permissionGroups, queryFn: rbacService.listPermissionGroups });

export const useRbacPermissions = (groupId?: string) =>
  useQuery({
    queryKey: rbacKeys.permissions(groupId),
    queryFn: () => rbacService.listPermissions(groupId),
  });

// -- Roles ----------------------------------------------------------------

export const useRbacRoles = () =>
  useQuery({ queryKey: rbacKeys.roles, queryFn: rbacService.listRoles });

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => rbacService.createRole(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.roles });
      qc.invalidateQueries({ queryKey: rbacKeys.kpis });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) =>
      rbacService.updateRole(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: rbacKeys.roles }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rbacService.deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.roles });
      qc.invalidateQueries({ queryKey: rbacKeys.kpis });
    },
  });
}

export function useCloneRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CloneRolePayload }) =>
      rbacService.cloneRole(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rbacKeys.roles });
      qc.invalidateQueries({ queryKey: rbacKeys.kpis });
    },
  });
}

export function useSetRoleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? rbacService.activateRole(id) : rbacService.deactivateRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: rbacKeys.roles }),
  });
}

export function useAttachRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionKey }: { roleId: string; permissionKey: string }) =>
      rbacService.attachRolePermission(roleId, permissionKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: rbacKeys.roles }),
  });
}

export function useDetachRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionKey }: { roleId: string; permissionKey: string }) =>
      rbacService.detachRolePermission(roleId, permissionKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: rbacKeys.roles }),
  });
}

// -- Role assignment (scoped, per user) --------------------------------------

export const useUserRoleAssignments = (userId: string) =>
  useQuery({
    queryKey: rbacKeys.userRoleAssignments(userId),
    queryFn: () => rbacService.listUserRoleAssignments(userId),
    enabled: !!userId,
  });

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AssignRolePayload }) =>
      rbacService.assignRole(userId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: rbacKeys.userRoleAssignments(vars.userId) });
      qc.invalidateQueries({ queryKey: rbacKeys.user(vars.userId) });
      qc.invalidateQueries({ queryKey: rbacKeys.userPermissions(vars.userId) });
    },
  });
}

export function useRevokeRoleAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, assignmentId }: { userId: string; assignmentId: string }) =>
      rbacService.revokeRoleAssignment(userId, assignmentId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: rbacKeys.userRoleAssignments(vars.userId) });
      qc.invalidateQueries({ queryKey: rbacKeys.user(vars.userId) });
      qc.invalidateQueries({ queryKey: rbacKeys.userPermissions(vars.userId) });
    },
  });
}

export const useUserPermissions = (userId: string) =>
  useQuery({
    queryKey: rbacKeys.userPermissions(userId),
    queryFn: () => rbacService.getUserPermissions(userId),
    enabled: !!userId,
  });

// -- Login attempts -----------------------------------------------------------

export const useLoginAttempts = (q: LoginAttemptListQuery) =>
  useQuery({
    queryKey: rbacKeys.loginAttempts(q),
    queryFn: () => rbacService.listLoginAttempts(q),
  });

// -- Organizations / locations (pickers) --------------------------------------

export const useRbacOrganizations = () =>
  useQuery({
    queryKey: rbacKeys.organizations,
    queryFn: rbacService.organizations,
    staleTime: 60_000,
  });

export const useRbacLocations = () =>
  useQuery({ queryKey: rbacKeys.locations, queryFn: rbacService.locations, staleTime: 60_000 });
