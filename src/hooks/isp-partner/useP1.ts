/** RAKESH-P1: each `available` is false while its BE flag is off (404), and
 * the UI then hides the matching field or button (old behaviour). */
import { useQuery } from "@tanstack/react-query";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import {
  p1Service,
  type CycleBasis,
  type TemplateDeviceRules,
  type ZoneCouponRight,
} from "@/services/isp-partner/p1";

export const p1Keys = {
  templateRules: ["isp", "p1", "template-rules"] as const,
  cycleBasis: ["isp", "p1", "cycle-basis"] as const,
  couponRights: ["isp", "p1", "zone-coupon-rights"] as const,
};

export function useTemplateRulesMap(enabled = true) {
  const q = useQuery({
    queryKey: p1Keys.templateRules,
    queryFn: () => p1Service.listTemplateRules(),
    retry: retryUnless4xx,
    staleTime: 60_000,
    enabled,
  });
  const map = new Map<string, TemplateDeviceRules>();
  for (const r of q.data ?? []) map.set(r.speed_group_id, r);
  return { available: q.isSuccess, map, query: q };
}

export function useCycleBasisMap(enabled = true) {
  const q = useQuery({
    queryKey: p1Keys.cycleBasis,
    queryFn: () => p1Service.listCycleBasis(),
    retry: retryUnless4xx,
    staleTime: 60_000,
    enabled,
  });
  const map = new Map<string, CycleBasis>();
  for (const r of q.data ?? []) map.set(r.package_id, r.basis);
  return { available: q.isSuccess, map, query: q };
}

export function useZoneCouponRights(enabled = true) {
  const q = useQuery({
    queryKey: p1Keys.couponRights,
    queryFn: () => p1Service.listZoneCouponRights(),
    retry: retryUnless4xx,
    staleTime: 60_000,
    enabled,
  });
  const map = new Map<string, ZoneCouponRight>();
  for (const r of q.data ?? []) map.set(r.zone_id, r);
  return { available: q.isSuccess, map, query: q };
}
