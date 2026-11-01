/** Queries/mutations for COLLECTIONS-1. A 404 means ISP_COLLECTIONS_ENABLED
 * is off: no retry. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collectionsService } from "@/services/isp-partner/collections";
import type {
  HandoverStatus,
  OverdueQuery,
  PartyRef,
  PromiseStatus,
} from "@/services/isp-partner/collections-types";

export const collectionsKeys = {
  all: ["isp", "collections"] as const,
  overdue: (q: OverdueQuery) => ["isp", "collections", "overdue", q] as const,
  forecast: () => ["isp", "collections", "forecast"] as const,
  timeline: (p: PartyRef) => ["isp", "collections", "timeline", p] as const,
  promises: (q: object) => ["isp", "collections", "promises", q] as const,
  myCash: (d: string | undefined) => ["isp", "collections", "cash", d ?? "today"] as const,
  handovers: (q: object) => ["isp", "collections", "handovers", q] as const,
  handover: (id: string) => ["isp", "collections", "handover", id] as const,
};

export function useOverdue(q: OverdueQuery) {
  return useQuery({
    queryKey: collectionsKeys.overdue(q),
    queryFn: () => collectionsService.overdue(q),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useForecast(enabled = true) {
  return useQuery({
    queryKey: collectionsKeys.forecast(),
    queryFn: () => collectionsService.forecast(),
    enabled,
    retry: false,
  });
}

export function useTimeline(party: PartyRef | null) {
  return useQuery({
    queryKey: collectionsKeys.timeline(party ?? { subscriber_id: "" }),
    queryFn: () => collectionsService.timeline(party as PartyRef),
    enabled: !!party,
    retry: false,
  });
}

export function usePromises(q: {
  status?: PromiseStatus;
  due?: "today" | "week" | "missed";
  page?: number;
}) {
  return useQuery({
    queryKey: collectionsKeys.promises(q),
    queryFn: () => collectionsService.promises({ ...q, page_size: 50 }),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useMyCash(date: string | undefined, enabled = true) {
  return useQuery({
    queryKey: collectionsKeys.myCash(date),
    queryFn: () => collectionsService.myCash(date),
    enabled,
    retry: false,
  });
}

export function useHandovers(q: { status?: HandoverStatus; page?: number }, enabled = true) {
  return useQuery({
    queryKey: collectionsKeys.handovers(q),
    queryFn: () => collectionsService.handovers({ ...q, page_size: 50 }),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useHandover(id: string | null) {
  return useQuery({
    queryKey: collectionsKeys.handover(id ?? ""),
    queryFn: () => collectionsService.handover(id as string),
    enabled: !!id,
    retry: false,
  });
}

/** Any write refreshes every collections view (lists are small). */
export function useCollectionsMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionsKeys.all }),
  });
}
