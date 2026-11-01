/** Queries/mutations for INCIDENTS-1. A 404 means the flag is off: no retry. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { incidentsService } from "@/services/isp-partner/incidents";
import type { IncidentStatus } from "@/services/isp-partner/incidents-types";

export const incidentsKeys = {
  all: ["isp", "incidents"] as const,
  health: () => ["isp", "incidents", "health"] as const,
  list: (q: object) => ["isp", "incidents", "list", q] as const,
  detail: (id: string) => ["isp", "incidents", "detail", id] as const,
};

export function useNetworkHealth() {
  return useQuery({
    queryKey: incidentsKeys.health(),
    queryFn: () => incidentsService.health(),
    retry: false,
    refetchInterval: 60_000,
  });
}

export function useIncidents(q: { status?: IncidentStatus; open_only?: boolean; page?: number }) {
  return useQuery({
    queryKey: incidentsKeys.list(q),
    queryFn: () => incidentsService.list(q),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useIncident(id: string | null) {
  return useQuery({
    queryKey: incidentsKeys.detail(id ?? ""),
    queryFn: () => incidentsService.detail(id as string),
    enabled: !!id,
    retry: false,
  });
}

export function useIncidentsMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: incidentsKeys.all }),
  });
}
