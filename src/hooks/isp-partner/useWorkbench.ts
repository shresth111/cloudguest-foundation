/** SUB360-2 queries. Keys sit under ["isp", "sub360"] so every existing 360
 * mutation (renew, block, ...) refreshes the workbench too. */
import { useQuery } from "@tanstack/react-query";
import { helpdeskService, workbenchService } from "@/services/isp-partner/workbench";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorStatus } from "@/lib/isp-partner/errors";

export const workbenchKeys = {
  one: (id: string) => ["isp", "sub360", "workbench", id] as const,
  ticketTypes: ["isp", "sub360", "ticket-types"] as const,
};

export function useWorkbench(subscriberId: string) {
  const q = useQuery({
    queryKey: workbenchKeys.one(subscriberId),
    queryFn: () => workbenchService.get(subscriberId),
    retry: retryUnless4xx,
    refetchInterval: 30_000,
  });
  /** 404: the workbench flag is off (or the subscriber is out of scope, in
   * which case the 360 page itself already shows the error). */
  const off = ispErrorStatus(q.error) === 404 || ispErrorStatus(q.error) === 403;
  return { ...q, off, on: !!q.data };
}

export function useTicketTypes(enabled: boolean) {
  return useQuery({
    queryKey: workbenchKeys.ticketTypes,
    queryFn: () => helpdeskService.types(),
    retry: retryUnless4xx,
    enabled,
    staleTime: 5 * 60_000,
  });
}
