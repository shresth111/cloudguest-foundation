/** Queries and mutations for JAZE-2 (network enforcement). Keys sit under
 * `["isp", "network", ...]`, so the console-wide `["isp"]` reset covers them. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { networkService } from "@/services/isp-partner/network";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorStatus } from "@/lib/isp-partner/errors";
import type { IpBindingBody, PackagePolicyBody } from "@/services/isp-partner/network-types";

export const networkKeys = {
  all: ["isp", "network"] as const,
  policy: (packageId: string) => ["isp", "network", "policy", packageId] as const,
  subscriber: (id: string) => ["isp", "network", "subscriber", id] as const,
  fup: (id: string) => ["isp", "network", "subscriber", id, "fup"] as const,
  macs: (id: string) => ["isp", "network", "subscriber", id, "macs"] as const,
  ips: (id: string) => ["isp", "network", "subscriber", id, "ips"] as const,
  events: (id: string) => ["isp", "network", "subscriber", id, "events"] as const,
  pools: (locationId: string) => ["isp", "network", "pools", locationId] as const,
  health: (routerId: string) => ["isp", "network", "router", routerId, "live"] as const,
  history: (routerId: string, hours: number) =>
    ["isp", "network", "router", routerId, "history", hours] as const,
  sessions: (routerId: string) => ["isp", "network", "router", routerId, "sessions"] as const,
  enforcementScript: (routerId: string) =>
    ["isp", "network", "router", routerId, "enforcement-script"] as const,
  tr069Summary: ["isp", "network", "tr069", "summary"] as const,
  optical: (cpeId: string) => ["isp", "network", "tr069", "optical", cpeId] as const,
};

/** ENFORCE-1: null while enforcement is off (the endpoint answers 404). */
export function useEnforcementSetupChunk(routerId: string) {
  return useQuery({
    queryKey: networkKeys.enforcementScript(routerId),
    queryFn: async () => {
      try {
        return await networkService.enforcementScript(routerId);
      } catch (e) {
        if (ispErrorStatus(e) === 404) return null;
        throw e;
      }
    },
    retry: retryUnless4xx,
    enabled: !!routerId,
    staleTime: 0,
    gcTime: 0,
  });
}

export function usePackagePolicy(packageId: string | null) {
  return useQuery({
    queryKey: networkKeys.policy(packageId ?? ""),
    queryFn: () => networkService.getPolicy(packageId ?? ""),
    retry: retryUnless4xx,
    enabled: !!packageId,
  });
}

export function useSavePackagePolicy(packageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PackagePolicyBody) => networkService.putPolicy(packageId, body),
    onSuccess: (data) => qc.setQueryData(networkKeys.policy(packageId), data),
  });
}

export function useFupStatus(subscriberId: string) {
  return useQuery({
    queryKey: networkKeys.fup(subscriberId),
    queryFn: () => networkService.getFup(subscriberId),
    retry: retryUnless4xx,
  });
}

export function useMacBindings(subscriberId: string) {
  return useQuery({
    queryKey: networkKeys.macs(subscriberId),
    queryFn: () => networkService.listMacs(subscriberId),
    retry: retryUnless4xx,
  });
}

export function useIpBindings(subscriberId: string) {
  return useQuery({
    queryKey: networkKeys.ips(subscriberId),
    queryFn: () => networkService.listIpBindings(subscriberId),
    retry: retryUnless4xx,
  });
}

export function useEnforcementEvents(subscriberId: string, limit = 50) {
  return useQuery({
    queryKey: [...networkKeys.events(subscriberId), limit],
    queryFn: () => networkService.listEvents(subscriberId, limit),
    retry: retryUnless4xx,
  });
}

export function useIpPools(locationId: string) {
  return useQuery({
    queryKey: networkKeys.pools(locationId),
    queryFn: () => networkService.listPools(locationId),
    retry: retryUnless4xx,
    enabled: !!locationId,
  });
}

/** Every subscriber write refreshes that subscriber's network block (FUP,
 * bindings, events all move together) and the pool counts. */
export function useSubscriberNetworkMutation<TVars, TResult>(
  subscriberId: string,
  fn: (v: TVars) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: networkKeys.subscriber(subscriberId) });
      qc.invalidateQueries({ queryKey: ["isp", "network", "pools"] });
    },
  });
}

export function useAddIpBinding(subscriberId: string) {
  return useSubscriberNetworkMutation(subscriberId, (body: IpBindingBody) =>
    networkService.addIpBinding(subscriberId, body),
  );
}

/** The live read talks to the router (about 1 s plus the API round trip), so
 * it runs only when asked: `enabled` is the "Read now" toggle. */
export function useRouterHealthLive(routerId: string, enabled: boolean) {
  return useQuery({
    queryKey: networkKeys.health(routerId),
    queryFn: () => networkService.routerHealthLive(routerId),
    retry: false,
    enabled,
    staleTime: 15_000,
  });
}

export function useRouterHistory(routerId: string, hours: number) {
  return useQuery({
    queryKey: networkKeys.history(routerId, hours),
    queryFn: () => networkService.routerHistory(routerId, hours),
    retry: retryUnless4xx,
  });
}

export function useRouterSessions(routerId: string) {
  return useQuery({
    queryKey: networkKeys.sessions(routerId),
    queryFn: () => networkService.routerSessions(routerId),
    retry: retryUnless4xx,
    refetchInterval: 60_000,
  });
}

export function useTr069Summary() {
  return useQuery({
    queryKey: networkKeys.tr069Summary,
    queryFn: () => networkService.tr069Summary(),
    retry: retryUnless4xx,
    refetchInterval: 60_000,
  });
}

export function useTr069Optical(cpeId: string) {
  return useQuery({
    queryKey: networkKeys.optical(cpeId),
    queryFn: () => networkService.tr069Optical(cpeId),
    retry: retryUnless4xx,
  });
}
