/** ADDENDUM_05 JAZE-1 hooks. Every mutation also refreshes the plans
 * subscriber list and invoices (renew/revert touch both). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribers360Service } from "@/services/isp-partner/subscribers360";
import type { DirectoryQuery } from "@/services/isp-partner/subscribers360-types";

export const sub360Keys = {
  all: ["isp", "sub360"] as const,
  directory: (q: object) => ["isp", "sub360", "directory", q] as const,
  typeahead: (q: string) => ["isp", "sub360", "typeahead", q] as const,
  one: (id: string) => ["isp", "sub360", "one", id] as const,
  ledger: (id: string) => ["isp", "sub360", "ledger", id] as const,
  circuit: ["isp", "sub360", "circuit-next"] as const,
};

export function useSubscriberDirectory(q: DirectoryQuery) {
  return useQuery({
    queryKey: sub360Keys.directory(q),
    queryFn: () => subscribers360Service.directory(q),
    placeholderData: keepPreviousData,
  });
}

export function useSubscriberTypeahead(q: string) {
  return useQuery({
    queryKey: sub360Keys.typeahead(q),
    queryFn: () => subscribers360Service.typeahead(q),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useSubscriber360(id: string | null) {
  return useQuery({
    queryKey: sub360Keys.one(id ?? ""),
    queryFn: () => subscribers360Service.get(id as string),
    enabled: !!id,
  });
}

export function useSubscriberLedger(id: string | null) {
  return useQuery({
    queryKey: sub360Keys.ledger(id ?? ""),
    queryFn: () => subscribers360Service.ledger(id as string),
    enabled: !!id,
  });
}

export function useNextCircuitId(enabled: boolean) {
  return useQuery({
    queryKey: sub360Keys.circuit,
    queryFn: () => subscribers360Service.nextCircuitId(),
    enabled,
    staleTime: 0,
  });
}

export function useSub360Mutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sub360Keys.all });
      qc.invalidateQueries({ queryKey: ["isp", "plans"] });
      qc.invalidateQueries({ queryKey: ["isp", "billing"] });
    },
  });
}
