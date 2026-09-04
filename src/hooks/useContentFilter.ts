import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contentFilterService } from "@/services/contentFilter.service";
import type {
  ContentFilterListQuery,
  CreateContentFilterRulePayload,
  UpdateContentFilterRulePayload,
} from "@/types/contentFilter";

export const contentFilterKeys = {
  list: (q: ContentFilterListQuery) => ["content-filter", "list", q] as const,
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
