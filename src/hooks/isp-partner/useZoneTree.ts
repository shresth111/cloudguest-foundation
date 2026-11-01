/** ZONE-1 queries, the selected-zone hook and the request interceptor. */
import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { zoneTreeService } from "@/services/isp-partner/zones";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import {
  getZoneScope,
  setZoneScope,
  shouldScopeRequest,
  subscribeZoneScope,
} from "@/lib/isp-partner/zones";

export const zoneTreeKeys = {
  // Under ["isp", "zones"] so the Settings zone list and the tree refresh together.
  tree: ["isp", "zones", "tree"] as const,
  totals: (from: string, to: string) => ["isp", "zones", "totals", from, to] as const,
};

export function useZoneTree(enabled = true) {
  return useQuery({
    queryKey: zoneTreeKeys.tree,
    queryFn: () => zoneTreeService.tree(),
    retry: retryUnless4xx,
    enabled,
    staleTime: 60_000,
  });
}

export function useZoneTotals(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: zoneTreeKeys.totals(from, to),
    queryFn: () => zoneTreeService.totals(from, to),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useZoneTreeMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["isp", "zones"] }),
  });
}

/** The selected zone id, or null for all zones. */
export function useZoneScope(): string | null {
  return useSyncExternalStore(subscribeZoneScope, getZoneScope, () => null);
}

/** Drop every cached partner answer except the caller's identity and the zone
 * tree, so nothing from the previous zone is shown while the new one loads. */
export function resetScopedQueries(qc: QueryClient): void {
  qc.resetQueries({
    predicate: (q) => {
      const k = q.queryKey;
      if (k[0] !== "isp") return false;
      return k[1] !== "me" && k[1] !== "zones";
    },
  });
}

/** Switch the zone and refetch the page's data. */
export function switchZone(qc: QueryClient, zoneId: string | null): void {
  if (zoneId === getZoneScope()) return;
  setZoneScope(zoneId);
  resetScopedQueries(qc);
}

let installedOn: AxiosInstance | null = null;

/** Adds `scope_zone_id` to every scoped `/isp/*` request (see
 * `shouldScopeRequest`). Idempotent per client. Registered after the API
 * shim, so it runs first and only sees calls that were `/isp/*` to begin
 * with; venue-twin calls the shim rewrites are left alone. */
export function installZoneScopeInterceptor(client: AxiosInstance): void {
  if (installedOn === client) return;
  installedOn = client;
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const zone = getZoneScope();
    if (!zone || !shouldScopeRequest(config.url)) return config;
    if (config.params instanceof URLSearchParams) {
      if (!config.params.has("scope_zone_id")) config.params.append("scope_zone_id", zone);
    } else {
      const params = (config.params ?? {}) as Record<string, unknown>;
      if (params.scope_zone_id === undefined) config.params = { ...params, scope_zone_id: zone };
    }
    return config;
  });
}
