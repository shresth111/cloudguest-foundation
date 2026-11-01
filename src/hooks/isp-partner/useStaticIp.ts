/** STATICIP-2 query keys + "is the ledger API on" probe (BE flag). */
import { useQuery } from "@tanstack/react-query";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { staticIpService } from "@/services/isp-partner/staticip";

export const staticIpKeys = { all: ["isp", "static-ips"] as const };

/** True once the ledger API has answered (flag on). */
export function useStaticIpLedgerAvailable(): boolean {
  const q = useQuery({
    queryKey: [...staticIpKeys.all, "probe"],
    queryFn: () => staticIpService.ledger({ page: 1, page_size: 1 }),
    retry: retryUnless4xx,
    staleTime: 60_000,
  });
  return q.isSuccess;
}
