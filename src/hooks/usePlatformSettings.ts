import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  platformSettingsService,
  type UpdatePlatformSettingsPayload,
} from "@/services/platformSettings.service";

export const platformSettingsKeys = {
  features: ["platform", "features"] as const,
  settings: ["platform", "settings"] as const,
  planOptions: ["platform", "plan-options"] as const,
};

/** The global feature catalog (`GET /features`), read-only. */
export const usePlatformFeatures = () =>
  useQuery({
    queryKey: platformSettingsKeys.features,
    queryFn: () => platformSettingsService.listFeatures(),
  });

/** The platform-wide new-customer defaults (`GET /system-settings`). */
export const usePlatformSettings = () =>
  useQuery({
    queryKey: platformSettingsKeys.settings,
    queryFn: () => platformSettingsService.getPlatformSettings(),
  });

/** Plan id/name options for the default-plan picker (`GET /plans`). */
export const usePlanOptions = () =>
  useQuery({
    queryKey: platformSettingsKeys.planOptions,
    queryFn: () => platformSettingsService.listPlanOptions(),
  });

export function useUpdatePlatformSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePlatformSettingsPayload) =>
      platformSettingsService.updatePlatformSettings(payload),
    onSuccess: (data) => {
      // Seed the cache with the authoritative server response and refresh.
      qc.setQueryData(platformSettingsKeys.settings, data);
      qc.invalidateQueries({ queryKey: platformSettingsKeys.settings });
    },
  });
}
