import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { macAuthorizationService } from "@/services/mac-authorization.service";
import type {
  CreateMacAuthorizationPayload,
  MacAuthorizationListQuery,
  UpdateMacAuthorizationPayload,
} from "@/types/mac-authorization";

export const macAuthorizationKeys = {
  list: (q: MacAuthorizationListQuery) => ["mac-authorization", "list", q] as const,
  kpis: ["mac-authorization", "kpis"] as const,
};

export const useMacAuthorizationEntries = (q: MacAuthorizationListQuery) =>
  useQuery({
    queryKey: macAuthorizationKeys.list(q),
    queryFn: () => macAuthorizationService.list(q),
  });

export const useMacAuthorizationKpis = () =>
  useQuery({ queryKey: macAuthorizationKeys.kpis, queryFn: macAuthorizationService.getKpis });

export function useCreateMacAuthorizationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMacAuthorizationPayload) => macAuthorizationService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mac-authorization", "list"] });
      qc.invalidateQueries({ queryKey: macAuthorizationKeys.kpis });
    },
  });
}

export function useUpdateMacAuthorizationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMacAuthorizationPayload }) =>
      macAuthorizationService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mac-authorization", "list"] });
      qc.invalidateQueries({ queryKey: macAuthorizationKeys.kpis });
    },
  });
}

export function useDeleteMacAuthorizationEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => macAuthorizationService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mac-authorization", "list"] });
      qc.invalidateQueries({ queryKey: macAuthorizationKeys.kpis });
    },
  });
}
