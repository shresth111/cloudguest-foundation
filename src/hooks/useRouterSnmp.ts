import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RouterSnmpConfigInput } from "@/lib/router-snmp";
import { routerSnmpService } from "@/services/router-snmp.service";

export const routerSnmpKey = (routerId: string) => ["router-snmp", routerId] as const;

/** Stored config + last poll outcome. Cheap DB read; refreshed on the poll
 * cadence so "last poll" moves without a reload. */
export function useRouterSnmp(routerId: string | undefined) {
  return useQuery({
    queryKey: routerSnmpKey(routerId ?? ""),
    queryFn: () => routerSnmpService.status(routerId as string),
    enabled: !!routerId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useSaveRouterSnmp(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RouterSnmpConfigInput) => routerSnmpService.save(routerId, input),
    onSuccess: (data) => qc.setQueryData(routerSnmpKey(routerId), data),
  });
}

export function useTestRouterSnmp(routerId: string) {
  return useMutation({ mutationFn: () => routerSnmpService.test(routerId) });
}

export function useApplyRouterSnmp(routerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => routerSnmpService.apply(routerId),
    onSettled: () => qc.invalidateQueries({ queryKey: routerSnmpKey(routerId) }),
  });
}

export function useRouterSnmpScript(routerId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...routerSnmpKey(routerId), "script"],
    queryFn: () => routerSnmpService.script(routerId),
    enabled,
    retry: false,
  });
}
