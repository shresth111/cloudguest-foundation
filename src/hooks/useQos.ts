import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qosService } from "@/services/qos.service";
import type { CreateQosRulePayload, QosListQuery, UpdateQosRulePayload } from "@/types/qos";

export const qosKeys = {
  list: (q: QosListQuery) => ["qos", "list", q] as const,
};

export const useQosRules = (q: QosListQuery, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: qosKeys.list(q),
    queryFn: () => qosService.list(q),
    enabled: options?.enabled,
  });

export function useCreateQosRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQosRulePayload) => qosService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qos", "list"] }),
  });
}

export function useUpdateQosRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      organizationId,
    }: {
      id: string;
      payload: UpdateQosRulePayload;
      organizationId?: string;
    }) => qosService.update(id, payload, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qos", "list"] }),
  });
}

export function useDeleteQosRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      qosService.remove(id, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qos", "list"] }),
  });
}

export function usePushQosRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      qosService.push(id, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qos", "list"] }),
  });
}
