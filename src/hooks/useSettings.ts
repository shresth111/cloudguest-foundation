import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settings.service";
import type { PlatformSettings } from "@/types/settings";

const KEY = ["settings"] as const;

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => settingsService.getAll(), staleTime: 30_000 });
}

export function useUpdateSection<K extends keyof PlatformSettings>() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { section: K; value: PlatformSettings[K] }) =>
      settingsService.updateSection(input.section, input.value),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

export function useInvalidateSettings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}
