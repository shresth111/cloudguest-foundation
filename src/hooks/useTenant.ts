import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantService } from "@/services/tenant.service";
import type {
  ApiKeyRow,
  FeaturePolicy,
  ModuleLimits,
  NasDevice,
  NasGroup,
  NotificationChannel,
  PolicyAssignment,
  SecurityConfig,
  WebhookRow,
} from "@/types/tenant";

export const tenantKeys = {
  all: (id: string) => ["tenant", id] as const,
  config: (id: string) => ["tenant", id, "config"] as const,
  groups: (id: string) => ["tenant", id, "groups"] as const,
  nas: (id: string) => ["tenant", id, "nas"] as const,
  policies: (id: string) => ["tenant", id, "policies"] as const,
  integrations: (id: string) => ["tenant", id, "integrations"] as const,
  apiKeys: (id: string) => ["tenant", id, "apiKeys"] as const,
  webhooks: (id: string) => ["tenant", id, "webhooks"] as const,
  security: (id: string) => ["tenant", id, "security"] as const,
  notifications: (id: string) => ["tenant", id, "notifications"] as const,
  usage: (id: string) => ["tenant", id, "usage"] as const,
  audit: (id: string) => ["tenant", id, "audit"] as const,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: tenantKeys.all(id) });
}

export const useTenantConfig = (id: string) =>
  useQuery({ queryKey: tenantKeys.config(id), queryFn: () => tenantService.getConfig(id), enabled: !!id });
export const useTenantGroups = (id: string) =>
  useQuery({ queryKey: tenantKeys.groups(id), queryFn: () => tenantService.listGroups(id), enabled: !!id });
export const useTenantNas = (id: string) =>
  useQuery({ queryKey: tenantKeys.nas(id), queryFn: () => tenantService.listNas(id), enabled: !!id });
export const useTenantPolicies = (id: string) =>
  useQuery({ queryKey: tenantKeys.policies(id), queryFn: () => tenantService.listPolicies(id), enabled: !!id });
export const useTenantIntegrations = (id: string) =>
  useQuery({ queryKey: tenantKeys.integrations(id), queryFn: () => tenantService.listIntegrations(id), enabled: !!id });
export const useTenantApiKeys = (id: string) =>
  useQuery({ queryKey: tenantKeys.apiKeys(id), queryFn: () => tenantService.listApiKeys(id), enabled: !!id });
export const useTenantWebhooks = (id: string) =>
  useQuery({ queryKey: tenantKeys.webhooks(id), queryFn: () => tenantService.listWebhooks(id), enabled: !!id });
export const useTenantSecurity = (id: string) =>
  useQuery({ queryKey: tenantKeys.security(id), queryFn: () => tenantService.getSecurity(id), enabled: !!id });
export const useTenantNotifications = (id: string) =>
  useQuery({ queryKey: tenantKeys.notifications(id), queryFn: () => tenantService.getNotifications(id), enabled: !!id });
export const useTenantUsage = (id: string) =>
  useQuery({ queryKey: tenantKeys.usage(id), queryFn: () => tenantService.getUsage(id), enabled: !!id });
export const useTenantAudit = (id: string) =>
  useQuery({ queryKey: tenantKeys.audit(id), queryFn: () => tenantService.listAudit(id), enabled: !!id });

export function useTenantMutations(id: string) {
  const qc = useQueryClient();
  const done = () => invalidateAll(qc, id);
  return {
    setFeature: useMutation({
      mutationFn: (args: { key: string; status: "enabled" | "disabled" | "upgrade_required" }) =>
        tenantService.setFeatureStatus(id, args.key, args.status),
      onSuccess: done,
    }),
    setLimits: useMutation({
      mutationFn: (limits: ModuleLimits) => tenantService.setLimits(id, limits),
      onSuccess: done,
    }),
    saveGroup: useMutation({
      mutationFn: (g: Omit<NasGroup, "nasCount">) => tenantService.saveGroup(id, g),
      onSuccess: done,
    }),
    deleteGroup: useMutation({
      mutationFn: (gid: string) => tenantService.deleteGroup(id, gid),
      onSuccess: done,
    }),
    saveNas: useMutation({
      mutationFn: (n: NasDevice) => tenantService.saveNas(id, n),
      onSuccess: done,
    }),
    deleteNas: useMutation({
      mutationFn: (nid: string) => tenantService.deleteNas(id, nid),
      onSuccess: done,
    }),
    savePolicy: useMutation({
      mutationFn: (p: FeaturePolicy) => tenantService.savePolicy(id, p),
      onSuccess: done,
    }),
    deletePolicy: useMutation({
      mutationFn: (pid: string) => tenantService.deletePolicy(id, pid),
      onSuccess: done,
    }),
    assignPolicy: useMutation({
      mutationFn: (args: { policyId: string; assignment: PolicyAssignment }) =>
        tenantService.assignPolicy(id, args.policyId, args.assignment),
      onSuccess: done,
    }),
    unassignPolicy: useMutation({
      mutationFn: (args: { policyId: string; targetKey: string }) =>
        tenantService.unassignPolicy(id, args.policyId, args.targetKey),
      onSuccess: done,
    }),
    toggleIntegration: useMutation({
      mutationFn: (args: { key: string; enabled: boolean }) =>
        tenantService.toggleIntegration(id, args.key, args.enabled),
      onSuccess: done,
    }),
    createApiKey: useMutation({
      mutationFn: (args: { label: string; scopes: string[] }) =>
        tenantService.createApiKey(id, args.label, args.scopes),
      onSuccess: done,
    }),
    rotateApiKey: useMutation({
      mutationFn: (keyId: string) => tenantService.rotateApiKey(id, keyId),
      onSuccess: done,
    }),
    deleteApiKey: useMutation({
      mutationFn: (keyId: string) => tenantService.deleteApiKey(id, keyId),
      onSuccess: done,
    }),
    saveWebhook: useMutation({
      mutationFn: (w: WebhookRow) => tenantService.saveWebhook(id, w),
      onSuccess: done,
    }),
    deleteWebhook: useMutation({
      mutationFn: (wid: string) => tenantService.deleteWebhook(id, wid),
      onSuccess: done,
    }),
    setSecurity: useMutation({
      mutationFn: (cfg: SecurityConfig) => tenantService.setSecurity(id, cfg),
      onSuccess: done,
    }),
    setNotifications: useMutation({
      mutationFn: (channels: NotificationChannel[]) => tenantService.setNotifications(id, channels),
      onSuccess: done,
    }),
    apiKeyCreator: null as null | { row: ApiKeyRow; secret: string },
  };
}
