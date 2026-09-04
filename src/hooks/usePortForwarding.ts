import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portForwardingService } from "@/services/port-forwarding.service";
import type {
  CreatePortForwardingPayload,
  PortForwardingListQuery,
  UpdatePortForwardingPayload,
} from "@/types/port-forwarding";

export const portForwardingKeys = {
  list: (q: PortForwardingListQuery) => ["port-forwarding", "list", q] as const,
};

export const usePortForwardingRules = (
  q: PortForwardingListQuery,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: portForwardingKeys.list(q),
    queryFn: () => portForwardingService.list(q),
    enabled: options?.enabled,
  });

export function useCreatePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePortForwardingPayload) => portForwardingService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
    },
  });
}

/** Sends one rule to its router.
 *
 * Takes the id in an object rather than bare because the row-scoped
 * spinner in
 * PortForwardingManagement reads `push.variables?.id`, which is why the
 * variables stay an object rather than a bare string. */
export function usePushPortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => portForwardingService.push(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
    },
  });
}

export function useUpdatePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePortForwardingPayload }) =>
      portForwardingService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
    },
  });
}

export function useDeletePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => portForwardingService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
    },
  });
}
