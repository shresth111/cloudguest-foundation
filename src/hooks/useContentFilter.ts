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
 * Takes the id in an object (not bare) so callers can thread the
 * location-scoped `organizationId` the endpoint's tenant scoping needs --
 * same shape as `usePushDhcpPool`. The row-scoped spinner in
 * ContentFilterManagement reads `push.variables?.id`, which is why the
 * variables stay an object rather than a bare string. */
export function usePushContentFilterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      contentFilterService.push(id, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-filter", "list"] }),
  });
}

export function useUpdateContentFilterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      organizationId,
    }: {
      id: string;
      payload: UpdateContentFilterRulePayload;
      organizationId?: string;
    }) => contentFilterService.update(id, payload, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-filter", "list"] }),
  });
}

export function useDeleteContentFilterRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      contentFilterService.remove(id, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-filter", "list"] }),
  });
}
