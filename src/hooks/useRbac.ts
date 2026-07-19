import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rbacService } from "@/services/rbac.service";
import type { RbacUser, RbacRole } from "@/types/rbac";

const KEYS = {
  kpis: ["rbac", "kpis"] as const,
  users: ["rbac", "users"] as const,
  roles: ["rbac", "roles"] as const,
  departments: ["rbac", "departments"] as const,
  groups: ["rbac", "groups"] as const,
  invitations: ["rbac", "invitations"] as const,
  sessions: ["rbac", "sessions"] as const,
  loginHistory: ["rbac", "login-history"] as const,
  locationTree: ["rbac", "locations"] as const,
  organizations: ["rbac", "organizations"] as const,
  passwordPolicy: ["rbac", "password-policy"] as const,
  mfa: ["rbac", "mfa"] as const,
};

export const useRbacKpis = () => useQuery({ queryKey: KEYS.kpis, queryFn: rbacService.getKpis });
export const useRbacUsers = () => useQuery({ queryKey: KEYS.users, queryFn: rbacService.getUsers });
export const useRbacRoles = () => useQuery({ queryKey: KEYS.roles, queryFn: rbacService.getRoles });
export const useRbacDepartments = () => useQuery({ queryKey: KEYS.departments, queryFn: rbacService.getDepartments });
export const useRbacGroups = () => useQuery({ queryKey: KEYS.groups, queryFn: rbacService.getGroups });
export const useRbacInvitations = () => useQuery({ queryKey: KEYS.invitations, queryFn: rbacService.getInvitations });
export const useRbacSessions = () => useQuery({ queryKey: KEYS.sessions, queryFn: rbacService.getSessions });
export const useRbacLoginHistory = () => useQuery({ queryKey: KEYS.loginHistory, queryFn: rbacService.getLoginHistory });
export const useRbacLocationTree = () => useQuery({ queryKey: KEYS.locationTree, queryFn: rbacService.getLocationTree });
export const useRbacOrganizations = () => useQuery({ queryKey: KEYS.organizations, queryFn: rbacService.getOrganizations });
export const useRbacPasswordPolicy = () => useQuery({ queryKey: KEYS.passwordPolicy, queryFn: rbacService.getPasswordPolicy });
export const useRbacMfa = () => useQuery({ queryKey: KEYS.mfa, queryFn: rbacService.getMfaState });

export function useInvalidateRbac() {
  const qc = useQueryClient();
  return (scope: keyof typeof KEYS = "users") => {
    qc.invalidateQueries({ queryKey: KEYS[scope] });
    qc.invalidateQueries({ queryKey: KEYS.kpis });
  };
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Parameters<typeof rbacService.createUser>[0] & { id?: string }) => {
      if (payload.id) return rbacService.updateUser(payload.id, payload as Partial<RbacUser>);
      return rbacService.createUser(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.users });
      qc.invalidateQueries({ queryKey: KEYS.kpis });
    },
  });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: RbacRole) => rbacService.saveRole(role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.roles });
      qc.invalidateQueries({ queryKey: KEYS.kpis });
    },
  });
}
