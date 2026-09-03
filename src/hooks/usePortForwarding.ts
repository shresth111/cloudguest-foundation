import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portForwardingService } from "@/services/port-forwarding.service";
import type {
  CreatePortForwardingPayload,
  PortForwardingListQuery,
  UpdatePortForwardingPayload,
} from "@/types/port-forwarding";

export const portForwardingKeys = {
  list: (q: PortForwardingListQuery) => ["port-forwarding", "list", q] as const,
  kpis: (organizationId?: string) => ["port-forwarding", "kpis", organizationId] as const,
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

export const usePortForwardingKpis = (organizationId?: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: portForwardingKeys.kpis(organizationId),
    queryFn: () => portForwardingService.getKpis(organizationId),
    enabled: options?.enabled,
  });

export function useCreatePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePortForwardingPayload) => portForwardingService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
      qc.invalidateQueries({ queryKey: ["port-forwarding", "kpis"] });
    },
  });
}

/** Sends one rule to its router.
 *
 * Takes the id in an object (not bare) so callers can thread the
 * location-scoped `organizationId` the endpoint's tenant scoping needs --
 * same shape as `usePushDhcpPool`. The row-scoped spinner in
 * PortForwardingManagement reads `push.variables?.id`, which is why the
 * variables stay an object rather than a bare string. */
export function usePushPortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      portForwardingService.push(id, organizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
      qc.invalidateQueries({ queryKey: ["port-forwarding", "kpis"] });
    },
  });
}

export function useUpdatePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      organizationId,
    }: {
      id: string;
      payload: UpdatePortForwardingPayload;
      organizationId?: string;
    }) => portForwardingService.update(id, payload, organizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
      qc.invalidateQueries({ queryKey: ["port-forwarding", "kpis"] });
    },
  });
}

export function useDeletePortForwardingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      portForwardingService.remove(id, organizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["port-forwarding", "list"] });
      qc.invalidateQueries({ queryKey: ["port-forwarding", "kpis"] });
    },
  });
}
