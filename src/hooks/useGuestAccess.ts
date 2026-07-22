import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestAccessService } from "@/services/guest-access.service";
import type {
  AccessCheckQuery,
  CreateDeviceRulePayload,
  CreateGuestRulePayload,
} from "@/types/guest-access";

export const guestAccessKeys = {
  guestRules: ["guest-access", "guest-rules"] as const,
  deviceRules: ["guest-access", "device-rules"] as const,
  kpis: ["guest-access", "kpis"] as const,
  organizations: ["guest-access", "organizations"] as const,
};

export const useGuestAccessRules = () =>
  useQuery({ queryKey: guestAccessKeys.guestRules, queryFn: guestAccessService.listGuestRules });

export const useDeviceAccessRules = () =>
  useQuery({ queryKey: guestAccessKeys.deviceRules, queryFn: guestAccessService.listDeviceRules });

export const useGuestAccessKpis = () =>
  useQuery({ queryKey: guestAccessKeys.kpis, queryFn: guestAccessService.kpis });

export const useGuestAccessOrganizations = () =>
  useQuery({ queryKey: guestAccessKeys.organizations, queryFn: guestAccessService.organizations });

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: guestAccessKeys.guestRules });
  qc.invalidateQueries({ queryKey: guestAccessKeys.deviceRules });
  qc.invalidateQueries({ queryKey: guestAccessKeys.kpis });
}

export function useCreateGuestRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGuestRulePayload) => guestAccessService.createGuestRule(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateDeviceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDeviceRulePayload) => guestAccessService.createDeviceRule(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeactivateGuestRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId: string }) =>
      guestAccessService.deactivateGuestRule(id, organizationId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteGuestRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId: string }) =>
      guestAccessService.deleteGuestRule(id, organizationId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeactivateDeviceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId: string }) =>
      guestAccessService.deactivateDeviceRule(id, organizationId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteDeviceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId: string }) =>
      guestAccessService.deleteDeviceRule(id, organizationId),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCheckAccess() {
  return useMutation({
    mutationFn: (query: AccessCheckQuery) => guestAccessService.checkAccess(query),
  });
}
