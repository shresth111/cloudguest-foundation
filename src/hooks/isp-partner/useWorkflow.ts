/** RAKESH-FS: workflow features. `on` is false while the BE flag is off
 * (404), and then every form keeps its old behaviour (MB, no router zones). */
import { useQuery } from "@tanstack/react-query";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { workflowService } from "@/services/isp-partner/workflow";

export const workflowKeys = {
  features: ["isp", "workflow", "features"] as const,
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
