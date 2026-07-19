import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  systemService,
  type NotifCategory,
  type NotifPriority,
} from "@/services/system.service";

export const systemKeys = {
  marketplace: ["system", "marketplace"] as const,
  plan: ["system", "plan"] as const,
  invoices: ["system", "invoices"] as const,
  services: ["system", "services"] as const,
  metrics: ["system", "metrics"] as const,
  apiKeys: ["system", "apiKeys"] as const,
  webhooks: ["system", "webhooks"] as const,
  integrations: ["system", "integrations"] as const,
  notifications: (f?: { category?: NotifCategory; priority?: NotifPriority; unreadOnly?: boolean }) =>
    ["system", "notifications", f] as const,
  help: ["system", "help"] as const,
};

export const useMarketplace = () =>
  useQuery({ queryKey: systemKeys.marketplace, queryFn: () => systemService.listMarketplace() });

export const useToggleFeature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) => systemService.toggleFeature(id, enable),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemKeys.marketplace }),
  });
};

export const usePlan = () => useQuery({ queryKey: systemKeys.plan, queryFn: () => systemService.getPlan() });
export const useInvoices = () => useQuery({ queryKey: systemKeys.invoices, queryFn: () => systemService.listInvoices() });

export const useServices = () =>
  useQuery({ queryKey: systemKeys.services, queryFn: () => systemService.listServices(), refetchInterval: 15_000 });
export const useSystemMetrics = () =>
  useQuery({ queryKey: systemKeys.metrics, queryFn: () => systemService.systemMetrics(), refetchInterval: 30_000 });

export const useApiKeys = () => useQuery({ queryKey: systemKeys.apiKeys, queryFn: () => systemService.listApiKeys() });
export const useCreateApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, scopes }: { name: string; scopes: string[] }) => systemService.createApiKey(name, scopes),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemKeys.apiKeys }),
  });
};
export const useRevokeApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => systemService.revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemKeys.apiKeys }),
  });
};
export const useRotateApiKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => systemService.rotateApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemKeys.apiKeys }),
  });
};

export const useWebhooks = () => useQuery({ queryKey: systemKeys.webhooks, queryFn: () => systemService.listWebhooks() });
export const useCreateWebhook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, events }: { url: string; events: string[] }) => systemService.createWebhook(url, events),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemKeys.webhooks }),
  });
};
export const useDeleteWebhook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => systemService.deleteWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: systemKeys.webhooks }),
  });
};

export const useIntegrations = () =>
  useQuery({ queryKey: systemKeys.integrations, queryFn: () => systemService.listIntegrations() });

export const useNotifCenter = (filters?: { category?: NotifCategory; priority?: NotifPriority; unreadOnly?: boolean }) =>
  useQuery({ queryKey: systemKeys.notifications(filters), queryFn: () => systemService.listNotifications(filters) });

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => systemService.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system", "notifications"] }),
  });
};

export const useHelp = () => useQuery({ queryKey: systemKeys.help, queryFn: () => systemService.listHelp() });
