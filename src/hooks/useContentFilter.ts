import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contentFilterService } from "@/services/contentFilter.service";
import type {
  ContentFilterListQuery,
  CreateContentFilterRulePayload,
  UpdateContentFilterRulePayload,
} from "@/types/contentFilter";

export const contentFilterKeys = {
  list: (q: ContentFilterListQuery) => ["content-filter", "list", q] as const,
  apps: (routerId: string) => ["content-filter", "apps", routerId] as const,
};

export const useContentFilterRules = (q: ContentFilterListQuery, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: contentFilterKeys.list(q),
    queryFn: () => contentFilterService.list(q),
    enabled: options?.enabled,
  });

export function useCreateContentFilterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateContentFilterRulePayload) => contentFilterService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-filter", "list"] }),
  });
}

/** Sends one blocking rule to its router.
 *
 * Takes the id in an object rather than bare because the row-scoped
 * spinner in
 * ContentFilterManagement reads `push.variables?.id`, which is why the
 * variables stay an object rather than a bare string. */
export function usePushContentFilterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => contentFilterService.push(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-filter", "list"] }),
  });
}

export function useUpdateContentFilterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateContentFilterRulePayload }) =>
      contentFilterService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-filter", "list"] }),
  });
}

export function useDeleteContentFilterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => contentFilterService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-filter", "list"] }),
  });
}

export function useContentFilterApps(routerId: string, enabled = true) {
  return useQuery({
    queryKey: contentFilterKeys.apps(routerId),
    queryFn: () => contentFilterService.listApps(routerId),
    enabled: !!routerId && enabled,
    retry: false,
  });
}

/** Block (`on: false` -- the app is switched off) or unblock one app. Either
 * way the app list and the rule lists are re-read, success or failure: a
 * failed half-way block still changed rows. */
export function useToggleContentFilterApp(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appKey, block }: { appKey: string; block: boolean }) =>
      block
        ? contentFilterService.blockApp(routerId, appKey)
        : contentFilterService.unblockApp(routerId, appKey),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: contentFilterKeys.apps(routerId) });
      void qc.invalidateQueries({ queryKey: ["content-filter", "list"] });
    },
  });
}
