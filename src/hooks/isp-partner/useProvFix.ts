/** PROV-FIX queries. A 404 (flag off) resolves to `null`: callers then keep
 * the console exactly as it was. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { provFixService } from "@/services/isp-partner/provfix";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorStatus } from "@/lib/isp-partner/errors";

export const provFixKeys = {
  features: ["isp", "setup-fixes"] as const,
  monitoring: (id: string) => ["isp", "monitoring", id] as const,
  packagePolicies: ["isp", "package-policy-summaries"] as const,
  setupAccess: (id: string) => ["isp", "setup-access", id] as const,
};

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (ispErrorStatus(e) === 404) return null;
    throw e;
  }
}

export function useProvFixFeatures() {
  return useQuery({
    queryKey: provFixKeys.features,
    queryFn: () => orNull(provFixService.features()),
    retry: retryUnless4xx,
    staleTime: 5 * 60_000,
  });
}

/** FR-GENERATE: may this caller Generate on this router? `null` = the
 * backend has no probe (older build): keep showing Generate as before. */
export function useSetupAccess(ispRouterId: string) {
  return useQuery({
    queryKey: provFixKeys.setupAccess(ispRouterId),
    queryFn: () => orNull(provFixService.setupAccess(ispRouterId)),
    retry: retryUnless4xx,
    staleTime: 60_000,
  });
}

/** [POSTFIX-1] FUP + validity start for the package list, keyed by package
 * id. `available` is false while the flag is off (404): the list then shows
 * exactly what it showed before. */
export function usePackagePolicySummaries() {
  const q = useQuery({
    queryKey: provFixKeys.packagePolicies,
    queryFn: () => orNull(provFixService.packagePolicySummaries()),
    retry: retryUnless4xx,
    staleTime: 60_000,
  });
  const map = new Map((q.data?.items ?? []).map((i) => [i.package_id, i]));
  return { available: !!q.data, map };
}

export function useRouterMonitoring(routerId: string, enabled: boolean) {
  return useQuery({
    queryKey: provFixKeys.monitoring(routerId),
    queryFn: () => orNull(provFixService.monitoring(routerId)),
    retry: retryUnless4xx,
    enabled: enabled && !!routerId,
    refetchInterval: 60_000,
  });
}

export function useRouterMonitoringToggle(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => provFixService.setMonitoring(routerId, on),
    onSuccess: (data) => {
      qc.setQueryData(provFixKeys.monitoring(routerId), data);
      void qc.invalidateQueries({ queryKey: ["isp", "netmon"] });
    },
  });
}
