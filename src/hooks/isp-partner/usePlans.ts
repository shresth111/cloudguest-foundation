/** Queries and mutations for ADDENDUM_02 (plans, coupons, subscribers). Every
 * write invalidates `["isp", "plans"]`, which the four tabs share: counts on
 * groups and packages move when coupons or subscribers change. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plansService } from "@/services/isp-partner/plans";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";

export const planKeys = {
  all: ["isp", "plans"] as const,
  groups: (q: object) => ["isp", "plans", "groups", q] as const,
  packages: (q: object) => ["isp", "plans", "packages", q] as const,
  settings: ["isp", "plans", "settings"] as const,
  batches: (q: object) => ["isp", "plans", "batches", q] as const,
  batch: (id: string) => ["isp", "plans", "batch", id] as const,
  coupons: (id: string, q: object) => ["isp", "plans", "batch", id, "coupons", q] as const,
  subscribers: (q: object) => ["isp", "plans", "subscribers", q] as const,
  subscriber: (id: string) => ["isp", "plans", "subscriber", id] as const,
};

type Q = Record<string, string | number | boolean | undefined | null>;

export function useSpeedGroups(q: Q, enabled = true) {
  return useQuery({
    queryKey: planKeys.groups(q),
    queryFn: () => plansService.listGroups(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePackages(q: Q, enabled = true) {
  return useQuery({
    queryKey: planKeys.packages(q),
    queryFn: () => plansService.listPackages(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePlanSettings() {
  return useQuery({
    queryKey: planKeys.settings,
    queryFn: () => plansService.getPlanSettings(),
    retry: retryUnless4xx,
  });
}

export function useCouponBatches(q: Q) {
  return useQuery({
    queryKey: planKeys.batches(q),
    queryFn: () => plansService.listBatches(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useCouponBatch(id: string) {
  return useQuery({
    queryKey: planKeys.batch(id),
    queryFn: () => plansService.getBatch(id),
    retry: retryUnless4xx,
  });
}

export function useCoupons(batchId: string, q: Q) {
  return useQuery({
    queryKey: planKeys.coupons(batchId, q),
    queryFn: () => plansService.listCoupons(batchId, q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useSubscribers(q: Q) {
  return useQuery({
    queryKey: planKeys.subscribers(q),
    queryFn: () => plansService.listSubscribers(q),
    retry: retryUnless4xx,
    placeholderData: keepPreviousData,
  });
}

export function useSubscriber(id: string | null) {
  return useQuery({
    queryKey: planKeys.subscriber(id ?? ""),
    queryFn: () => plansService.getSubscriber(id ?? ""),
    retry: retryUnless4xx,
    enabled: !!id,
  });
}

/** A mutation that refreshes every plans query on success. */
export function usePlansMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: planKeys.all }),
  });
}
