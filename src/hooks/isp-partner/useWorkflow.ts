/** RAKESH-FS: workflow features. `on` is false while the BE flag is off
 * (404), and then every form keeps its old behaviour (MB, no router zones). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryUnless4xx, useInvalidateRouters } from "@/hooks/isp-partner/useIsp";
import type { IspRouterCreate } from "@/services/isp-partner/types";
import { workflowService } from "@/services/isp-partner/workflow";

export const workflowKeys = {
  features: ["isp", "workflow", "features"] as const,
  routerZones: (id: string) => ["isp", "workflow", "router-zones", id] as const,
  placement: (zoneId: string) => ["isp", "workflow", "placement", zoneId] as const,
  franchisees: ["isp", "workflow", "franchisees"] as const,
  zonePackages: (id: string) => ["isp", "workflow", "zone-packages", id] as const,
  routerSites: ["isp", "workflow", "franchisee-router-sites"] as const,
};

export function useWorkflowFeatures() {
  const q = useQuery({
    queryKey: workflowKeys.features,
    queryFn: () => workflowService.features(),
    retry: retryUnless4xx,
    staleTime: 5 * 60_000,
  });
  return { on: q.isSuccess, features: q.data, query: q };
}

/** True when data limits are entered/shown in GB (flag on). */
export function useGbDataLimits(): boolean {
  return useWorkflowFeatures().on;
}

export function useRouterZones(ispRouterId: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.routerZones(ispRouterId),
    queryFn: () => workflowService.routerZones(ispRouterId),
    retry: retryUnless4xx,
    enabled: enabled && !!ispRouterId,
  });
}

export function useSetRouterZones(ispRouterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneIds: string[]) => workflowService.setRouterZones(ispRouterId, zoneIds),
    onSuccess: (data) => {
      qc.setQueryData(workflowKeys.routerZones(ispRouterId), data);
      qc.invalidateQueries({ queryKey: ["isp", "workflow", "placement"] });
    },
  });
}

export function usePlacement(zoneId: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.placement(zoneId),
    queryFn: () => workflowService.placement(zoneId),
    retry: retryUnless4xx,
    enabled: enabled && !!zoneId,
  });
}

export function useFranchisees(enabled = true) {
  return useQuery({
    queryKey: workflowKeys.franchisees,
    queryFn: () => workflowService.franchisees(),
    retry: retryUnless4xx,
    enabled,
  });
}

export function useSetFranchiseeZones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; zoneIds: string[] }) =>
      workflowService.setFranchiseeZones(v.userId, v.zoneIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.franchisees }),
  });
}

export function useZonePackages(zoneId: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.zonePackages(zoneId),
    queryFn: () => workflowService.zonePackages(zoneId),
    retry: retryUnless4xx,
    enabled: enabled && !!zoneId,
  });
}

export function useSetZonePackages(zoneId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => workflowService.setZonePackages(zoneId, ids),
    onSuccess: (data) => qc.setQueryData(workflowKeys.zonePackages(zoneId), data),
  });
}

/** DECISIONS-1: sites inside the franchisee's zones (Add router picker). */
export function useFranchiseeRouterSites(enabled = true) {
  return useQuery({
    queryKey: workflowKeys.routerSites,
    queryFn: () => workflowService.franchiseeRouterSites(),
    retry: retryUnless4xx,
    enabled,
  });
}

/** DECISIONS-1: franchisee adds a router at one of those sites. */
export function useFranchiseeAddRouter(siteId: string) {
  const invalidate = useInvalidateRouters();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IspRouterCreate) => workflowService.franchiseeAddRouter(siteId, body),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["isp", "workflow"] });
    },
  });
}
