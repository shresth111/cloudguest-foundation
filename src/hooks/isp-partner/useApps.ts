/** Is the JAZE-5 Apps section on for this ISP? `ISP_APPS_ENABLED` off ->
 * every /isp/apps route 404s, so the probe fails and the nav item and the
 * page hide. One cached call, only for roles that hold `isp_apps.read`. */
import { useQuery } from "@tanstack/react-query";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { appsService } from "@/services/isp-partner/apps";

export function useAppsEnabled(): { enabled: boolean; loading: boolean; error: unknown } {
  const { can } = usePartner();
  const allowed = can("isp_apps.read");
  const q = useQuery({
    queryKey: ["isp", "apps", "probe"],
    queryFn: () => appsService.probe(),
    enabled: allowed,
    retry: false,
    staleTime: 10 * 60_000,
  });
  return { enabled: allowed && q.isSuccess, loading: allowed && q.isLoading, error: q.error };
}
