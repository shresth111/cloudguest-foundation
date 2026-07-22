import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { networkConfigService } from "@/services/network-config.service";

const K = {
  preview: (routerId: string) => ["network-config", "preview", routerId] as const,
  versions: (routerId: string) => ["network-config", "versions", routerId] as const,
};

export const useNetworkConfigPreview = (routerId: string) =>
  useQuery({
    queryKey: K.preview(routerId),
    queryFn: () => networkConfigService.preview(routerId),
    enabled: !!routerId,
  });

export const useConfigVersions = (routerId: string) =>
  useQuery({
    queryKey: K.versions(routerId),
    queryFn: () => networkConfigService.listVersions(routerId),
    enabled: !!routerId,
  });

export const usePushNetworkConfig = (routerId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => networkConfigService.push(routerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.versions(routerId) }),
  });
};

export const useRollbackNetworkConfig = (routerId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetVersionId: string) =>
      networkConfigService.rollback(routerId, targetVersionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.versions(routerId) }),
  });
};
