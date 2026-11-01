/** Queries/mutations for PPPoE (lane JAZE-6). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pppoeService } from "@/services/isp-partner/pppoe";
import type { PppoeScriptParams, PppoeSessionQuery } from "@/services/isp-partner/pppoe-types";
import { isNotFound } from "@/lib/isp-partner/errors";

export const pppoeKeys = {
  all: ["isp", "pppoe"] as const,
  status: ["isp", "pppoe", "status"] as const,
  credential: (id: string) => ["isp", "pppoe", "credential", id] as const,
  sessions: (q: PppoeSessionQuery) => ["isp", "pppoe", "sessions", q] as const,
  script: (id: string, p: PppoeScriptParams) => ["isp", "pppoe", "script", id, p] as const,
};

/** 404 = feature off: no retry, the caller shows "not switched on". */
export function usePppoeStatus(enabled = true) {
  return useQuery({
    queryKey: pppoeKeys.status,
    queryFn: () => pppoeService.status(),
    enabled,
    retry: (n, err) => !isNotFound(err) && n < 2,
    staleTime: 5 * 60_000,
  });
}

export function usePppoeCredential(subscriberId: string | null, enabled = true) {
  return useQuery({
    queryKey: pppoeKeys.credential(subscriberId ?? ""),
    queryFn: () => pppoeService.credential(subscriberId as string),
    enabled: enabled && !!subscriberId,
    retry: false,
  });
}

export function usePppoeSessions(q: PppoeSessionQuery, enabled = true) {
  return useQuery({
    queryKey: pppoeKeys.sessions(q),
    queryFn: () => pppoeService.sessions(q),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    retry: false,
  });
}

/** The script carries the router's RADIUS secret: fetched on demand, never
 * kept in the cache. `params === null` = not requested. */
export function usePppoeRouterScript(routerId: string, params: PppoeScriptParams | null) {
  return useQuery({
    queryKey: pppoeKeys.script(routerId, params ?? {}),
    queryFn: () => pppoeService.routerScript(routerId, params ?? {}),
    enabled: !!routerId && params !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

export function usePppoeMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: pppoeKeys.all }),
  });
}
