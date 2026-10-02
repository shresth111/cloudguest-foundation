import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dnsFilteringService } from "@/services/dns-filtering.service";

export const dnsFilteringKeys = {
  categories: (locationId: string) => ["dns-filtering", "categories", locationId] as const,
  locationPolicy: (locationId: string) => ["dns-filtering", "policy", locationId] as const,
  router: (routerId: string) => ["dns-filtering", "router", routerId] as const,
};

/** Not retried: a 503 / 404 is an answer ("not set up"), not a blip. */
export function useWebCategories(locationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: dnsFilteringKeys.categories(locationId ?? ""),
    queryFn: () => dnsFilteringService.categories(locationId as string),
    enabled: !!locationId && enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useWebFilterLocationPolicy(locationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: dnsFilteringKeys.locationPolicy(locationId ?? ""),
    queryFn: () => dnsFilteringService.locationPolicy(locationId as string),
    enabled: !!locationId && enabled,
    retry: false,
  });
}

export function useSetWebFilterLocationPolicy(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryIds: number[]) =>
      dnsFilteringService.setLocationPolicy(locationId, categoryIds),
    onSuccess: (policy) => {
      qc.setQueryData(dnsFilteringKeys.locationPolicy(locationId), policy);
      // Each router's status carries the effective list too.
      void qc.invalidateQueries({ queryKey: ["dns-filtering", "router"] });
    },
  });
}

export function useWebFilterRouterStatus(routerId: string, enabled = true) {
  return useQuery({
    queryKey: dnsFilteringKeys.router(routerId),
    queryFn: () => dnsFilteringService.routerStatus(routerId),
    enabled: !!routerId && enabled,
    retry: false,
  });
}

/** Enable, disable and bypass hardening all answer with the router's new
 * status. A FAILED switch also writes status (the backend commits the
 * failure record before it raises), so the status is refetched either way. */
export function useWebFilterRouterAction(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      action: { kind: "enable" } | { kind: "disable" } | { kind: "bypass"; enabled: boolean },
    ) =>
      action.kind === "enable"
        ? dnsFilteringService.enable(routerId)
        : action.kind === "disable"
          ? dnsFilteringService.disable(routerId)
          : dnsFilteringService.setBypassHardening(routerId, action.enabled),
    onSuccess: (status) => qc.setQueryData(dnsFilteringKeys.router(routerId), status),
    onSettled: () => void qc.invalidateQueries({ queryKey: dnsFilteringKeys.router(routerId) }),
  });
}
