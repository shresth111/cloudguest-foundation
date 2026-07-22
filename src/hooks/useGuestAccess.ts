import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestService } from "@/services/guest.service";
import { organizationService } from "@/services/organization.service";
import type {
  AccessCheckQuery,
  AccessRuleType,
  DeviceAccessRule,
  GuestAccessRule,
} from "@/types/guest";

// This used to be a standalone service (guest-access.service.ts) duplicating
// guest.service.ts's already-real access-rule CRUD against the same
// /guest-access/* backend. Consolidated onto guest.service.ts -- this file
// now only adds the organizationName enrichment and KPI aggregation the
// dedicated /guests/access-rules page needs, which guest.service.ts's own
// consumers (AccessRulesPanel.tsx, embedded in guests.index.tsx) don't.

export interface EnrichedGuestAccessRule extends GuestAccessRule {
  organizationName: string;
}
export interface EnrichedDeviceAccessRule extends DeviceAccessRule {
  organizationName: string;
}

async function fetchEnrichedRules(): Promise<{
  guest: EnrichedGuestAccessRule[];
  device: EnrichedDeviceAccessRule[];
}> {
  const [rules, orgs] = await Promise.all([
    guestService.listAccessRules(),
    organizationService.list({ page: 1, pageSize: 100 }),
  ]);
  const nameById = new Map(orgs.rows.map((o) => [o.id, o.name]));
  const guest = rules
    .filter((r): r is GuestAccessRule & { kind: "identifier" } => r.kind === "identifier")
    .map((r) => ({ ...r, organizationName: nameById.get(r.organizationId) ?? "—" }));
  const device = rules
    .filter((r): r is DeviceAccessRule & { kind: "device" } => r.kind === "device")
    .map((r) => ({ ...r, organizationName: nameById.get(r.organizationId) ?? "—" }));
  return { guest, device };
}

export const guestAccessKeys = {
  rules: ["guest-access", "rules"] as const,
  organizations: ["guest-access", "organizations"] as const,
};

export const useGuestAccessRules = () =>
  useQuery({
    queryKey: guestAccessKeys.rules,
    queryFn: fetchEnrichedRules,
    select: (data) => data.guest,
  });

export const useDeviceAccessRules = () =>
  useQuery({
    queryKey: guestAccessKeys.rules,
    queryFn: fetchEnrichedRules,
    select: (data) => data.device,
  });

export const useGuestAccessKpis = () =>
  useQuery({
    queryKey: guestAccessKeys.rules,
    queryFn: fetchEnrichedRules,
    select: (data) => ({
      totalGuestRules: data.guest.length,
      totalDeviceRules: data.device.length,
      activeRules: [...data.guest, ...data.device].filter((r) => r.isActive).length,
      vipCount: [...data.guest, ...data.device].filter((r) => r.ruleType === "vip").length,
    }),
  });

export const useGuestAccessOrganizations = () =>
  useQuery({
    queryKey: guestAccessKeys.organizations,
    queryFn: async () => {
      const { rows } = await organizationService.list({ page: 1, pageSize: 100 });
      return rows.map((o) => ({ id: o.id, name: o.name }));
    },
  });

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: guestAccessKeys.rules });
}

export function useCreateGuestRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      organizationId: string;
      locationId?: string | null;
      identifier: string;
      ruleType: AccessRuleType;
      reason?: string | null;
      expiresAt?: string | null;
    }) =>
      guestService.createAccessRule({
        kind: "identifier",
        organizationId: payload.organizationId,
        locationId: payload.locationId ?? undefined,
        identifier: payload.identifier,
        ruleType: payload.ruleType,
        reason: payload.reason ?? undefined,
        expiresAt: payload.expiresAt ?? undefined,
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateDeviceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      organizationId: string;
      locationId?: string | null;
      macAddress: string;
      ruleType: AccessRuleType;
      reason?: string | null;
      expiresAt?: string | null;
    }) =>
      guestService.createAccessRule({
        kind: "device",
        organizationId: payload.organizationId,
        locationId: payload.locationId ?? undefined,
        macAddress: payload.macAddress,
        ruleType: payload.ruleType,
        reason: payload.reason ?? undefined,
        expiresAt: payload.expiresAt ?? undefined,
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeactivateGuestRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; organizationId: string }) =>
      guestService.deactivateAccessRule("identifier", id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteGuestRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; organizationId: string }) =>
      guestService.deleteAccessRule("identifier", id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeactivateDeviceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; organizationId: string }) =>
      guestService.deactivateAccessRule("device", id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteDeviceRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; organizationId: string }) =>
      guestService.deleteAccessRule("device", id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCheckAccess() {
  return useMutation({
    mutationFn: (query: AccessCheckQuery) => guestService.checkAccess(query),
  });
}
