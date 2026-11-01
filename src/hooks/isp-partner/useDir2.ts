/** DIR-2: is the bulk/export surface on (BE flag)? 404 -> hidden. */
import { useQuery } from "@tanstack/react-query";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { dir2Service } from "@/services/isp-partner/dir2";

export function useDir2Available(): { available: boolean; max: number } {
  const q = useQuery({
    queryKey: ["isp", "dir2", "capabilities"],
    queryFn: () => dir2Service.capabilities(),
    retry: retryUnless4xx,
    staleTime: 300_000,
  });
  return { available: q.isSuccess, max: q.data?.max_subscribers ?? 500 };
}
